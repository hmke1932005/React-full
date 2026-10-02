import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, getTokens } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/audit-logs';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/admin/audit-logs.php, talking to the real JSON API
 * (app/Controllers/Api/AdminAuditLogsApiController.php,
 * /api/v1/admin/audit-logs — already existed, wired for the first time
 * here). Read-only, filterable, exportable. The backend genuinely
 * returns two different row shapes depending on whether filters are
 * active (AuditLogService::toRow() when unfiltered vs toSearchRow()
 * when filtered — see the controller's own docblock), so this page
 * normalizes both rather than picking one and silently dropping data
 * the other shape has.
 */

const PER_PAGE = 25;

function label(v) {
  if (v == null) return '';
  return typeof v === 'object' ? (v.en || v.ar || '') : String(v);
}

export default function AdminAuditLogs() {
  const t = useTranslations(translations);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/admin/audit-logs', { page, per_page: PER_PAGE, q: q || undefined })
      .then((json) => {
        setRows(json.data || []);
        setTotal(json.meta?.total ?? 0);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, q]);

  useEffect(() => { load(); }, [load]);

  async function handleExport() {
    setExporting(true);
    try {
      const { accessToken } = getTokens();
      const res = await fetch(`/api/v1/admin/audit-logs/export${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <h1 className="text-h1">{t('Audit Logs')}</h1>
          <p className="text-small">{total} recorded actions.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={exporting}>
            <Icon name="download" size={18} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="card glass-panel" style={{ marginBottom: 'var(--space-5)' }}>
        <input className="form-input" placeholder="Search actor, email, action, target…" value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }} style={{ maxWidth: 360 }} />
      </div>

      {loading && <p className="text-small">Loading audit log…</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && (
        <div className="table-responsive card glass-panel">
          <table className="data-table">
            <thead>
              <tr><th>Actor</th><th>{t('Action')}</th><th>Target</th><th>Time</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{label(r.actor)}{r.email ? ` · ${r.email}` : ''}</td>
                  <td>{label(r.action)}</td>
                  <td>{r.target}</td>
                  <td>{r.time ? r.time.slice(0, 19).replace('T', ' ') : ''}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="text-small" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>No log entries match this search.</td></tr>
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
