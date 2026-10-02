import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, getTokens } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/security-logs';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/admin/security-logs.php, talking to the real JSON
 * API (app/Controllers/Api/AdminSecurityLogsApiController.php,
 * /api/v1/admin/security-logs). The log itself lives in log files (no
 * DB table) via SecurityLogService — every field here (severity, event,
 * event_type, module, status, user, ip, device/browser/os, time) is
 * read straight from those real entries. Nothing here is invented.
 */

const PER_PAGE = 25;
const SEVERITY_BADGE = { critical: 'badge-danger', warning: 'badge-warning', info: 'badge-neutral' };

export default function AdminSecurityLogs() {
  const t = useTranslations(translations);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState({});
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/security-logs', { page, q: q || undefined, severity: severity || undefined })
      .then((json) => {
        setRows(json.data || []);
        setTotal(json.meta?.total ?? 0);
        setMeta(json.meta || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, q, severity]);

  useEffect(() => { load(); }, [load]);

  async function handleExport() {
    setExporting(true);
    try {
      const { accessToken } = getTokens();
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (severity) params.set('severity', severity);
      const res = await fetch(`/api/v1/admin/security-logs/export?${params}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Security Logs')}</h1>
          <p className="text-small">
            {total} events · {meta.criticalCount ?? 0} critical · {meta.warningCount ?? 0} warnings · {meta.distinctIps ?? 0} distinct IPs
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={exporting}>
            <Icon name="download" size={18} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="card glass-panel" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <input className="form-input" placeholder="Search event, user, IP…" value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }} style={{ maxWidth: 320 }} />
        <select className="form-input" value={severity} onChange={(e) => { setPage(1); setSeverity(e.target.value); }} style={{ maxWidth: 180 }}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading && <p className="text-small">Loading security logs…</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && (
        <div className="table-responsive card glass-panel">
          <table className="data-table">
            <thead>
              <tr><th>{t('Severity')}</th><th>Event</th><th>{t('User')}</th><th>IP</th><th>Device</th><th>Time</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><span className={`badge ${SEVERITY_BADGE[r.severity] || 'badge-neutral'}`}>{r.severity}</span></td>
                  <td>{r.event}</td>
                  <td>{r.user || '—'}</td>
                  <td>{r.ip}</td>
                  <td>{[r.device, r.browser, r.os].filter((v) => v && v !== '—').join(' · ') || '—'}</td>
                  <td>{r.time ? String(r.time).slice(0, 19).replace('T', ' ') : ''}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-small" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>No events match this search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)', alignItems: 'center' }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><Icon name="chevron-left" size={16} /></button>
          <span className="text-small">Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><Icon name="chevron-right" size={16} /></button>
        </div>
      )}
    </>
  );
}
