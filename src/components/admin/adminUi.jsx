import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/users';

const translations = { ...i18nCommon, ...i18nPage };

export const STATUS_BADGE = { active: 'badge-success', suspended: 'badge-danger', pending: 'badge-warning' };

export function initialsOf(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, large }) {
  return <span className={`adm-avatar${large ? ' adm-avatar--lg' : ''}`}>{initialsOf(name)}</span>;
}

export function StatusBadge({ status }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
  return <span className={`badge ${STATUS_BADGE[status] || 'badge-neutral'}`}>{label}</span>;
}

export function roleLabel(roles, slug) {
  const r = (roles || []).find((x) => x.slug === slug);
  return r?.name_en || slug || '—';
}

export function RoleBadge({ roles, slug }) {
  return <span className="badge badge-primary">{roleLabel(roles, slug)}</span>;
}

/** In-page replacement for window.confirm() — matches the design's "Confirm action" dialog. */
export function ConfirmModal({ title, message, confirmLabel, danger, busy, onConfirm, onClose }) {
  const t = useTranslations(translations);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{title || 'Confirm action'}</h2>
        <p className="adm-modal-text">{message}</p>
        <div className="modal-box__actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
          <button type="button" className={`btn btn-primary${danger ? ' adm-btn-danger' : ''}`} disabled={busy} onClick={onConfirm}
            style={danger ? { background: 'var(--color-danger)', borderColor: 'var(--color-danger)', color: '#fff' } : undefined}>
            {busy ? '…' : (confirmLabel || 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Add / Edit user dialog. Same endpoints and payloads the page used before the
 * redesign (POST /api/v1/admin/users, PATCH /api/v1/admin/users/{uuid}, secondary
 * roles via POST/DELETE /api/v1/admin/users/{uuid}/roles[/{slug}]).
 */
export function UserModal({ user, roles, onClose, onSaved }) {
  const t = useTranslations(translations);
  const isNew = !user;
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || roles[0]?.slug || '');
  const [status, setStatus] = useState(user?.status || 'active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [additionalRoles, setAdditionalRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(!isNew);
  const [grantRole, setGrantRole] = useState('');
  const [roleActionError, setRoleActionError] = useState(null);
  const [roleActionBusy, setRoleActionBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    setRolesLoading(true);
    api.get(`/api/v1/admin/users/${user.uuid}`)
      .then((json) => setAdditionalRoles(json.data?.additional_roles || []))
      .catch(() => {})
      .finally(() => setRolesLoading(false));
  }, [isNew, user?.uuid]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isNew) await api.post('/api/v1/admin/users', { full_name: fullName, email, phone, password, role });
      else await api.patch(`/api/v1/admin/users/${user.uuid}`, { full_name: fullName, email, phone, status, role });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function refreshRoles() {
    const json = await api.get(`/api/v1/admin/users/${user.uuid}`);
    setAdditionalRoles(json.data?.additional_roles || []);
  }

  async function handleGrantRole() {
    if (!grantRole) return;
    setRoleActionError(null); setRoleActionBusy(true);
    try { await api.post(`/api/v1/admin/users/${user.uuid}/roles`, { role: grantRole }); await refreshRoles(); setGrantRole(''); }
    catch (err) { setRoleActionError(errorMessage(err)); }
    finally { setRoleActionBusy(false); }
  }

  async function handleRevokeRole(slug) {
    setRoleActionError(null); setRoleActionBusy(true);
    try { await api.del(`/api/v1/admin/users/${user.uuid}/roles/${slug}`); await refreshRoles(); }
    catch (err) { setRoleActionError(errorMessage(err)); }
    finally { setRoleActionBusy(false); }
  }

  const grantableRoles = roles.filter((r) => r.slug !== role && !additionalRoles.includes(r.slug));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{isNew ? t('Add User') : `${t('Edit')} ${user.full_name}`}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Email')}</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {isNew && (
            <div className="form-group">
              <label className="form-label">Temporary password</label>
              <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Primary role</label>
            <select className="form-input" value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => <option key={r.slug} value={r.slug}>{r.name_en || r.slug}</option>)}
            </select>
          </div>
          {!isNew && (
            <div className="form-group">
              <label className="form-label">{t('Status')}</label>
              <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">{t('Active')}</option>
                <option value="suspended">{t('Suspended')}</option>
                <option value="pending">{t('Pending')}</option>
              </select>
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : (isNew ? 'Create user' : 'Save')}</button>
          </div>
        </form>

        {!isNew && (
          <div className="form-group" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <label className="form-label">Additional access (secondary roles)</label>
            {rolesLoading ? (
              <p className="text-small">{t('Loading…')}</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {additionalRoles.length === 0 && <p className="text-small">No additional roles granted.</p>}
                  {additionalRoles.map((slug) => (
                    <span key={slug} className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {roleLabel(roles, slug)}
                      <button type="button" disabled={roleActionBusy} title="Revoke this access" onClick={() => handleRevokeRole(slug)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, color: 'inherit' }}>
                        <Icon name="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-input" value={grantRole} onChange={(e) => setGrantRole(e.target.value)} style={{ maxWidth: 220 }}>
                    <option value="">Grant additional role…</option>
                    {grantableRoles.map((r) => <option key={r.slug} value={r.slug}>{r.name_en || r.slug}</option>)}
                  </select>
                  <button type="button" className="btn btn-outline btn-sm" disabled={!grantRole || roleActionBusy} onClick={handleGrantRole}>Grant</button>
                </div>
                {roleActionError && <p className="form-error">{roleActionError}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Smooth area/line chart (inline SVG, no chart library). points: [{ label, value }].
 * Colours come from the Admin palette tokens so it follows light/dark.
 */
export function AreaChart({ points, height = 220 }) {
  const W = 640;
  const H = height;
  const padL = 8, padR = 14, padT = 14, padB = 26;
  if (!points || points.length === 0) return <p className="adm-empty">Not enough data yet.</p>;
  const max = Math.max(1, ...points.map((p) => Number(p.value) || 0));
  const step = points.length > 1 ? (W - padL - padR) / (points.length - 1) : 0;
  const xy = points.map((p, i) => [padL + (points.length > 1 ? i * step : (W - padL - padR) / 2), padT + (1 - (Number(p.value) || 0) / max) * (H - padT - padB)]);
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i += 1) {
    const mx = (xy[i - 1][0] + xy[i][0]) / 2;
    d += ` C${mx},${xy[i - 1][1]} ${mx},${xy[i][1]} ${xy[i][0]},${xy[i][1]}`;
  }
  const base = H - padB;
  const area = `${d} L${xy[xy.length - 1][0]},${base} L${xy[0][0]},${base} Z`;
  const last = xy[xy.length - 1];
  const gid = `adm-grad-${points.length}-${max}`;
  return (
    <svg className="adm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} className="adm-chart__grid" />)}
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="4" fill="var(--color-primary)" />
      {points.map((p, i) => (
        <text key={i} x={xy[i][0]} y={H - 7} textAnchor="middle" className="adm-chart__label">{p.label}</text>
      ))}
    </svg>
  );
}

/** Paged footer shared by the Admin list pages. */
export function Pager({ page, setPage, total, perPage }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;
  return (
    <div className="adm-pager">
      <span>Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total.toLocaleString()}</span>
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
