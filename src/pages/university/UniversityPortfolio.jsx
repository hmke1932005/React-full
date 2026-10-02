import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/portfolio';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/portfolio.php. Data comes from
 * GET /api/v1/universities/me (App\Controllers\Api\UniversitiesApiController
 * ::me() — now merges UniversityRepository::withProfileStats() in and
 * returns share_url, same shape University\UniversityPortfolioController
 * ::index() passes its view). Visibility toggles via the small addition
 * PATCH /api/v1/universities/me/visibility (mirrors
 * UniversityPortfolioController::update()'s is_public-only write).
 */
export default function UniversityPortfolio() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [uni, setUni] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/universities/me')
      .then((json) => {
        setUni(json.data?.university || null);
        setShareUrl(json.data?.share_url || '');
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleVisibility(nextValue) {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/api/v1/universities/me/visibility', { is_public: nextValue ? 1 : 0 });
      setUni((u) => ({ ...u, is_public: nextValue ? 1 : 0 }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <p className="text-small">{t('Loading…')}</p>;
  if (error && !uni) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;
  if (!uni) return null;

  const name = locale === 'ar' ? (uni.official_name_ar || uni.official_name_en) : (uni.official_name_en || uni.official_name_ar);
  const verified = uni.verification_status === 'verified';
  const isPublic = !!uni.is_public;
  const location = [uni.city, uni.country].filter(Boolean).join(', ');

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="award" size={26} /> {t('Public Portfolio')}</h1>
          <p className="text-small">
            {locale === 'ar'
              ? 'ملف الجامعة العام اللي يعرض مشاريع طلابك المعتمدة من غير تسجيل دخول.'
              : "Your university's public page — showcasing your students' approved projects without logging in."}
          </p>
        </div>
        <div className="page-header__actions">
          <span className={`badge ${isPublic ? 'badge-success' : 'badge-neutral'}`}>
            <Icon name={isPublic ? 'eye' : 'eye-off'} size={12} />
            {isPublic ? t('Public') : t('Private')}
          </span>
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card glass-panel" style={{ padding: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            {uni.logo_path ? (
              <img src={uni.logo_path} alt={`${name} logo`} style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-muted)', flexShrink: 0 }}>
                <Icon name="building" size={28} />
              </span>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <h2 className="text-h3" style={{ margin: 0 }}>{name}</h2>
                {verified ? (
                  <span className="badge badge-success"><Icon name="check-circle" size={12} /> {t('Verified')}</span>
                ) : (
                  <span className="badge badge-neutral">{t('Unverified')}</span>
                )}
              </div>
              <p className="text-small" style={{ margin: '2px 0 0', color: 'var(--text-secondary)' }}>
                {location || t('Location not set yet')}
              </p>
            </div>
          </div>

          <div className="grid-2">
            <div className="card glass-panel" style={{ padding: 'var(--space-5)' }}>
              <div className="text-caption">{locale === 'ar' ? 'الطلاب' : 'Students'}</div>
              <div className="text-h2">{uni.students_count ?? 0}</div>
            </div>
            <div className="card glass-panel" style={{ padding: 'var(--space-5)' }}>
              <div className="text-caption">{locale === 'ar' ? 'مشاريع منشورة' : 'Published Projects'}</div>
              <div className="text-h2">{uni.published_projects_count ?? 0}</div>
            </div>
          </div>

          <div className="card glass-panel" style={{ padding: 'var(--space-6)' }}>
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>{t('Profile Visibility')}</h2>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label className="form-label" style={{ margin: 0 }}>{t('Make profile public')}</label>
                <p className="text-caption" style={{ margin: '2px 0 0' }}>{t('When on, anyone with the link can view your published student projects.')}</p>
              </div>
              <input
                type="checkbox"
                className="form-checkbox"
                checked={isPublic}
                disabled={saving}
                onChange={(e) => toggleVisibility(e.target.checked)}
              />
            </div>
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
            <span style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, margin: '0 auto var(--space-4)' }}>
              <Icon name="award" size={34} />
            </span>
            <h2 className="text-h3">{t('Public Share Link')}</h2>
            {isPublic ? (
              <>
                <p className="text-small" style={{ marginBottom: 'var(--space-3)' }}>{t('Anyone with this link can view your published projects.')}</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input className="form-input text-caption" type="text" readOnly value={shareUrl} style={{ flex: 1 }} />
                  <button type="button" className="btn btn-outline btn-sm" onClick={copyLink}>
                    {copied ? t('Copied!') : t('Copy')}
                  </button>
                </div>
                <a href={shareUrl} target="_blank" rel="noreferrer" className="text-caption" style={{ display: 'block', marginTop: 'var(--space-2)', color: 'var(--color-primary)' }}>
                  {t('Open public page')}
                </a>
              </>
            ) : (
              <p className="text-small" style={{ marginBottom: 'var(--space-3)' }}>{t('Turn on "Make profile public" above to get a shareable link.')}</p>
            )}
          </div>

          <div className="card glass-panel">
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Tip')}</h2>
            <p className="text-small">{t('Completing verification adds a trust badge to your public profile, which builds confidence in your students\' projects.')}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
