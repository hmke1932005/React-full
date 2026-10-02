import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/project-approval';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/project-approval.php, talking to the real
 * JSON API (GET /api/v1/university/approvals — App\Controllers\Api\
 * UniversityApprovalsApiController::index(), the same
 * ProjectApprovalService::queueForUniversity() rows the Blade table
 * consumes). Decision actions POST to the same controller's approve/
 * reject/request-changes, mirroring the AI-acknowledgment gate the
 * original per-row forms enforce (project-approval.php's rowHasAi/
 * ackCheckbox logic).
 */

const STATUS_META = {
  pending: { cls: 'badge-primary', en: 'Pending', ar: 'قيد الانتظار' },
  approved: { cls: 'badge-success', en: 'Approved', ar: 'معتمد' },
  rejected: { cls: 'badge-danger', en: 'Rejected', ar: 'مرفوض' },
  changes_requested: { cls: 'badge-neutral', en: 'Changes Requested', ar: 'تعديلات مطلوبة' },
};

const TABS = ['all', 'pending', 'approved', 'changes_requested', 'rejected'];
const TAB_LABEL = {
  all: { en: 'All', ar: 'الكل' },
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  approved: { en: 'Approved', ar: 'معتمد' },
  changes_requested: { en: 'Changes Requested', ar: 'تعديلات مطلوبة' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
};

function scoreColor(score) {
  if (score === null || score === undefined) return 'var(--color-text-secondary)';
  if (score >= 75) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-accent)';
  return 'var(--color-danger)';
}

function QueueRow({ p, locale, canApprove, onDecide, busyId }) {
  const meta = STATUS_META[p.status] || STATUS_META.pending;
  const hasScore = p.score !== null && p.score !== undefined;
  const rowHasAi = hasScore || !!p.predictedCategory;
  const [ack, setAck] = useState(false);
  const busy = busyId === p.id;

  return (
    <tr>
      <td>
        <strong>{p.title?.[locale] || p.title?.en}</strong><br />
        <span className="text-caption text-mono">{p.id}</span>
        {p.predictedCategory && (
          <>
            <br />
            <span className="badge badge-neutral" style={{ marginTop: 4, fontSize: 10 }} title={locale === 'ar' ? 'مصنَّف تلقائياً بالذكاء الاصطناعي' : 'Auto-classified by AI'}>
              <Icon name="sparkles" size={10} /> {p.predictedCategory}
              {p.classificationConfidence !== null && p.classificationConfidence !== undefined ? ` · ${Math.round(p.classificationConfidence)}%` : ''}
            </span>
          </>
        )}
      </td>
      <td>{p.student?.[locale] || p.student?.en}<br /><span className="text-caption">{p.faculty?.[locale] || p.faculty?.en}</span></td>
      <td>{p.supervisor?.[locale] || p.supervisor?.en}</td>
      <td>
        {hasScore
          ? <span style={{ color: scoreColor(p.score), fontWeight: 700 }}>{Number(p.score).toFixed(1)}</span>
          : <span className="text-caption">{locale === 'ar' ? 'لم يُحلَّل بعد' : 'Not analyzed'}</span>}
      </td>
      <td>{p.submitted}</td>
      <td><span className={`badge ${meta.cls}`}>{meta[locale]}</span></td>
      <td>
        {p.status !== 'pending' ? (
          <Link to={`/university/approvals/${encodeURIComponent(p.id)}`} className="btn btn-ghost btn-sm">{locale === 'ar' ? 'عرض' : 'View'}</Link>
        ) : !canApprove ? (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <Link to={`/university/approvals/${encodeURIComponent(p.id)}`} className="btn btn-ghost btn-sm">{locale === 'ar' ? 'عرض' : 'View'}</Link>
            <span className="text-caption" style={{ opacity: 0.6 }}>{locale === 'ar' ? 'لا تملك صلاحية' : 'No permission'}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {rowHasAi && (
              <label className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} title={locale === 'ar' ? 'راجعت مؤشرات الذكاء الاصطناعي بشكل مستقل' : "I've reviewed the AI indicators independently"}>
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <Icon name="sparkles" size={12} />
              </label>
            )}
            <Link to={`/university/approvals/${encodeURIComponent(p.id)}`} className="btn btn-ghost btn-sm" title={locale === 'ar' ? 'عرض' : 'View'}><Icon name="eye" size={14} /></Link>
            <button type="button" className="btn btn-primary btn-sm" disabled={(rowHasAi && !ack) || busy} title={locale === 'ar' ? 'اعتماد' : 'Approve'} onClick={() => onDecide(p.id, 'approve', ack)}><Icon name="check" size={14} /></button>
            <button type="button" className="btn btn-outline btn-sm" disabled={(rowHasAi && !ack) || busy} title={locale === 'ar' ? 'طلب تعديلات' : 'Request Changes'} onClick={() => onDecide(p.id, 'request-changes', ack)}><Icon name="edit" size={14} /></button>
            <button type="button" className="btn btn-danger btn-sm" disabled={(rowHasAi && !ack) || busy} title={locale === 'ar' ? 'رفض' : 'Reject'} onClick={() => onDecide(p.id, 'reject', ack)}><Icon name="x" size={14} /></button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function UniversityApprovals() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [queue, setQueue] = useState([]);
  const [canApprove, setCanApprove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [tab, setTab] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/university/approvals')
      .then((json) => {
        setQueue(json.data?.queue || []);
        setCanApprove(!!json.data?.can_approve);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDecide(id, action, aiAcknowledged) {
    setBusyId(id);
    setActionError(null);
    try {
      await api.post(`/api/v1/university/approvals/${encodeURIComponent(id)}/${action}`, { ai_acknowledgment: aiAcknowledged ? 1 : 0 });
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const counts = {
    all: queue.length,
    pending: queue.filter((p) => p.status === 'pending').length,
    approved: queue.filter((p) => p.status === 'approved').length,
    rejected: queue.filter((p) => p.status === 'rejected').length,
    changes_requested: queue.filter((p) => p.status === 'changes_requested').length,
  };
  const rows = tab === 'all' ? queue : queue.filter((p) => p.status === tab);
  const columns = locale === 'ar'
    ? ['المشروع', 'الطالب', 'المشرف', 'درجة الجاهزية', 'تاريخ التقديم', 'الحالة', 'الإجراء']
    : ['Project', 'Student', 'Supervisor', 'Readiness Score', 'Submitted', 'Status', 'Action'];

  const pendingRows = queue.filter((p) => p.status === 'pending');
  const classifiedCount = pendingRows.filter((p) => p.predictedCategory).length;

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Project Approvals')}</h1>
          <p className="text-small">{locale === 'ar' ? 'مشاريع اعتمدها المشرف وتنتظر اعتماد الجامعة قبل النشر.' : 'Supervisor-approved projects awaiting your university-level sign-off before publishing.'}</p>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <div className="tabs" data-tabs style={{ marginBottom: 'var(--space-5)' }}>
        {TABS.map((key) => (
          <button key={key} type="button" className={`tab-link${tab === key ? ' is-active' : ''}`} onClick={() => setTab(key)}>
            {TAB_LABEL[key][locale]} <span className="badge badge-neutral">{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && (
        <div className="grid-2">
          <div className="table-responsive card glass-panel">
            <table className="data-table">
              <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.map((p) => (
                  <QueueRow key={p.id} p={p} locale={locale} canApprove={canApprove} onDecide={handleDecide} busyId={busyId} />
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={columns.length} className="text-small" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>{locale === 'ar' ? 'لا توجد مشاريع في هذا التصنيف.' : 'No projects in this filter.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div className="card glass-panel">
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{locale === 'ar' ? 'مسار اعتماد المشروع' : 'Approval Workflow'}</h2>
              <div className="timeline">
                <div className="timeline-item is-done"><div className="timeline-item__dot"><Icon name="check" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{t('Student submission')}</p></div>
                <div className="timeline-item is-done"><div className="timeline-item__dot"><Icon name="check" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{t('Supervisor approval')}</p></div>
                <div className="timeline-item"><div className="timeline-item__dot"><Icon name="clock" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{locale === 'ar' ? 'اعتماد الجامعة' : 'University approval'}</p></div>
                <div className="timeline-item"><div className="timeline-item__dot"><Icon name="sparkles" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{t('AI review')}</p></div>
                <div className="timeline-item"><div className="timeline-item__dot"><Icon name="folder" size={16} /></div><p className="text-small" style={{ margin: 0 }}>{locale === 'ar' ? 'النشر في المنصة' : 'Published on platform'}</p></div>
              </div>
              <p className="text-caption" style={{ marginTop: 'var(--space-4)' }}>
                {locale === 'ar'
                  ? 'الاعتماد ينشر المشروع فوراً على المنصة. طلب التعديلات يعيده مسودة للطالب. مرحلتا "مراجعة المشرف" و"مراجعة الذكاء الاصطناعي" لسه مش مفعّلتين.'
                  : "Approve publishes the project immediately. Request Changes sends it back to the student as a draft. The Supervisor and AI-review stages shown above aren't wired up yet."}
              </p>
            </div>

            <div className="card glass-panel">
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{locale === 'ar' ? 'التصنيف التلقائي' : 'Automatic Classification'}</h2>
              {pendingRows.length > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <span className="text-h2 text-mono">{classifiedCount}/{pendingRows.length}</span>
                  </div>
                  <p className="text-small">
                    {locale === 'ar'
                      ? 'من المشاريع قيد الانتظار مصنَّفة تلقائياً حسب المجال بالذكاء الاصطناعي. المجال المقترح يظهر تحت اسم كل مشروع في الجدول.'
                      : 'of pending projects have been auto-tagged by field. The suggested field appears under each project title in the table.'}
                  </p>
                </>
              ) : (
                <p className="text-caption">{locale === 'ar' ? 'لا توجد مشاريع قيد الانتظار حالياً.' : 'No pending projects right now.'}</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
