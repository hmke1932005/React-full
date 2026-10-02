import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { AreaChart } from '../../components/admin/adminUi';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/dashboard';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Admin Dashboard — new design. Data comes from the same real endpoints as before:
 *   GET /api/v1/admin/dashboard  (KPIs, pending universities, recent activity, AI overview)
 *   GET /api/v1/admin/roles      (users_count per role, for "Users by Role")
 *   GET /api/v1/analytics/overview (user_growth, for the "Platform Growth" chart)
 * "Needs Your Attention" is built only from real counters.
 */

const AI_TYPE_LABELS = {
  readiness_score: 'Readiness Score',
  classification: 'Classification',
  startup_potential: 'Startup Potential',
  improvement_suggestions: 'Improvement Suggestions',
  summary: 'Project Summary',
};

function Kpi({ label, value, icon, note, tone, to }) {
  const body = (
    <>
      <div className="adm-kpi__top">{label} <Icon name={icon} size={16} /></div>
      <div className="adm-kpi__value">{Number(value ?? 0).toLocaleString()}</div>
      {note && <div className={`adm-kpi__note${tone ? ` adm-kpi__note--${tone}` : ''}`}>{note}</div>}
    </>
  );
  return to ? <Link to={to} className="adm-kpi">{body}</Link> : <div className="adm-kpi">{body}</div>;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T')).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminDashboard() {
  const t = useTranslations(translations);
  const [data, setData] = useState(null);
  const [roles, setRoles] = useState([]);
  const [growth, setGrowth] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/admin/dashboard')
      .then((json) => { if (!cancelled) setData(json.data); })
      .catch((err) => { if (!cancelled) setLoadError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    api.get('/api/v1/admin/roles')
      .then((json) => { if (!cancelled) setRoles(json.data || []); })
      .catch(() => {});
    api.get('/api/v1/analytics/overview')
      .then((json) => { if (!cancelled) setGrowth((json.data?.user_growth || []).map((p) => ({ label: p.label?.en || '', value: p.value }))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-small">Loading dashboard…</p>;
  if (loadError) return <p className="form-error">{loadError}</p>;
  if (!data) return null;

  const ai = data.ai_overview || { completedRuns: 0, failedRuns: 0, analyzedProjects: 0, byType: {} };
  const pendingUnis = data.pending_universities || [];
  const activity = data.recent_activity || [];
  const roleRows = roles.filter((r) => (r.users_count ?? 0) > 0).sort((a, b) => b.users_count - a.users_count);
  const roleTotal = roleRows.reduce((n, r) => n + r.users_count, 0);
  const roleMax = roleRows[0]?.users_count || 1;

  const attention = [
    { n: data.pending_approvals, text: 'approvals pending', to: '/admin/approvals' },
    { n: pendingUnis.length, text: 'university applications awaiting review', to: '/admin/universities' },
    { n: data.suspended_users, text: 'suspended accounts need manual review', to: '/admin/users?status=suspended' },
    { n: ai.failedRuns, text: 'failed AI analysis runs', to: '/admin/ai-code-review' },
  ].filter((x) => x.n > 0);

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">Admin Dashboard</h1>
          <p className="text-small">Monitor users, universities, approvals and platform health.</p>
        </div>
        <div className="page-header__actions">
          <Link to="/admin/universities" className="btn btn-primary">
            <Icon name="building" size={16} /> {t('Review University Applications')}
          </Link>
        </div>
      </div>


      <div className="adm-kpis">
        <Kpi label="Total Users" value={data.total_users} icon="users" to="/admin/users" />
        <Kpi label="Verified Universities" value={data.verified_universities} icon="building" to="/admin/universities" />
        <Kpi label="Published Projects" value={data.published_projects} icon="folder" />
        <Kpi label="Pending Approvals" value={data.pending_approvals} icon="shield" to="/admin/approvals"
          note={data.pending_approvals > 0 ? 'Needs review' : 'All clear'} tone={data.pending_approvals > 0 ? 'warn' : 'good'} />
        <Kpi label="Suspended Accounts" value={data.suspended_users} icon="x-circle" to="/admin/users?status=suspended"
          note={data.suspended_users > 0 ? 'Needs review' : 'None'} tone={data.suspended_users > 0 ? 'bad' : 'good'} />
        <Kpi label="AI Runs Completed" value={ai.completedRuns} icon="sparkles"
          note={ai.failedRuns > 0 ? `${ai.failedRuns} failed` : undefined} tone="bad" />
      </div>

      <div className="adm-grid">
        <div className="adm-panel">
          <div className="adm-panel__head">
            <div><h2>Platform Growth</h2><p>New users per month</p></div>
          </div>
          <AreaChart points={growth} />
        </div>
        <div className="adm-panel">
          <div className="adm-panel__head">
            <div><h2>Users by Role</h2><p>{roleTotal.toLocaleString()} total accounts</p></div>
          </div>
          {roleRows.length === 0 && <p className="adm-empty">No role data yet.</p>}
          <div className="adm-bars">
            {roleRows.map((r) => (
              <div key={r.slug} className="adm-bar">
                <span>{r.name_en || r.slug}</span>
                <span className="adm-bar__track"><span className="adm-bar__fill" style={{ width: `${Math.max(3, (r.users_count / roleMax) * 100)}%` }} /></span>
                <span className="adm-bar__num">{r.users_count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="adm-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="adm-panel">
          <div className="adm-panel__head">
            <div><h2>Needs Your Attention</h2><p>Open items across the platform</p></div>
          </div>
          {attention.length === 0 && <p className="adm-empty">Nothing needs attention right now.</p>}
          <ul className="adm-list">
            {attention.map((a) => (
              <li key={a.text}>
                <Link to={a.to} className="adm-list__item">
                  <span><strong>{a.n}</strong> {a.text}</span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="adm-panel">
          <div className="adm-panel__head">
            <div><h2>{t('Recent Activity')}</h2><p>Latest admin actions</p></div>
            <Link to="/admin/audit-logs" className="btn btn-outline btn-sm">View audit log</Link>
          </div>
          {activity.length === 0 && <p className="adm-empty">{t('No admin activity yet.')}</p>}
          {activity.map((a) => (
            <div key={a.id} className="adm-dot-item">
              <span>{a.action}{a.entity_type ? ` — ${a.entity_type} #${a.entity_id}` : ''}</span>
              <span className="adm-muted">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="adm-panel">
            <div className="adm-panel__head">
              <div><h3>{t('AI Analysis Overview')}</h3><p>{t('Platform-wide — real data from the analysis log')}</p></div>
            </div>
            {ai.completedRuns === 0 ? (
              <p className="adm-empty">{t('No AI analysis has been run on the platform yet.')}</p>
            ) : (
              <>
                <div className="adm-dot-item" style={{ justifyContent: 'space-between' }}>
                  <span>{t('Projects analyzed')}</span><strong>{ai.analyzedProjects} / {data.published_projects}</strong>
                </div>
                {Object.keys(ai.byType || {}).length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {Object.entries(ai.byType).map(([type, cnt]) => (
                      <span key={type} className="badge badge-neutral">{AI_TYPE_LABELS[type] || type}: {cnt}</span>
                    ))}
                  </div>
                )}
              </>
            )}
            <Link to="/admin/ai-code-review" className="btn btn-outline btn-sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>
              {t('Open the reviews dashboard →')}
            </Link>
          </div>
          <div className="adm-panel">
            <div className="adm-panel__head"><div><h3>Security Logs</h3><p>Full incident and alert history lives in Security Logs.</p></div></div>
            <Link to="/admin/security-logs" className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
              <Icon name="shield" size={16} /> {t('View All Security Logs')}
            </Link>
          </div>
        </div>
      </div>

      <div className="adm-panel">
        <div className="adm-panel__head">
          <div><h2>{t('Universities Awaiting Review')}</h2><p>Latest university applications</p></div>
          <Link to="/admin/universities" className="btn btn-outline btn-sm">{t('View all')}</Link>
        </div>
        {pendingUnis.length === 0 ? (
          <p className="adm-empty">{t('No pending applications right now.')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table">
              <thead><tr><th>University</th><th>Location</th><th>Submitted</th><th>Status</th><th /></tr></thead>
              <tbody>
                {pendingUnis.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.official_name_en || u.official_name_ar}</strong></td>
                    <td>{[u.city, u.country].filter(Boolean).join(', ') || '—'}</td>
                    <td>{u.created_at ? u.created_at.slice(0, 10) : '—'}</td>
                    <td><span className="badge badge-warning">{t('Pending')}</span></td>
                    <td className="adm-actions"><Link to="/admin/universities" className="btn btn-outline btn-sm">Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
