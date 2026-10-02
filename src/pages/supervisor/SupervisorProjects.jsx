import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { api, errorMessage } from '../../api/client';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import { StaffHead, StaffKpi, PersonAvatar } from '../../components/staff/stfUi';
import { Pill, StModal, EmptyState, Skeleton } from '../../components/student/stUi';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/supervisor/projects';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/supervisor/projects.php, talking to the real JSON API
 * (GET/POST /api/v1/supervisor/projects* — SupervisorProjectsApiController,
 * a JSON port of Supervisor\SupervisorProjectController::index()/approve()/
 * reject()/requestChanges()). Same rule the PHP view enforced: the
 * approve/reject/request-changes buttons only ever render for a 'submitted'
 * project when the caller has 'manage_projects' — no button lets a
 * supervisor act outside status or permission, the server re-checks both
 * plus scope anyway. The rubric grading link ("Grade project" in the old
 * view) is now wired up (item 14, Graduation) — GET/POST
 * /api/v1/supervisor/projects/{id}/grade, same status set the old view
 * gated it on (submitted/published/rejected; a never-submitted draft can't
 * be graded).
 */

const GRADABLE_STATUSES = ['submitted', 'published', 'rejected'];

// Design wording ("Pending Review / Approved / Rejected") on top of the real
// statuses: submitted = awaiting this supervisor, published = approved & live.
const STATUS_META = {
  draft:     { tone: 'neutral', en: 'Draft',          ar: 'مسودة' },
  submitted: { tone: 'warning', en: 'Pending Review', ar: 'بانتظار المراجعة' },
  published: { tone: 'success', en: 'Approved',       ar: 'معتمد' },
  rejected:  { tone: 'danger',  en: 'Rejected',       ar: 'مرفوض' },
};

export default function SupervisorProjects() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ can_manage: false, has_scope: false, status: 'all' });
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [confirmReject, setConfirmReject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/supervisor/projects', {})
      .then((json) => {
        setRows(json.data || []);
        setMeta(json.meta || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(project, action) {
    setBusyId(project.uuid);
    setActionError(null);
    try {
      await api.post(`/api/v1/supervisor/projects/${encodeURIComponent(project.uuid)}/${action}`, {});
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const ar = locale === 'ar';
  const TABS = [
    { key: 'all', en: 'All', ar: 'الكل' },
    { key: 'submitted', en: 'Pending Review', ar: 'بانتظار المراجعة' },
    { key: 'published', en: 'Approved', ar: 'معتمد' },
    { key: 'rejected', en: 'Rejected', ar: 'مرفوض' },
  ];
  const countOf = (k) => (k === 'all' ? rows.length : rows.filter((r) => r.status === k).length);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (!q) return true;
    return `${r.title_en || ''} ${r.title_ar || ''} ${r.owner_name || ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="st-page">
      <StaffHead
        crumbs={[{ label: ar ? 'لوحة التحكم' : 'Dashboard', to: '/supervisor/dashboard' }, { label: ar ? 'الإشراف على المشاريع' : 'Project Supervision' }]}
        title={ar ? 'الإشراف على المشاريع' : 'Project Supervision'}
        subtitle={t('Only the projects within the scope your university assigned you.')}
      />

      {error && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>}
      {actionError && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{actionError}</span></div>}

      {!loading && !error && !meta.has_scope ? (
        <EmptyState icon="folder" title={ar ? 'لم يتم إسناد أي نطاق لك بعد.' : "You haven't been assigned a scope yet."} />
      ) : (
        <>
          <div className="stf-kpis">
            <StaffKpi value={rows.length} label={ar ? 'المشاريع المُسندة' : 'Assigned Projects'} icon="folder" />
            <StaffKpi value={countOf('submitted')} label={ar ? 'بانتظار المراجعة' : 'Pending Review'} icon="clock" tone="warn" />
            <StaffKpi value={countOf('rejected')} label={ar ? 'مرفوضة' : 'Rejected'} icon="x-circle" tone="bad" />
            <StaffKpi value={countOf('published')} label={ar ? 'معتمدة' : 'Approved'} icon="check-circle" tone="good" />
          </div>

          <div className="st-tabs" role="tablist">
            {TABS.map((tb) => (
              <button key={tb.key} type="button" role="tab" aria-selected={status === tb.key} className={`st-tab${status === tb.key ? ' is-active' : ''}`} onClick={() => setStatus(tb.key)}>
                {ar ? tb.ar : tb.en}{tb.key !== 'all' && <span className="st-tab__count">{countOf(tb.key)}</span>}
              </button>
            ))}
          </div>

          <div className="stf-toolbar">
            <label className="st-search">
              <Icon name="search" size={16} />
              <input className="form-input" type="search" placeholder={ar ? 'ابحث عن مشاريع أو طلاب…' : 'Search projects or students…'} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          {loading ? <Skeleton h={64} count={4} /> : shown.length === 0 ? (
            <EmptyState icon="folder" title={rows.length === 0 ? t('No projects currently fall within your scope.') : (ar ? 'لا توجد مشاريع مطابقة' : 'No matching projects')} />
          ) : (
            <div className="stf-table-card st-table-wrap">
              <table className="st-table">
                <thead>
                  <tr>
                    <th>{ar ? 'المشروع' : 'Project'}</th>
                    <th>{ar ? 'الكلية' : 'Faculty'}</th>
                    <th>{t('Status')}</th>
                    <th style={{ textAlign: 'end' }}>{ar ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const sMeta = STATUS_META[p.status] || STATUS_META.draft;
                    const title = ar ? (p.title_ar || p.title_en) : (p.title_en || p.title_ar);
                    const busy = busyId === p.uuid;
                    const canDecide = p.status === 'submitted' && meta.can_manage;
                    return (
                      <tr key={p.uuid}>
                        <td style={{ whiteSpace: 'normal', minWidth: 200 }}>
                          <div className="stf-person"><PersonAvatar name={p.owner_name || title} /><div><strong>{title}</strong><small>{p.owner_name || ''}</small></div></div>
                        </td>
                        <td className="st-muted">{p.owner_faculty || '—'}</td>
                        <td><Pill tone={sMeta.tone}>{sMeta[locale] || sMeta.en}</Pill></td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {canDecide && (
                              <>
                                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(p, 'approve')}><Icon name="check" size={14} /> {t('Approve')}</button>
                                <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => decide(p, 'request-changes')}><Icon name="edit" size={14} /> {t('Request Changes')}</button>
                                <button type="button" className="btn btn-outline btn-sm st-btn-danger" disabled={busy} onClick={() => setConfirmReject(p)}><Icon name="x" size={14} /> {t('Reject')}</button>
                              </>
                            )}
                            {GRADABLE_STATUSES.includes(p.status) && (
                              <Link to={`/supervisor/projects/${encodeURIComponent(p.uuid)}/grade`} className={canDecide ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'} title={t('Grade project')}>
                                <Icon name="award" size={14} /> {t('Grade project')}
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {confirmReject && (
        <StModal
          title={t('Reject')}
          onClose={() => setConfirmReject(null)}
          actions={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setConfirmReject(null)}>{ar ? 'إلغاء' : 'Cancel'}</button>
              <button type="button" className="btn btn-primary st-btn-danger st-btn-solid" onClick={() => { const p = confirmReject; setConfirmReject(null); decide(p, 'reject'); }}>{t('Reject')}</button>
            </>
          )}
        >
          {t('Reject this project?')}
        </StModal>
      )}
    </div>
  );
}
