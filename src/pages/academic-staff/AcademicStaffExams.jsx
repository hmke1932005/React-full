import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useLanguage } from '../../context/LanguageContext';
import { StaffHead } from '../../components/staff/stfUi';
import { EmptyState, Skeleton } from '../../components/student/stUi';
import {
  EXAM_TYPES, ExKpi, PhasePill, PHASES, examPhase, examTypeLabel, fmtDate, toDate,
} from '../../components/exam/examUi';

/**
 * Exams workspace (design: "Assessment workspace"). GET /api/v1/exam-system/exams
 * already returns, per exam, students_count / attempts_count / submitted_count /
 * pending_grading_count (ExamSystemService::listExamsWithMeta), so this page makes
 * a single request. The Draft / Scheduled / Live / Completed phases are derived
 * from status + the exam window (components/exam/examUi.jsx::examPhase).
 */

const TAB_KEYS = ['all', 'draft', 'scheduled', 'live', 'completed'];
const DAY = 86400000;

const SORTS = [
  { key: 'latest', en: 'Latest Created', ar: 'الأحدث إنشاءً' },
  { key: 'oldest', en: 'Oldest Created', ar: 'الأقدم إنشاءً' },
  { key: 'date', en: 'Exam Date', ar: 'تاريخ الامتحان' },
  { key: 'title', en: 'Title (A–Z)', ar: 'العنوان (أ–ي)' },
];

const DATE_RANGES = [
  { key: '', en: 'Any date', ar: 'أي تاريخ' },
  { key: 'next7', en: 'Next 7 days', ar: 'الأسبوع القادم' },
  { key: 'next30', en: 'Next 30 days', ar: 'الشهر القادم' },
  { key: 'past', en: 'Past exams', ar: 'امتحانات سابقة' },
];

function actionFor(exam, phase, ar) {
  switch (phase) {
    case 'draft': return { to: `/academic-staff/exams/${exam.id}/edit`, label: ar ? 'تعديل' : 'Edit' };
    case 'live': return { to: `/academic-staff/exams/${exam.id}/attempts`, label: ar ? 'متابعة' : 'Monitor' };
    case 'completed': return { to: `/academic-staff/exams/${exam.id}?tab=results`, label: ar ? 'النتائج' : 'Results' };
    default: return { to: `/academic-staff/exams/${exam.id}`, label: ar ? 'عرض' : 'View' };
  }
}

export default function AcademicStaffExams() {
  const { locale } = useLanguage();
  const ar = locale === 'ar';
  const navigate = useNavigate();

  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('');
  const [type, setType] = useState('');
  const [year, setYear] = useState('');
  const [range, setRange] = useState('');
  const [sort, setSort] = useState('latest');

  const load = useCallback(() => api.get('/api/v1/exam-system/exams').then((json) => setExams(json.data || [])), []);

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(errorMessage(err))).finally(() => setLoading(false));
  }, [load]);

  const now = useMemo(() => new Date(), []);
  const rows = useMemo(() => exams.map((e) => ({ ...e, _phase: examPhase(e, now) })), [exams, now]);

  const courses = useMemo(() => [...new Set(rows.map((e) => e.subject).filter(Boolean))].sort(), [rows]);
  const years = useMemo(() => [...new Set(rows.map((e) => e.academic_year).filter(Boolean))].sort(), [rows]);

  const counts = useMemo(() => {
    const c = { all: rows.length, draft: 0, scheduled: 0, live: 0, completed: 0 };
    rows.forEach((e) => { c[e._phase] += 1; });
    return c;
  }, [rows]);

  const upcoming = useMemo(() => rows.filter((e) => {
    if (e._phase !== 'scheduled') return false;
    const s = toDate(e.start_at);
    return !s || (s - now <= 30 * DAY);
  }).length, [rows, now]);

  const pendingGrading = useMemo(() => rows.reduce((a, e) => a + (e.pending_grading_count || 0), 0), [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((e) => {
      if (tab !== 'all' && e._phase !== tab) return false;
      if (course && e.subject !== course) return false;
      if (type && e.exam_type !== type) return false;
      if (year && e.academic_year !== year) return false;
      if (range) {
        const s = toDate(e.start_at);
        if (range === 'past') { if (!s || s >= now) return false; }
        else {
          const limit = range === 'next7' ? 7 : 30;
          if (!s || s < now || s - now > limit * DAY) return false;
        }
      }
      if (needle) {
        const hay = `${e.title} ${e.subject || ''} ${PHASES[e._phase].en} ${PHASES[e._phase].ar}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const by = {
      latest: (a, b) => b.id - a.id,
      oldest: (a, b) => a.id - b.id,
      date: (a, b) => (toDate(a.start_at)?.getTime() ?? Infinity) - (toDate(b.start_at)?.getTime() ?? Infinity),
      title: (a, b) => String(a.title).localeCompare(String(b.title), locale),
    };
    return [...list].sort(by[sort]);
  }, [rows, tab, q, course, type, year, range, sort, now, locale]);

  async function handleDelete(exam) {
    if (!window.confirm(ar ? 'حذف هذا الامتحان؟ لا يمكن التراجع.' : 'Delete this exam? This cannot be undone.')) return;
    setActionError(null);
    try {
      await api.del(`/api/v1/exam-system/exams/${exam.id}`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const clearFilters = () => { setQ(''); setCourse(''); setType(''); setYear(''); setRange(''); };
  const filtered = q || course || type || year || range;

  if (loading) return <div className="st-page"><Skeleton h={100} count={3} /></div>;

  return (
    <div className="ex-page">
      <StaffHead
        eyebrow={ar ? 'مساحة التقييم' : 'Assessment workspace'}
        title={ar ? 'الامتحانات' : 'Exams'}
        subtitle={ar ? 'أنشئ الامتحانات وجدولها وأدرها لطلابك.' : 'Create, schedule, and manage assessments for your students.'}
        actions={(
          <>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/academic-staff/exams/create')}>
              <Icon name="plus" size={16} /> {ar ? 'إنشاء امتحان' : 'Create Exam'}
            </button>
            <Link to="/academic-staff/attempts" className="btn btn-outline">{ar ? 'عرض النتائج' : 'View Results'}</Link>
          </>
        )}
      />

      <div className="ex-kpis">
        <ExKpi label={ar ? 'إجمالي الامتحانات' : 'Total Exams'} value={counts.all} sub={ar ? 'في كل المقررات' : 'Across all courses'} icon="file" />
        <ExKpi label={ar ? 'القادمة' : 'Upcoming'} value={upcoming} sub={ar ? 'خلال 30 يومًا' : 'Next 30 days'} icon="calendar" tone="warn" />
        <ExKpi label={ar ? 'جارية الآن' : 'Active / Live'} value={counts.live} sub={ar ? 'قيد التنفيذ حاليًا' : 'Currently in progress'} icon="check-circle" tone="good" />
        <ExKpi label={ar ? 'بانتظار التصحيح' : 'Pending Grading'} value={pendingGrading} sub={ar ? 'تحتاج انتباهك' : 'Needs your attention'} icon="clock" tone="bad" />
      </div>

      {error && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>}
      {actionError && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{actionError}</span></div>}

      <div className="ex-card">
        <div className="ex-tabs" role="tablist">
          {TAB_KEYS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`ex-tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>
              {k === 'all' ? (ar ? 'الكل' : 'All') : (ar ? PHASES[k].ar : PHASES[k].en)}
              {k !== 'all' && <small>({counts[k]})</small>}
            </button>
          ))}
        </div>

        <div className="ex-toolbar">
          <div className="ex-search">
            <Icon name="search" size={15} />
            <input
              className="ex-input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? 'ابحث بالعنوان أو المقرر أو الحالة' : 'Search exams by title, course, or status'}
              aria-label={ar ? 'بحث' : 'Search'}
            />
          </div>
          <select className="ex-select" value={course} onChange={(e) => setCourse(e.target.value)} aria-label={ar ? 'المقرر' : 'Course'}>
            <option value="">{ar ? 'كل المقررات' : 'All courses'}</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="ex-select" value={type} onChange={(e) => setType(e.target.value)} aria-label={ar ? 'النوع' : 'Type'}>
            <option value="">{ar ? 'كل الأنواع' : 'All types'}</option>
            {EXAM_TYPES.map((x) => <option key={x.key} value={x.key}>{ar ? x.ar : x.en}</option>)}
          </select>
          <select className="ex-select" value={year} onChange={(e) => setYear(e.target.value)} aria-label={ar ? 'السنة الدراسية' : 'Academic year'}>
            <option value="">{ar ? 'كل السنوات' : 'All years'}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="ex-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label={ar ? 'التاريخ' : 'Date'}>
            {DATE_RANGES.map((r) => <option key={r.key} value={r.key}>{ar ? r.ar : r.en}</option>)}
          </select>
          <select className="ex-select ex-select--sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={ar ? 'الترتيب' : 'Sort'}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{ar ? s.ar : s.en}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState icon="file" title={ar ? 'أنشئ أول امتحان لك ثم أضف إليه الأسئلة.' : 'Create your first exam, then add questions to it.'}>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/academic-staff/exams/create')}>
                <Icon name="plus" size={16} /> {ar ? 'إنشاء امتحان' : 'Create Exam'}
              </button>
            </EmptyState>
          </div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState icon="search" title={ar ? 'لا توجد امتحانات مطابقة' : 'No exams match'} text={ar ? 'جرّب تغيير البحث أو التصنيف.' : 'Try a different search or filter.'}>
              {filtered && <button type="button" className="btn btn-outline" onClick={clearFilters}>{ar ? 'مسح التصفية' : 'Clear filters'}</button>}
            </EmptyState>
          </div>
        ) : (
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>{ar ? 'الامتحان' : 'Exam'}</th>
                  <th>{ar ? 'المقرر' : 'Course'}</th>
                  <th>{ar ? 'التاريخ' : 'Date'}</th>
                  <th>{ar ? 'المدة' : 'Duration'}</th>
                  <th>{ar ? 'الطلاب' : 'Students'}</th>
                  <th>{ar ? 'الحالة' : 'Status'}</th>
                  <th className="is-end">{ar ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const act = actionFor(e, e._phase, ar);
                  return (
                    <tr key={e.id}>
                      <td style={{ minWidth: 200 }}>
                        <Link to={`/academic-staff/exams/${e.id}`} className="is-title">{e.title}</Link>
                        <div className="is-muted" style={{ fontSize: 12, marginTop: 2 }}>{examTypeLabel(e.exam_type, ar)}</div>
                      </td>
                      <td className="is-muted">{e.subject || '—'}</td>
                      <td className="is-muted" style={{ whiteSpace: 'nowrap' }}>{e.start_at ? fmtDate(e.start_at, ar) : (ar ? 'غير محدد' : 'Not set')}</td>
                      <td className="is-muted" style={{ whiteSpace: 'nowrap' }}>{e.duration_minutes} {ar ? 'د' : 'min'}</td>
                      <td className="is-muted"><span className="ex-inline"><Icon name="users" size={14} />{e.students_count ?? 0}</span></td>
                      <td><PhasePill phase={e._phase} ar={ar} /></td>
                      <td className="is-end" style={{ whiteSpace: 'nowrap' }}>
                        <Link to={act.to} className="ex-link">{act.label}</Link>
                        {e._phase === 'draft' && (
                          <button type="button" className="ex-icon-btn ex-icon-btn--danger" style={{ marginInlineStart: 8 }} onClick={() => handleDelete(e)} title={ar ? 'حذف' : 'Delete'} aria-label={ar ? 'حذف' : 'Delete'}>
                            <Icon name="trash" size={15} />
                          </button>
                        )}
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
