import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/data-analysis/search-results';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/data-analysis/search-results.php, talking to the
 * real JSON API (DataAnalysisSearchApiController::index(),
 * /api/v1/data-analysis/search — reuses ProjectRepository::searchAll()
 * exactly as the server-rendered view does: platform-wide, unrestricted
 * search across projects, same as the topbar
 * search for the data_analyst role).
 */
export default function DataAnalysisSearchResults() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [input, setInput] = useState(q);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setInput(q);
    if (q === '') {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    api.get('/api/v1/data-analysis/search', { params: { q } })
      .then((json) => {
        setProjects(json.data?.projects || []);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [q]);

  const total = projects.length;

  const submit = (e) => {
    e.preventDefault();
    setSearchParams(input.trim() ? { q: input.trim() } : {});
  };

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="search" size={26} /> {t('Search results')}</h1>
          <p className="text-small">
            {q === ''
              ? t('Type something in the search box above to get started.')
              : (locale === 'ar'
                  ? `${total} نتيجة لـ "${q}"`
                  : `${total} result${total === 1 ? '' : 's'} for "${q}"`)}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="glass-panel animate-rise-in" style={{ padding: 'var(--space-3) var(--space-4)', marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
        <input
          type="search"
          className="form-input"
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('Search covers projects platform-wide.')}
        />
        <button type="submit" className="btn btn-primary"><Icon name="search" size={16} /> {t('Search results')}</button>
      </form>

      {loading && <p className="text-small" style={{ marginTop: 'var(--space-4)' }}>{t('Loading…')}</p>}
      {error && <p style={{ color: 'var(--color-danger)', marginTop: 'var(--space-4)' }}>{error}</p>}

      {!loading && q !== '' && total === 0 && (
        <div className="glass-panel animate-rise-in" style={{ padding: 'var(--space-8)', textAlign: 'center', marginTop: 'var(--space-4)' }}>
          <p className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>{t('No matching results')}</p>
          <p className="text-small">{t('Search covers projects platform-wide.')}</p>
        </div>
      )}

      {projects.length > 0 && (
        <>
          <h2 className="text-h3" style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>{t('Projects')}</h2>
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr><th>{t('Title')}</th><th>{t('Owner')}</th><th>{t('Category')}</th><th>{t('Status')}</th></tr>
              </thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr key={p.id ?? i}>
                    <td>{p.title_en || p.title_ar || ''}</td>
                    <td>{p.owner_name || ''}</td>
                    <td>{p.category || ''}</td>
                    <td><span className="badge badge-neutral">{p.status || ''}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

    </>
  );
}
