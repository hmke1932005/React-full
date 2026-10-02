import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { Avatar, ConfirmModal, StatusBadge } from '../../components/admin/adminUi';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';

const translations = { ...i18nCommon };

/**
 * Companies (new page, /admin/companies). The platform has no dedicated companies API,
 * so this is a focused view over accounts whose primary role is `company`, using the
 * existing /api/v1/admin/users endpoints (list, suspend, activate). Industry, project
 * counts and verification from the design are not available and are not shown.
 */

const PER_PAGE = 20;
const ROLE = 'company';

export default function AdminCompanies() {
  const t = useTranslations(translations);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/users', { page, per_page: PER_PAGE, role: ROLE, status: status || undefined, q: search || undefined })
      .then((json) => {
        setRows(json.data || []);
        setTotal(json.meta?.total ?? 0);
        setCounts(json.meta?.counts_by_status || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, status, search]);

  useEffect(() => { load(); }, [load]);

  async function runConfirmed() {
    if (!confirm) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/admin/users/${confirm.row.uuid}/${confirm.kind}`);
      setConfirm(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasFilters = Boolean(search || status);

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">Companies</h1>
          <p className="text-small">Company accounts on the platform and their access status.</p>
        </div>
      </div>

      <div className="adm-kpis">
        <div className="adm-kpi"><div className="adm-kpi__top">Company accounts <Icon name="briefcase" size={16} /></div><div className="adm-kpi__value">{total.toLocaleString()}</div><div className="adm-kpi__note">{hasFilters ? 'matching current filters' : 'all companies'}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">{t('Active')} <Icon name="pulse" size={16} /></div><div className="adm-kpi__value">{(counts.active ?? 0).toLocaleString()}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">{t('Pending')} <Icon name="clock" size={16} /></div><div className="adm-kpi__value">{(counts.pending ?? 0).toLocaleString()}</div><div className="adm-kpi__note adm-kpi__note--warn">{(counts.pending ?? 0) > 0 ? 'Awaiting review' : 'None'}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">Suspended <Icon name="x-circle" size={16} /></div><div className="adm-kpi__value">{(counts.suspended ?? 0).toLocaleString()}</div></div>
      </div>

      {actionError && <p className="form-error">{actionError}</p>}

      <div className="adm-filters">
        <div className="adm-filters__search">
          <Icon name="search" size={16} />
          <input className="form-input" placeholder="Search company name or email…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <select className="form-input" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} style={{ maxWidth: 180 }}>
          <option value="">All statuses</option>
          <option value="active">{t('Active')}</option>
          <option value="pending">{t('Pending')}</option>
          <option value="suspended">Suspended</option>
        </select>
        {hasFilters && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatus(''); setPage(1); }}>Clear filters</button>}
      </div>

      {loading && <p className="text-small">Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Company</th><th>Status</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.uuid || u.id}>
                  <td>
                    <Link to={`/admin/companies/${u.uuid}`} className="adm-person">
                      <Avatar name={u.full_name} />
                      <span><strong>{u.full_name}</strong><small>{u.email}</small></span>
                    </Link>
                  </td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>{u.created_at ? u.created_at.slice(0, 10) : '—'}</td>
                  <td className="adm-actions">
                    <Link to={`/admin/companies/${u.uuid}`} className="btn btn-outline btn-sm">View</Link>
                    {u.status === 'suspended' ? (
                      <button type="button" className="btn btn-ghost btn-sm" title="Reactivate" onClick={() => setConfirm({ kind: 'activate', row: u })}><Icon name="check-circle" size={16} /></button>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" title="Suspend" onClick={() => setConfirm({ kind: 'suspend', row: u })}><Icon name="x-circle" size={16} /></button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="adm-empty" style={{ textAlign: 'center', padding: 28 }}>No company accounts match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && total > 0 && (
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
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'suspend' ? 'Suspend account' : 'Reactivate account'}
          message={confirm.kind === 'suspend' ? `${confirm.row.full_name} will lose access until reactivated.` : `${confirm.row.full_name} will be able to sign in again.`}
          confirmLabel={confirm.kind === 'suspend' ? 'Suspend' : 'Reactivate'}
          busy={busy} onConfirm={runConfirmed} onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
