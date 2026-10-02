import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import MeetingsDashboardWidget from '../../components/meetings/MeetingsDashboardWidget';
import { StaffHead, StaffKpi, whenLabel } from '../../components/staff/stfUi';
import { Pill, Skeleton } from '../../components/student/stUi';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

/**
 * Academic Staff home (Academic Staff design). Every number comes from the
 * endpoints this page always used: GET /academic-staff/me, /exam-system/exams,
 * /exam-system/question-banks and /exam-system/dashboard/instructor
 * (total_exams / active_exams / pending_grading / recent_results).
 * "Needs your attention" is derived from that real data (pending grading,
 * exams still in draft) — nothing is invented, and project/student widgets from
 * the design are not shown because this role has no API for them.
 */

const EXAM_TONE = { draft: 'neutral', scheduled: 'warning', published: 'success', active: 'success', closed: 'neutral', grading: '', graded: 'success', archived: 'neutral' };
const EXAM_LABEL = {
  draft: ['Draft', 'مسودة'], scheduled: ['Scheduled', 'مجدول'], published: ['Published', 'منشور'], active: ['Live', 'جارٍ'],
  closed: ['Closed', 'مغلق'], grading: ['Grading', 'قيد التصحيح'], graded: ['Graded', 'تم التصحيح'], archived: ['Archived', 'مؤرشف'],
};

export default function AcademicStaffDashboard() {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const ar = locale === 'ar';
  const [staff, setStaff] = useState(null);
  const [banks, setBanks] = useState([]);
  const [exams, setExams] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/api/v1/academic-staff/me'),
      api.get('/api/v1/exam-system/question-banks'),
      api.get('/api/v1/exam-system/exams'),
      api.get('/api/v1/exam-system/dashboard/instructor'),
    ])
      .then(([meJson, banksJson, examsJson, overviewJson]) => {
        if (cancelled) return;
        setStaff(meJson.data?.staff || null);
        setBanks(banksJson.data || []);
        setExams(examsJson.data || []);
        setOverview(overviewJson.data || null);
      })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="st-page"><Skeleton h={110} count={3} /></div>;
  if (error) return <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>;

  const name = staff?.full_name || user?.full_name || user?.name || '';
  const pending = overview?.pending_grading ?? 0;
  const upcoming = exams
    .filter((e) => (e.status === 'scheduled' || e.status === 'published') && e.start_at && new Date(String(e.start_at).replace(' ', 'T')) > new Date())
    .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  const drafts = exams.filter((e) => e.status === 'draft');
  const recentResults = overview?.recent_results || [];

  // Needs your attention — built only from real data.
  const attention = [];
  if (pending > 0) {
    attention.push({
      key: 'grading', tone: 'bad',
      title: ar ? 'تصحيح الامتحانات' : 'Exam Grading',
      text: ar ? `${pending} تسليمات تنتظر المراجعة اليدوية.` : `${pending} submission${pending === 1 ? '' : 's'} waiting for manual review.`,
      cta: ar ? 'فتح النتائج' : 'Open Results', to: '/academic-staff/attempts', primary: true,
    });
  }
  drafts.slice(0, 3).forEach((e) => attention.push({
    key: `draft-${e.id}`, tone: 'warn',
    title: e.title,
    text: ar ? 'امتحان ما زال مسودة — أكمله وانشره.' : 'Still a draft — finish it and publish.',
    cta: ar ? 'فتح الامتحان' : 'Open Exam', to: `/academic-staff/exams/${e.id}`,
  }));

  return (
    <div className="st-page">
      <StaffHead
        eyebrow={ar ? 'مرحبًا بعودتك' : 'Welcome back'}
        title={<>{name || (ar ? 'أهلًا' : 'Welcome')} <span aria-hidden="true">👋</span></>}
        subtitle={ar ? 'إليك ما يحتاج انتباهك اليوم.' : "Here's what needs your attention today."}
        actions={(
          <>
            <Link to="/academic-staff/attempts" className="btn btn-primary">{ar ? 'تصحيح المحاولات' : 'Grade Attempts'}</Link>
            <Link to="/academic-staff/exams" className="btn btn-outline" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-strong)' }}>{ar ? 'إنشاء امتحان' : 'Create Exam'}</Link>
          </>
        )}
      />

      {staff && staff.status !== 'active' && (
        <div className="st-alert st-alert--warning"><Icon name="alert-triangle" size={16} /><span>{ar ? 'حسابك غير نشط حاليًا. تواصل مع جامعتك.' : 'Your account is not currently active. Contact your university.'}</span></div>
      )}

      <div className="stf-kpis">
        <StaffKpi value={overview?.total_exams ?? exams.length} label={ar ? 'امتحاناتي' : 'My Exams'} icon="file" />
        <StaffKpi value={overview?.active_exams ?? 0} label={ar ? 'امتحانات جارية' : 'Active Exams'} icon="check-circle" tone="good" />
        <StaffKpi value={upcoming.length} label={ar ? 'امتحانات قادمة' : 'Upcoming Exams'} icon="calendar" tone="warn" />
        <StaffKpi value={pending} label={ar ? 'بانتظار التصحيح' : 'Pending Grading'} icon="edit" tone="bad" />
      </div>

      <MeetingsDashboardWidget />

      <div className="st-grid st-grid--main">
        <div className="st-stack">
          <section className="st-panel">
            <div className="st-panel__head"><h2>{ar ? 'يحتاج انتباهك' : 'Needs Your Attention'}</h2><Link to="/academic-staff/exams" className="st-link">{ar ? 'عرض الكل' : 'View all'}</Link></div>
            {attention.length === 0 ? (
              <p className="st-muted" style={{ fontSize: 13.5 }}>{ar ? 'لا شيء ينتظرك الآن. عمل رائع!' : "Nothing is waiting on you right now. You're all caught up."}</p>
            ) : (
              <ul className="stf-attn">
                {attention.map((a) => (
                  <li key={a.key}>
                    <div className="stf-attn__main">
                      <span className={`stf-attn__rule${a.tone === 'bad' ? ' stf-attn__rule--bad' : ''}`} />
                      <div style={{ minWidth: 0 }}><strong>{a.title}</strong><span>{a.text}</span></div>
                    </div>
                    <Link to={a.to} className={a.primary ? 'btn btn-primary btn-sm' : 'st-link'}>{a.cta}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="st-panel st-panel--flush">
            <div className="st-panel__head"><h2>{ar ? 'أحدث النتائج' : 'Recent Results'}</h2></div>
            {recentResults.length === 0 ? (
              <p className="st-muted" style={{ fontSize: 13.5, padding: '0 20px 20px' }}>{ar ? 'لا توجد نتائج مصححة بعد.' : 'No graded results yet.'}</p>
            ) : (
              <div className="st-table-wrap">
                <table className="st-table">
                  <thead><tr><th>{ar ? 'الامتحان' : 'Exam'}</th><th>{ar ? 'الطالب' : 'Student'}</th><th>{ar ? 'الدرجة' : 'Score'}</th><th>{ar ? 'وقت التسليم' : 'Submitted'}</th></tr></thead>
                  <tbody>
                    {recentResults.map((r, i) => (
                      <tr key={i}>
                        <td>{r.exam_id ? <Link to={`/academic-staff/exams/${r.exam_id}/attempts`} className="st-link" style={{ color: 'inherit', fontSize: 13 }}>{r.exam_title}</Link> : r.exam_title}</td>
                        <td>{r.student_name}</td>
                        <td>{r.percentage !== null && r.percentage !== undefined ? `${r.percentage}%` : '—'}</td>
                        <td className="st-muted">{r.submitted_at || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="st-stack">
          <section className="st-panel">
            <div className="st-panel__head"><h2>{ar ? 'الامتحانات القادمة' : 'Upcoming Exams'}</h2><Link to="/academic-staff/exams" className="st-link">{ar ? 'عرض الكل' : 'View all'}</Link></div>
            {upcoming.length === 0 ? (
              <p className="st-muted" style={{ fontSize: 13.5 }}>{ar ? 'لا توجد امتحانات قادمة.' : 'No upcoming exams.'}</p>
            ) : (
              <ul className="st-list">
                {upcoming.slice(0, 4).map((e) => {
                  const lbl = EXAM_LABEL[e.status] || EXAM_LABEL.scheduled;
                  return (
                    <li key={e.id} className="st-row" style={{ alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/academic-staff/exams/${e.id}`} style={{ fontWeight: 700, fontSize: 14, color: 'inherit', textDecoration: 'none' }}>{e.title}</Link>
                        <div className="st-muted" style={{ fontSize: 12.5, marginTop: 3 }}>{whenLabel(e.start_at, locale)}</div>
                      </div>
                      <Pill tone={EXAM_TONE[e.status] ?? ''}>{ar ? lbl[1] : lbl[0]}</Pill>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="st-panel">
            <div className="st-panel__head"><h2>{ar ? 'بنوك الأسئلة' : 'Question Banks'}</h2><Link to="/academic-staff/question-banks" className="st-link">{ar ? 'عرض الكل' : 'View all'}</Link></div>
            {banks.length === 0 ? (
              <p className="st-muted" style={{ fontSize: 13.5 }}>{ar ? 'لا توجد بنوك أسئلة بعد.' : 'No question banks yet.'}</p>
            ) : (
              <ul className="st-list">
                {banks.slice(0, 5).map((b) => (
                  <li key={b.id} className="st-row">
                    <Link to={`/academic-staff/question-banks/${b.id}`} style={{ fontSize: 13.5, fontWeight: 600, color: 'inherit', textDecoration: 'none', minWidth: 0 }}>{b.title}</Link>
                    <span className="st-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{b.questions_count || 0} {ar ? 'سؤال' : 'questions'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
