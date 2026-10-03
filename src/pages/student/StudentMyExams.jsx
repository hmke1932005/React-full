import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useLanguage } from '../../context/LanguageContext';
import { usePageMeta } from '../../context/PageMetaContext';
import { EmptyState, Skeleton } from '../../components/student/stUi';
import {
  AttemptPill, ExKpi, PhasePill, PHASES, examPhase, fmtDate, fmtNum, fmtTime, toDate,
} from '../../components/exam/examUi';

/**
 * Student "My Exams" (GET /api/v1/exam-system/my-exams). Each exam now carries
 * attempts_used + last_attempt, so the status and the action are derived with a
 * single request. Student phases: upcoming (window not open) / available (open,
 * attempts left or one in progress) / completed (finished, missed or out of attempts).
 */

const TABS = ['all', 'available', 'upcoming', 'completed'];
const TAB_LABEL = {
  all: { en: 'All', ar: 'الكل' },
  available: { en: 'Available', ar: 'متاح الآن' },
  upcoming: { en: 'Upcoming', ar: 'قادم' },
  completed: { en: 'Completed', ar: 'مكتمل' },
};

export function studentState(e, now = new Date()) {
  const last = e.last_attempt;
  const phase = examPhase(e, now);
  const used = e.attempts_used || 0;
  const outOfAttempts = e.max_attempts != null && used >= e.max_attempts;
  if (last?.status === 'in_progress') return 'available';
  if (phase === 'scheduled') return 'upcoming';
  if (phase === 'completed' || outOfAttempts) return 'completed';
  return 'available';
}

export default function StudentMyExams() {
  const { locale } = useLanguage();
  const ar = locale === 'ar';
  usePageMeta(ar ? 'الامتحانات' : 'Exams', ar ? 'امتحانات نشرها أساتذتك لك.' : 'Exams your instructors have published for you.');

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/exam-system/my-exams')
      .then((json) => { if (!cancelled) setExams(json.data || []); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const now = useMemo(() => new Date(), []);
  const rows = useMemo(() => exams.map((e) => ({ ...e, _s: studentState(e, now) })), [exams, now]);
  const counts = useMemo(() => {
    const c = { all: rows.length, available: 0, upcoming: 0, completed: 0 };
    rows.forEach((e) => { c[e._s] += 1; });
    return c;
  }, [rows]);
  const avg = useMemo(() => {
    const done = rows.filter((e) => e.last_attempt?.percentage != null);
    return done.length ? done.reduce((a, e) => a + e.last_attempt.percentage, 0) / done.length : null;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((e) => (tab === 'all' || e._s === tab)
      && (!needle || `${e.title} ${e.subject || ''}`.toLowerCase().includes(needle)));
  }, [rows, tab, q]);

  if (loading) return <div className="st-page"><Skeleton h={100} count={3} /></div>;
  if (error) return <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>;

  const action = (e) => {
    const last = e.last_attempt;
    if (last?.status === 'in_progress') return { to: `/student/exam-attempt/${last.id}`, label: ar ? 'متابعة' : 'Resume' };
    if (e._s === 'available') return { to: `/student/my-exams/${e.id}`, label: ar ? 'ابدأ' : 'Start' };
    if (last) return { to: `/student/my-exams/${e.id}`, label: ar ? 'النتيجة' : 'Result' };
    return { to: `/student/my-exams/${e.id}`, label: ar ? 'عرض' : 'View' };
  };

  return (
    <div className="ex-page">
      <div className="ex-kpis">
        <ExKpi label={ar ? 'إجمالي الامتحانات' : 'Total Exams'} value={counts.all} sub={ar ? 'المخصصة لك' : 'Assigned to you'} icon="file" />
        <ExKpi label={ar ? 'متاحة الآن' : 'Available Now'} value={counts.available} sub={ar ? 'جاهزة للبدء' : 'Ready to take'} icon="check-circle" tone="good" />
        <ExKpi label={ar ? 'القادمة' : 'Upcoming'} value={counts.upcoming} sub={ar ? 'لم تفتح بعد' : 'Not open yet'} icon="calendar" tone="warn" />
        <ExKpi label={ar ? 'متوسط درجاتك' : 'Your Average'} value={avg == null ? '—' : `${fmtNum(avg)}%`} sub={ar ? 'النتائج المنشورة' : 'Published results'} icon="award" />
      </div>

      <div className="ex-card">
        <div className="ex-tabs" role="tablist">
          {TABS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`ex-tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>
              {ar ? TAB_LABEL[k].ar : TAB_LABEL[k].en}<small>({counts[k]})</small>
            </button>
          ))}
        </div>
        <div className="ex-toolbar">
          <div className="ex-search">
            <Icon name="search" size={15} />
            <input className="ex-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'ابحث بعنوان الامتحان أو المقرر' : 'Search exams by title or course'} aria-label={ar ? 'بحث' : 'Search'} />
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 24 }}><EmptyState icon="file" title={ar ? 'لا توجد امتحانات متاحة حاليًا.' : 'No exams available right now.'} /></div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 24 }}><EmptyState icon="search" title={ar ? 'لا توجد امتحانات مطابقة' : 'No exams match'} /></div>
        ) : (
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>{ar ? 'الامتحان' : 'Exam'}</th>
                  <th>{ar ? 'الموعد' : 'Date'}</th>
                  <th>{ar ? 'المدة' : 'Duration'}</th>
                  <th>{ar ? 'المحاولات' : 'Attempts'}</th>
                  <th>{ar ? 'الحالة' : 'Status'}</th>
                  <th className="is-end">{ar ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const act = action(e);
                  const start = toDate(e.start_at);
                  return (
                    <tr key={e.id}>
                      <td style={{ minWidth: 200 }}>
                        <Link to={`/student/my-exams/${e.id}`} className="is-title">{e.title}</Link>
                        <div className="is-muted" style={{ fontSize: 12, marginTop: 2 }}>{e.subject || '—'}</div>
                      </td>
                      <td className="is-muted" style={{ whiteSpace: 'nowrap' }}>
                        {start ? `${fmtDate(e.start_at, ar)} · ${fmtTime(e.start_at, ar)}` : (ar ? 'يفتح فورًا' : 'Opens immediately')}
                      </td>
                      <td className="is-muted" style={{ whiteSpace: 'nowrap' }}>{e.duration_minutes} {ar ? 'د' : 'min'}</td>
                      <td className="is-muted">{e.attempts_used || 0}/{e.max_attempts ?? '∞'}</td>
                      <td>
                        {e.last_attempt && e._s === 'completed' && e.last_attempt.status !== 'in_progress'
                          ? <AttemptPill status={e.last_attempt.status} ar={ar} />
                          : e._s === 'upcoming' ? <PhasePill phase="scheduled" ar={ar} />
                            : e._s === 'available' ? <PhasePill phase="live" ar={ar} />
                              : <span className="ex-status ex-status--idle">{ar ? PHASES.completed.ar : PHASES.completed.en}</span>}
                      </td>
                      <td className="is-end" style={{ whiteSpace: 'nowrap' }}>
                        <Link to={act.to} className="ex-link">{act.label}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
