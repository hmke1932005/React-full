import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/my-exams';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Round 2 — GET /api/v1/exam-system/my-exams/{id} (StudentExamApiController::
 * show() -> StudentExamService::examSummaryForStudent()). Metadata only —
 * no question content (see StudentExamService's docblock: content is only
 * revealed once an attempt starts).
 *
 * Round 3 addition — GET/POST /api/v1/exam-system/my-exams/{id}/attempts
 * (ExamAttemptApiController::index/store -> ExamAttemptService). Lists the
 * student's own attempts and lets them start a new one (or resume an
 * `in_progress` one) or, for a finished attempt, jump straight to its
 * result. Question content itself only appears once inside
 * StudentExamAttempt, after an attempt exists — this page never fetches it.
 */

const ATTEMPT_STATUS_META = {
  in_progress: { cls: 'badge-primary', key: 'In Progress' },
  submitted: { cls: 'badge-success', key: 'Submitted' },
  auto_submitted: { cls: 'badge-success', key: 'Auto-submitted' },
  grading: { cls: 'badge-warning', key: 'Grading' },
  graded: { cls: 'badge-success', key: 'Graded' },
  expired: { cls: 'badge-neutral', key: 'Expired' },
  cancelled: { cls: 'badge-neutral', key: 'Cancelled' },
};

const STATUS_META = {
  scheduled: { cls: 'badge-primary', key: 'Scheduled' },
  published: { cls: 'badge-success', key: 'Published' },
};

const RESULT_VISIBILITY_LABELS = {
  immediate: 'Immediately after submission',
  after_close: 'After the exam closes',
  manual: 'Manual (your instructor publishes results)',
};

export default function StudentExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useTranslations(translations);
  const [exam, setExam] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const loadAttempts = useCallback(() => {
    return api.get(`/api/v1/exam-system/my-exams/${id}/attempts`)
      .then((json) => setAttempts(json.data || []));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get(`/api/v1/exam-system/my-exams/${id}`).then((json) => { if (!cancelled) setExam(json.data); }),
      loadAttempts().catch(() => {}),
    ])
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, loadAttempts]);

  const handleStart = () => {
    if (!window.confirm(t('Start this exam now? The timer starts immediately and cannot be paused.'))) return;
    setStarting(true);
    api.post(`/api/v1/exam-system/my-exams/${id}/attempts`)
      .then((json) => navigate(`/student/exam-attempt/${json.data.id}`))
      .catch((err) => { setError(errorMessage(err)); setStarting(false); });
  };

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p className="form-error" style={{ padding: 'var(--space-5)' }}>{error}</p>;
  if (!exam) return null;

  const inProgress = attempts.find((a) => a.status === 'in_progress');
  const attemptsUsed = attempts.length;
  const maxedOut = exam.max_attempts != null && attemptsUsed >= exam.max_attempts && !inProgress;

  const statusMeta = STATUS_META[exam.status] || STATUS_META.published;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div>
        <Link to="/student/my-exams" className="text-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-left" size={14} /> {t('Back to My Exams')}
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="text-h2" style={{ margin: 0 }}>{exam.title}</h1>
          {exam.subject && <p className="text-small" style={{ margin: 'var(--space-1) 0 0' }}>{exam.subject}</p>}
        </div>
        <span className={`badge ${statusMeta.cls}`}>{t(statusMeta.key)}</span>
      </div>

      {exam.description && (
        <div className="card glass-panel">
          <p className="text-small" style={{ margin: 0 }}>{exam.description}</p>
        </div>
      )}

      <div className="card glass-panel">
        <div className="grid-3">
          <div>
            <p className="text-caption" style={{ margin: 0 }}>{t('Duration')}</p>
            <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{exam.duration_minutes} {t('minutes')}</p>
          </div>
          <div>
            <p className="text-caption" style={{ margin: 0 }}>{t('Questions')}</p>
            <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{exam.question_count}</p>
          </div>
          <div>
            <p className="text-caption" style={{ margin: 0 }}>{t('Total Marks')}</p>
            <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{exam.total_marks}</p>
          </div>
          <div>
            <p className="text-caption" style={{ margin: 0 }}>{t('Starts')}</p>
            <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{exam.start_at ? new Date(exam.start_at).toLocaleString() : t('Opens immediately')}</p>
          </div>
          <div>
            <p className="text-caption" style={{ margin: 0 }}>{t('Ends')}</p>
            <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{exam.end_at ? new Date(exam.end_at).toLocaleString() : t('No end date')}</p>
          </div>
          <div>
            <p className="text-caption" style={{ margin: 0 }}>{t('Max Attempts')}</p>
            <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{exam.max_attempts}</p>
          </div>
          <div>
            <p className="text-caption" style={{ margin: 0 }}>{t('Passing Score')}</p>
            <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{exam.passing_score ?? t('Not set')}</p>
          </div>
          <div>
            <p className="text-caption" style={{ margin: 0 }}>{t('Result Visibility')}</p>
            <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{t(RESULT_VISIBILITY_LABELS[exam.result_visibility] || exam.result_visibility)}</p>
          </div>
          {exam.secure_mode_enabled && (
            <div>
              <p className="text-caption" style={{ margin: 0 }}>{t('Secure Mode')}</p>
              <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>
                <Icon name="shield" size={14} /> {t('Enabled')}
              </p>
            </div>
          )}
        </div>
      </div>

      {exam.secure_mode_enabled && (
        <div className="card glass-panel">
          <p className="text-small" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Icon name="shield" size={16} /> {t('This exam uses secure/proctored mode — fullscreen and tab-switching will be monitored.')}
          </p>
        </div>
      )}

      {exam.instructions && (
        <div className="card glass-panel">
          <h2 className="text-h3" style={{ marginTop: 0 }}>{t('Instructions')}</h2>
          <p className="text-small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{exam.instructions}</p>
        </div>
      )}

      <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>{t('Your Attempts')}</h2>
          {inProgress ? (
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/student/exam-attempt/${inProgress.id}`)}>
              {t('Resume Attempt')}
            </button>
          ) : maxedOut ? null : (
            <button type="button" className="btn btn-primary" disabled={starting} onClick={handleStart}>
              {starting ? t('Saving…') : t('Start Exam')}
            </button>
          )}
        </div>

        {maxedOut && !inProgress && (
          <p className="text-small" style={{ margin: 0 }}>{t('You have used the maximum number of attempts for this exam.')}</p>
        )}

        {attempts.length === 0 ? (
          <p className="text-caption" style={{ margin: 0 }}>{t('No attempts yet.')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {attempts.map((a, idx) => {
              const meta = ATTEMPT_STATUS_META[a.status] || ATTEMPT_STATUS_META.submitted;
              const finished = !['in_progress'].includes(a.status);
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 'var(--space-2)', padding: 'var(--space-2) 0',
                    borderTop: idx > 0 ? '1px solid var(--color-border, #e5e7eb)' : 'none',
                  }}
                >
                  <span className="text-small">{t('Attempt')} {attempts.length - idx}</span>
                  <span className={`badge ${meta.cls}`}>{t(meta.key)}</span>
                  {finished && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => navigate(`/student/exam-attempt/${a.id}/result`)}
                    >
                      {t('View Result')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
