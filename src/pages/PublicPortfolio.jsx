import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import Icon from '../components/Icon';
import SiteFooter from '../components/SiteFooter';
import PublicTopbar from '../components/PublicTopbar';

/**
 * Port of app/Views/public/portfolio.php — reached at /p/{uuid} with no
 * login required (see PublicPortfolioController / routes/web.php in the
 * legacy app). Talks to GET /api/v1/public/portfolios/{uuid} — the
 * unauthenticated twin of PortfoliosApiController::show() registered
 * specifically for this page (the /api/v1/portfolios/{uuid} route stays
 * behind uip.auth, same as legacy's separate PortfoliosApiController vs
 * PublicPortfolioController split). Same avatar-initial hero, headline/
 * about, and featured-projects grid as the PHP view — same
 * .public-projects-grid / .card-project classes, so this reuses the CSS
 * ProjectsShowcase/ProjectDetail already ship rather than adding new rules.
 * 404 (missing user, or a portfolio that exists but isn't public) is a
 * single "not found" state — the API never distinguishes the two, so
 * neither does this page.
 */
export default function PublicPortfolio() {
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
    api.get(`/api/v1/public/portfolios/${encodeURIComponent(uuid)}`)
      .then((json) => { if (alive) setData(json.data); })
      .catch((err) => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [uuid]);

  if (error) {
    return (
      <div className="public-wrap" style={{ textAlign: 'center' }}>
        <PublicTopbar />
        <p className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Portfolio not found.', 'الملف الشخصي غير موجود.')}</p>
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

  const owner = data.owner || {};
  const portfolio = data.portfolio || {};
  const featured = data.featured_projects || [];
  const fullName = owner.full_name || '';
  const initial = (fullName || '?').charAt(0).toUpperCase();

  return (
    <div className="public-wrap">
      <PublicTopbar />

      <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <div
          style={{
            width: 88, height: 88, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-on-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-h1)', fontWeight: 800,
            margin: '0 auto var(--space-4)',
          }}
        >
          {initial}
        </div>
        <h1 className="text-h1">{fullName}</h1>
        {portfolio.headline && (
          <p className="text-body" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{portfolio.headline}</p>
        )}
        {portfolio.about && (
          <p className="text-small" style={{ maxWidth: 640, margin: 'var(--space-4) auto 0', whiteSpace: 'pre-line' }}>{portfolio.about}</p>
        )}
      </div>

      <h2 className="text-h2" style={{ marginTop: 'var(--space-7)', marginBottom: 'var(--space-2)' }}>
        {t('Featured Projects', 'المشاريع المميزة')}
      </h2>

      {featured.length === 0 ? (
        <div className="card glass-panel" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('No featured projects yet.', 'لا توجد مشاريع مميزة بعد.')}
        </div>
      ) : (
        <div className="public-projects-grid">
          {featured.map((p) => {
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
