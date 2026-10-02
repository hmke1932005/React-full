import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { Avatar, ConfirmModal, RoleBadge, StatusBadge, UserModal, roleLabel } from '../../components/admin/adminUi';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/users';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * User Details (new page, /admin/users/:uuid). Built only on endpoints that already exist:
 *   GET    /api/v1/admin/users/{uuid}            profile + additional_roles
 *   GET    /api/v1/admin/roles, /roles/{slug}    role names + permission groups + granted_ids
 *   GET    /api/v1/admin/audit-logs?q=           activity (searched by the user's email)
 *   POST   /api/v1/admin/users/{uuid}/suspend | activate | block-ip,  DELETE /users/{uuid}
 * Optional profile fields (last login, email verified, 2FA) are shown only when the API returns them.
 */

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'permissions', label: 'Roles & Permissions' },
  { key: 'activity', label: 'Activity' },
  { key: 'security', label: 'Security' },
];

// Permission slug -> matrix column. Slugs that match none of these are listed as extra chips.
const ACTION_ALIASES = { view: 'view', read: 'view', list: 'view', create: 'create', add: 'create', edit: 'edit', update: 'edit', write: 'edit', approve: 'approve', delete: 'delete', remove: 'delete', export: 'export', manage: 'manage' };
const ACTION_ORDER = ['view', 'create', 'edit', 'approve', 'delete', 'export', 'manage'];

function actionOf(slug) {
  const tokens = String(slug).toLowerCase().split(/[.:_\-\s]+/);
  for (let i = tokens.length - 1; i >= 0; i -= 1) if (ACTION_ALIASES[tokens[i]]) return ACTION_ALIASES[tokens[i]];
  return null;
}

function fmtDate(v) {
  if (!v) return null;
  const d = new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function Fact({ label, children }) {
  return <div className="adm-fact"><small>{label}</small><strong>{children ?? '—'}</strong></div>;
}

function label(v) {
  if (v == null) return '';
  return typeof v === 'object' ? (v.en || v.ar || '') : String(v);
}

export default function AdminUserDetails({ company = false }) {
  const backTo = company ? '/admin/companies' : '/admin/users';
  const backLabel = company ? 'Back to companies' : 'Back to users';
  const t = useTranslations(translations);
  const { uuid } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/api/v1/admin/users/${uuid}`)
      .then((json) => setUser(json.data || null))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [uuid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/api/v1/admin/roles').then((j) => setRoles(j.data || [])).catch(() => {}); }, []);

  async function runConfirmed() {
    if (!confirm) return;
    setBusy(true);
    setActionError(null);
    try {
      if (confirm === 'suspend') await api.post(`/api/v1/admin/users/${uuid}/suspend`);
      else if (confirm === 'activate') await api.post(`/api/v1/admin/users/${uuid}/activate`);
      else if (confirm === 'block-ip') await api.post(`/api/v1/admin/users/${uuid}/block-ip`);
      else if (confirm === 'delete') { await api.del(`/api/v1/admin/users/${uuid}`); navigate(backTo); return; }
      setConfirm(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !user) return <p className="text-small">{t('Loading…')}</p>;
  if (error) {
    return (<><Link to={backTo} className="adm-link-back"><Icon name="chevron-left" size={14} /> {backLabel}</Link><p className="form-error">{error}</p></>);
  }
  if (!user) return null;

  const suspended = user.status === 'suspended';
  const additional = user.additional_roles || [];
  const verifiedKnown = user.email_verified_at !== undefined || user.email_verified !== undefined;
  const verified = Boolean(user.email_verified_at || user.email_verified);

  const CONFIRM = {
    suspend: { title: 'Suspend account', message: `${user.full_name} will lose access until the account is reactivated.`, label: t('Suspend') },
    activate: { title: 'Reactivate account', message: `${user.full_name} will be able to sign in again.`, label: t('Reactivate') },
    'block-ip': { title: 'Block last-known IP', message: `Block ${user.full_name}'s last-known IP address and suspend the account?`, label: t('Block IP'), danger: true },
    delete: { title: 'Delete user', message: `Delete ${user.full_name}? This cannot be undone.`, label: t('Delete'), danger: true },
  };
  const cfg = confirm ? CONFIRM[confirm] : null;

  return (
    <>
      <Link to={backTo} className="adm-link-back"><Icon name="chevron-left" size={14} /> {backLabel}</Link>
      <div className="page-header animate-rise-in">
        <div className="page-header__title"><h1 className="text-h1">{company ? 'Company Details' : 'User Details'}</h1></div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> {company ? 'Edit company' : 'Edit user'}</button>
          {suspended ? (
            <button type="button" className="btn btn-outline" onClick={() => setConfirm('activate')}><Icon name="check-circle" size={16} /> Reactivate account</button>
          ) : (
            <button type="button" className="btn btn-outline" onClick={() => setConfirm('suspend')}><Icon name="x-circle" size={16} /> Suspend account</button>
          )}
        </div>
      </div>
      {actionError && <p className="form-error">{actionError}</p>}

      <div className="adm-profile">
        <Avatar name={user.full_name} large />
        <div>
          <h2>{user.full_name}</h2>
          <p>{user.email}{user.uuid ? ` · ID ${String(user.uuid).slice(0, 8).toUpperCase()}` : ''}</p>
          <div className="adm-profile__badges">
            <RoleBadge roles={roles} slug={user.role} />
            {verifiedKnown && verified && <span className="badge badge-success">Verified</span>}
            <StatusBadge status={user.status} />
          </div>
        </div>
      </div>

      <div className="adm-tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} className={`adm-tab${tab === x.key ? ' is-active' : ''}`} onClick={() => setTab(x.key)}>
            {t(x.label)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="adm-facts">
          <Fact label="Primary role">{roleLabel(roles, user.role)}</Fact>
          <Fact label={t('Status')}>{user.status}</Fact>
          <Fact label="Phone">{user.phone}</Fact>
          <Fact label="Joined">{fmtDate(user.created_at)}</Fact>
          {(user.last_login_at || user.last_login) && <Fact label="Last sign-in">{fmtDate(user.last_login_at || user.last_login)}</Fact>}
          {user.email_verified_at && <Fact label="Email verified">{fmtDate(user.email_verified_at)}</Fact>}
          <Fact label="Additional access">
            {additional.length ? additional.map((s) => roleLabel(roles, s)).join(', ') : 'None granted'}
          </Fact>
        </div>
      )}

      {tab === 'permissions' && <PermissionsTab user={user} roles={roles} additional={additional} />}
      {tab === 'activity' && <ActivityTab user={user} />}

      {tab === 'security' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="adm-facts">
            <Fact label="Account status">{user.status}</Fact>
            {user.two_factor_enabled !== undefined && <Fact label="Two-factor authentication">{user.two_factor_enabled ? 'Enabled' : 'Disabled'}</Fact>}
            {(user.last_login_at || user.last_login) && <Fact label="Last sign-in">{fmtDate(user.last_login_at || user.last_login)}</Fact>}
          </div>
          <div className="adm-panel adm-danger">
            <div className="adm-panel__head"><div><h3>Account controls</h3><p>These actions are recorded in the audit log.</p></div></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {suspended ? (
                <button type="button" className="btn btn-outline" onClick={() => setConfirm('activate')}>{t('Reactivate')}</button>
              ) : (
                <button type="button" className="btn btn-outline" onClick={() => setConfirm('suspend')}>{t('Suspend')}</button>
              )}
              <button type="button" className="btn btn-outline adm-btn-danger" onClick={() => setConfirm('block-ip')}>{t('Block IP')}</button>
              <button type="button" className="btn btn-outline adm-btn-danger" onClick={() => setConfirm('delete')}>{t('Delete')}</button>
            </div>
          </div>
        </div>
      )}

      {editing && <UserModal user={user} roles={roles} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {cfg && <ConfirmModal title={cfg.title} message={cfg.message} confirmLabel={cfg.label} danger={cfg.danger} busy={busy} onConfirm={runConfirmed} onClose={() => setConfirm(null)} />}
    </>
  );
}

function PermissionsTab({ user, roles, additional }) {
  const [groups, setGroups] = useState({});
  const [granted, setGranted] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const slugs = useMemo(() => [user.role, ...additional].filter(Boolean), [user.role, additional]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(slugs.map((s) => api.get(`/api/v1/admin/roles/${s}`)))
      .then((results) => {
        if (cancelled) return;
        const ids = new Set();
        results.forEach((r) => (r.data?.granted_ids || []).forEach((id) => ids.add(id)));
        setGroups(results[0]?.data?.permission_groups || {});
        setGranted(ids);
      })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slugs]);

  const columns = useMemo(() => {
    const present = new Set();
    Object.values(groups).forEach((perms) => (perms || []).forEach((p) => { const a = actionOf(p.slug); if (a) present.add(a); }));
    return ACTION_ORDER.filter((a) => present.has(a));
  }, [groups]);

  return (
    <div className="adm-panel">
      <div className="adm-panel__head">
        <div>
          <h3>Permission matrix</h3>
          <p>{roleLabel(roles, user.role)} access profile{additional.length ? ` + ${additional.length} additional role${additional.length > 1 ? 's' : ''}` : ''}</p>
        </div>
        <Link to="/admin/roles" className="btn btn-outline btn-sm"><Icon name="edit" size={14} /> Edit permissions</Link>
      </div>
      {loading && <p className="adm-empty">Loading…</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && Object.keys(groups).length === 0 && <p className="adm-empty">No permissions are defined yet.</p>}
      {!loading && !error && Object.keys(groups).length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="adm-matrix">
            <thead>
              <tr><th /><>{columns.map((c) => <th key={c}>{c}</th>)}</><th style={{ textAlign: 'start' }}>Other</th></tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([moduleName, perms]) => {
                const list = perms || [];
                const extras = list.filter((p) => !actionOf(p.slug));
                return (
                  <tr key={moduleName}>
                    <td>{moduleName}</td>
                    {columns.map((c) => {
                      const p = list.find((x) => actionOf(x.slug) === c);
                      if (!p) return <td key={c}><span className="adm-matrix__none">–</span></td>;
                      const on = granted.has(p.id);
                      return (
                        <td key={c} title={p.slug}>
                          <span className={`adm-check${on ? ' is-on' : ''}`} role="img" aria-label={`${c}: ${on ? 'granted' : 'not granted'}`}>{on && <Icon name="check" size={12} />}</span>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'start' }}>
                      {extras.map((p) => (
                        <span key={p.id} className={`badge ${granted.has(p.id) ? 'badge-primary' : 'badge-neutral'}`} style={{ marginInlineEnd: 4 }} title={p.description || ''}>{p.slug}</span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ user }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/admin/audit-logs', { page: 1, per_page: 15, q: user.email })
      .then((json) => { if (!cancelled) setRows(json.data || []); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user.email]);

  return (
    <div className="adm-panel">
      <div className="adm-panel__head">
        <div><h3>Recent activity</h3><p>Audit-log entries that mention {user.email}.</p></div>
        <Link to="/admin/audit-logs" className="btn btn-outline btn-sm">Open audit log</Link>
      </div>
      {loading && <p className="adm-empty">Loading…</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="adm-empty">No recorded activity for this user.</p>}
      {rows.map((r, i) => (
        <div key={i} className="adm-dot-item">
          <span>{label(r.action)}{r.target ? ` — ${r.target}` : ''}</span>
          <span className="adm-muted">{r.time ? r.time.slice(0, 16).replace('T', ' ') : ''}</span>
        </div>
      ))}
    </div>
  );
}
