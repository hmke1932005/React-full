import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { Avatar, ConfirmModal, RoleBadge, StatusBadge, UserModal } from '../../components/admin/adminUi';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/users';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Users & Roles list — Admin design. Talks to the same real API as before
 * (/api/v1/admin/users, /api/v1/admin/roles); nothing here is invented.
 * Every row links to the new User Details page (/admin/users/:uuid).
 * window.confirm() is replaced by the in-page "Confirm action" dialog.
 */

const PER_PAGE = 20;

export default function AdminUsers() {
  const t = useTranslations(translations);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [countsByStatus, setCountsByStatus] = useState({});
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(null); // user | 'new' | null
  const [confirm, setConfirm] = useState(null); // { kind, user }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/users', {
      page, per_page: PER_PAGE, role: roleFilter || undefined,
      status: statusFilter || undefined, q: search || undefined,
    })
      .then((json) => {
        setRows(json.data || []);
        setTotal(json.meta?.total ?? 0);
        setCountsByStatus(json.meta?.counts_by_status || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, roleFilter, statusFilter, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/api/v1/admin/roles').then((json) => setRoles(json.data || [])).catch(() => {});
  }, []);

  async function runConfirmed() {
    if (!confirm) return;
    const { kind, user: u } = confirm;
    setBusy(true);
    setActionError(null);
    try {
      if (kind === 'suspend') await api.post(`/api/v1/admin/users/${u.uuid}/suspend`);
      else if (kind === 'activate') await api.post(`/api/v1/admin/users/${u.uuid}/activate`);
      else if (kind === 'block-ip') await api.post(`/api/v1/admin/users/${u.uuid}/block-ip`);
      else if (kind === 'delete') await api.del(`/api/v1/admin/users/${u.uuid}`);
      setNotice(`${u.full_name}: done.`);
      setConfirm(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  const CONFIRM_TEXT = {
    suspend: (u) => ({ title: 'Suspend account', message: `${u.full_name} will lose access until the account is reactivated.`, label: t('Suspend') }),
    activate: (u) => ({ title: 'Reactivate account', message: `${u.full_name} will be able to sign in again.`, label: t('Reactivate') }),
    'block-ip': (u) => ({ title: 'Block last-known IP', message: `Block ${u.full_name}'s last-known IP address and suspend the account?`, label: t('Block IP'), danger: true }),
    delete: (u) => ({ title: 'Delete user', message: `Delete ${u.full_name}? This cannot be undone.`, label: t('Delete'), danger: true }),
  };
  const confirmCfg = confirm ? CONFIRM_TEXT[confirm.kind](confirm.user) : null;

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasFilters = Boolean(search || roleFilter || statusFilter);

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">Users &amp; Roles</h1>
          <p className="text-small">Manage platform accounts, primary roles and access status.</p>
        </div>
        <div className="page-header__actions">
          <Link to="/admin/roles" className="btn btn-outline"><Icon name="shield" size={16} /> Manage roles</Link>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> {t('Add User')}
          </button>
        </div>
      </div>

      <div className="adm-kpis">
        <div className="adm-kpi">
          <div className="adm-kpi__top">Total users <Icon name="users" size={16} /></div>
          <div className="adm-kpi__value">{total.toLocaleString()}</div>
          <div className="adm-kpi__note">{hasFilters ? 'matching current filters' : 'all accounts'}</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi__top">{t('Active')} <Icon name="pulse" size={16} /></div>
          <div className="adm-kpi__value">{(countsByStatus.active ?? 0).toLocaleString()}</div>
          <div className="adm-kpi__note adm-kpi__note--good">can sign in</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi__top">{t('Pending')} <Icon name="clock" size={16} /></div>
          <div className="adm-kpi__value">{(countsByStatus.pending ?? 0).toLocaleString()}</div>
          <div className="adm-kpi__note adm-kpi__note--warn">awaiting activation</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi__top">{t('Suspended')} <Icon name="x-circle" size={16} /></div>
          <div className="adm-kpi__value">{(countsByStatus.suspended ?? 0).toLocaleString()}</div>
          <div className="adm-kpi__note adm-kpi__note--bad">need manual review</div>
        </div>
      </div>

      {notice && <p className="adm-empty" style={{ color: 'var(--color-success)' }}>{notice}</p>}
      {actionError && <p className="form-error">{actionError}</p>}

      <div className="adm-filters">
        <div className="adm-filters__search">
          <Icon name="search" size={16} />
          <input className="form-input" placeholder={t('Search by name or email...')} value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        </div>
        <select className="form-input" value={roleFilter} onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }} style={{ maxWidth: 200 }}>
          <option value="">{t('All Roles')}</option>
          {roles.map((r) => <option key={r.slug} value={r.slug}>{r.name_en || r.slug}</option>)}
        </select>
        <select className="form-input" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} style={{ maxWidth: 180 }}>
          <option value="">{t('All Statuses')}</option>
          <option value="active">{t('Active')}</option>
          <option value="suspended">{t('Suspended')}</option>
          <option value="pending">{t('Pending')}</option>
        </select>
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}>
            Clear filters
          </button>
        )}
      </div>

      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>{t('Name')}</th><th>{t('Role')}</th><th>{t('Status')}</th><th>{t('Joined')}</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.uuid || u.id}>
                  <td>
                    <Link to={`/admin/users/${u.uuid}`} className="adm-person">
                      <Avatar name={u.full_name} />
                      <span><strong>{u.full_name}</strong><small>{u.email}</small></span>
                    </Link>
                  </td>
                  <td><RoleBadge roles={roles} slug={u.role} /></td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>{u.created_at ? u.created_at.slice(0, 10) : '—'}</td>
                  <td className="adm-actions">
                    <Link to={`/admin/users/${u.uuid}`} className="btn btn-ghost btn-sm" title="View details"><Icon name="eye" size={16} /></Link>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(u)} title={t('Edit')}><Icon name="edit" size={16} /></button>
                    {u.status === 'suspended' ? (
                      <button type="button" className="btn btn-ghost btn-sm" title={t('Reactivate')} onClick={() => setConfirm({ kind: 'activate', user: u })}>
                        <Icon name="check-circle" size={16} />
                      </button>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" title={t('Suspend')} onClick={() => setConfirm({ kind: 'suspend', user: u })}>
                        <Icon name="x-circle" size={16} />
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" title={t('Block IP')} onClick={() => setConfirm({ kind: 'block-ip', user: u })}>
                      <Icon name="shield" size={16} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" title={t('Delete')} onClick={() => setConfirm({ kind: 'delete', user: u })}>
                      <Icon name="trash" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="adm-empty" style={{ textAlign: 'center', padding: 28 }}>{t('No matching users.')}</td></tr>
              )}
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

      {editing && (
        <UserModal
          user={editing === 'new' ? null : editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setNotice('Saved.'); load(); }}
        />
      )}
      {confirmCfg && (
        <ConfirmModal title={confirmCfg.title} message={confirmCfg.message} confirmLabel={confirmCfg.label}
          danger={confirmCfg.danger} busy={busy} onConfirm={runConfirmed} onClose={() => setConfirm(null)} />
      )}
    </>
  );
}
