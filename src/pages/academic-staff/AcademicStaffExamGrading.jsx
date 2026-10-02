import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nExam from '../../i18n/academic-staff/exam-system';

const translations = { ...i18nCommon, ...i18nExam };

/**
 * Round 4 (Grading Core) — GET /api/v1/exam-system/exams/{id}/attempts/{attemptId}
 * (full attempt detail: questions, student answers, current grades) plus:
 *   - POST .../auto-grade — re-run automatic grading for objective questions
 *     only (mcq/true_false/multi_select); does nothing to short_answer/essay.
 *   - PUT .../grades/{examQuestionId} — manual grade / override, body
 *     { marks_awarded, feedback }. Works for every question type: it's how
 *     short_answer/essay get their first grade, and how an instructor
 *     overrides an objective auto-grade.
 *   - GET .../grades/{examQuestionId}/history — full change history for one
 *     question, shown inline (expand/collapse) rather than a modal, since
 *     this codebase has no modal component (see AcademicStaffExamTargets /
 *     AcademicStaffExamBuilder — everything here is inline cards).
 *
 * Round 6 (AI Grading) addition — attemptDetailForInstructor() nests the
 * current grade under question.grade (marks_awarded/is_correct/feedback/
 * source/graded_at), not flat on the question, and adds per-question
 * model_answer/grading_instructions/ai_grading_enabled/rubric/ai_grading
 * (the last two null for non-AI-gradable types). This page:
 *   - POST .../grades/{examQuestionId}/accept-ai — confirm the AI's score
 *     as-is (only meaningful while grade.source === 'ai').
 *   - POST .../grades/{examQuestionId}/ai-regrade — re-queue AI grading for
 *     one question (e.g. after editing the model answer/rubric elsewhere).
 *   Both just trigger a reload of the attempt; ai-regrade's job runs on the
 *   queue, so its result shows up as 'processing' until the worker finishes
 *   and the instructor reloads again.
 *
 * Round 5 addition — GET .../exams/{id}/attempts/{attemptId}/security-events
 * (ExamSecurityApiController::timeline -> ExamSecurityService::
 * timelineForAttempt()): shown as a collapsible card, only when the exam
 * has secure_mode_enabled, with the attempt's violations_count/
 * max_violations present directly on the attempt-detail payload used above.
 */

const TYPE_LABELS = { mcq: 'Multiple Choice', multi_select: 'Multi-select', true_false: 'True / False', short_answer: 'Short Answer', essay: 'Essay' };
const OBJECTIVE_TYPES = ['mcq', 'multi_select', 'true_false'];
const AI_GRADABLE_TYPES = ['short_answer', 'essay'];
const AI_STATUS_META = {
  queued: { cls: 'badge-neutral', key: 'Queued' },
  processing: { cls: 'badge-warning', key: 'Processing' },
  completed: { cls: 'badge-success', key: 'Completed' },
  failed: { cls: 'badge-danger', key: 'Failed' },
};
const SECURITY_EVENT_LABELS = {
  exam_started: 'Exam Started',
  exam_submitted: 'Exam Submitted',
  auto_submitted: 'Auto-submitted',
  fullscreen_entered: 'Entered Fullscreen',
  fullscreen_exited: 'Exited Fullscreen',
  tab_switch: 'Tab Switch',
  window_blur: 'Window Lost Focus',
  window_focus: 'Window Focus Regained',
  copy_attempt: 'Copy Attempt',
  paste_attempt: 'Paste Attempt',
  cut_attempt: 'Cut Attempt',
  question_changed: 'Question Changed',
  answer_saved: 'Answer Saved',
  time_expired: 'Time Expired',
};

function QuestionGrader({ examId, attemptId, question, t, onChanged }) {
  const grade = question.grade;
  const [marks, setMarks] = useState(grade?.marks_awarded ?? '');
  const [feedback, setFeedback] = useState(grade?.feedback || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  // Resync local fields whenever the server-side grade actually changes
  // (accept-ai / ai-regrade / a save from this same form) — the parent
  // reloads and passes a new `question` prop, but this component instance
  // is kept alive (same key) so its own state wouldn't otherwise update.
  useEffect(() => {
    setMarks(grade?.marks_awarded ?? '');
    setFeedback(grade?.feedback || '');
    setSaved(false);
  }, [grade?.graded_at, grade?.marks_awarded, grade?.source]);

  const isObjective = OBJECTIVE_TYPES.includes(question.type);
  const isAiGradable = AI_GRADABLE_TYPES.includes(question.type);
  const ai = question.ai_grading;

  const handleSave = () => {
    const marksNum = marks === '' ? null : Number(marks);
    if (marksNum != null && (Number.isNaN(marksNum) || marksNum < 0 || marksNum > question.max_marks)) {
      setSaveError(t('Marks must be between 0 and the question\'s max marks.'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    api.put(`/api/v1/exam-system/exams/${examId}/attempts/${attemptId}/grades/${question.exam_question_id}`, {
      marks_awarded: marksNum,
      feedback: feedback || null,
    })
      .then(() => { setSaved(true); setHistory(null); onChanged(); })
      .catch((err) => setSaveError(errorMessage(err)))
      .finally(() => setSaving(false));
  };

  const handleAcceptAi = () => {
    setAiBusy(true);
    setSaveError(null);
    api.post(`/api/v1/exam-system/exams/${examId}/attempts/${attemptId}/grades/${question.exam_question_id}/accept-ai`)
      .then(() => onChanged())
      .catch((err) => setSaveError(errorMessage(err)))
      .finally(() => setAiBusy(false));
  };

  const handleAiRegrade = () => {
    setAiBusy(true);
    setSaveError(null);
    api.post(`/api/v1/exam-system/exams/${examId}/attempts/${attemptId}/grades/${question.exam_question_id}/ai-regrade`)
      .then(() => onChanged())
      .catch((err) => setSaveError(errorMessage(err)))
      .finally(() => setAiBusy(false));
  };

  const toggleHistory = () => {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    if (history) return;
    setHistoryLoading(true);
    api.get(`/api/v1/exam-system/exams/${examId}/attempts/${attemptId}/grades/${question.exam_question_id}/history`)
      .then((json) => setHistory(json.data || []))
      .catch((err) => setSaveError(errorMessage(err)))
      .finally(() => setHistoryLoading(false));
  };

  return (
    <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        <p className="text-caption" style={{ margin: 0 }}>
          {t(TYPE_LABELS[question.type] || question.type)} · {question.max_marks} {t('Marks')}
        </p>
        {isObjective && grade?.is_correct === true && <span className="badge badge-success">{t('Correct')}</span>}
        {isObjective && grade?.is_correct === false && <span className="badge badge-danger">{t('Incorrect')}</span>}
        {grade?.source === 'ai' && <span className="badge badge-warning"><Icon name="sparkles" size={12} /> {t('AI Suggested')}</span>}
      </div>

      <p className="text-small" style={{ margin: 0, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{question.prompt}</p>

      {(question.options || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {question.options.map((opt) => {
            const selected = (question.student_answer?.selected_option_ids || []).includes(opt.id);
            return (
              <p
                key={opt.id}
                className="text-small"
                style={{ margin: 0, fontWeight: selected ? 600 : 400, opacity: selected ? 1 : 0.6 }}
              >
                {selected ? '● ' : '○ '}{question.type === 'true_false' ? t(opt.option_text) : opt.option_text}
                {opt.is_correct && <span className="text-caption"> ({t('Correct')})</span>}
              </p>
            );
          })}
        </div>
      )}

      {question.student_answer?.answer_text != null && (
        <div className="card" style={{ background: 'var(--glass-bg)', padding: 'var(--space-3)' }}>
          <p className="text-caption" style={{ margin: 0 }}>{t('Student Answer')}</p>
          <p className="text-small" style={{ margin: 'var(--space-1) 0 0', whiteSpace: 'pre-wrap' }}>
            {question.student_answer.answer_text || t('No answer submitted')}
          </p>
        </div>
      )}

      {question.model_answer && (
        <div className="card" style={{ background: 'var(--glass-bg)', padding: 'var(--space-3)' }}>
          <p className="text-caption" style={{ margin: 0 }}>{t('Model Answer')}</p>
          <p className="text-small" style={{ margin: 'var(--space-1) 0 0', whiteSpace: 'pre-wrap' }}>{question.model_answer}</p>
        </div>
      )}

      {question.rubric?.criteria?.length > 0 && (
        <div className="card" style={{ background: 'var(--glass-bg)', padding: 'var(--space-3)' }}>
          <p className="text-caption" style={{ margin: '0 0 var(--space-1)' }}>{t('Rubric')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {question.rubric.criteria.map((c) => (
              <p key={c.id} className="text-small" style={{ margin: 0, display: 'flex', justifyContent: 'space-between' }}>
                <span>{c.label}</span>
                <span className="text-caption">{c.max_points} {t('pts')}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {isAiGradable && question.ai_grading_enabled && (
        <div className="card" style={{ background: 'var(--glass-bg)', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <span className="text-small" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkles" size={14} /> {t('AI Grading')}
            </span>
            {ai?.status && (
              <span className={`badge ${(AI_STATUS_META[ai.status] || AI_STATUS_META.queued).cls}`}>
                {t((AI_STATUS_META[ai.status] || AI_STATUS_META.queued).key)}
              </span>
            )}
          </div>

          {!ai && <p className="text-caption" style={{ margin: 0 }}>{t('No AI grade yet for this question.')}</p>}

          {ai?.status === 'failed' && (
            <p className="form-error" style={{ margin: 0 }}>{ai.error_message || t('AI grading failed.')}</p>
          )}

          {ai?.status === 'completed' && (
            <>
              <p className="text-small" style={{ margin: 0 }}>
                {t('AI Score')}: <strong>{ai.marks_awarded} / {question.max_marks}</strong>
                {ai.confidence != null && <span className="text-caption"> · {t('Confidence')}: {Math.round(ai.confidence * 100)}%</span>}
              </p>
              {ai.feedback && <p className="text-small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ai.feedback}</p>}
              {ai.reasoning_summary && (
                <p className="text-caption" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ai.reasoning_summary}</p>
              )}
              {ai.strengths?.length > 0 && (
                <p className="text-caption" style={{ margin: 0 }}>{t('Strengths')}: {ai.strengths.join(', ')}</p>
              )}
              {ai.missing_concepts?.length > 0 && (
                <p className="text-caption" style={{ margin: 0 }}>{t('Missing')}: {ai.missing_concepts.join(', ')}</p>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {grade?.source === 'ai' && grade?.marks_awarded != null && (
              <button type="button" className="btn btn-primary btn-sm" disabled={aiBusy} onClick={handleAcceptAi}>
                {aiBusy ? t('Saving…') : t('Accept AI Grade')}
              </button>
            )}
            <button type="button" className="btn btn-outline btn-sm" disabled={aiBusy} onClick={handleAiRegrade}>
              <Icon name="refresh" size={14} /> {aiBusy ? t('Saving…') : t('Re-grade with AI')}
            </button>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">{t('Marks Awarded')}</label>
          <input
            type="number"
            className="form-input"
            min={0}
            max={question.max_marks}
            step="0.5"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('Feedback')}</label>
          <input
            type="text"
            className="form-input"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t('Optional feedback for the student')}
          />
        </div>
      </div>

      {saveError && <p className="form-error" style={{ margin: 0 }}>{saveError}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleHistory}>
          {historyOpen ? t('Hide History') : t('View History')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {saved && !saving && <span className="text-caption">{t('Saved')}</span>}
          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
            {saving ? t('Saving…') : t('Save Grade')}
          </button>
        </div>
      </div>

      {historyOpen && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
          {historyLoading ? (
            <p className="text-caption" style={{ margin: 0 }}>{t('Loading…')}</p>
          ) : !history || history.length === 0 ? (
            <p className="text-caption" style={{ margin: 0 }}>{t('No grade changes recorded yet.')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {history.map((h, idx) => (
                <div key={h.id || idx} className="text-caption" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>
                    {h.previous_score ?? '—'} → <strong>{h.new_score ?? '—'}</strong>
                    {h.source && ` · ${t(h.source === 'ai' ? 'AI' : h.source === 'instructor' ? 'Instructor' : 'Auto')}`}
                    {h.changed_at && ` · ${new Date(h.changed_at).toLocaleString()}`}
                  </span>
                  {h.reason && <span>{h.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AcademicStaffExamGrading() {
  const { id, attemptId } = useParams();
  const t = useTranslations(translations);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoGrading, setAutoGrading] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityEvents, setSecurityEvents] = useState(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  const load = useCallback(() => {
    return api.get(`/api/v1/exam-system/exams/${id}/attempts/${attemptId}`)
      .then((json) => setAttempt(json.data));
  }, [id, attemptId]);

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(errorMessage(err))).finally(() => setLoading(false));
  }, [load]);

  const toggleSecurity = () => {
    if (securityOpen) { setSecurityOpen(false); return; }
    setSecurityOpen(true);
    if (securityEvents) return;
    setSecurityLoading(true);
    api.get(`/api/v1/exam-system/exams/${id}/attempts/${attemptId}/security-events`)
      .then((json) => setSecurityEvents(json.data || []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setSecurityLoading(false));
  };

  const handleAutoGrade = () => {
    setAutoGrading(true);
    api.post(`/api/v1/exam-system/exams/${id}/attempts/${attemptId}/auto-grade`)
      .then(() => load())
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setAutoGrading(false));
  };

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p className="form-error" style={{ padding: 'var(--space-5)' }}>{error}</p>;
  if (!attempt) return null;

  const questions = attempt.questions || [];
  const secureModeEnabled = attempt.exam?.secure_mode_enabled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', paddingBottom: 'var(--space-6)' }}>
      <div>
        <Link to={`/academic-staff/exams/${id}/attempts`} className="text-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-left" size={14} /> {t('Back to Attempts')}
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="text-h2" style={{ margin: 0 }}>{attempt.student?.name || t('Student')}</h1>
          <p className="text-caption" style={{ margin: 'var(--space-1) 0 0' }}>{attempt.exam?.title}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" disabled={autoGrading} onClick={handleAutoGrade}>
          <Icon name="refresh" size={14} /> {autoGrading ? t('Saving…') : t('Re-run Auto-grade')}
        </button>
      </div>

      {secureModeEnabled && (
        <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Icon name="shield" size={16} />
              <span className="text-small" style={{ fontWeight: 600 }}>{t('Security Events')}</span>
              <span className="badge badge-warning">
                {t('Violations')}: {attempt.violations_count ?? 0}{attempt.exam.max_violations != null ? ` / ${attempt.exam.max_violations}` : ''}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleSecurity}>
              {securityOpen ? t('Hide Timeline') : t('View Timeline')}
            </button>
          </div>

          {securityOpen && (
            securityLoading ? (
              <p className="text-caption" style={{ margin: 0 }}>{t('Loading…')}</p>
            ) : !securityEvents || securityEvents.length === 0 ? (
              <p className="text-caption" style={{ margin: 0 }}>{t('No security events recorded.')}</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('Event')}</th>
                      <th>{t('Violation')}</th>
                      <th>{t('Time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td>{t(SECURITY_EVENT_LABELS[ev.event_type] || ev.event_type)}</td>
                        <td>{ev.is_violation ? <span className="badge badge-danger">{t('Yes')}</span> : <span className="badge badge-neutral">{t('No')}</span>}</td>
                        <td className="text-caption">{ev.occurred_at ? new Date(ev.occurred_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {questions.map((q, idx) => (
        <div key={q.exam_question_id}>
          <p className="text-caption" style={{ margin: '0 0 var(--space-1)' }}>{t('Question')} {idx + 1}</p>
          <QuestionGrader examId={id} attemptId={attemptId} question={q} t={t} onChanged={load} />
        </div>
      ))}
    </div>
  );
}
