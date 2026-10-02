import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { ConfirmModal } from '../../components/admin/adminUi';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/mobile';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/admin/mobile.php, talking to the real JSON API
 * (app/Controllers/Api/AdminMobileApiController.php — new, added
 * alongside this page; reuses the exact same ApiTokenRepository calls
 * the Blade view already made). Mobile App Management = issuing/
 * revoking the long-lived bearer tokens the future mobile client
 * authenticates with. One-time-reveal: the raw token is returned once,
 * in the create response, and never again after that.
 */

function StatCard({ label, value, icon }) {
  return (
    <div className="adm-kpi">
      <div className="adm-kpi__top">{label} <Icon name={icon} size={16} /></div>
      <div className="adm-kpi__value">{value}</div>
    </div>
  );
}

export default function AdminMobile() {
  const t = useTranslations(translations);
  const [tokens, setTokens] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [issuedToken, setIssuedToken] = useState(null);
  const [name, setName] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/mobile-tokens')
      .then((json) => {
        setTokens(json.data || []);
        setActiveCount(json.meta?.activeCount ?? 0);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleIssue(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setIssuing(true);
    setActionError(null);
    setIssuedToken(null);
    try {
      const res = await api.post('/api/v1/admin/mobile-tokens', { name: name.trim() });
      setIssuedToken(res.data?.issued_token || null);
      setName('');
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setIssuing(false);
    }
  }

  async function confirmRevoke() {
    setRevokeBusy(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/admin/mobile-tokens/${revoking.id}/revoke`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setRevokeBusy(false);
      setRevoking(null);
    }
  }

  const revokedCount = tokens.length - activeCount;

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Mobile App Management')}</h1>
          <p className="text-small">{t('Bearer tokens issued to the mobile client for API access — issue a new one or revoke an old one.')}</p>
        </div>
      </div>

      {actionError && <p className="form-error">{actionError}</p>}
      {error && <p className="form-error">{error}</p>}

      {issuedToken && (
        <div className="adm-panel" style={{ borderColor: 'var(--color-success)', marginBottom: 'var(--space-4)' }}>
          <h2 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>{t('New Token — Copy It Now')}</h2>
          <p className="text-small" style={{ marginBottom: 'var(--space-3)' }}>{t('This token will never be shown again for any reason.')}</p>
          <code style={{ display: 'block', padding: 'var(--space-3)', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', wordBreak: 'break-all', fontSize: 'var(--text-small)' }}>{issuedToken}</code>
        </div>
      )}

      <div className="adm-kpis">
        <StatCard label="Active Tokens" value={activeCount} icon="check-circle" />
        <StatCard label="Revoked Tokens" value={revokedCount} icon="x-circle" />
      </div>

      <div className="adm-panel" style={{ marginBottom: 'var(--space-4)' }}>
        <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Issue a New Token')}</h2>
        <form onSubmit={handleIssue} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 220, margin: 0 }}>
            <label className="form-label">{t('Token Name (e.g. iOS Build 1.2)')}</label>
            <input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={issuing}>
            <Icon name="plus" size={18} /> {issuing ? 'Issuing…' : 'Issue'}
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-small">{t('Loading…')}</p>
      ) : tokens.length === 0 ? (
        <div className="adm-panel" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p className="text-small">{t('No tokens issued yet.')}</p>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Token Name</th><th>Issued By</th><th>Last Used</th><th>Issued On</th><th>{t('Status')}</th><th>{t('Action')}</th></tr>
            </thead>
            <tbody>
              {tokens.map((token) => {
                const isRevoked = Boolean(token.revoked_at);
                return (
                  <tr key={token.id}>
                    <td>{token.name}</td>
                    <td>{token.created_by_name || '—'}</td>
                    <td>{token.last_used_at ? token.last_used_at.slice(0, 16).replace('T', ' ') : 'Never used'}</td>
                    <td>{token.created_at ? token.created_at.slice(0, 10) : '—'}</td>
                    <td>{isRevoked ? <span className="badge badge-danger">{t('Revoked')}</span> : <span className="badge badge-success">{t('Active')}</span>}</td>
                    <td className="adm-actions">
                      {isRevoked ? (
                        <span className="text-caption">{token.revoked_at.slice(0, 10)}</span>
                      ) : (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setRevoking(token)}>
                          <Icon name="x" size={14} /> {t('Revoke')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {revoking && (
        <ConfirmModal
          title="Confirm action"
          message={`Revoke "${revoking.name}"? Any app using it loses access immediately.`}
          confirmLabel={t('Revoke')}
          danger
          busy={revokeBusy}
          onConfirm={confirmRevoke}
          onClose={() => setRevoking(null)}
        />
      )}
    </>
  );
}
