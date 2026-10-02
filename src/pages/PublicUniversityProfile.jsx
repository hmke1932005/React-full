import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import Icon from '../components/Icon';
import SiteFooter from '../components/SiteFooter';
import PublicTopbar from '../components/PublicTopbar';

/**
 * Public university page — reached at /u/{uuid} with no login required.
 * Sibling of PublicPortfolio.jsx (/p/{uuid}, student): same no-auth
 * pattern, same
 * .public-projects-grid / .card-project markup reused as-is. Talks to
 * GET /api/v1/public/universities/{uuid} (PublicApiController::
 * universityProfile() — the unauthenticated twin of
 * UniversitiesApiController::me(), which is also where this page's own
 * share_url comes from on the University > Portfolio settings screen).
 * 404 (missing uuid, or a university that hasn't turned "Make profile
 * public" on) is a single "not found" state, same rule as the sibling
 * pages — the API never distinguishes the two reasons.
 */
export default function PublicUniversityProfile() {
  const { uuid } = useParams();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const t = (en, ar) => (isAr ? ar : en);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api.get(`/api/v1/public/universities/${encodeURIComponent(uuid)}`)
      .then((json) => { if (alive) setData(json.data); })
      .catch((err) => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [uuid]);

  if (error) {
    return (
      <div className="public-wrap" style={{ textAlign: 'center' }}>
        <PublicTopbar />
        <p className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('University page not found.', 'صفحة الجامعة غير موجودة.')}</p>
        <Link to="/projects" className="btn btn-primary">{t('Browse projects', 'تصفّح المشاريع')}</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="public-wrap">
        <PublicTopbar />
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t('Loading…', 'جارِ التحميل…')}</div>
      </div>
    );
  }

  const uni = data.university || {};
  const projects = data.projects || [];
  const name = isAr ? (uni.official_name_ar || uni.official_name_en) : (uni.official_name_en || uni.official_name_ar);
  const initial = (name || '?').charAt(0).toUpperCase();
  const location = [uni.city, uni.country].filter(Boolean).join(', ');

  return (
    <div className="public-wrap">
      <PublicTopbar />

      <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        {uni.logo_path ? (
          <img
            src={uni.logo_path}
            alt={name}
            style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', margin: '0 auto var(--space-4)' }}
          />
        ) : (
          <div
            style={{
              width: 88, height: 88, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-on-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-h1)', fontWeight: 800,
              margin: '0 auto var(--space-4)',
            }}
          >
            {initial}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <h1 className="text-h1">{name}</h1>
          {uni.verification_status === 'verified' && (
            <span className="badge badge-success"><Icon name="check-circle" size={12} /> {t('Verified', 'موثّقة')}</span>
          )}
        </div>
        {location && (
          <p className="text-body" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{location}</p>
        )}
        <div className="grid-2" style={{ maxWidth: 360, margin: 'var(--space-5) auto 0' }}>
          <div className="card glass-panel" style={{ padding: 'var(--space-4)' }}>
            <div className="text-caption">{t('Students', 'الطلاب')}</div>
            <div className="text-h2">{uni.students_count ?? 0}</div>
          </div>
          <div className="card glass-panel" style={{ padding: 'var(--space-4)' }}>
            <div className="text-caption">{t('Published Projects', 'مشاريع منشورة')}</div>
            <div className="text-h2">{uni.published_projects_count ?? 0}</div>
          </div>
        </div>
      </div>

      <h2 className="text-h2" style={{ marginTop: 'var(--space-7)', marginBottom: 'var(--space-2)' }}>
        {t('Published Student Projects', 'مشاريع الطلاب المنشورة')}
      </h2>

      {projects.length === 0 ? (
        <div className="card glass-panel" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('No published projects yet.', 'لا توجد مشاريع منشورة بعد.')}
        </div>
      ) : (
        <div className="public-projects-grid">
          {projects.map((p) => {
            const title = (isAr ? p.title?.ar : p.title?.en) || p.title?.en || '';
            const summary = (isAr ? p.summary?.ar : p.summary?.en) || p.summary?.en || '';
            const category = (isAr ? p.category?.ar : p.category?.en) || '';
            const tags = Array.isArray(p.tags) ? p.tags : [];
            const cover = p.cover_image_path || '';
            const liveUrl = p.live_demo_url || '';
            return (
              <div key={p.id} className="card card-project glass-panel">
                {cover && (
                  <img
                    src={`/${cover.replace(/^\//, '')}`}
                    alt={title}
                    loading="lazy"
                    style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }}
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <span className="badge badge-success">{t('Published', 'منشور')}</span>
                  {liveUrl && (
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="badge badge-primary" style={{ textDecoration: 'none' }}>
                      <Icon name="globe" size={12} /> {t('Live', 'شغّال')}
                    </a>
                  )}
                </div>
                <h3 className="text-h3">{title}</h3>
                <p className="text-small" style={{ flex: 1 }}>{summary}</p>
                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'var(--space-2)' }}>
                    {tags.map((tag, i) => <span key={i} className="badge badge-neutral">{String(tag)}</span>)}
                  </div>
                )}
                <div className="card-project__meta">
                  <Icon name="folder" size={14} /> <span>{category}</span>
                  {liveUrl && (
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer" style={{ marginInlineStart: 'auto' }}>
                      <Icon name="link" size={14} /> {t('Visit demo', 'زيارة المشروع')}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-caption" style={{ textAlign: 'center', marginTop: 'var(--space-7)', color: 'var(--text-secondary)' }}>
        {t('Public profile powered by', 'ملف عام تم إنشاؤه عبر')} <Link to="/" style={{ color: 'var(--color-primary)' }}>UIP</Link>
      </p>

      <SiteFooter />
    </div>
  );
}
