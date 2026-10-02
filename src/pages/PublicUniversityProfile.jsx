import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import Icon from '../components/Icon';
import SiteFooter from '../components/SiteFooter';
import PublicTopbar from '../components/PublicTopbar';

/**
 * Public university page — /u/{uuid}, no login required.
 * Talks to GET /api/v1/public/universities/{uuid} (PublicApiController::universityProfile()).
 * 404 (missing uuid, or a university with "Make profile public" off) is one "not found" state.
 *
 * Same design language as PublicPortfolio.jsx (/p/{uuid}): scoped to .pf-page in
 * styles/css/pages/public-portfolio.css, Light + Dark, RTL-aware. No new backend data needed.
 */
export default function PublicUniversityProfile() {
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
    api.get(`/api/v1/public/universities/${encodeURIComponent(uuid)}`)
      .then((json) => { if (alive) setData(json.data); })
      .catch((err) => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [uuid]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — ignore */ }
  };

  if (error) {
    return (
      <div className="pf-page">
        <div className="pf-shell">
          <PublicTopbar />
          <div className="pf-card pf-state">
            <Icon name="building" size={34} />
            <h1>{t('University page not found', 'صفحة الجامعة غير موجودة')}</h1>
            <p>{t('This profile does not exist or is not public.', 'الصفحة دي مش موجودة أو مش متاحة للعامة.')}</p>
            <Link to="/projects" className="pf-btn pf-btn--primary">{t('Browse projects', 'تصفّح المشاريع')}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pf-page">
        <div className="pf-shell">
          <PublicTopbar />
          <div className="pf-layout" aria-busy="true" aria-label={t('Loading…', 'جارِ التحميل…')}>
            <div className="pf-skel" style={{ height: 420 }} />
            <div className="pf-main">
              <div className="pf-skel" style={{ height: 90 }} />
              <div className="pf-skel" style={{ height: 320 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const uni = data.university || {};
  const projects = data.projects || [];
  const name = isAr ? (uni.official_name_ar || uni.official_name_en) : (uni.official_name_en || uni.official_name_ar);
  const altName = isAr ? uni.official_name_en : uni.official_name_ar;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const location = [uni.city, uni.country].filter(Boolean).join(isAr ? '، ' : ', ');
  const verified = uni.verification_status === 'verified';
  const website = uni.website || '';
  const websiteLabel = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const liveCount = projects.filter((p) => p.live_demo_url).length;

  return (
    <div className="pf-page">
      <div className="pf-shell">
        <PublicTopbar />

        <div className="pf-layout">
          {/* ---- Profile card ---- */}
          <aside className="pf-card pf-profile animate-rise-in">
            <div className="pf-profile__cover" />
            <div className="pf-profile__body">
              <div className={`pf-avatar${uni.logo_path ? ' pf-avatar--logo' : ''}`} aria-hidden="true">
                {uni.logo_path ? <img src={uni.logo_path} alt="" /> : initial}
              </div>
              <h1 className="pf-name">{name}</h1>
              {altName && altName !== name && <p className="pf-subline">{altName}</p>}
              {verified && (
                <span className="pf-verified"><Icon name="check-circle" size={14} />{t('Verified university', 'جامعة موثّقة')}</span>
              )}

              <div className="pf-stats">
                <div className="pf-stat"><strong>{uni.students_count ?? 0}</strong><span>{t('Students', 'الطلاب')}</span></div>
                <div className="pf-stat"><strong>{uni.published_projects_count ?? 0}</strong><span>{t('Published projects', 'مشاريع منشورة')}</span></div>
              </div>

              {(location || website) && (
                <ul className="pf-meta">
                  {location && <li><Icon name="map-pin" size={16} /><span>{location}</span></li>}
                  {website && (
                    <li>
                      <Icon name="globe" size={16} />
                      <a href={website} target="_blank" rel="noopener noreferrer">{websiteLabel}</a>
                    </li>
                  )}
                </ul>
              )}

              <div className="pf-actions">
                <button type="button" className={`pf-btn${copied ? ' is-done' : ''}`} onClick={copyLink}>
                  <Icon name={copied ? 'check' : 'link'} size={16} />
                  {copied ? t('Link copied', 'تم نسخ الرابط') : t('Copy profile link', 'نسخ رابط البروفايل')}
                </button>
                {website && (
                  <a href={website} target="_blank" rel="noopener noreferrer" className="pf-btn pf-btn--primary">
                    <Icon name="globe" size={16} />
                    {t('Visit website', 'زيارة الموقع')}
                  </a>
                )}
              </div>
            </div>
          </aside>

          {/* ---- Main column ---- */}
          <div className="pf-main">
            <div className="pf-kpis">
              <div className="pf-card pf-kpi animate-rise-in">
                <span className="pf-kpi__ico"><Icon name="users" size={20} /></span>
                <div><strong>{uni.students_count ?? 0}</strong><span>{t('Students', 'الطلاب')}</span></div>
              </div>
              <div className="pf-card pf-kpi animate-rise-in">
                <span className="pf-kpi__ico"><Icon name="projects" size={20} /></span>
                <div><strong>{uni.published_projects_count ?? 0}</strong><span>{t('Published projects', 'مشاريع منشورة')}</span></div>
              </div>
              <div className="pf-card pf-kpi animate-rise-in">
                <span className="pf-kpi__ico"><Icon name="globe" size={20} /></span>
                <div><strong>{liveCount}</strong><span>{t('Live demos', 'عروض شغّالة')}</span></div>
              </div>
            </div>

            <section className="pf-card pf-section animate-rise-in">
              <div className="pf-section__head">
                <h2 className="pf-section__title"><Icon name="star" size={18} />{t('Published Student Projects', 'مشاريع الطلاب المنشورة')}</h2>
                {projects.length > 0 && <span className="pf-count">{projects.length}</span>}
              </div>

              {projects.length === 0 ? (
                <div className="pf-empty">
                  <Icon name="folder" size={30} />
                  <strong>{t('No published projects yet', 'لا توجد مشاريع منشورة بعد')}</strong>
                  <p>{t('Student projects will appear here once they are published.', 'مشاريع الطلاب هتظهر هنا أول ما تتنشر.')}</p>
                </div>
              ) : (
                <div className="pf-grid">
                  {projects.map((p) => {
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
