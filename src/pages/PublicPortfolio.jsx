import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import Icon from '../components/Icon';
import SiteFooter from '../components/SiteFooter';
import PublicTopbar from '../components/PublicTopbar';

/**
 * Public portfolio — /p/{uuid}, no login required.
 * Talks to GET /api/v1/public/portfolios/{uuid} (owner.full_name, portfolio.headline/about,
 * featured_projects[]). 404 (missing user or non-public portfolio) is one "not found" state.
 *
 * Redesigned to match the new UIP portal design language (warm canvas, #2A52D7 primary,
 * 14px radius cards, Light + Dark). Styles: styles/css/pages/public-portfolio.css (scoped to .pf-page).
 * No new backend data is needed — everything shown comes from the existing response.
 */
export default function PublicPortfolio() {
  const { uuid } = useParams();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const t = (en, ar) => (isAr ? ar : en);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api.get(`/api/v1/public/portfolios/${encodeURIComponent(uuid)}`)
      .then((json) => { if (alive) setData(json.data); })
      .catch((err) => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [uuid]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — silently ignore */ }
  };

  // ---- Not found ----
  if (error) {
    return (
      <div className="pf-page">
        <div className="pf-shell">
          <PublicTopbar />
          <div className="pf-card pf-state">
            <Icon name="user" size={34} />
            <h1>{t('Portfolio not found', 'الملف الشخصي غير موجود')}</h1>
            <p>{t('This profile does not exist or is not public.', 'الملف ده مش موجود أو مش متاح للعامة.')}</p>
            <Link to="/projects" className="pf-btn pf-btn--primary">{t('Browse projects', 'تصفّح المشاريع')}</Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (!data) {
    return (
      <div className="pf-page">
        <div className="pf-shell">
          <PublicTopbar />
          <div className="pf-layout" aria-busy="true" aria-label={t('Loading…', 'جارِ التحميل…')}>
            <div className="pf-skel" style={{ height: 380 }} />
            <div className="pf-main">
              <div className="pf-skel" style={{ height: 150 }} />
              <div className="pf-skel" style={{ height: 300 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const owner = data.owner || {};
  const portfolio = data.portfolio || {};
  const featured = data.featured_projects || [];
  const fullName = owner.full_name || '';
  const initial = (fullName || '?').trim().charAt(0).toUpperCase();
  const liveCount = featured.filter((p) => p.live_demo_url).length;

  return (
    <div className="pf-page">
      <div className="pf-shell">
        <PublicTopbar />

        <div className="pf-layout">
          {/* ---- Profile card ---- */}
          <aside className="pf-card pf-profile animate-rise-in">
            <div className="pf-profile__cover" />
            <div className="pf-profile__body">
              <div className="pf-avatar" aria-hidden="true">{initial}</div>
              <h1 className="pf-name">{fullName}</h1>
              {portfolio.headline && <p className="pf-headline">{portfolio.headline}</p>}

              <div className="pf-stats">
                <div className="pf-stat"><strong>{featured.length}</strong><span>{t('Featured projects', 'مشاريع مميزة')}</span></div>
                <div className="pf-stat"><strong>{liveCount}</strong><span>{t('Live demos', 'عروض شغّالة')}</span></div>
              </div>

              <div className="pf-actions">
                <button type="button" className={`pf-btn${copied ? ' is-done' : ''}`} onClick={copyLink}>
                  <Icon name={copied ? 'check' : 'link'} size={16} />
                  {copied ? t('Link copied', 'تم نسخ الرابط') : t('Copy profile link', 'نسخ رابط البروفايل')}
                </button>
                <Link to="/projects" className="pf-btn pf-btn--primary">
                  <Icon name="projects" size={16} />
                  {t('Explore all projects', 'استكشف كل المشاريع')}
                </Link>
              </div>
            </div>
          </aside>

          {/* ---- Main column ---- */}
          <div className="pf-main">
            {portfolio.about && (
              <section className="pf-card pf-section animate-rise-in">
                <div className="pf-section__head">
                  <h2 className="pf-section__title"><Icon name="user" size={18} />{t('About', 'نبذة')}</h2>
                </div>
                <p className="pf-about">{portfolio.about}</p>
              </section>
            )}

            <section className="pf-card pf-section animate-rise-in">
              <div className="pf-section__head">
                <h2 className="pf-section__title"><Icon name="star" size={18} />{t('Featured Projects', 'المشاريع المميزة')}</h2>
                {featured.length > 0 && <span className="pf-count">{featured.length}</span>}
              </div>

              {featured.length === 0 ? (
                <div className="pf-empty">
                  <Icon name="folder" size={30} />
                  <strong>{t('No featured projects yet', 'لا توجد مشاريع مميزة بعد')}</strong>
                  <p>{t('Featured projects will appear here once they are added.', 'المشاريع المميزة هتظهر هنا أول ما تتضاف.')}</p>
                </div>
              ) : (
                <div className="pf-grid">
                  {featured.map((p) => {
                    const title = (isAr ? p.title?.ar : p.title?.en) || p.title?.en || p.title?.ar || '';
                    const summary = (isAr ? p.summary?.ar : p.summary?.en) || p.summary?.en || p.summary?.ar || '';
                    const category = (isAr ? p.category?.ar : p.category?.en) || p.category?.en || '';
                    const tags = Array.isArray(p.tags) ? p.tags : [];
                    const cover = p.cover_image_path || '';
                    const liveUrl = p.live_demo_url || '';
                    return (
                      <article key={p.id} className="pf-project">
                        <div className="pf-project__media">
                          {cover ? (
                            <img src={`/${cover.replace(/^\//, '')}`} alt={title} loading="lazy" />
                          ) : (
                            <div className="pf-project__ph">{(title || '?').charAt(0).toUpperCase()}</div>
                          )}
                          {liveUrl && (
                            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="pf-project__live">
                              <i /> {t('Live', 'شغّال')}
                            </a>
                          )}
                        </div>
                        <div className="pf-project__body">
                          {category && <span className="pf-project__cat">{category}</span>}
                          <h3 className="pf-project__title">{title}</h3>
                          {summary && <p className="pf-project__sum">{summary}</p>}
                          {tags.length > 0 && (
                            <div className="pf-tags">
                              {tags.map((tag, i) => <span key={i} className="pf-tag">{String(tag)}</span>)}
                            </div>
                          )}
                          <div className="pf-project__foot">
                            <span className="pf-badge-pub"><Icon name="check-circle" size={14} />{t('Published', 'منشور')}</span>
                            {liveUrl && (
                              <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                                {t('Visit demo', 'زيارة المشروع')} <Icon name={isAr ? 'arrow-left' : 'arrow-right'} size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        <p className="pf-credit">
          {t('Public profile powered by', 'ملف عام تم إنشاؤه عبر')} <Link to="/">UIP</Link>
        </p>
      </div>

      <SiteFooter />
    </div>
  );
}
