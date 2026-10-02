import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage, getTokens } from '../../api/client';
import Icon from '../../components/Icon';
import { ConfirmModal } from '../../components/admin/adminUi';

import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/ai-code-review';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/admin/ai-code-review.php, talking to the real JSON
 * API (app/Controllers/Api/AdminAiCodeReviewApiController.php — new;
 * reuses the exact same AiCodeReviewRepository::filteredPaginated()/
 * platformStats() calls the Blade view already made). Every row action
 * (approve/note/override score/re-run) is a real write logged via
 * AuditLogService, same as the web form flow.
 */

const STATUS_META = {
  completed:  { cls: 'badge-success', label: 'Completed' },
  processing: { cls: 'badge-primary', label: 'Processing' },
  queued:     { cls: 'badge-neutral', label: 'Queued' },
  failed:     { cls: 'badge-danger',  label: 'Failed' },
};

const FORMATS = ['pdf', 'csv', 'xlsx', 'json'];

function StatCard({ label, value, icon }) {
  return (
    <div className="adm-kpi">
      <div className="adm-kpi__top">{label} <Icon name={icon} size={16} /></div>
      <div className="adm-kpi__value">{value}</div>
    </div>
  );
}

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

function ActionsMenu({ review, onChanged, onError }) {
  const t = useTranslations(translations);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('review');
  const [rerun, setRerun] = useState(false);
  const [note, setNote] = useState(review.admin_notes || '');
  const [newScore, setNewScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    onError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(fmt) {
    try {
      await downloadExport(`/api/v1/admin/ai-code-review/project/${review.project_id}/export?format=${fmt}`, `ai_code_review_project_${review.project_id}.${fmt === 'xlsx' ? 'xlsx' : fmt}`);
    } catch {
      onError('Export failed. Please try again.');
    }
  }

  const title = review.title_en || review.title_ar || '—';

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => { setTab('review'); setOpen(true); }}>{t('Actions')}</button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-box card glass-panel" role="dialog" aria-modal="true" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-box__title text-h3">{title} · v{review.version || 1}</h2>

            <div className="adm-tabs" role="tablist">
              {[['review', 'Review'], ['export', 'Export'], ['notes', 'Notes & score']].map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={`adm-tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>

            <div className="adm-actions-stack">
              {tab === 'review' && (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy}
                      onClick={() => run(() => api.post(`/api/v1/admin/ai-code-review/${review.id}/approve`))}>
                      <Icon name="check" size={14} /> {t('Approve')}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setRerun(true)}>
                      <Icon name="refresh" size={14} /> {t('Re-run')}
                    </button>
                  </div>
                  <Link className="btn btn-outline btn-sm" to={`/admin/ai-code-review/project/${review.project_id}/history`}>
                    <Icon name="clock" size={14} /> {t('Version History')}
                  </Link>
                </>
              )}

              {tab === 'export' && (
                <div>
                  <div className="adm-muted" style={{ marginBottom: 6 }}>{t('Export report')}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {FORMATS.map((fmt) => (
                      <button key={fmt} type="button" className="btn btn-outline btn-sm" onClick={() => handleExport(fmt)}>
                        <Icon name="download" size={12} /> {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'notes' && (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('Admin note...')}</label>
                    <textarea className="form-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} style={{ marginTop: 6 }}
                      onClick={() => run(() => api.post(`/api/v1/admin/ai-code-review/${review.id}/note`, { admin_notes: note }))}>
                      {t('Save Note')}
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Override Score')}</label>
                    <input className="form-input" type="number" min="0" max="100" placeholder={t('New score')} style={{ marginBottom: 6 }} value={newScore} onChange={(e) => setNewScore(e.target.value)} />
                    <textarea className="form-input" rows={2} placeholder={t('Override reason (required)')} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} style={{ marginTop: 6 }}
                      onClick={() => run(() => api.post(`/api/v1/admin/ai-code-review/${review.id}/override-score`, { overall_score: newScore, override_reason: overrideReason }))}>
                      {t('Override Score')}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="modal-box__actions">
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>{t('Close')}</button>
            </div>
          </div>
        </div>
      )}

      {rerun && (
        <ConfirmModal
          title="Confirm action"
          message="Re-run the AI analysis for this project? A new review version will be created."
          confirmLabel={t('Re-run')}
          busy={busy}
          onConfirm={async () => { await run(() => api.post(`/api/v1/admin/ai-code-review/${review.project_uuid}/rerun`)); setRerun(false); }}
          onClose={() => setRerun(false)}
        />
      )}
    </>
  );
}

export default function AdminAiCodeReview() {
  const t = useTranslations(translations);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = {
    search: searchParams.get('search') || '',
    university_id: searchParams.get('university_id') || '',
    status: searchParams.get('status') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    score_min: searchParams.get('score_min') || '',
    score_max: searchParams.get('score_max') || '',
  };
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [form, setForm] = useState(filters);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, total_issues: 0 });
  const [universities, setUniversities] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/ai-code-review', { ...filters, page })
      .then((json) => {
        setReviews(json.data || []);
        setStats(json.meta?.stats || { total: 0, completed: 0, failed: 0, total_issues: 0 });
        setUniversities(json.meta?.universities || []);
        setTotalPages(json.meta?.totalPages || 1);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setForm(filters); }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters(e) {
    e.preventDefault();
    const next = new URLSearchParams();
    Object.entries(form).forEach(([k, v]) => { if (v) next.set(k, v); });
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams());
  }

  function goToPage(n) {
    setSearchParams((p) => {
      const next = new URLSearchParams(p);
      next.set('page', String(n));
      return next;
    });
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('AI Code Review')}</h1>
          <p className="text-small">{t('Every code review run against student project GitHub repositories, platform-wide.')}</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="adm-kpis">
        <StatCard label="Total Reviews" value={stats.total} icon="sparkles" />
        <StatCard label="Completed" value={stats.completed} icon="check-circle" />
        <StatCard label="Failed" value={stats.failed} icon="x-circle" />
        <StatCard label="Total Issues Found" value={Number(stats.total_issues || 0).toLocaleString()} icon="alert-triangle" />
      </div>

      <div className="adm-panel" style={{ marginBottom: 16 }}>
        <form onSubmit={applyFilters} className="adm-filter-form">
          <div className="form-group">
            <label className="form-label">{t('Search')}</label>
            <input className="form-input" type="text" placeholder={t('Project or student name')} value={form.search} onChange={(e) => setForm((f) => ({ ...f, search: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('University')}</label>
            <select className="form-input" value={form.university_id} onChange={(e) => setForm((f) => ({ ...f, university_id: e.target.value }))}>
              <option value="">{t('All')}</option>
              {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('Status')}</label>
            <select className="form-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="">{t('All')}</option>
              {Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('From')}</label>
            <input className="form-input" type="date" value={form.date_from} onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('To')}</label>
            <input className="form-input" type="date" value={form.date_to} onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Min Score')}</label>
            <input className="form-input" type="number" min="0" max="100" style={{ width: 90 }} value={form.score_min} onChange={(e) => setForm((f) => ({ ...f, score_min: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Max Score')}</label>
            <input className="form-input" type="number" min="0" max="100" style={{ width: 90 }} value={form.score_max} onChange={(e) => setForm((f) => ({ ...f, score_max: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flexDirection: 'row', gap: 6 }}>
            <button type="submit" className="btn btn-primary btn-sm">{t('Filter')}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>{t('Reset')}</button>
          </div>
        </form>

        {filters.university_id && (
          <div className="adm-export-row">
            <span className="adm-muted">{t('Export report for the selected university:')}</span>
            {FORMATS.map((fmt) => (
              <button key={fmt} type="button" className="btn btn-outline btn-sm"
                onClick={() => downloadExport(`/api/v1/admin/ai-code-review/university/${filters.university_id}/export?format=${fmt}`, `ai_code_review_university_${filters.university_id}.${fmt}`).catch(() => setError('Export failed. Please try again.'))}>
                <Icon name="download" size={12} /> {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <FacultyExport onError={setError} />
      </div>

      {loading ? (
        <p className="text-small">{t('Loading…')}</p>
      ) : reviews.length === 0 ? (
        <div className="adm-panel" style={{ textAlign: 'center' }}>
          <p className="adm-empty">{t('No matching code reviews.')}</p>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Project</th><th>Student</th><th>{t('Status')}</th><th>Score</th><th>Issues</th><th>Admin Review</th><th>Date</th><th>{t('Actions')}</th></tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.queued;
                const title = r.title_en || r.title_ar || '—';
                const scoreClass = r.overall_score === null ? null : (r.overall_score >= 70 ? 'badge-success' : r.overall_score >= 40 ? 'badge-warning' : 'badge-danger');
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{title}</strong><br />
                      {r.repository_url
                        ? <a href={r.repository_url} target="_blank" rel="noopener noreferrer" className="adm-muted"><Icon name="github" size={12} /> GitHub</a>
                        : <span className="adm-muted">—</span>}
                      <br /><span className="adm-muted">v{r.version || 1}</span>
                    </td>
                    <td>{r.owner_name || '—'}</td>
                    <td><span className={`badge ${meta.cls}`}>{meta.label}</span></td>
                    <td>
                      {r.overall_score !== null
                        ? <>
                            <span className={`badge ${scoreClass}`}>{r.overall_score}</span>
                            {Number(r.score_overridden) === 1 && <span className="text-caption" title={t('Manually overridden')}> <Icon name="edit" size={12} /></span>}
                          </>
                        : <span className="adm-muted">—</span>}
                    </td>
                    <td>{r.issues_found > 0 ? <span className="badge badge-danger">{r.issues_found}</span> : <span className="adm-muted">0</span>}</td>
                    <td>{r.approved_at ? <span className="badge badge-success">{t('Approved')}</span> : <span className="adm-muted">{t('Not reviewed')}</span>}</td>
                    <td>{r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : '—'}</td>
                    <td className="adm-actions"><ActionsMenu review={r} onChanged={load} onError={setError} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && reviews.length > 0 && totalPages > 1 && (
        <div className="adm-pager">
          <span>{stats.total.toLocaleString()} reviews</span>
          <div>
            <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => goToPage(page - 1)} aria-label="Previous page"><Icon name="chevron-left" size={16} /></button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} aria-label="Next page"><Icon name="chevron-right" size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}

function FacultyExport({ onError }) {
  const t = useTranslations(translations);
  const [faculty, setFaculty] = useState('');
  const [format, setFormat] = useState('pdf');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!faculty.trim()) return;
    setBusy(true);
    try {
      await downloadExport(`/api/v1/admin/ai-code-review/faculty/export?faculty=${encodeURIComponent(faculty)}&format=${format}`, `ai_code_review_faculty.${format}`);
    } catch {
      onError('Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-export-row">
      <form onSubmit={handleSubmit} className="adm-filter-form" style={{ margin: 0 }}>
        <div className="form-group">
          <label className="form-label">{t('Export a faculty report')}</label>
          <input className="form-input" type="text" required placeholder={t('Faculty name')} value={faculty} onChange={(e) => setFaculty(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 'auto' }} value={format} onChange={(e) => setFormat(e.target.value)}>
          {FORMATS.map((fmt) => <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>)}
        </select>
        <button type="submit" className="btn btn-outline btn-sm" disabled={busy}><Icon name="download" size={12} /> {busy ? 'Exporting…' : 'Export'}</button>
      </form>
    </div>
  );
}
