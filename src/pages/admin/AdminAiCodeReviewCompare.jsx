import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage, getTokens } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/ai-code-review-compare';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/admin/ai-code-review-compare.php, talking to the
 * real JSON API (AdminAiCodeReviewApiController::compareVersions() —
 * reuses the exact same score-diff + issue-list logic the Blade view
 * already made). Export reuses AdminAiCodeReviewExportController::
 * exportComparison() directly (self-contained file download).
 */

const SCORE_LABELS = { overall: 'Overall', security: 'Security', performance: 'Performance', maintainability: 'Maintainability', architecture: 'Architecture', quality: 'Quality' };
const FORMATS = ['pdf', 'csv', 'xlsx', 'json'];

export default function AdminAiCodeReviewCompare() {
  const t = useTranslations(translations);
  const { idA, idB } = useParams();
  const [a, setA] = useState({});
  const [b, setB] = useState({});
  const [scoreDiff, setScoreDiff] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportError, setExportError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/api/v1/admin/ai-code-review/compare/${idA}/${idB}`)
      .then((json) => {
        setA(json.data?.a || {});
        setB(json.data?.b || {});
        setScoreDiff(json.data?.score_diff || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [idA, idB]);

  useEffect(() => { load(); }, [load]);

  async function handleExport(fmt) {
    try {
      const { accessToken } = getTokens();
      const res = await fetch(`/api/v1/admin/ai-code-review/compare/${idA}/${idB}/export?format=${fmt}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      setExportError(null);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai_code_review_compare_${idA}_${idB}.${fmt}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Export failed. Please try again.');
    }
  }

  if (loading) return <p className="text-small">{t('Loading…')}</p>;
  if (error) return <p className="form-error">{error}</p>;

  return (
    <>
      <Link to="/admin/ai-code-review" className="adm-link-back"><Icon name="chevron-left" size={14} /> AI Code Review</Link>

      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Version Comparison')}</h1>
          <p className="text-small">v{a.version || 0} &rarr; v{b.version || 0}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FORMATS.map((fmt) => (
            <button key={fmt} type="button" className="btn btn-outline btn-sm" onClick={() => handleExport(fmt)}>
              <Icon name="download" size={12} /> {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {exportError && <p className="form-error">{exportError}</p>}

      <div className="adm-table-wrap" style={{ marginBottom: 16 }}>
        <div>
          <table className="adm-table">
            <thead>
              <tr><th>{t('Metric')}</th><th>v{a.version || 0}</th><th>v{b.version || 0}</th><th>{t('Change')}</th></tr>
            </thead>
            <tbody>
              {Object.entries(SCORE_LABELS).map(([key, label]) => {
                const d = scoreDiff[key];
                return (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{a.scores?.[key] ?? '—'}</td>
                    <td>{b.scores?.[key] ?? '—'}</td>
                    <td>
                      {d === null || d === undefined ? '—'
                        : d > 0 ? <span className="badge badge-success">+{d}</span>
                        : d < 0 ? <span className="badge badge-danger">{d}</span>
                        : <span className="badge badge-neutral">0</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
        {[['a', a], ['b', b]].map(([side, rev]) => (
          <div key={side} className="adm-panel">
            <div className="adm-panel__head"><h3>v{rev.version || 0} — Issues ({(rev.issues || []).length})</h3></div>
            {(rev.issues || []).map((issue, idx) => (
              <div key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-2) 0' }}>
                <span className="badge badge-warning">{issue.severity}</span>{' '}
                <span className="adm-muted">{issue.category}</span>{' '}
                {issue.file_name && <span className="adm-muted">{issue.file_name}{issue.line_number ? `:${issue.line_number}` : ''}</span>}
                <p className="text-small">{issue.description}</p>
              </div>
            ))}
            {(!rev.issues || rev.issues.length === 0) && <p className="adm-empty">{t('No issues recorded.')}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
