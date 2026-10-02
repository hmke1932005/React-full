import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import Icon from '../components/Icon';
import SiteFooter from '../components/SiteFooter';
import PublicTopbar from '../components/PublicTopbar';

/**
 * Public faculty page — /universities/{universitySlug}/faculties/{facultySlug}, no login required.
 * Talks to GET /api/v1/faculty/public/{universitySlug}/{facultySlug} (FacultyApiController::publicShow()).
 * 404 (unknown slugs / non-public faculty / non-public parent university) is one "not found" state.
 *
 * Same design language as PublicPortfolio.jsx and PublicUniversityProfile.jsx: scoped to .pf-page in
 * styles/css/pages/public-portfolio.css, Light + Dark, RTL-aware.
 */
export default function PublicFacultyProfile() {
  const { universitySlug, facultySlug } = useParams();
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
    api.get(`/api/v1/faculty/public/${encodeURIComponent(universitySlug)}/${encodeURIComponent(facultySlug)}`)
      .then((json) => { if (alive) setData(json.data); })
      .catch((err) => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [universitySlug, facultySlug]);

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
            <h1>{t('Faculty page not found', 'صفحة الكلية غير موجودة')}</h1>
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

  const university = data.university || {};
  const faculty = data.faculty || {};
  const departments = data.departments || [];
  const uniName = isAr ? (university.official_name_ar || university.official_name_en) : (university.official_name_en || university.official_name_ar);
  const name = isAr ? (faculty.name_ar || faculty.name_en) : (faculty.name_en || faculty.name_ar);
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const website = faculty.website || '';
  const websiteLabel = website.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const kpis = [
    { icon: 'building', value: faculty.departments_count ?? 0, label: t('Departments', 'الأقسام') },
    { icon: 'users', value: faculty.students_count ?? 0, label: t('Students', 'الطلاب') },
    { icon: 'layers', value: faculty.programs_count ?? 0, label: t('Programs', 'البرامج') },
    { icon: 'projects', value: faculty.published_projects_count ?? 0, label: t('Published projects', 'مشاريع منشورة') },
  ];

  return (
    <div className="pf-page">
      <div className="pf-shell">
        <PublicTopbar />

        <div className="pf-layout">
          {/* ---- Profile card ---- */}
          <aside className="pf-card pf-profile animate-rise-in">
            <div className="pf-profile__cover" />
            <div className="pf-profile__body">
              <div className={`pf-avatar${faculty.logo_path ? ' pf-avatar--logo' : ''}`} aria-hidden="true">
                {faculty.logo_path ? <img src={faculty.logo_path} alt="" /> : initial}
              </div>
              <h1 className="pf-name">{name}</h1>
              {uniName && <p className="pf-subline">{uniName}</p>}

              <div className="pf-stats">
                <div className="pf-stat"><strong>{faculty.departments_count ?? 0}</strong><span>{t('Departments', 'الأقسام')}</span></div>
                <div className="pf-stat"><strong>{faculty.students_count ?? 0}</strong><span>{t('Students', 'الطلاب')}</span></div>
              </div>

              {(uniName || website) && (
                <ul className="pf-meta">
                  {uniName && <li><Icon name="building" size={16} /><span>{uniName}</span></li>}
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
              {kpis.map((k) => (
                <div key={k.label} className="pf-card pf-kpi animate-rise-in">
                  <span className="pf-kpi__ico"><Icon name={k.icon} size={20} /></span>
                  <div><strong>{k.value}</strong><span>{k.label}</span></div>
                </div>
              ))}
            </div>

            {faculty.description && (
              <section className="pf-card pf-section animate-rise-in">
                <div className="pf-section__head">
                  <h2 className="pf-section__title"><Icon name="info" size={18} />{t('About', 'نبذة')}</h2>
                </div>
                <p className="pf-about">{faculty.description}</p>
              </section>
            )}

            <section className="pf-card pf-section animate-rise-in">
              <div className="pf-section__head">
                <h2 className="pf-section__title"><Icon name="building" size={18} />{t('Departments', 'الأقسام')}</h2>
                {departments.length > 0 && <span className="pf-count">{departments.length}</span>}
              </div>

              {departments.length === 0 ? (
                <div className="pf-empty">
                  <Icon name="building" size={30} />
                  <strong>{t('No public departments yet', 'لا توجد أقسام معلنة بعد')}</strong>
                  <p>{t('Departments will appear here once they are made public.', 'الأقسام هتظهر هنا أول ما تتفعّل للعامة.')}</p>
                </div>
              ) : (
                <div className="pf-grid">
                  {departments.map((d) => {
                    const dName = isAr ? (d.name_ar || d.name_en) : (d.name_en || d.name_ar);
                    return (
                      <article key={d.id} className="pf-dept">
                        <span className="pf-dept__ico"><Icon name="layers" size={18} /></span>
                        <h3>{dName}</h3>
                        {d.description && <p>{d.description}</p>}
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
