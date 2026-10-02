import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import { StaffHead, StaffKpi } from '../../components/staff/stfUi';
import { Pill, StModal, EmptyState, Skeleton } from '../../components/student/stUi';
import i18nCommon from '../../i18n/common';
import i18nExam from '../../i18n/academic-staff/exam-system';

const translations = { ...i18nCommon, ...i18nExam };

/**
 * Round 1 (Foundation) — GET/POST /api/v1/exam-system/exams, DELETE
 * .../exams/{id} (ExamSystemApiController::indexExams/storeExam/
 * destroyExam). Creation only takes title + duration here (the minimum
 * the API requires); everything else (schedule, passing score,
 * instructions, randomization, result visibility, and attaching
 * questions) is edited afterwards in the exam builder
 * (AcademicStaffExamBuilder.jsx) — same "create bare, refine after" flow
 * as most other multi-field creation modals in this app.
 */

const TABS = [
  { key: 'all', en: 'All', ar: 'الكل', match: null },
  { key: 'draft', en: 'Draft', ar: 'مسودة', match: ['draft'] },
  { key: 'scheduled', en: 'Scheduled', ar: 'مجدول', match: ['scheduled'] },
  { key: 'live', en: 'Live', ar: 'جارٍ', match: ['published', 'active'] },
  { key: 'done', en: 'Completed', ar: 'مكتمل', match: ['closed', 'grading', 'graded'] },
];
const TONE = { draft: 'neutral', scheduled: 'warning', published: 'success', active: 'success', closed: 'neutral', grading: '', graded: 'success', archived: 'neutral' };
const STATUS_META = {
  draft: { cls: 'badge-neutral', key: 'Draft' },
  scheduled: { cls: 'badge-primary', key: 'Scheduled' },
  published: { cls: 'badge-success', key: 'Published' },
  active: { cls: 'badge-success', key: 'Published' },
  closed: { cls: 'badge-neutral', key: 'Closed' },
  grading: { cls: 'badge-primary', key: 'Grading' },
  graded: { cls: 'badge-success', key: 'Graded' },
  archived: { cls: 'badge-neutral', key: 'Archived' },
};

function CreateExamModal({ onClose, onCreated }) {
  const t = useTranslations(translations);
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const json = await api.post('/api/v1/exam-system/exams', {
        title: title.trim(),
        duration_minutes: Number(durationMinutes) || 60,
      });
      onCreated(json.data.id);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <StModal
      title={t('Create Exam')}
      onClose={onClose}
      actions={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" form="create-exam-form" className="btn btn-primary" disabled={saving || !title.trim()}>{saving ? '…' : t('Create Exam')}</button>
        </>
      )}
    >
      <form id="create-exam-form" onSubmit={handleSubmit} className="st-form" style={{ marginTop: 12 }}>
        <div className="st-field">
          <label className="st-label">{t('Title')}</label>
          <input className="form-input" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="st-field">
          <label className="st-label">{t('Duration (minutes)')}</label>
          <input className="form-input" type="number" min="1" required value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
        </div>
        {error && <p className="st-form__error">{error}</p>}
      </form>
    </StModal>
  );
}

export default function AcademicStaffExams() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const ar = locale === 'ar';
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [pendingGrading, setPendingGrading] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    return api.get('/api/v1/exam-system/exams').then((json) => setExams(json.data || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(errorMessage(err))).finally(() => setLoading(false));
    api.get('/api/v1/exam-system/dashboard/instructor').then((j) => setPendingGrading(j.data?.pending_grading ?? null)).catch(() => {});
  }, [load]);

  function handleCreated(examId) {
    setCreating(false);
    navigate(`/academic-staff/exams/${examId}`);
  }

  async function handleDelete(exam) {
    if (!window.confirm(t('Delete this exam? This cannot be undone.'))) return;
    setActionError(null);
    try {
      await api.del(`/api/v1/exam-system/exams/${exam.id}`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  if (loading) return <div className="st-page"><Skeleton h={100} count={3} /></div>;

  const countOf = (tb) => (tb.match ? exams.filter((e) => tb.match.includes(e.status)).length : exams.length);
  const active = TABS.find((x) => x.key === tab);
  const shown = active.match ? exams.filter((e) => active.match.includes(e.status)) : exams;

  return (
    <div className="st-page">
      <StaffHead
        crumbs={[{ label: ar ? 'لوحة التحكم' : 'Dashboard', to: '/academic-staff/dashboard' }, { label: t('Exams') }]}
        title={t('Exams')}
        subtitle={ar ? 'أنشئ الامتحانات ونظّمها وراقب نتائج طلابك.' : 'Create, schedule, and manage exams for your students.'}
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> {t('New Exam')}</button>}
      />

      <div className="stf-kpis">
        <StaffKpi value={exams.length} label={ar ? 'إجمالي الامتحانات' : 'Total Exams'} icon="file" />
        <StaffKpi value={countOf(TABS[2])} label={ar ? 'مجدولة' : 'Scheduled'} icon="calendar" tone="warn" />
        <StaffKpi value={countOf(TABS[3])} label={ar ? 'جارية' : 'Live'} icon="check-circle" tone="good" />
        {pendingGrading !== null && <StaffKpi value={pendingGrading} label={ar ? 'بانتظار التصحيح' : 'Pending Grading'} icon="edit" tone="bad" />}
      </div>

      {error && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>}
      {actionError && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{actionError}</span></div>}

      <div className="st-tabs" role="tablist">
        {TABS.map((tb) => (
          <button key={tb.key} type="button" role="tab" aria-selected={tab === tb.key} className={`st-tab${tab === tb.key ? ' is-active' : ''}`} onClick={() => setTab(tb.key)}>
            {ar ? tb.ar : tb.en}<span className="st-tab__count">{countOf(tb)}</span>
          </button>
        ))}
      </div>

      {exams.length === 0 ? (
        <EmptyState icon="file" title={t('Create your first exam, then attach questions to it.')}>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> {t('New Exam')}</button>
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon="file" title={ar ? 'لا توجد امتحانات في هذا التصنيف' : 'No exams in this category'} />
      ) : (
        <div className="stf-table-card st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>{t('Title')}</th>
                <th>{t('Duration')}</th>
                <th>{t('Total Marks')}</th>
                <th>{t('Status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const meta = STATUS_META[e.status] || STATUS_META.draft;
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'normal', minWidth: 180 }}>
                      <Link to={`/academic-staff/exams/${e.id}`} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>{e.title}</Link>
                      {e.subject && <div className="st-muted" style={{ fontSize: 12 }}>{e.subject}</div>}
                    </td>
                    <td className="st-muted">{e.duration_minutes} {t('minutes')}</td>
                    <td className="st-muted">{e.total_marks}</td>
                    <td><Pill tone={TONE[e.status] ?? 'neutral'}>{t(meta.key)}</Pill></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                        <Link to={`/academic-staff/exams/${e.id}`} className="btn btn-primary btn-sm">{t('Open Builder')}</Link>
                        <Link to={`/academic-staff/exams/${e.id}/attempts`} className="btn btn-outline btn-sm" title={t('View Attempts & Grading')} aria-label={t('View Attempts & Grading')}><Icon name="edit" size={14} /></Link>
                        <Link to={`/academic-staff/exams/${e.id}/targets`} className="btn btn-outline btn-sm" title={t('Manage Targeting & Publish')} aria-label={t('Manage Targeting & Publish')}><Icon name="filter" size={14} /></Link>
                        <Link to={`/academic-staff/exams/${e.id}/analytics`} className="btn btn-outline btn-sm" title={t('Analytics')} aria-label={t('Analytics')}><Icon name="bar-chart" size={14} /></Link>
                        <button type="button" className="btn btn-outline btn-sm st-btn-danger" onClick={() => handleDelete(e)} title={t('Delete')} aria-label={t('Delete')}><Icon name="trash" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <CreateExamModal onClose={() => setCreating(false)} onCreated={handleCreated} />}
    </div>
  );
}
