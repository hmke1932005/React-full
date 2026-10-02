import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage, getTokens } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nExam from '../../i18n/academic-staff/exam-system';

const translations = { ...i18nCommon, ...i18nExam };

/**
 * roundless — GET /api/v1/exam-system/exams/{id}/attempts
 * (ExamGradingApiController::indexAttempts -> ExamGradingService::
 * listAttemptsForExam()), "with grading progress" per EXAM_SYSTEM_API.md —
 * each row carries student_name/student_number (denormalized, no nested
 * student object), status, violations_count, graded_count and
 * total_questions (Round 7: pool-drawn attempts can have different
 * question counts, so this is per-attempt, not the exam's fixed count).
 *
 * Also hosts the two exam-level result actions from the same API section:
 * POST .../publish-results and POST .../unpublish-results — for
 * result_visibility=manual exams, this is how the instructor actually
 * releases scores to students (immediate/after_close exams reveal
 * automatically and don't need this, so the button always shows; the
 * backend is the source of truth for whether it's a no-op).
 *
 * Round 8 additions: a link out to the exam's analytics page (own file,
 * GET /exams/{id}/analytics) and a results export menu — GET
 * /exams/{id}/results/export?format=csv|xlsx|pdf|json
 * (ExamResultsExportApiController), a real file download behind auth so it
 * goes through fetch+Blob (same downloadExport() pattern already used by
 * AdminAiCodeReview.jsx) rather than a plain <a href>.
 */

const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf', 'json'];

async function downloadExport(url, filename) {
  const { accessToken } = getTokens();
  const res = await fetch(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objUrl);
}

const ATTEMPT_STATUS_META = {
  in_progress: { cls: 'badge-primary', key: 'In Progress' },
  submitted: { cls: 'badge-warning', key: 'Submitted' },
  auto_submitted: { cls: 'badge-warning', key: 'Auto-submitted' },
  grading: { cls: 'badge-warning', key: 'Grading' },
  graded: { cls: 'badge-success', key: 'Graded' },
  expired: { cls: 'badge-neutral', key: 'Expired' },
  cancelled: { cls: 'badge-neutral', key: 'Cancelled' },
};

const CARD = { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };

export default function AcademicStaffExamAttempts() {
  const { id } = useParams();
  const t = useTranslations(translations);
  const [exam, setExam] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([
      api.get(`/api/v1/exam-system/exams/${id}`),
      api.get(`/api/v1/exam-system/exams/${id}/attempts`),
    ])
      .then(([examJson, attemptsJson]) => {
        setExam(examJson.data);
        setAttempts(attemptsJson.data || []);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handlePublishResults = () => {
    if (!window.confirm(t('Publish results for all graded attempts on this exam?'))) return;
    setBusy(true);
    setActionError(null);
    api.post(`/api/v1/exam-system/exams/${id}/publish-results`)
      .then(() => load())
      .catch((err) => setActionError(errorMessage(err)))
      .finally(() => setBusy(false));
  };

  const handleUnpublishResults = () => {
    if (!window.confirm(t('Revoke published results for this exam?'))) return;
    setBusy(true);
    setActionError(null);
    api.post(`/api/v1/exam-system/exams/${id}/unpublish-results`)
      .then(() => load())
      .catch((err) => setActionError(errorMessage(err)))
      .finally(() => setBusy(false));
  };

  const [exportOpen, setExportOpen] = useState(false);
  async function handleExport(fmt) {
    setExportOpen(false);
    setActionError(null);
    try {
      await downloadExport(`/api/v1/exam-system/exams/${id}/results/export?format=${fmt}`, `exam_results_${id}.${fmt}`);
    } catch {
      setActionError(t('Export failed. Please try again.'));
    }
  }

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p className="form-error" style={{ padding: 'var(--space-5)' }}>{error}</p>;
  if (!exam) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div>
        <Link to={`/academic-staff/exams/${id}`} className="text-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-left" size={14} /> {t('Back to Exam')}
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="text-h2" style={{ margin: 0 }}>{exam.title}</h1>
          <p className="text-caption" style={{ margin: 'var(--space-1) 0 0' }}>{t('Attempts & Grading')}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Link to={`/academic-staff/exams/${id}/analytics`} className="btn btn-outline btn-sm">
            <Icon name="chart" size={14} /> {t('Analytics')}
          </Link>
          <Link to={`/academic-staff/exams/${id}/targets`} className="btn btn-outline btn-sm">
            <Icon name="filter" size={14} /> {t('Manage Targeting & Publish')}
          </Link>
          <div style={{ position: 'relative' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setExportOpen((o) => !o)}>
              <Icon name="download" size={14} /> {t('Export')}
            </button>
            {exportOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown, 40)' }} onClick={() => setExportOpen(false)} />
                <div
                  className="card glass-panel"
                  style={{ position: 'absolute', top: '100%', insetInlineStart: 0, marginTop: 4, zIndex: 'var(--z-dropdown, 41)', display: 'flex', gap: 6, flexWrap: 'wrap', padding: 'var(--space-3)', minWidth: 180 }}
                >
                  {EXPORT_FORMATS.map((fmt) => (
                    <button key={fmt} type="button" className="btn btn-ghost btn-sm" onClick={() => handleExport(fmt)}>
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {exam.result_visibility === 'manual' && (
            <>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={handleUnpublishResults}>
                {t('Unpublish Results')}
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={handlePublishResults}>
                {t('Publish Results')}
              </button>
            </>
          )}
        </div>
      </div>

      {actionError && <p className="form-error">{actionError}</p>}

      {attempts.length === 0 ? (
        <div className="card glass-panel empty-state">
          <Icon name="note" size={32} className="empty-state__icon" />
          <p className="text-small">{t('No attempts yet.')}</p>
        </div>
      ) : (
        <div className="card glass-panel" style={CARD}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Student')}</th>
                  <th>{t('Status')}</th>
                  <th>{t('Grading Progress')}</th>
                  <th>{t('Score')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => {
                  const meta = ATTEMPT_STATUS_META[a.status] || ATTEMPT_STATUS_META.submitted;
                  return (
                    <tr key={a.id}>
                      <td>
                        <span className="text-small" style={{ fontWeight: 600 }}>{a.student_name || `#${a.student_id}`}</span>
                        {a.student_number && <div className="text-caption">{a.student_number}</div>}
                      </td>
                      <td><span className={`badge ${meta.cls}`}>{t(meta.key)}</span></td>
                      <td>{a.graded_count ?? 0} / {a.total_questions ?? 0}</td>
                      <td>{a.score != null ? `${a.score} / ${exam.total_marks}` : '—'}</td>
                      <td>
                        <Link to={`/academic-staff/exams/${id}/attempts/${a.id}`} className="btn btn-outline btn-sm">
                          {t('Grade')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
