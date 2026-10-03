import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/my-exams';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Round 3 (Attempts + Timer + Auto-save) — GET /api/v1/exam-system/attempts/{id}
 * (ExamAttemptApiController::show -> ExamAttemptService::attemptDetail()).
 * The timer is server-truth (Phase 11: "must be enforced by the backend, do
 * NOT rely only on JavaScript") — this page counts down locally between
 * syncs purely for UX smoothness, but re-fetches attempt detail on an
 * interval and whenever the local countdown hits 0, so a server-side
 * auto-submit (expired timer, or Round 5's violation-based auto-submit)
 * is always picked up and reflected here, not just assumed client-side.
 *
 * Auto-save: PUT attempts/{id}/answers/{examQuestionId} on every answer
 * change, debounced per-question so fast typing (short_answer/essay)
 * doesn't fire a request per keystroke. An empty answer clears it (DELETE)
 * rather than saving an empty payload, matching the API's own "auto-save:
 * create/update" vs "explicit delete" split.
 *
 * Round 5 (Secure Exam Mode + Security Events) — when the exam has
 * `secure_mode_enabled`, this page gates the questions behind an explicit
 * "Enter Secure Mode" action (fullscreen request needs a user gesture in
 * every browser anyway) and then, for the rest of the attempt, listens for
 * fullscreen-exit / tab-switch / window-blur / copy-paste-cut and reports
 * each via POST attempts/{id}/security-events (ExamSecurityApiController::
 * recordEvent -> ExamSecurityService::recordClientEvent(), see
 * ExamSecurityService::CLIENT_EVENTS for the exact reportable set — this
 * page never invents an event type outside that list). Per Phase 15's own
 * docblock this is browser-level only, not real proctoring, so the banner
 * says exactly that rather than overselling it.
 *
 * Every response carries the authoritative violations_count/max_violations/
 * threshold_exceeded — if `auto_submitted` comes back true the attempt is
 * already `auto_submitted` server-side in that same request, so this page
 * just re-syncs and routes to the result page, the same as the timer
 * running out does.
 */

const SAVE_DEBOUNCE_MS = 900;
const SYNC_INTERVAL_MS = 20000;

const TYPE_LABELS = {
  mcq: 'Multiple Choice',
  multi_select: 'Multi-select',
  true_false: 'True / False',
  short_answer: 'Short Answer',
  essay: 'Essay',
};

function formatTime(totalSeconds) {
  if (totalSeconds == null) return '--:--';
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function isAnswered(question) {
  const a = question.my_answer;
  if (!a) return false;
  if (a.selected_option_ids && a.selected_option_ids.length > 0) return true;
  if (a.answer_text && a.answer_text.trim() !== '') return true;
  return false;
}

export default function StudentExamAttempt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useTranslations(translations);

  const [cur, setCur] = useState(0);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  // examQuestionId -> 'idle' | 'saving' | 'saved' | 'error'
  const [saveState, setSaveState] = useState({});
  const saveTimers = useRef({});
  const autoSubmitTriggered = useRef(false);

  const load = useCallback(() => {
    return api.get(`/api/v1/exam-system/attempts/${id}`).then((json) => {
      setAttempt(json.data);
      setSecondsLeft(json.data.time_remaining_seconds);
    });
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [load]);

  // Periodic re-sync with the server (source of truth for the timer and
  // for any server-side auto-submit that happened elsewhere).
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return undefined;
    const iv = setInterval(() => {
      load().catch(() => {});
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [attempt, load]);

  // Local 1s countdown for a smooth display between syncs.
  useEffect(() => {
    if (attempt?.status !== 'in_progress' || secondsLeft == null) return undefined;
    if (secondsLeft <= 0) {
      if (!autoSubmitTriggered.current) {
        autoSubmitTriggered.current = true;
        load().catch(() => {});
      }
      return undefined;
    }
    const timeout = setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [attempt?.status, secondsLeft, load]);

  const questions = useMemo(() => attempt?.questions || [], [attempt]);
  const answeredCount = useMemo(() => questions.filter(isAnswered).length, [questions]);
  const isActive = attempt?.status === 'in_progress';

  // ---- Round 5: Secure Exam Mode ----------------------------------
  const secureModeEnabled = attempt?.exam?.secure_mode_enabled;
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [secureModeEntered, setSecureModeEntered] = useState(false);
  const secureModeEnteredRef = useRef(false);
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const reportSecurityEvent = useCallback((eventType, metadata) => {
    if (!isActiveRef.current) return;
    api.post(`/api/v1/exam-system/attempts/${id}/security-events`, { event_type: eventType, metadata: metadata || null })
      .then((json) => {
        if (json?.data) {
          setAttempt((prev) => (prev ? { ...prev, violations_count: json.data.violations_count, violations_remaining: json.data.violations_remaining } : prev));
        }
        if (json?.data?.auto_submitted) {
          navigate(`/student/exam-attempt/${id}/result`, { replace: true });
        }
      })
      .catch(() => {});
  }, [id, navigate]);

  const handleEnterSecureMode = () => {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    Promise.resolve(req ? req.call(el) : null)
      .catch(() => {})
      .finally(() => {
        secureModeEnteredRef.current = true;
        setSecureModeEntered(true);
        reportSecurityEvent('fullscreen_entered');
      });
  };

  useEffect(() => {
    if (!secureModeEnabled || !isActive) return undefined;

    const onFullscreenChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && secureModeEnteredRef.current) reportSecurityEvent('fullscreen_exited');
    };
    const onVisibilityChange = () => {
      if (document.hidden && secureModeEnteredRef.current) reportSecurityEvent('tab_switch');
    };
    const onBlur = () => { if (secureModeEnteredRef.current) reportSecurityEvent('window_blur'); };
    const onFocus = () => { if (secureModeEnteredRef.current) reportSecurityEvent('window_focus'); };
    const onCopy = (e) => { if (secureModeEnteredRef.current) { e.preventDefault(); reportSecurityEvent('copy_attempt'); } };
    const onPaste = (e) => { if (secureModeEnteredRef.current) { e.preventDefault(); reportSecurityEvent('paste_attempt'); } };
    const onCut = (e) => { if (secureModeEnteredRef.current) { e.preventDefault(); reportSecurityEvent('cut_attempt'); } };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('cut', onCut);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('cut', onCut);
    };
  }, [secureModeEnabled, isActive, reportSecurityEvent]);

  const persistAnswer = useCallback((examQuestionId, payload) => {
    setSaveState((s) => ({ ...s, [examQuestionId]: 'saving' }));
    const isEmpty = (!payload.selected_option_ids || payload.selected_option_ids.length === 0)
      && (!payload.answer_text || payload.answer_text.trim() === '');

    const req = isEmpty
      ? api.del(`/api/v1/exam-system/attempts/${id}/answers/${examQuestionId}`)
      : api.put(`/api/v1/exam-system/attempts/${id}/answers/${examQuestionId}`, payload);

    req
      .then((json) => {
        setSaveState((s) => ({ ...s, [examQuestionId]: 'saved' }));
        if (json?.data?.time_remaining_seconds != null) {
          setSecondsLeft(json.data.time_remaining_seconds);
        }
        if (json?.data?.status && json.data.status !== 'in_progress') {
          // Server decided the attempt is no longer active (timer ran out
          // mid-save) — re-sync fully to pick up the new state.
          load().catch(() => {});
        }
      })
      .catch(() => setSaveState((s) => ({ ...s, [examQuestionId]: 'error' })));
  }, [id, load]);

  const scheduleSave = useCallback((examQuestionId, payload) => {
    clearTimeout(saveTimers.current[examQuestionId]);
    saveTimers.current[examQuestionId] = setTimeout(() => {
      persistAnswer(examQuestionId, payload);
    }, SAVE_DEBOUNCE_MS);
  }, [persistAnswer]);

  const updateLocalAnswer = useCallback((examQuestionId, patch) => {
    setAttempt((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: prev.questions.map((q) => (
          q.exam_question_id === examQuestionId
            ? { ...q, my_answer: { ...(q.my_answer || { selected_option_ids: [], answer_text: null }), ...patch } }
            : q
        )),
      };
    });
  }, []);

  const handleOptionChange = (question, optionId, multi) => {
    const current = question.my_answer?.selected_option_ids || [];
    let next;
    if (multi) {
      next = current.includes(optionId) ? current.filter((o) => o !== optionId) : [...current, optionId];
    } else {
      next = [optionId];
    }
    updateLocalAnswer(question.exam_question_id, { selected_option_ids: next });
    scheduleSave(question.exam_question_id, { selected_option_ids: next, answer_text: null });
  };

  const handleTextChange = (question, text) => {
    updateLocalAnswer(question.exam_question_id, { answer_text: text });
    scheduleSave(question.exam_question_id, { answer_text: text, selected_option_ids: null });
  };

  const doSubmit = () => {
    setSubmitting(true);
    // Flush any pending debounced saves immediately before submitting.
    Object.values(saveTimers.current).forEach(clearTimeout);
    api.post(`/api/v1/exam-system/attempts/${id}/submit`)
      .then(() => navigate(`/student/exam-attempt/${id}/result`, { replace: true }))
      .catch((err) => {
        setError(errorMessage(err));
        setSubmitting(false);
      });
  };

  const handleSubmitClick = () => {
    const unanswered = questions.length - answeredCount;
    const msg = unanswered > 0
      ? `${unanswered} ${t('unanswered question(s). Submit anyway?')}`
      : t('Submit this exam now? You will not be able to change your answers after submitting.');
    if (window.confirm(msg)) doSubmit();
  };

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p className="form-error" style={{ padding: 'var(--space-5)' }}>{error}</p>;
  if (!attempt) return null;

  if (!isActive) {
    return (
      <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 480, margin: '0 auto' }}>
        <p className="text-small" style={{ margin: 0 }}>{t('This attempt has already been submitted.')}</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/student/exam-attempt/${id}/result`)}>
          {t('View Result')}
        </button>
      </div>
    );
  }

  const timeCritical = secondsLeft != null && secondsLeft <= 60;

  if (secureModeEnabled && !secureModeEntered) {
    return (
      <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 480, margin: '0 auto', alignItems: 'center', textAlign: 'center' }}>
        <Icon name="shield" size={32} />
        <h1 className="text-h3" style={{ margin: 0 }}>{t('Secure Exam Mode')}</h1>
        <p className="text-small" style={{ margin: 0 }}>
          {t('This exam is monitored: fullscreen exits, tab switches, and copy/paste will be recorded as violations.')}
        </p>
        {attempt.exam.max_violations != null && (
          <p className="text-caption" style={{ margin: 0 }}>
            {t('Maximum violations allowed')}: {attempt.exam.max_violations}
          </p>
        )}
        <button type="button" className="btn btn-primary" onClick={handleEnterSecureMode}>
          {t('Enter Secure Mode & Continue')}
        </button>
      </div>
    );
  }

  const allowBack = !!attempt.exam.allow_back_navigation;
  const last = questions.length - 1;
  const idx = Math.min(cur, Math.max(last, 0));
  const q = questions[idx];
  const state = q ? saveState[q.exam_question_id] : null;
  const goTo = (n) => { if (n >= 0 && n <= last && (allowBack || n >= idx)) setCur(n); };
  const arLocale = document.documentElement.dir === 'rtl';

  return (
    <div className="ex-page ex-page--narrow" style={{ paddingBottom: 'var(--space-6)' }}>
      <div className="ex-card ex-attempt-bar">
        <div>
          <h1>{attempt.exam.title}</h1>
          <p className="ex-card__sub">{answeredCount} / {questions.length} {t('Answered').toLowerCase()}</p>
        </div>
        <div className="ex-attempt-bar__meta">
          {secureModeEnabled && (
            <span className="ex-inline" title={t('Violations')}>
              <Icon name={isFullscreen ? 'shield' : 'lock'} size={16} />
              {attempt.violations_count ?? 0}{attempt.exam.max_violations != null ? ` / ${attempt.exam.max_violations}` : ''}
            </span>
          )}
          <span className={`ex-timer${timeCritical ? ' is-critical' : ''}`}>
            <Icon name="clock" size={16} />{formatTime(secondsLeft)}
          </span>
        </div>
      </div>

      {secureModeEnabled && !isFullscreen && (
        <div className="ex-note ex-note--warn">
          <Icon name="lock" size={16} />
          <div>{t('You have exited fullscreen — this has been recorded as a violation. Return to fullscreen to continue safely.')}{' '}
            <button type="button" className="ex-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={handleEnterSecureMode}>{t('Re-enter Fullscreen')}</button>
          </div>
        </div>
      )}

      {idx === 0 && attempt.exam.instructions && (
        <div className="ex-note"><Icon name="info" size={16} /><div style={{ whiteSpace: 'pre-wrap' }}>{attempt.exam.instructions}</div></div>
      )}

      <div className="ex-palette" role="group" aria-label={t('Question')}>
        {questions.map((x, n) => (
          <button
            key={x.exam_question_id}
            type="button"
            className={`ex-palette__dot${n === idx ? ' is-current' : ''}${isAnswered(x) ? ' is-answered' : ''}`}
            disabled={!allowBack && n < idx}
            onClick={() => goTo(n)}
            aria-label={`${t('Question')} ${n + 1}`}
            aria-current={n === idx ? 'step' : undefined}
          >{n + 1}</button>
        ))}
      </div>

      {q && (
        <div className="ex-card ex-card__pad">
          <div className="ex-q__top" style={{ marginBottom: 6 }}>
            <span className="ex-q__no">{t('Question')} {idx + 1} / {questions.length}</span>
            <span>·</span>
            <span>{t(TYPE_LABELS[q.type] || q.type)}</span>
            <span>·</span>
            <span>{q.marks} {t('Marks')}</span>
            <span className="ex-q__tools">
              <span className={`ex-status ${isAnswered(q) ? 'ex-status--graded' : 'ex-status--idle'}`}>{isAnswered(q) ? t('Answered') : t('Not answered')}</span>
            </span>
          </div>

          <p className="ex-q__prompt" style={{ fontSize: 16 }}>{q.prompt}</p>

          {(q.type === 'mcq' || q.type === 'true_false' || q.type === 'multi_select') && (
            <div className="ex-opts">
              {(q.options || []).map((opt) => {
                const multi = q.type === 'multi_select';
                const checked = (q.my_answer?.selected_option_ids || []).includes(opt.id);
                return (
                  <label key={opt.id} className={`ex-choice${checked ? ' is-selected' : ''}`}>
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name={`q-${q.exam_question_id}`}
                      checked={checked}
                      onChange={() => handleOptionChange(q, opt.id, multi)}
                    />
                    <span>{q.type === 'true_false' ? t(opt.option_text) : opt.option_text}</span>
                  </label>
                );
              })}
            </div>
          )}

          {(q.type === 'short_answer' || q.type === 'essay') && (
            <textarea
              className="ex-textarea"
              rows={q.type === 'essay' ? 10 : 4}
              placeholder={t('Write your answer here…')}
              value={q.my_answer?.answer_text || ''}
              onChange={(e) => handleTextChange(q, e.target.value)}
            />
          )}

          <p className="ex-card__sub" style={{ marginTop: 10, minHeight: 18, color: state === 'error' ? 'var(--color-danger)' : undefined }}>
            {state === 'saving' && t('Saving…')}
            {state === 'saved' && t('Saved')}
            {state === 'error' && t('Save failed — will retry')}
          </p>

          <div className="ex-footer">
            {allowBack ? (
              <button type="button" className="btn btn-outline" disabled={idx === 0} onClick={() => goTo(idx - 1)}>
                <Icon name="arrow-left" size={14} className="icon-flip" /> {arLocale ? 'السابق' : 'Previous'}
              </button>
            ) : <span className="ex-card__sub">{arLocale ? 'لا يمكن الرجوع إلى الأسئلة السابقة.' : 'You cannot go back to previous questions.'}</span>}
            <div className="ex-footer__right">
              {idx < last ? (
                <button type="button" className="btn btn-primary" onClick={() => goTo(idx + 1)}>
                  {arLocale ? 'التالي' : 'Next'} <Icon name="arrow-right" size={14} className="icon-flip" />
                </button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleSubmitClick}>
                  {submitting ? t('Saving…') : t('Submit Exam')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {idx < last && (
        <div style={{ textAlign: 'end' }}>
          <button type="button" className="ex-link" style={{ background: 'none', border: 0, cursor: 'pointer' }} disabled={submitting} onClick={handleSubmitClick}>{t('Submit Exam')}</button>
        </div>
      )}
    </div>
  );
}
