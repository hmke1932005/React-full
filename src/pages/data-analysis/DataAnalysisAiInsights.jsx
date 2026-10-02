import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useLanguage, useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/data-analysis/ai-insights/index';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/data-analysis/ai-insights/index.php, talking to the
 * real JSON API (DataAnalysisAiInsightsApiController::index()/
 * regenerate(), /api/v1/data-analysis/ai-insights — reuses
 * AIInsightsService exactly as the server-rendered view does: real AI
 * analytics over live platform metrics, never fabricated when the AI
 * provider isn't configured or the call fails).
 */

function directionIcon(direction) {
  return direction === 'up' ? 'trend' : direction === 'down' ? 'chevron-down' : 'chevron-right';
}

function SeverityBadge({ severity, t }) {
  const map = {
    high: { cls: 'badge-danger', label: t('High') },
    medium: { cls: 'badge-warning', label: t('Medium') },
    low: { cls: 'badge-info', label: t('Low') },
    strong: { cls: 'badge-danger', label: t('Strong') },
    moderate: { cls: 'badge-warning', label: t('Moderate') },
    weak: { cls: 'badge-info', label: t('Weak') },
  };
  const key = String(severity || '').toLowerCase();
  const m = map[key] || { cls: 'badge-neutral', label: severity };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

function ListPanel({ icon, title, items, empty, t, render }) {
  return (
    <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-5)' }}>
      <h2 className="text-h3" style={{ margin: '0 0 var(--space-3) 0' }}><Icon name={icon} size={18} /> {title}</h2>
      {(!items || items.length === 0) ? (
        <p className="text-small text-muted">{empty}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {items.map((item, i) => <div key={i}>{render(item)}</div>)}
        </div>
      )}
    </div>
  );
}

export default function DataAnalysisAiInsights() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [available, setAvailable] = useState(false);
  const [latest, setLatest] = useState(null);
  const [result, setResult] = useState(null);
  const [lastFailed, setLastFailed] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/data-analysis/ai-insights')
      .then((json) => {
        setAvailable(!!json.data?.available);
        setLatest(json.data?.latest || null);
        setResult(json.data?.result || null);
        setLastFailed(json.data?.last_failed || null);
        setHistory(json.data?.history || []);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRegenerate = () => {
    setRegenerating(true);
    setError(null);
    api.post(`/api/v1/data-analysis/ai-insights/regenerate?lang=${locale === 'ar' ? 'ar' : 'en'}`, {})
      .then((json) => {
        setResult(json.data?.result || null);
        load();
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setRegenerating(false));
  };

  if (loading) return <p className="text-small">{t('Loading…')}</p>;

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {t('AI Insights')}
            {available ? (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="sparkles" size={12} /> {t('Active')}</span>
            ) : (
              <span className="badge badge-neutral">{t('Unavailable')}</span>
            )}
          </h1>
          <p className="text-small">{t('AI-powered analytics engine generating insights, trends, correlations, anomalies, and recommendations from real platform data.')}</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-primary" disabled={!available || regenerating} onClick={handleRegenerate}>
            <Icon name="sparkles" size={16} /> {regenerating ? t('Loading…') : t('Regenerate Insights')}
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginTop: 'var(--space-3)' }}>{error}</p>}

      {!available && (
        <div className="glass-panel animate-rise-in" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <p className="text-h3"><Icon name="sparkles" size={20} /> {t('No AI provider is configured yet')}</p>
          <p className="text-small text-muted">{t('An admin needs to add an API key under Settings → AI to enable this feature.')}</p>
        </div>
      )}

      {lastFailed && (
        <div className="alert alert-danger animate-rise-in" style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Icon name="alert-triangle" size={16} />
          <span>{t('The last generation attempt failed: ')}{lastFailed.error_message || ''}</span>
        </div>
      )}

      {!result ? (
        available && (
          <div className="glass-panel animate-rise-in" style={{ padding: 'var(--space-8)', textAlign: 'center', marginTop: 'var(--space-4)' }}>
            <p className="text-h3">{t('No report generated yet')}</p>
            <p className="text-small text-muted">{t('Click "Regenerate Insights" to run the first analysis.')}</p>
          </div>
        )
      ) : (
        <>
          {result.language && result.language !== locale && (
            <div className="alert alert-info animate-rise-in" style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Icon name="sparkles" size={16} />
              <span>{locale === 'ar'
                ? 'هذا التقرير مكتوب بالإنجليزية. اضغط "إعادة توليد الرؤى" للحصول عليه بالعربية.'
                : 'This report was written in Arabic. Click "Regenerate Insights" to get it in English.'}</span>
            </div>
          )}

          <div className="text-caption" style={{ marginTop: 'var(--space-3)' }}>
            {t('Last generated by')} <strong>{latest?.generated_by_name || '—'}</strong> {t('on')} {latest?.created_at || ''}
          </div>

          <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
            <h2 className="text-h3" style={{ margin: '0 0 var(--space-2) 0' }}><Icon name="file" size={18} /> {t('Executive Summary')}</h2>
            <p className="text-small" style={{ whiteSpace: 'pre-line' }}>{result.executive_summary || ''}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <ListPanel icon="sparkles" title={t('Key Insights')} items={result.insights} empty={t('No notable insights right now.')} t={t}
              render={(i) => <p className="text-small" style={{ margin: 0 }}>• {i}</p>} />

            <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-5)' }}>
              <h2 className="text-h3" style={{ margin: '0 0 var(--space-3) 0' }}><Icon name="trend" size={18} /> {t('Trends')}</h2>
              {(!result.trends || result.trends.length === 0) ? (
                <p className="text-small text-muted">{t('No trends detected.')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {result.trends.map((tr, i) => (
                    <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                      <Icon name={directionIcon(tr.direction)} size={16} />
                      <div>
                        <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{tr.label}</p>
                        <p className="text-caption" style={{ margin: 0 }}>{tr.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ListPanel icon="layers" title={t('Correlations')} items={result.correlations} empty={t('No notable correlations.')} t={t}
              render={(c) => (
                <p className="text-small" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span>{c.description}</span> <SeverityBadge severity={c.strength} t={t} />
                </p>
              )} />

            <ListPanel icon="alert-triangle" title={t('Anomalies')} items={result.anomalies} empty={t('No anomalies detected.')} t={t}
              render={(a) => (
                <p className="text-small" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span>{a.description}</span> <SeverityBadge severity={a.severity} t={t} />
                </p>
              )} />

            <ListPanel icon="shield" title={t('Risks')} items={result.risks} empty={t('No risks detected.')} t={t}
              render={(r) => (
                <p className="text-small" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span>{r.description}</span> <SeverityBadge severity={r.severity} t={t} />
                </p>
              )} />

            <ListPanel icon="star" title={t('Opportunities')} items={result.opportunities} empty={t('No opportunities detected.')} t={t}
              render={(o) => (
                <p className="text-small" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span>{o.description}</span> <SeverityBadge severity={o.potential_impact} t={t} />
                </p>
              )} />
          </div>

          <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
            <h2 className="text-h3" style={{ margin: '0 0 var(--space-3) 0' }}><Icon name="wrench" size={18} /> {t('Root Cause Analysis')}</h2>
            {(!result.root_cause_analysis || result.root_cause_analysis.length === 0) ? (
              <p className="text-small text-muted">{t('No issues currently warrant root cause analysis.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {result.root_cause_analysis.map((rc, i) => (
                  <div key={i} style={{ borderInlineStart: '3px solid var(--uip-coral-600, #F0555A)', paddingInlineStart: 'var(--space-3)' }}>
                    <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{rc.issue}</p>
                    <p className="text-caption" style={{ margin: 0 }}>{rc.likely_cause}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
            <h2 className="text-h3" style={{ margin: '0 0 var(--space-3) 0' }}><Icon name="award" size={18} /> {t('KPI Analysis')}</h2>
            {(!result.kpi_analysis || result.kpi_analysis.length === 0) ? (
              <p className="text-small text-muted">{t('No active KPIs to analyze yet. Add some from KPI Management.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {result.kpi_analysis.map((ka, i) => (
                  <div key={i}>
                    <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{ka.kpi}</p>
                    <p className="text-caption" style={{ margin: 0 }}>{ka.analysis}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <ListPanel icon="check-circle" title={t('Recommendations')} items={result.recommendations} empty={t('No recommendations right now.')} t={t}
              render={(r) => <p className="text-small" style={{ margin: 0 }}>• {r}</p>} />
            <ListPanel icon="trend" title={t('Performance Recommendations')} items={result.performance_recommendations} empty={t('No performance recommendations right now.')} t={t}
              render={(r) => <p className="text-small" style={{ margin: 0 }}>• {r}</p>} />
          </div>
        </>
      )}

      {history.length > 0 && (
        <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
          <h2 className="text-h3" style={{ margin: '0 0 var(--space-3) 0' }}><Icon name="clock" size={18} /> {t('Generation History')}</h2>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr><th>{t('Date')}</th><th>{t('Status')}</th><th>{t('By')}</th><th>{t('Details')}</th></tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td className="text-small">{h.created_at}</td>
                    <td>{h.status === 'completed' ? <span className="badge badge-success">{t('Completed')}</span> : <span className="badge badge-danger">{t('Failed')}</span>}</td>
                    <td className="text-small">{h.generated_by_name || '—'}</td>
                    <td className="text-caption">{h.error_message || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
