import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/faculty/portfolio';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Faculty-portal twin of UniversityPortfolio.jsx — the faculty's own
 * public portfolio page. No legacy app/Views/faculty/portfolio.php
 * existed (the faculty portal never had one), so this is built fresh
 * from the same GET/PATCH /api/v1/faculty/me{,/visibility} shape
 * FacultyApiController::me()/updateOwnVisibility() now return, mirroring
 * UniversitiesApiController::me()/updateVisibility() exactly. share_url
 * points at the already-working public page (PublicFacultyController::
 * show(), routes/web.php '/universities/{universitySlug}/faculties/{facultySlug}').
 */
export default function FacultyPortfolio() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [faculty, setFaculty] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/faculty/me')
      .then((json) => {
        setFaculty(json.data?.faculty || null);
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
      await api.patch('/api/v1/faculty/me/visibility', { is_public: nextValue ? 1 : 0 });
      setFaculty((f) => ({ ...f, is_public: nextValue ? 1 : 0 }));
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
  if (error && !faculty) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;
  if (!faculty) return null;

  const name = locale === 'ar' ? (faculty.name_ar || faculty.name_en) : (faculty.name_en || faculty.name_ar);
  const isPublic = !!faculty.is_public;

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="award" size={26} /> {t('Public Portfolio')}</h1>
          <p className="text-small">
            {locale === 'ar'
              ? 'ملف الكلية العام اللي يعرض مشاريع طلابك المعتمدة من غير تسجيل دخول.'
              : "Your faculty's public page — showcasing your students' approved projects without logging in."}
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
            {faculty.logo_path ? (
              <img src={faculty.logo_path} alt={`${name} logo`} style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-muted)', flexShrink: 0 }}>
                <Icon name="building" size={28} />
              </span>
            )}
            <div>
              <h2 className="text-h3" style={{ margin: 0 }}>{name}</h2>
              <p className="text-small" style={{ margin: '2px 0 0', color: 'var(--text-secondary)' }}>
                {faculty.location || t('Location not set yet')}
              </p>
            </div>
          </div>

          <div className="grid-2">
            <div className="card glass-panel" style={{ padding: 'var(--space-5)' }}>
              <div className="text-caption">{t('Students')}</div>
              <div className="text-h2">{faculty.students_count ?? 0}</div>
            </div>
            <div className="card glass-panel" style={{ padding: 'var(--space-5)' }}>
              <div className="text-caption">{t('Published Projects')}</div>
              <div className="text-h2">{faculty.published_projects_count ?? 0}</div>
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
            <p className="text-small">{t('Completing your faculty profile in Settings helps students and staff recognize your page.')}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
