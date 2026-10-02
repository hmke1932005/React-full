import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, getTokens } from '../../api/client';
import Icon from '../../components/Icon';
import { Pager } from '../../components/admin/adminUi';

/**
 * System Activity — Admin design. One page, two real logs on the existing APIs:
 *   • Security events: /api/v1/admin/security-logs (+ /export)  — severity, event, user, IP, device, time
 *   • Admin actions:   /api/v1/admin/audit-logs    (+ /export)  — actor, action, target, time
 * Serves /admin/activity, and also /admin/security-logs and /admin/audit-logs (they open the
 * matching tab). Response-time / uptime / CPU tiles from the design have no data source, so
 * the KPI row only shows what the logs themselves report.
 */

const SEVERITY_BADGE = { critical: 'badge-danger', warning: 'badge-warning', info: 'badge-neutral' };
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '—');
const fmtTime = (v) => (v ? String(v).slice(0, 19).replace('T', ' ') : '—');
const label = (v) => (v == null ? '' : typeof v === 'object' ? (v.en || v.ar || '') : String(v));

async function downloadCsv(path, params, filename) {
  const { accessToken } = getTokens();
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const res = await fetch(`${path}${qs.toString() ? `?${qs}` : ''}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminSystemActivity({ initialTab = 'security' }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">System Activity</h1>
          <p className="text-small">Monitor security events and administrative actions across the platform.</p>
        </div>
      </div>
      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'security'} className={`adm-tab${tab === 'security' ? ' is-active' : ''}`} onClick={() => setTab('security')}>Security events</button>
        <button type="button" role="tab" aria-selected={tab === 'audit'} className={`adm-tab${tab === 'audit' ? ' is-active' : ''}`} onClick={() => setTab('audit')}>Admin actions</button>
      </div>
      {tab === 'security' ? <SecurityTab /> : <AuditTab />}
    </>
  );
}

function SecurityTab() {
  const PER_PAGE = 25;
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
      .then((json) => { setRows(json.data || []); setTotal(json.meta?.total ?? 0); setMeta(json.meta || {}); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, q, severity]);
  useEffect(() => { load(); }, [load]);

  async function exportCsv() {
    setExporting(true);
    try { await downloadCsv('/api/v1/admin/security-logs/export', { q, severity }, 'security-log'); }
    catch { setError('Export failed. Please try again.'); }
    finally { setExporting(false); }
  }

  return (
    <>
      <div className="adm-kpis">
        <div className="adm-kpi"><div className="adm-kpi__top">Events <Icon name="pulse" size={16} /></div><div className="adm-kpi__value">{total.toLocaleString()}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">Critical <Icon name="shield" size={16} /></div><div className="adm-kpi__value">{(meta.criticalCount ?? 0).toLocaleString()}</div><div className={`adm-kpi__note${(meta.criticalCount ?? 0) > 0 ? ' adm-kpi__note--bad' : ''}`}>{(meta.criticalCount ?? 0) > 0 ? 'Needs review' : 'None'}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">Warnings <Icon name="info" size={16} /></div><div className="adm-kpi__value">{(meta.warningCount ?? 0).toLocaleString()}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">Distinct IPs <Icon name="globe" size={16} /></div><div className="adm-kpi__value">{(meta.distinctIps ?? 0).toLocaleString()}</div></div>
      </div>

      <div className="adm-filters">
        <div className="adm-filters__search">
          <Icon name="search" size={16} />
          <input className="form-input" placeholder="Search event, user, IP…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        <select className="form-input" value={severity} onChange={(e) => { setPage(1); setSeverity(e.target.value); }} style={{ maxWidth: 180 }}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting}><Icon name="download" size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}</button>
      </div>

      {loading && <p className="text-small">Loading…</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Time</th><th>Event</th><th>User</th><th>IP</th><th>Device</th><th>Severity</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.time)}</td>
                  <td>{r.event}</td>
                  <td>{r.user || '—'}</td>
                  <td>{r.ip || '—'}</td>
                  <td>{[r.device, r.browser, r.os].filter((v) => v && v !== '—').join(' · ') || '—'}</td>
                  <td><span className={`badge ${SEVERITY_BADGE[r.severity] || 'badge-neutral'}`}>{cap(r.severity)}</span></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="adm-empty" style={{ textAlign: 'center', padding: 28 }}>No events match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && <Pager page={page} setPage={setPage} total={total} perPage={PER_PAGE} />}
    </>
  );
}

function AuditTab() {
  const PER_PAGE = 25;
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
      .then((json) => { setRows(json.data || []); setTotal(json.meta?.total ?? 0); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, q]);
  useEffect(() => { load(); }, [load]);

  async function exportCsv() {
    setExporting(true);
    try { await downloadCsv('/api/v1/admin/audit-logs/export', { q }, 'audit-log'); }
    catch { setError('Export failed. Please try again.'); }
    finally { setExporting(false); }
  }

  return (
    <>
      <div className="adm-kpis">
        <div className="adm-kpi"><div className="adm-kpi__top">Recorded actions <Icon name="history" size={16} /></div><div className="adm-kpi__value">{total.toLocaleString()}</div><div className="adm-kpi__note">{q ? 'matching search' : 'all time'}</div></div>
      </div>
      <div className="adm-filters">
        <div className="adm-filters__search">
          <Icon name="search" size={16} />
          <input className="form-input" placeholder="Search actor, email, action, target…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting}><Icon name="download" size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}</button>
      </div>
      {loading && <p className="text-small">Loading…</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && !error && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(r.time)}</td>
                  <td><strong>{label(r.actor) || '—'}</strong>{r.email && <small style={{ display: 'block', color: 'var(--text-secondary)' }}>{r.email}</small>}</td>
                  <td>{label(r.action)}</td>
                  <td>{r.target || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="adm-empty" style={{ textAlign: 'center', padding: 28 }}>No log entries match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && <Pager page={page} setPage={setPage} total={total} perPage={PER_PAGE} />}
    </>
  );
}
