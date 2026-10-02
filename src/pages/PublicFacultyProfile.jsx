import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import Icon from '../components/Icon';
import SiteFooter from '../components/SiteFooter';
import PublicTopbar from '../components/PublicTopbar';

/**
 * Public faculty page — reached at /universities/{universitySlug}/faculties/
 * {facultySlug} with no login required. Sibling of PublicUniversityProfile.jsx
 * (/u/{uuid}): same no-auth pattern. Talks to
 * GET /api/v1/faculty/public/{universitySlug}/{facultySlug}
 * (FacultyApiController::publicShow() — this endpoint already existed and
 * already built the right share_url via publicBaseUrl(), but the route was
 * mistakenly registered inside the uip.auth-protected `faculty` group, so
 * every unauthenticated visitor got a 401 instead of the page; and there
 * was no frontend route/page to land on at all). 404 (unknown slugs, a
 * faculty that hasn't turned "public" on, or a non-public parent
 * university) is a single "not found" state, same rule as the sibling
 * pages — the API never distinguishes the reason.
 */
export default function PublicFacultyProfile() {
  const { universitySlug, facultySlug } = useParams();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const t = (en, ar) => (isAr ? ar : en);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api.get(`/api/v1/faculty/public/${encodeURIComponent(universitySlug)}/${encodeURIComponent(facultySlug)}`)
      .then((json) => { if (alive) setData(json.data); })
      .catch((err) => { if (alive) setError(err); });
    return () => { alive = false; };
  }, [universitySlug, facultySlug]);

  if (error) {
    return (
      <div className="public-wrap" style={{ textAlign: 'center' }}>
        <PublicTopbar />
        <p className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Faculty page not found.', 'صفحة الكلية غير موجودة.')}</p>
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

  const university = data.university || {};
  const faculty = data.faculty || {};
  const departments = data.departments || [];
  const uniName = isAr ? (university.official_name_ar || university.official_name_en) : (university.official_name_en || university.official_name_ar);
  const name = isAr ? (faculty.name_ar || faculty.name_en) : (faculty.name_en || faculty.name_ar);
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div className="public-wrap">
      <PublicTopbar />

      <div className="card glass-panel animate-rise-in" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        {faculty.logo_path ? (
          <img
            src={faculty.logo_path}
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
        <h1 className="text-h1">{name}</h1>
        {uniName && (
          <p className="text-body" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{uniName}</p>
        )}
        {faculty.description && (
          <p className="text-small" style={{ maxWidth: 640, margin: 'var(--space-4) auto 0', whiteSpace: 'pre-line' }}>{faculty.description}</p>
        )}
        {faculty.website && (
          <a href={faculty.website} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-4)' }}>
            <Icon name="globe" size={14} /> {t('Visit website', 'زيارة الموقع')}
          </a>
        )}

        <div className="grid-2" style={{ maxWidth: 480, margin: 'var(--space-5) auto 0' }}>
          <div className="card glass-panel" style={{ padding: 'var(--space-4)' }}>
            <div className="text-caption">{t('Departments', 'الأقسام')}</div>
            <div className="text-h2">{faculty.departments_count ?? 0}</div>
          </div>
          <div className="card glass-panel" style={{ padding: 'var(--space-4)' }}>
            <div className="text-caption">{t('Students', 'الطلاب')}</div>
            <div className="text-h2">{faculty.students_count ?? 0}</div>
          </div>
          <div className="card glass-panel" style={{ padding: 'var(--space-4)' }}>
            <div className="text-caption">{t('Programs', 'البرامج')}</div>
            <div className="text-h2">{faculty.programs_count ?? 0}</div>
          </div>
          <div className="card glass-panel" style={{ padding: 'var(--space-4)' }}>
            <div className="text-caption">{t('Published Projects', 'مشاريع منشورة')}</div>
            <div className="text-h2">{faculty.published_projects_count ?? 0}</div>
          </div>
        </div>
      </div>

      <h2 className="text-h2" style={{ marginTop: 'var(--space-7)', marginBottom: 'var(--space-2)' }}>
        {t('Departments', 'الأقسام')}
      </h2>

      {departments.length === 0 ? (
        <div className="card glass-panel" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {t('No public departments yet.', 'لا توجد أقسام معلنة بعد.')}
        </div>
      ) : (
        <div className="public-projects-grid">
          {departments.map((d) => {
            const dName = isAr ? (d.name_ar || d.name_en) : (d.name_en || d.name_ar);
            return (
              <div key={d.id} className="card card-project glass-panel">
                <h3 className="text-h3">{dName}</h3>
                {d.description && <p className="text-small" style={{ flex: 1 }}>{d.description}</p>}
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
