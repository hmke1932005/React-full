import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { Avatar, ConfirmModal, StatusBadge } from '../../components/admin/adminUi';
import { useTranslations } from '../../context/LanguageContext';
import translations from '../../i18n/admin/team';

/**
 * Mirrors app/Views/admin/team.php. Admin\AdminTeamController is
 * deliberately thin — "who else has Admin access" is just the same user
 * directory filtered to role=admin, reusing AdminUserManagementController's
 * routes for every action rather than duplicating them. Same here: this
 * page talks to the exact same /api/v1/admin/users/* endpoints as
 * AdminUsers.jsx, just pre-filtered to role=admin, with the create form
 * preset to role=admin instead of showing a role picker.
 */

export default function AdminTeam() {
  const t = useTranslations(translations);
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/users', { role: 'admin', per_page: 100 })
      .then((json) => setRows(json.data || []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runAction(promise) {
    setActionError(null);
    try {
      await promise;
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function confirmRemove() {
    setBusy(true);
    await runAction(api.del(`/api/v1/admin/users/${removing.uuid}`));
    setBusy(false);
    setRemoving(null);
  }

  const activeCount = rows.filter((u) => u.status !== 'suspended').length;
  const suspendedCount = rows.length - activeCount;

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Team Management')}</h1>
          <p className="text-small">{t('Every account with full administrative access to the platform.')}</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus-circle" size={18} /> {t('Add Admin')}
          </button>
        </div>
      </div>

      {!loading && !error && (
        <div className="adm-kpis">
          <div className="adm-kpi"><div className="adm-kpi__top">Administrators <Icon name="shield" size={16} /></div><div className="adm-kpi__value">{rows.length}</div></div>
          <div className="adm-kpi"><div className="adm-kpi__top">{t('Active')} <Icon name="check-circle" size={16} /></div><div className="adm-kpi__value">{activeCount}</div></div>
          <div className="adm-kpi"><div className="adm-kpi__top">{t('Suspended')} <Icon name="x-circle" size={16} /></div><div className="adm-kpi__value">{suspendedCount}</div></div>
        </div>
      )}

      {actionError && <p className="form-error">{actionError}</p>}
      {loading && <p className="text-small">{t('Loading team…')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>{t('Name')}</th><th>{t('Email')}</th><th>{t('Status')}</th><th>{t('Joined')}</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = String(u.id) === String(currentUser?.id);
                return (
                  <tr key={u.uuid || u.id}>
                    <td><div className="adm-person"><Avatar name={u.full_name} /><span><strong>{u.full_name}{isSelf && <span className="badge badge-neutral" style={{ marginInlineStart: 'var(--space-2)' }}>{t('You')}</span>}</strong></span></div></td>
                    <td>{u.email}</td>
                    <td><StatusBadge status={u.status === 'suspended' ? 'suspended' : 'active'} /></td>
                    <td>{u.created_at ? u.created_at.slice(0, 10) : ''}</td>
                    <td className="adm-actions">
                      {!isSelf && (
                        <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                          {u.status === 'suspended' ? (
                            <button type="button" className="btn btn-ghost btn-sm" title={t('Activate')}
                              onClick={() => runAction(api.post(`/api/v1/admin/users/${u.uuid}/activate`))}>
                              <Icon name="check-circle" size={16} />
                            </button>
                          ) : (
                            <button type="button" className="btn btn-ghost btn-sm" title={t('Suspend')}
                              onClick={() => runAction(api.post(`/api/v1/admin/users/${u.uuid}/suspend`))}>
                              <Icon name="x-circle" size={16} />
                            </button>
                          )}
                          <button
                            type="button" className="btn btn-ghost btn-sm" title={t('Remove admin access')}
                            onClick={() => setRemoving(u)}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="adm-empty" style={{ padding: 28, textAlign: 'center' }}>{t('No admin accounts found.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {removing && (
        <ConfirmModal
          title="Confirm action"
          message={t("Delete {name}'s account? This cannot be undone.").replace('{name}', removing.full_name)}
          confirmLabel={t('Remove admin access')}
          danger
          busy={busy}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}
      {creating && <AddAdminModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </>
  );
}

function AddAdminModal({ onClose, onSaved }) {
  const t = useTranslations(translations);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/admin/users', { full_name: fullName, email, password, role: 'admin' });
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
        <h2 className="modal-box__title text-h3">{t('Add Admin')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('Full name')}</label>
            <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Email')}</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Password')}</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('Creating…') : t('Create Admin')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
