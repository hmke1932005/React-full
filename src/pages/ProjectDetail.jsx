import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import Icon from '../components/Icon';
import SiteFooter from '../components/SiteFooter';
import LandingNav from '../components/LandingNav';

const LINK_ICONS = {
  github: 'github', gitlab: 'github', live_demo: 'globe', website: 'globe',
  mobile_app: 'smartphone', documentation: 'file', video_demo: 'monitor',
  presentation: 'monitor', research_paper: 'file', other: 'link',
};

function safeJsonArray(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function livePreviewUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1200&h=650`;
}

/**
 * Port of app/Views/public/projects/show.php — same section order/classes
 * (.pp-window--standalone hero, .pp-gallery + .pp-lightbox media gallery,
 * links/docs, team, contact) talking to GET /api/v1/public/projects/{slug}
 * instead of the PHP-rendered view. "Contact the team" and the github/demo/
 * file click-tracking redirects (spec §18/§19) stay web-only for now —
 * PublicApiController's docblock — so this links straight to the raw URLs
 * instead of the PHP /go/ tracked redirects, and the message form is
 * disabled with a note rather than silently failing against a route that
 * doesn't exist yet.
 */
export default function ProjectDetail() {
  const { slug } = useParams();
  const { status, user } = useAuth();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const t = (en, ar) => (isAr ? ar : en);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null); // index into media, or null
  const [contactMessage, setContactMessage] = useState('');
  const [contactNote, setContactNote] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api.get(`/api/v1/public/projects/${encodeURIComponent(slug)}`)
      .then((json) => { if (alive) setData(json.data); })
      .catch((err) => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    if (lightbox === null) return undefined;
    const media = data?.media || [];
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowLeft') setLightbox((i) => (i - 1 + media.length) % media.length);
      if (e.key === 'ArrowRight') setLightbox((i) => (i + 1) % media.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, data]);

  const shaped = useMemo(() => {
    if (!data?.project) return null;
    const p = data.project;
    const title = (isAr ? p.title_ar : p.title_en) || p.title_en || p.title_ar || '';
    const uniName = (isAr ? p.university_name_ar : p.university_name_en) || '';
    const facName = (isAr ? p.faculty_name_ar : p.faculty_name_en) || '';
    const depName = (isAr ? p.department_name_ar : p.department_name_en) || '';
    const tags = safeJsonArray(p.tags);
    const technologies = safeJsonArray(p.technologies);
    const media = data.media || [];
    const mediaIds = new Set(media.map((m) => m.id));
    const otherFiles = (data.files || []).filter((f) => !mediaIds.has(f.id));
    const links = data.links || [];
    const liveLink = links.find((l) => l.type === 'live_demo' || l.type === 'website') || null;
    const heroCover = p.cover_image_path || '';
    const heroLivePreview = heroCover ? null : livePreviewUrl(liveLink?.url);
    const heroInitial = (title || 'U').charAt(0).toUpperCase();
    const isOwner = status === 'authenticated' && user && Number(user.id) === Number(p.owner_id);
    return { p, title, uniName, facName, depName, tags, technologies, media, otherFiles, links, liveLink, heroCover, heroLivePreview, heroInitial, isOwner };
  }, [data, isAr, status, user]);

  const shell = (children) => (
    <div className="lp2 lp2-page">
      <LandingNav />
      {children}
      <SiteFooter />
    </div>
  );

  if (error) {
    return shell(
      <main className="lp2-pd lp2-shell">
        <div className="lp2-card lp2-ex-empty">
          <span className="lp2-icon lp2-icon--lg"><Icon name="search" size={22} /></span>
          <h3>{t('Project not found.', 'المشروع غير موجود.')}</h3>
          <p>{t('It may have been unpublished or the link is wrong.', 'ممكن يكون اتشال من النشر أو الرابط غلط.')}</p>
          <Link to="/projects" className="btn btn-primary">{t('Back to all projects', 'رجوع لكل المشاريع')}</Link>
        </div>
      </main>
    );
  }

  if (!shaped) {
    return shell(
      <main className="lp2-pd lp2-shell" aria-busy="true">
        <div className="lp2-skel__line lp2-skel__line--s" style={{ width: 140 }} />
        <div className="lp2-skel__img" style={{ aspectRatio: '16/7', borderRadius: 16, margin: '16px 0' }} />
        <div className="lp2-skel__line" style={{ height: 28, width: '60%' }} />
        <div className="lp2-skel__line lp2-skel__line--m" />
      </main>
    );
  }

  const { p, title, uniName, facName, depName, tags, technologies, media, otherFiles, links, liveLink, heroCover, heroLivePreview, heroInitial, isOwner } = shaped;
  const current = lightbox !== null ? media[lightbox] : null;
  const team = (data.team_members || []).filter((m) => m.status === 'accepted');
  const views = (Number(p.views_count) || 0) + 1;
  const likes = Number(p.likes_count) || 0;
  const facts = [
    uniName && ['building', t('University', 'الجامعة'), p.university_slug
      ? <Link to={`/universities/${encodeURIComponent(p.university_slug)}`}>{uniName}</Link> : uniName],
    facName && ['layers', t('Faculty', 'الكلية'), facName],
    depName && ['folder', t('Department', 'القسم'), depName],
    p.category && ['projects', t('Category', 'التصنيف'), p.category],
    ['eye', t('Views', 'المشاهدات'), views],
    likes > 0 && ['heart', t('Likes', 'الإعجابات'), likes],
  ].filter(Boolean);

  return shell(
    <main className="lp2-pd lp2-shell">
      <Link to="/projects" className="lp2-pd__back">
        <Icon name={isAr ? 'arrow-right' : 'arrow-left'} size={16} /> {t('Back to all projects', 'رجوع لكل المشاريع')}
      </Link>

      <header className="lp2-pd__head animate-rise-in">
        <div className="lp2-pd__badges">
          {p.category && <span className="lp2-tag lp2-tag--static">{p.category}</span>}
          <span className="lp2-badge"><Icon name="check-circle" size={13} /> {t('Published', 'منشور')}</span>
        </div>
        <h1>{title}</h1>
        {p.summary && <p className="lp2-pd__summary">{p.summary}</p>}
      </header>

      <div className="lp2-pd__grid">
        <div className="lp2-pd__main">
          {(heroCover || heroLivePreview) && (
            <div className="lp2-pd__hero animate-rise-in">
              {heroCover ? (
                <img src={`/${heroCover.replace(/^\//, '')}`} alt={title || t('Project cover image', 'صورة المشروع')} />
              ) : (
                <img
                  src={heroLivePreview}
                  alt={`${title || t('Project', 'المشروع')}${t(' — live preview', ' — معاينة حية')}`}
                  onError={(e) => {
                    const div = document.createElement('div');
                    div.className = 'pp-window__placeholder';
                    div.setAttribute('aria-hidden', 'true');
                    div.innerHTML = `<span>${heroInitial}</span>`;
                    e.currentTarget.replaceWith(div);
                  }}
                />
              )}
              {liveLink && <span className="lp2-pd__live"><span className="pp-live__dot" />{t('Live', 'شغّال')}</span>}
            </div>
          )}

          {p.description && (
            <section className="lp2-card lp2-pd__sec">
              <h2>{t('About this project', 'عن المشروع')}</h2>
              <div className="lp2-pd__prose">{p.description}</div>
              {(tags.length > 0 || technologies.length > 0) && (
                <div className="lp2-pd__chips">
                  {technologies.map((tech, i) => <span className="lp2-tag lp2-tag--brand" key={`tech-${i}`}>{tech}</span>)}
                  {tags.map((tag, i) => <span className="lp2-tag lp2-tag--static" key={`tag-${i}`}>{tag}</span>)}
                </div>
              )}
            </section>
          )}

          {media.length > 0 && (
            <section className="lp2-card lp2-pd__sec">
              <h2>{t('Media Gallery', 'معرض الوسائط')}</h2>
              <div className="pp-gallery">
                {media.map((m, i) => {
                  const thumb = m.file_type === 'image' ? m.url : m.thumbnail_url;
                  return (
                    <button
                      key={m.id} type="button"
                      className={`pp-gallery__item${m.is_featured ? ' pp-gallery__item--featured' : ''}`}
                      aria-label={m.caption || m.original_name}
                      onClick={() => setLightbox(i)}
                    >
                      {thumb ? (
                        <img src={thumb} alt={m.caption || ''} loading="lazy" />
                      ) : (
                        <div className="pp-gallery__placeholder" aria-hidden="true"><Icon name="file" size={22} /></div>
                      )}
                      {m.file_type !== 'image' && <span className="pp-gallery__play"><Icon name="monitor" size={18} /></span>}
                      {(m.caption || m.original_name) && <span className="pp-gallery__caption">{m.caption || m.original_name}</span>}
                    </button>
                  );
                })}
              </div>

              {current && (
                <div className="pp-lightbox" onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
                  <button type="button" className="pp-lightbox__close" aria-label={t('Close', 'إغلاق')} onClick={() => setLightbox(null)}>
                    <Icon name="x" size={22} />
                  </button>
                  <button
                    type="button" className="pp-lightbox__nav pp-lightbox__nav--prev" aria-label={t('Previous', 'السابق')}
                    onClick={() => setLightbox((i) => (i - 1 + media.length) % media.length)}
                  >
                    <Icon name="chevron-left" size={26} />
                  </button>
                  <div className="pp-lightbox__stage">
                    {current.file_type === 'image' && <img src={current.url} alt={current.caption || ''} />}
                    {current.file_type === 'video' && current.url && <video src={current.url} controls autoPlay />}
                    {current.file_type !== 'image' && current.embed_url && (
                      <iframe src={current.embed_url} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={current.caption || 'media'} />
                    )}
                  </div>
                  <button
                    type="button" className="pp-lightbox__nav pp-lightbox__nav--next" aria-label={t('Next', 'التالي')}
                    onClick={() => setLightbox((i) => (i + 1) % media.length)}
                  >
                    <Icon name="chevron-right" size={26} />
                  </button>
                  <div className="pp-lightbox__caption">{current.caption || current.original_name || ''}</div>
                </div>
              )}
            </section>
          )}

          {team.length > 0 && (
            <section className="lp2-card lp2-pd__sec">
              <h2>{t('Team', 'فريق العمل')}</h2>
              <div className="lp2-pd__team">
                {team.map((m) => (
                  <div key={m.id} className="lp2-pd__member">
                    <span className="lp2-icon"><Icon name="user" size={16} /></span>
                    <div>
                      <strong>{m.display_name}</strong>
                      {m.role && <span>{m.role}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lp2-pd__side">
          <div className="lp2-card lp2-pd__panel">
            {liveLink && (
              <a href={liveLink.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary lp2-pd__cta">
                <Icon name="globe" size={16} /> {t('Visit live project', 'زيارة المشروع مباشرة')}
              </a>
            )}
            <dl className="lp2-pd__facts">
              {facts.map(([icon, label, value]) => (
                <div key={label}>
                  <dt><Icon name={icon} size={14} /> {label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {(links.length > 0 || otherFiles.length > 0) && (
            <div className="lp2-card lp2-pd__panel">
              <h2>{t('Links & Documents', 'روابط ومستندات')}</h2>
              <div className="lp2-pd__links">
                {links.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer">
                    <Icon name={LINK_ICONS[l.type] || 'link'} size={16} /> <span>{l.label}</span>
                    <Icon name="arrow-right" size={14} />
                  </a>
                ))}
                {otherFiles.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer">
                    <Icon name="file" size={16} /> <span>{f.original_name}</span>
                    <Icon name="arrow-right" size={14} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="lp2-card lp2-pd__panel">
            <h2>{t('Contact the Team', 'تواصل مع الفريق')}</h2>
            {isOwner ? (
              <p className="lp2-pd__muted">{t('This is your own project.', 'ده مشروعك انت.')}</p>
            ) : status === 'authenticated' ? (
              <form onSubmit={(e) => { e.preventDefault(); setContactNote(t("Messaging the project team isn't available from this page yet — try Messages from your dashboard.", 'التواصل مع فريق المشروع من هنا لسه مش متاح — جرّب صفحة الرسائل من لوحة التحكم.')); }}>
                {contactNote && (
                  <div className="lp2-pd__note"><Icon name="alert-triangle" size={16} /><span>{contactNote}</span></div>
                )}
                <textarea
                  className="form-input" rows={4} maxLength={2000} required
                  value={contactMessage} onChange={(e) => setContactMessage(e.target.value)}
                  placeholder={t('Write your message to the team...', 'اكتب رسالتك للفريق...')}
                />
                <button type="submit" className="btn btn-primary lp2-pd__cta"><Icon name="mail" size={16} /> {t('Send', 'إرسال')}</button>
              </form>
            ) : (
              <>
                <p className="lp2-pd__muted">{t("Log in to contact this project's team.", 'سجّل دخولك عشان تتواصل مع فريق المشروع.')}</p>
                <Link to={`/auth/login?redirect=${encodeURIComponent(`/projects/${p.slug || p.uuid}`)}`} className="btn btn-outline lp2-pd__cta">
                  {t('Log in', 'تسجيل الدخول')}
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
