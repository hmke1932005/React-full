import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import MeetingsDashboardWidget from '../../components/meetings/MeetingsDashboardWidget';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/faculty/dashboard';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/faculty/dashboard.php, talking to the real JSON API
 * (GET /api/v1/dashboards/overview — App\Controllers\Api\
 * DashboardsApiController::overview() → facultyOverview(), the exact
 * same source-of-truth list the web controller's own dashboard.php
 * consumes: ProjectRepository::forFacultyWithOwner/departmentBreakdown
 * ForFaculty/categoryBreakdownForFaculty/academicYearBreakdownForFaculty/
 * mostViewedForFaculty/recentForFaculty, ProjectApprovalService::
 * queueForFaculty, StudentRepository::forFacultyWithStats). Nothing here
 * is invented — every widget below reads a key the API already returns.
 * No Activity chart / Most Interacted / avg AI readiness widgets here —
 * facultyOverview() doesn't return those keys (university-only), same
 * gap the PHP view leaves out.
 *
 * The PHP view's CSS-only mobile recomposition (kpi-scroll strip, two
 * mobile tab groups, collapsed Project Approval Path accordion) is
 * preserved via explicit React tab state, same convention as
 * UniversityDashboard.jsx.
 *
 * Round 8 (Phase 26/28) addition — a separate, best-effort pair of calls
 * to GET /api/v1/exam-system/faculty/dashboard (ExamAnalyticsApiController
 * ::facultyDashboard -> ExamAnalyticsService::scopedDashboard(), scoped to
 * this faculty via FacultyRepository::findByUserId(), never from client
 * input) and GET /api/v1/exam-system/faculty/exams feed the new "Exams"
 * section below. Kept as its own request pair, same pattern as
 * StudentDashboard.jsx's exam widget — this dashboard's main data still
 * comes from /api/v1/dashboards/overview (project system), a completely
 * separate module from exam-system; failing to load exam data just hides
 * that one section instead of the whole dashboard.
 */

const EXAM_STATUS_META = {
  draft: { cls: 'badge-neutral', en: 'Draft', ar: 'مسودة' },
  scheduled: { cls: 'badge-primary', en: 'Scheduled', ar: 'مجدول' },
  published: { cls: 'badge-success', en: 'Published', ar: 'منشور' },
  closed: { cls: 'badge-neutral', en: 'Closed', ar: 'مغلق' },
};

function StatCard({ label, value, icon, accent }) {
  return (
    <div className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
      <span style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', flexShrink: 0, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} />
      </span>
      <div>
        <p className="text-caption" style={{ margin: 0 }}>{label}</p>
        <p className="text-h2" style={{ margin: 0 }}>{value}</p>
      </div>
    </div>
  );
}

function BarRow({ label, total, max, colorFrom, colorTo }) {
  const pct = Math.round((total / max) * 100);
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
        <span className="text-small">{label}</span>
        <span className="text-caption text-mono">{total}</span>
      </div>
      <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--glass-bg)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-full)', background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})` }} />
      </div>
    </div>
  );
}

const STATUS_META = {
  pending: { cls: 'badge-primary', en: 'Pending', ar: 'قيد الانتظار' },
  approved: { cls: 'badge-success', en: 'Approved', ar: 'معتمد' },
  rejected: { cls: 'badge-danger', en: 'Rejected', ar: 'مرفوض' },
  changes_requested: { cls: 'badge-neutral', en: 'Changes Requested', ar: 'تعديلات مطلوبة' },
};

const PROJECT_STATUS_META = {
  submitted: { cls: 'badge-primary', en: 'Submitted', ar: 'مُقدَّم' },
  under_review: { cls: 'badge-primary', en: 'Under Review', ar: 'قيد المراجعة' },
  approved: { cls: 'badge-success', en: 'Approved', ar: 'معتمد' },
  rejected: { cls: 'badge-danger', en: 'Rejected', ar: 'مرفوض' },
  published: { cls: 'badge-success', en: 'Published', ar: 'منشور' },
  archived: { cls: 'badge-neutral', en: 'Archived', ar: 'مؤرشف' },
};

function projectTitle(row, locale) {
  const en = row.title_en || '';
  const ar = row.title_ar || '';
  return (locale === 'ar' ? (ar || en) : (en || ar)) || '';
}

export default function FacultyDashboard() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [breakdownTab, setBreakdownTab] = useState('dept');
  const [listTab, setListTab] = useState('viewed');
  const [examStats, setExamStats] = useState(null);
  const [examList, setExamList] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/dashboards/overview')
      .then((json) => { if (!cancelled) setData(json.data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/api/v1/exam-system/faculty/dashboard'),
      api.get('/api/v1/exam-system/faculty/exams'),
    ])
      .then(([statsJson, examsJson]) => {
        if (cancelled) return;
        setExamStats(statsJson.data || null);
        setExamList(examsJson.data || []);
      })
      .catch(() => { /* best-effort — exam widget just stays hidden */ });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p style={{ color: 'var(--color-danger)', padding: 'var(--space-5)' }}>{error}</p>;
  if (!data) return null;

  const faculty = data.faculty || null;
  const facultyName = faculty
    ? (locale === 'ar' ? (faculty.name_ar || faculty.name_en) : (faculty.name_en || faculty.name_ar))
    : t('Your Faculty');

  const totalStudents = data.total_students || 0;
  const underReview = data.under_review || 0;
  const approvalRate = data.approval_rate || 0;
  const totalProjects = data.total_projects || 0;
  const pendingQueue = data.pending_queue || [];
  const departmentBreakdown = data.department_breakdown || [];
  const categoryBreakdown = data.category_breakdown || [];
  const yearBreakdown = data.year_breakdown || [];
  const mostViewed = data.most_viewed || [];
  const recentProjects = data.recent_projects || [];

  const maxDept = departmentBreakdown.length ? Math.max(1, ...departmentBreakdown.map((r) => Number(r.total))) : 1;
  const maxCategory = categoryBreakdown.length ? Math.max(1, ...categoryBreakdown.map((r) => Number(r.total))) : 1;
  const maxYear = yearBreakdown.length ? Math.max(1, ...yearBreakdown.map((r) => Number(r.total))) : 1;

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <p className="text-caption" style={{ margin: 0 }}>{t('Welcome back')}</p>
          <h1 className="text-h1">{facultyName} 🎓</h1>
          <p className="text-small">{locale === 'ar' ? 'إليك ملخص نشاط طلاب كليتك اليوم.' : "Here's a snapshot of your faculty's student activity today."}</p>
        </div>
        <div className="page-header__actions">
          <Link to="/faculty/approvals" className="btn btn-primary">
            <Icon name="check-circle" size={18} /> {t('Review Approvals')}
          </Link>
          <Link to="/faculty/students" className="btn btn-outline">
            <Icon name="users" size={18} /> {t('Manage Students')}
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <MeetingsDashboardWidget />
      </div>

      {!faculty && (
        <div className="card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
          <p className="text-small text-muted">{t('This login is not linked to a faculty yet.')}</p>
        </div>
      )}

      <div className="grid-4 kpi-scroll" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard label={locale === 'ar' ? 'إجمالي الطلاب' : 'Total Students'} value={totalStudents} icon="users" accent="var(--uip-indigo-600)" />
        <StatCard label={locale === 'ar' ? 'مشاريع قيد المراجعة' : 'Projects Under Review'} value={underReview} icon="clock" accent="var(--uip-gold-600)" />
        <StatCard label={locale === 'ar' ? 'معدل الاعتماد' : 'Approval Rate'} value={`${approvalRate}%`} icon="check-circle" accent="var(--uip-teal-600)" />
        <StatCard label={locale === 'ar' ? 'إجمالي المشاريع' : 'Total Projects'} value={totalProjects} icon="folder" accent="var(--uip-coral-600)" />
      </div>

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 className="text-h2">{t('Awaiting Your Approval')}</h2>
              <Link to="/faculty/approvals" className="btn btn-ghost btn-sm">
                {t('View all')} <Icon name={locale === 'ar' ? 'chevron-left' : 'chevron-right'} size={14} />
              </Link>
            </div>
            {pendingQueue.length === 0 ? (
              <p className="text-caption">{t('Nothing awaiting your approval right now.')}</p>
            ) : pendingQueue.map((p) => {
              const meta = STATUS_META[p.status] || STATUS_META.pending;
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{p.title?.[locale] || p.title?.en}</p>
                    <span className="text-caption">{p.student?.[locale] || p.student?.en}</span>
                  </div>
                  <span className={`badge ${meta.cls}`}>{meta[locale]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card glass-panel">
            <details className="mobile-accordion">
              <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                <h3 className="text-h3" style={{ margin: 0 }}>{t('Project Approval Path')}</h3>
                <span className="mobile-accordion__chevron"><Icon name="chevron-down" size={18} /></span>
              </summary>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <div className="timeline">
                  <div className="timeline-item is-done"><div className="timeline-item__dot"><Icon name="check" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{t('Student submission')}</p></div>
                  <div className="timeline-item"><div className="timeline-item__dot"><Icon name="clock" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{t('Faculty approval (you are here)')}</p></div>
                  <div className="timeline-item"><div className="timeline-item__dot"><Icon name="sparkles" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{t('AI review')}</p></div>
                  <div className="timeline-item"><div className="timeline-item__dot"><Icon name="folder" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{t('Published on platform')}</p></div>
                </div>
                <p className="text-caption" style={{ marginTop: 'var(--space-4)' }}>{t('Approve publishes the project immediately. Request Changes sends it back to the student as a draft.')}</p>
              </div>
            </details>
          </div>
        </aside>
      </div>

      <div data-tabs-scope style={{ marginTop: 'var(--space-6)' }}>
        <div className="tabs" data-tabs data-mobile-tabs style={{ marginBottom: 'var(--space-5)' }}>
          <button type="button" className={`tab-link${breakdownTab === 'dept' ? ' is-active' : ''}`} onClick={() => setBreakdownTab('dept')}>{t('Department')}</button>
          <button type="button" className={`tab-link${breakdownTab === 'category' ? ' is-active' : ''}`} onClick={() => setBreakdownTab('category')}>{t('Category')}</button>
          <button type="button" className={`tab-link${breakdownTab === 'year' ? ' is-active' : ''}`} onClick={() => setBreakdownTab('year')}>{t('Year')}</button>
        </div>
        <div className="grid-3">
          <div className={`card glass-panel mobile-tab-panel${breakdownTab === 'dept' ? ' is-active' : ''}`}>
            <h3 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>{t('By Department')}</h3>
            {departmentBreakdown.length === 0 ? (
              <p className="text-caption">{t('Not enough data yet.')}</p>
            ) : departmentBreakdown.map((row, i) => (
              <BarRow key={i} label={row.department} total={Number(row.total)} max={maxDept} colorFrom="var(--uip-indigo-600)" colorTo="var(--color-accent)" />
            ))}
          </div>

          <div className={`card glass-panel mobile-tab-panel${breakdownTab === 'category' ? ' is-active' : ''}`}>
            <h3 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>{t('By Category')}</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-caption">{t('Not enough data yet.')}</p>
            ) : categoryBreakdown.map((row, i) => (
              <BarRow key={i} label={row.category} total={Number(row.total)} max={maxCategory} colorFrom="var(--uip-teal-600)" colorTo="var(--color-accent)" />
            ))}
          </div>

          <div className={`card glass-panel mobile-tab-panel${breakdownTab === 'year' ? ' is-active' : ''}`}>
            <h3 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>{t('By Academic Year')}</h3>
            {yearBreakdown.length === 0 ? (
              <p className="text-caption">{t('Not enough data yet.')}</p>
            ) : yearBreakdown.map((row, i) => (
              <BarRow
                key={i}
                label={locale === 'ar' ? `السنة ${row.academic_year}` : `Year ${row.academic_year}`}
                total={Number(row.total)}
                max={maxYear}
                colorFrom="var(--uip-coral-600)"
                colorTo="var(--color-accent)"
              />
            ))}
          </div>
        </div>
      </div>

      <div data-tabs-scope style={{ marginTop: 'var(--space-6)' }}>
        <div className="tabs" data-tabs data-mobile-tabs style={{ marginBottom: 'var(--space-5)' }}>
          <button type="button" className={`tab-link${listTab === 'viewed' ? ' is-active' : ''}`} onClick={() => setListTab('viewed')}>{t('Most Viewed')}</button>
          <button type="button" className={`tab-link${listTab === 'recent' ? ' is-active' : ''}`} onClick={() => setListTab('recent')}>{t('Recent Projects')}</button>
        </div>
        <div className="grid-2">
          <div className={`card glass-panel mobile-tab-panel${listTab === 'viewed' ? ' is-active' : ''}`}>
            <h2 className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>{t('Most Viewed')}</h2>
            {mostViewed.length === 0 ? (
              <p className="text-caption">{t('No views recorded yet.')}</p>
            ) : mostViewed.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <Link to={`/projects/${encodeURIComponent(p.slug || p.uuid)}`} className="text-small" style={{ fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>{projectTitle(p, locale)}</Link>
                <span className="badge badge-neutral"><Icon name="eye" size={14} /> {p.views_count}</span>
              </div>
            ))}
          </div>

          <div className={`card glass-panel mobile-tab-panel${listTab === 'recent' ? ' is-active' : ''}`}>
            <h2 className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>{t('Recent Projects')}</h2>
            {recentProjects.length === 0 ? (
              <p className="text-caption">{t('No projects yet.')}</p>
            ) : recentProjects.map((p) => {
              const meta = PROJECT_STATUS_META[p.status] || PROJECT_STATUS_META.submitted;
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className="text-small" style={{ fontWeight: 600 }}>{projectTitle(p, locale)}</span>
                  <span className={`badge ${meta.cls}`}>{meta[locale]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {examStats && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <h2 className="text-h2" style={{ marginBottom: 'var(--space-4)' }}>{t('Exams')}</h2>
          <div className="grid-4 kpi-scroll" style={{ marginBottom: 'var(--space-5)' }}>
            <StatCard label={t('Total Exams')} value={examStats.total_exams ?? 0} icon="file" accent="var(--uip-indigo-600)" />
            <StatCard label={t('Total Students')} value={examStats.total_students ?? 0} icon="users" accent="var(--uip-teal-600)" />
            <StatCard label={t('Total Attempts')} value={examStats.total_attempts ?? 0} icon="edit" accent="var(--uip-coral-600)" />
            <StatCard label={t('Average Performance')} value={examStats.average_performance !== null && examStats.average_performance !== undefined ? `${examStats.average_performance}%` : '—'} icon="chart" accent="var(--uip-gold-600)" />
          </div>
          <div className="card glass-panel">
            <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Faculty Exams')}</h3>
            {examList.length === 0 ? (
              <p className="text-caption">{t('No exams yet.')}</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('Exam')}</th>
                      <th>{t('Status')}</th>
                      <th>{t('Attempts')}</th>
                      <th>{t('Graded')}</th>
                      <th>{t('Average Score')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examList.slice(0, 8).map((e) => {
                      const meta = EXAM_STATUS_META[e.status] || EXAM_STATUS_META.draft;
                      return (
                        <tr key={e.id}>
                          <td>{e.title}</td>
                          <td><span className={`badge ${meta.cls}`}>{meta[locale]}</span></td>
                          <td>{e.total_attempts ?? 0}</td>
                          <td>{e.graded_count ?? 0}</td>
                          <td>{e.average_score !== null && e.average_score !== undefined ? `${e.average_score}%` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
