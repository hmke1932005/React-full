import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { ConfirmModal } from '../../components/admin/adminUi';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/roles';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/admin/roles.php + role-permissions.php + role-create.php,
 * talking to the real JSON API (app/Controllers/Api/AdminRolesApiController.php,
 * /api/v1/admin/roles/*). Every role in `roles` (the six core roles plus any
 * custom ones — the platform now has 13, not just six, roles.php's own
 * comment is stale), each with live user/permission counts from
 * RolePermissionRepository::rolesWithCounts() — nothing here is invented.
 * Permission editing replaces the whole set (not a diff), same as the
 * web's checklist editor (AdminRolesApiController::updatePermissions doc).
 *
 * Card icon is presentation-only (roles.php: "icon has no column in
 * `roles` — it's UI chrome, not data") — same $roleIcons lookup, same
 * 'shield' fallback for every role beyond the original six.
 */

const ROLE_ICONS = {
  student: 'user', university: 'building',
  admin: 'shield',
};

export default function AdminRoles() {
  const t = useTranslations(translations);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSlug, setEditingSlug] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/roles')
      .then((json) => setRoles(json.data || []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    setBusy(true);
    setActionError(null);
    try {
      await api.del(`/api/v1/admin/roles/${deleting.slug}`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  const customCount = roles.filter((r) => Number(r.is_system ?? 1) !== 1).length;
  const totalUsers = roles.reduce((n, r) => n + Number(r.users_count ?? 0), 0);

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Roles & Permissions')}</h1>
          <p className="text-small">The platform's core roles, and what each one is permitted to do.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} /> {t('New Custom Role')}
          </button>
        </div>
      </div>

      {!loading && !error && (
        <div className="adm-kpis">
          <div className="adm-kpi"><div className="adm-kpi__top">Roles <Icon name="shield" size={16} /></div><div className="adm-kpi__value">{roles.length}</div></div>
          <div className="adm-kpi"><div className="adm-kpi__top">{t('Custom role')} <Icon name="edit" size={16} /></div><div className="adm-kpi__value">{customCount}</div></div>
          <div className="adm-kpi"><div className="adm-kpi__top">Users with a role <Icon name="users" size={16} /></div><div className="adm-kpi__value">{totalUsers.toLocaleString()}</div></div>
        </div>
      )}

      {actionError && <p className="form-error">{actionError}</p>}
      {loading && <p className="adm-empty">Loading roles…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <div className="adm-role-grid">
          {roles.map((r) => {
            const isSystem = Number(r.is_system ?? 1) === 1;
            return (
              <div key={r.slug} className="adm-panel adm-role">
                <div className="adm-role__head">
                  <span className="adm-report-type__icon"><Icon name={ROLE_ICONS[r.slug] || 'shield'} size={20} /></span>
                  <div>
                    <h3>{r.name_en}</h3>
                    <small>{(r.users_count ?? 0).toLocaleString()} users</small>
                  </div>
                  {!isSystem && <span className="badge badge-info" style={{ marginInlineStart: 'auto' }}>{t('Custom role')}</span>}
                </div>
                <p className="adm-role__desc">{r.description || '—'}</p>
                <div className="adm-role__foot">
                  <span className="badge badge-neutral">{r.permissions_count ?? 0} permissions</span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingSlug(r.slug)}>
                      <Icon name="edit" size={14} /> {t('Edit')}
                    </button>
                    {!isSystem && (
                      <button type="button" className="btn btn-ghost btn-sm adm-btn-danger" onClick={() => setDeleting(r)}>
                        <Icon name="trash" size={14} /> {t('Delete')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingSlug && (
        <PermissionsModal slug={editingSlug} onClose={() => setEditingSlug(null)} onSaved={() => { setEditingSlug(null); load(); }} />
      )}
      {deleting && (
        <ConfirmModal title="Confirm action" message={`Delete the custom role "${deleting.name_en}"? Users holding it lose its permissions.`} confirmLabel={t('Delete')} danger busy={busy} onConfirm={handleDelete} onClose={() => setDeleting(null)} />
      )}
      {creating && (
        <CreateRoleModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />
      )}
    </>
  );
}

const humanize = (txt) => {
  const out = String(txt || '').replace(/[_.]+/g, ' ').trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
};

// "data_analysis.dashboard.view" -> label "Dashboard view" (the module is already the group title)
function permLabel(p) {
  const slug = String(p.slug || '');
  const mod = String(p.module || '');
  const rest = mod && slug.startsWith(`${mod}.`) ? slug.slice(mod.length + 1) : slug.split('.').slice(1).join('.') || slug;
  return humanize(rest);
}

function PermissionsModal({ slug, onClose, onSaved }) {
  const t = useTranslations(translations);
  const [role, setRole] = useState(null);
  // allPermissionsGrouped() returns { moduleName: [ {id, slug, module, description}, ... ] }
  const [groups, setGroups] = useState({});
  const [granted, setGranted] = useState(new Set());
  const [initial, setInitial] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [onlyGranted, setOnlyGranted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/admin/roles/${slug}`)
      .then((json) => {
        if (cancelled) return;
        setRole(json.data.role);
        setGroups(json.data.permission_groups || {});
        const ids = new Set(json.data.granted_ids || []);
        setGranted(ids);
        setInitial(new Set(ids));
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const allPerms = useMemo(() => Object.values(groups).flat().filter(Boolean), [groups]);
  const total = allPerms.length;
  const dirty = useMemo(() => {
    if (granted.size !== initial.size) return true;
    for (const id of granted) if (!initial.has(id)) return true;
    return false;
  }, [granted, initial]);

  function toggle(id) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setMany(ids, on) {
    setGranted((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/v1/admin/roles/${slug}/permissions`, { permissions: Array.from(granted) });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const q = query.trim().toLowerCase();
  const visibleGroups = Object.entries(groups)
    .map(([moduleName, perms]) => {
      const list = (perms || []).filter((p) => {
        if (onlyGranted && !granted.has(p.id)) return false;
        if (!q) return true;
        return `${p.slug} ${p.description || ''} ${moduleName}`.toLowerCase().includes(q);
      });
      return [moduleName, perms || [], list];
    })
    .filter(([, , list]) => list.length > 0);

  return (
    <div className="modal-overlay" onClick={() => { if (!dirty && !saving) onClose(); }}>
      <div className="adm-perm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="adm-perm__head">
          <div>
            <h2 className="text-h3">{role ? `${role.name_en} — Permissions` : 'Permissions'}</h2>
            <p className="adm-muted">{loading ? '…' : `${granted.size} of ${total} permissions granted`}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Close" onClick={onClose}><Icon name="x" size={18} /></button>
        </header>

        <div className="adm-perm__toolbar">
          <div className="adm-filters__search">
            <Icon name="search" size={15} />
            <input className="form-input" type="text" placeholder="Search permissions…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="adm-seg" role="group">
            <button type="button" className={!onlyGranted ? 'is-active' : ''} onClick={() => setOnlyGranted(false)}>All</button>
            <button type="button" className={onlyGranted ? 'is-active' : ''} onClick={() => setOnlyGranted(true)}>Granted</button>
          </div>
          <div className="adm-perm__bulk">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMany(allPerms.map((p) => p.id), true)}>Grant all</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMany(allPerms.map((p) => p.id), false)}>Revoke all</button>
          </div>
        </div>

        <div className="adm-perm__body">
          {loading && <p className="text-small">{t('Loading…')}</p>}
          {error && <p className="form-error">{error}</p>}
          {!loading && !error && visibleGroups.length === 0 && <p className="adm-empty" style={{ padding: 28, textAlign: 'center' }}>No permissions match.</p>}
          {!loading && visibleGroups.map(([moduleName, all, list]) => {
            const ids = all.map((p) => p.id);
            const on = ids.filter((id) => granted.has(id)).length;
            const state = on === 0 ? '' : on === ids.length ? ' is-all' : ' is-some';
            return (
              <section key={moduleName} className="adm-perm-group">
                <div className="adm-perm-group__head">
                  <div>
                    <h3>{humanize(moduleName)}</h3>
                    <span className={`adm-perm-group__count${state}`}>{on}/{ids.length} granted</span>
                  </div>
                  <label className="switch" title={on === ids.length ? 'Revoke all in this module' : 'Grant all in this module'}>
                    <input type="checkbox" checked={on === ids.length} onChange={(e) => setMany(ids, e.target.checked)} />
                    <span className="switch__track" />
                  </label>
                </div>
                <ul className="adm-perm-group__list">
                  {list.map((p) => (
                    <li key={p.id} className="adm-perm-row">
                      <div className="adm-perm-row__text">
                        <strong>{permLabel(p)}</strong>
                        <code>{p.slug}</code>
                        {p.description && <span className="adm-muted">{p.description}</span>}
                      </div>
                      <label className="switch">
                        <input type="checkbox" checked={granted.has(p.id)} onChange={() => toggle(p.id)} aria-label={p.slug} />
                        <span className="switch__track" />
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="adm-perm__foot">
          <span className="adm-muted">{dirty ? 'You have unsaved changes' : 'No changes'}</span>
          <div>
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
            <button type="button" className="btn btn-primary" disabled={saving || loading || !dirty} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function CreateRoleModal({ onClose, onSaved }) {
  const t = useTranslations(translations);
  const [slug, setSlug] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/admin/roles', { slug, name_en: nameEn, name_ar: nameAr, description: description || undefined });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">New Role</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Identifier (slug)</label>
            <input className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. content_moderator" required />
          </div>
          <div className="form-group">
            <label className="form-label">Name (English)</label>
            <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Name (Arabic)</label>
            <input className="form-input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Role'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
