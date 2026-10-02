import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { AreaChart, DonutChart, HBarChart, KpiCard, Panel, fmt } from '../../components/insight/charts';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/data-analysis/dashboard';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Data Analysis dashboard — Insight Platform layout.
 *
 * Data still comes from the real JSON API (/api/v1/data-analysis/dashboard,
 * DataAnalysisDashboardService). Nothing here is invented: every KPI, chart
 * and "key insight" is derived from the fields that endpoint returns.
 */

const SERIES_COLORS = [
  'var(--color-primary)', 'var(--color-success)', 'var(--color-accent)',
  'var(--color-info)', 'var(--color-danger)',
];

const pctChange = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

export default function DataAnalysisDashboard() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/api/v1/data-analysis/dashboard')
      .then((json) => setData(json.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const label = (obj) => obj?.[locale] || obj?.en || '';

  const view = useMemo(() => {
    if (!data) return null;
    const kpis = data.kpis || {};
    const growth = (data.user_growth || []).map((p) => ({ label: label(p.label), value: p.value }));
    const roles = (data.users_by_role || []).map((p, i) => ({ label: label(p.label), value: p.value, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
    const cats = (data.category_dist || []).map((c) => ({ label: label(c.label), value: c.value }));
    const unis = (data.leaderboard || []).map((u) => ({ name: label(u.university), projects: u.projects }));
    const trends = data.trends || [];

    const last = growth[growth.length - 1];
    const prev = growth[growth.length - 2];
    const growthDelta = last && prev ? pctChange(last.value, prev.value) : null;
    const totalProjects = cats.reduce((s, c) => s + c.value, 0);
    const topCat = cats.slice().sort((a, b) => b.value - a.value)[0];
    const totalUniProjects = unis.reduce((s, u) => s + u.projects, 0);

    return { kpis, growth, roles, cats, unis, trends, growthDelta, last, totalProjects, topCat, totalUniProjects };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, locale]);

  if (loading) return <p className="text-small">{t('Loading…')}</p>;
  if (error) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;
  if (!view) return null;

  const { kpis, growth, roles, cats, unis, trends, growthDelta, last, totalProjects, topCat, totalUniProjects } = view;
  const recentExports = data.recent_exports || [];
  const savedDashboards = data.saved_dashboards || [];
  const approval = Number(kpis.approval_rate || 0);

  // Key insights — only statements the data actually supports.
  const insights = [];
  if (growthDelta !== null) {
    insights.push({
      icon: growthDelta >= 0 ? 'trend' : 'arrow-down',
      title: growthDelta >= 0 ? t('Growth is accelerating') : t('Growth is slowing'),
      text: locale === 'ar'
        ? `تسجيلات المستخدمين الجدد ${growthDelta >= 0 ? 'ارتفعت' : 'انخفضت'} ${Math.abs(growthDelta)}٪ عن الشهر السابق.`
        : `New user sign-ups ${growthDelta >= 0 ? 'rose' : 'fell'} ${Math.abs(growthDelta)}% versus the previous month.`,
    });
  }
  if (topCat && totalProjects > 0) {
    insights.push({
      icon: 'award',
      title: locale === 'ar' ? `${topCat.label} في الصدارة` : `${topCat.label} leads`,
      text: locale === 'ar'
        ? `تمثل ${Math.round((topCat.value / totalProjects) * 100)}٪ من المشاريع.`
        : `It holds ${Math.round((topCat.value / totalProjects) * 100)}% of all projects.`,
    });
  }
  insights.push({
    icon: 'shield',
    title: approval >= 70 ? t('Approvals are healthy') : t('Approvals need attention'),
    text: locale === 'ar' ? `معدل اعتماد المنصة ${approval}٪.` : `Platform approval rate is ${approval}%.`,
  });
  if (unis[0]) {
    insights.push({
      icon: 'building',
      title: locale === 'ar' ? `${unis[0].name} الأعلى نشاطاً` : `${unis[0].name} is most active`,
      text: locale === 'ar' ? `${fmt(unis[0].projects)} مشروع منشور.` : `${fmt(unis[0].projects)} projects submitted.`,
    });
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1>{t('Data Analysis Dashboard')}</h1>
          <p>{t('A clear view of innovation across your university network.')}</p>
        </div>
        <div className="page-header__actions">
          <Link to="/data-analysis/segments" className="btn btn-outline btn-sm"><Icon name="filter" size={16} /> {t('Segments')}</Link>
          <Link to="/data-analysis/exports" className="btn btn-primary btn-sm"><Icon name="download" size={16} /> {t('Export Data')}</Link>
        </div>
      </div>

      <div className="insight-grid insight-grid--kpi">
        <KpiCard label={t('Registered Users')} value={fmt(kpis.total_users)} tone="primary" note={t('all roles')} />
        <KpiCard
          label={t('New Users (This Month)')} value={fmt(kpis.new_users_this_month)} tone="success"
          delta={growthDelta} note={growthDelta !== null ? t('vs. previous month') : undefined}
        />
        <KpiCard label={t('Platform Approval Rate')} value={`${approval}%`} tone={approval >= 70 ? 'success' : 'warning'} progress={approval} />
        <KpiCard label={t('Verified Universities')} value={fmt(kpis.verified_universities)} tone="info" note={t('verified')} />
      </div>

      <div className="insight-grid insight-grid--main">
        <Panel
          title={t('New User Growth per Month')}
          subtitle={last ? (locale === 'ar' ? `آخر نقطة: ${last.label} — ${fmt(last.value)}` : `Latest: ${last.label} — ${fmt(last.value)}`) : undefined}
        >
          <AreaChart data={growth} emptyText={t('Not enough data yet.')} />
        </Panel>

        <Panel title={t('Users by Role')} subtitle={t('Share of registered accounts')}>
          <DonutChart segments={roles} centerLabel={t('users')} emptyText={t('No users yet.')} />
        </Panel>
      </div>

      <div className="insight-grid insight-grid--halves">
        <Panel title={t('Project Distribution by Category')} subtitle={t('Top categories by number of projects')}>
          <HBarChart items={cats.slice(0, 6)} emptyText={t('No projects yet.')} />
        </Panel>

        <Panel title={t('Growth Trends (30 days)')} subtitle={t('Submissions vs. the prior 30-day period, by category.')}>
          {trends.length ? (
            <ul className="insight-list" style={{ gap: 0 }}>
              {trends.map((tr, i) => (
                <li key={i} style={{ gridTemplateColumns: '1fr auto', padding: '12px 0', borderBottom: i < trends.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
                  <div>
                    <strong>{label(tr.label)}</strong>
                    <span className="num">{fmt(tr.current)} {t('vs')} {fmt(tr.previous)}</span>
                  </div>
                  {tr.growth_pct === null ? (
                    <span className="badge badge-neutral">{t('New')}</span>
                  ) : (
                    <span className={`badge ${tr.growth_pct >= 0 ? 'badge-success' : 'badge-danger'}`}>
                      <Icon name={tr.growth_pct >= 0 ? 'arrow-up' : 'arrow-down'} size={12} /> {(tr.growth_pct >= 0 ? '+' : '') + tr.growth_pct}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="chart-empty">{t('Not enough data yet to compute trends.')}</p>}
        </Panel>
      </div>

      <div className="insight-grid insight-grid--bottom">
        <Panel title={t('Universities Ranked by Project Volume')} className="panel--flat" >
          <div style={{ padding: '0 28px 8px' }}>
            {unis.length ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>{t('University')}</th><th>{t('Projects')}</th><th>{t('Share')}</th></tr>
                  </thead>
                  <tbody>
                    {unis.map((u, i) => (
                      <tr key={u.name + i}>
                        <td className="num">{i + 1}</td>
                        <td><strong>{u.name}</strong></td>
                        <td className="num">{fmt(u.projects)}</td>
                        <td className="num">{totalUniProjects ? Math.round((u.projects / totalUniProjects) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="chart-empty" style={{ marginBottom: 20 }}>{t('No projects submitted yet.')}</p>}
          </div>
        </Panel>

        <Panel title={t('Key insights')} className="panel--soft">
          <ul className="insight-list">
            {insights.map((it) => (
              <li key={it.title}>
                <Icon name={it.icon} size={20} />
                <div><strong>{it.title}</strong><span>{it.text}</span></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="insight-grid insight-grid--halves">
        <Panel
          title={t('Recent Exports')}
          actions={<Link to="/data-analysis/exports" className="btn btn-outline btn-sm">{t('All Exports')}</Link>}
        >
          {recentExports.length ? recentExports.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < recentExports.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ textTransform: 'capitalize' }}>{String(e.export_type || '').replace(/_/g, ' ')}</span>
              <span className={`badge ${e.status === 'completed' ? 'badge-success' : 'badge-neutral'}`}>{e.status}</span>
            </div>
          )) : <p className="chart-empty">{t('No exports yet.')}</p>}
        </Panel>

        <Panel
          title={t('My Saved Dashboards')}
          actions={<Link to="/data-analysis/dashboards" className="btn btn-outline btn-sm"><Icon name="grid" size={14} /> {t('Manage Dashboards')}</Link>}
        >
          {savedDashboards.length ? savedDashboards.slice(0, 5).map((d, i, arr) => (
            <Link
              key={d.id} to="/data-analysis/dashboards"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', color: 'inherit' }}
            >
              <span>{d.name}</span>
              {d.is_default ? <span className="badge badge-primary">{t('Default')}</span> : null}
            </Link>
          )) : <p className="chart-empty">{t('No saved dashboards yet.')}</p>}
        </Panel>
      </div>
    </>
  );
}
