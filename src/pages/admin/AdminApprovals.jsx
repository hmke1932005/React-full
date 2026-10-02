import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { ConfirmModal } from '../../components/admin/adminUi';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/project-approval';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Verification & Approvals — Admin design. Two real queues, both on existing APIs:
 *   • Institutions: pending universities (/api/v1/admin/universities?status=…, verify / reject)
 *   • Projects: platform-wide project approval oversight (/api/v1/admin/approvals) + the
 *     logged, reason-required admin override (POST …/approvals/{id}/override).
 * The design's "risk" and "documents" columns have no data source and are not shown.
 */

const PER_PAGE = 20;
const PROJECT_BADGE = { pending: 'badge-warning', approved: 'badge-success', rejected: 'badge-danger' };
const UNI_BADGE = { verified: 'badge-success', pending: 'badge-warning', rejected: 'badge-danger' };

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

export default function AdminApprovals() {
  const [tab, setTab] = useState('institutions');
  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">Verification &amp; Approvals</h1>
          <p className="text-small">Review institution verification requests and project approval decisions.</p>
        </div>
      </div>
      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'institutions'} className={`adm-tab${tab === 'institutions' ? ' is-active' : ''}`} onClick={() => setTab('institutions')}>Institutions</button>
        <button type="button" role="tab" aria-selected={tab === 'projects'} className={`adm-tab${tab === 'projects' ? ' is-active' : ''}`} onClick={() => setTab('projects')}>Project approvals</button>
      </div>
      {tab === 'institutions' ? <InstitutionQueue /> : <ProjectQueue />}
    </>
  );
}

function Pager({ page, setPage, total }) {
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (total === 0) return null;
  return (
    <div className="adm-pager">
      <span>Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}</span>
      {totalPages > 1 && (
        <div>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><Icon name="chevron-left" size={16} /></button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><Icon name="chevron-right" size={16} /></button>
        </div>
      )}
    </div>
  );
}

function InstitutionQueue() {
  const t = useTranslations(translations);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/universities', { page, status: status || undefined })
      .then((json) => { setRows(json.data || []); setTotal(json.meta?.total ?? 0); setCounts(json.meta?.counts || {}); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, status]);
  useEffect(() => { load(); }, [load]);

  async function runConfirmed() {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/admin/universities/${confirm.row.id}/${confirm.kind}`);
      setConfirm(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (u) => u.official_name_en || u.official_name_ar || '—';

  return (
    <>
      <div className="adm-kpis">
        <div className="adm-kpi"><div className="adm-kpi__top">Pending verifications <Icon name="shield" size={16} /></div><div className="adm-kpi__value">{(counts.pending ?? 0).toLocaleString()}</div><div className={`adm-kpi__note${(counts.pending ?? 0) > 0 ? ' adm-kpi__note--warn' : ''}`}>{(counts.pending ?? 0) > 0 ? 'Needs review' : 'All clear'}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">{t('Verified')} <Icon name="check-circle" size={16} /></div><div className="adm-kpi__value">{(counts.verified ?? 0).toLocaleString()}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">Rejected <Icon name="x-circle" size={16} /></div><div className="adm-kpi__value">{(counts.rejected ?? 0).toLocaleString()}</div></div>
      </div>
      {actionError && <p className="form-error">{actionError}</p>}
      <div className="adm-filters">
        {['pending', 'verified', 'rejected', ''].map((s) => (
          <button key={s || 'all'} type="button" className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setStatus(s); setPage(1); }}>
            {s ? cap(s) : 'All'}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <Link to="/admin/universities" className="btn btn-ghost btn-sm">Open Institutions</Link>
      </div>
      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Requester</th><th>Type</th><th>Location</th><th>Submitted</th><th>{t('Status')}</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><Link to={`/admin/universities/${u.id}`} state={{ row: u, from: 'approvals' }} className="adm-person"><strong>{nameOf(u)}</strong></Link></td>
                  <td>University</td>
                  <td>{[u.city, u.country].filter(Boolean).join(', ') || '—'}</td>
                  <td>{u.created_at ? u.created_at.slice(0, 10) : '—'}</td>
                  <td><span className={`badge ${UNI_BADGE[u.verification_status] || 'badge-neutral'}`}>{cap(u.verification_status)}</span></td>
                  <td className="adm-actions">
                    {u.verification_status === 'pending' ? (
                      <>
                        <Link to={`/admin/universities/${u.id}`} state={{ row: u, from: 'approvals' }} className="btn btn-outline btn-sm">Review</Link>{' '}
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirm({ kind: 'verify', row: u })}>{t('Verify')}</button>{' '}
                        <button type="button" className="btn btn-outline btn-sm adm-btn-danger" onClick={() => setConfirm({ kind: 'reject', row: u })}>{t('Reject')}</button>
                      </>
                    ) : <Link to={`/admin/universities/${u.id}`} state={{ row: u, from: 'approvals' }} className="btn btn-outline btn-sm">Review</Link>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="adm-empty" style={{ textAlign: 'center', padding: 28 }}>No verification requests in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && <Pager page={page} setPage={setPage} total={total} />}
      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'verify' ? 'Verify institution' : 'Reject institution'}
          message={confirm.kind === 'verify' ? `Mark ${nameOf(confirm.row)} as verified?` : `Reject the verification request from ${nameOf(confirm.row)}?`}
          confirmLabel={confirm.kind === 'verify' ? t('Verify') : t('Reject')} danger={confirm.kind === 'reject'}
          busy={busy} onConfirm={runConfirmed} onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function ProjectQueue() {
  const t = useTranslations(translations);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [overriding, setOverriding] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/approvals', { page, q: search || undefined })
      .then((json) => { setRows(json.data || []); setTotal(json.meta?.total ?? 0); setCounts(json.meta?.counts || {}); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, search]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="adm-kpis">
        <div className="adm-kpi"><div className="adm-kpi__top">Total decisions <Icon name="file" size={16} /></div><div className="adm-kpi__value">{total.toLocaleString()}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">{t('Pending')} <Icon name="clock" size={16} /></div><div className="adm-kpi__value">{(counts.pending ?? 0).toLocaleString()}</div><div className="adm-kpi__note adm-kpi__note--warn">{(counts.pending ?? 0) > 0 ? 'At universities' : 'None'}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">Approved <Icon name="check-circle" size={16} /></div><div className="adm-kpi__value">{(counts.approved ?? 0).toLocaleString()}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">Rejected <Icon name="x-circle" size={16} /></div><div className="adm-kpi__value">{(counts.rejected ?? 0).toLocaleString()}</div></div>
      </div>
      {actionError && <p className="form-error">{actionError}</p>}
      <div className="adm-filters">
        <div className="adm-filters__search">
          <Icon name="search" size={16} />
          <input className="form-input" placeholder="Search project title…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
      </div>
      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Project</th><th>University</th><th>{t('Status')}</th><th>Decided</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.title?.en || r.title?.ar}</strong></td>
                  <td>{r.university?.en || r.university?.ar}</td>
                  <td><span className={`badge ${PROJECT_BADGE[r.status] || 'badge-neutral'}`}>{cap(r.status)}</span></td>
                  <td>{r.decided || '—'}</td>
                  <td className="adm-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => setOverriding(r)}>{t('Override')}</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="adm-empty" style={{ textAlign: 'center', padding: 28 }}>No projects match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && <Pager page={page} setPage={setPage} total={total} />}
      {overriding && <OverrideModal project={overriding} onClose={() => setOverriding(null)} onDone={(err) => { setOverriding(null); if (err) setActionError(err); else load(); }} />}
    </>
  );
}

function OverrideModal({ project, onClose, onDone }) {
  const t = useTranslations(translations);
  const [status, setStatus] = useState('published');
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/v1/admin/approvals/${project.id}/override`, { status, comments });
      onDone(null);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">Override — {project.title?.en || project.title?.ar}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="published">Approve (publish)</option>
              <option value="rejected">{t('Reject')}</option>
              <option value="draft">{t('Send back to draft')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Reason (required, logged)</label>
            <textarea className="form-input" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} required />
            <p className="form-hint">This override is written to the project's approval history and the admin audit log.</p>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Override Decision'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
