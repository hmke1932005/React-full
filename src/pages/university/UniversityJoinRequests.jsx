import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/join-requests';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/join-requests.php. Data comes from
 * GET /api/v1/university/join-requests (App\Controllers\Api\
 * UniversityJoinRequestsApiController::index() -> StudentJoinRequestService
 * ::pendingQueue()/fullQueue(), the only place that ever writes
 * students.university_id). Approve/reject post to .../approve|reject.
 */

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

const STATUS_META = {
  pending: { class: 'badge-primary', en: 'Pending', ar: 'قيد الانتظار' },
  approved: { class: 'badge-success', en: 'Approved', ar: 'مقبول' },
  rejected: { class: 'badge-danger', en: 'Rejected', ar: 'مرفوض' },
};

export default function UniversityJoinRequests() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [pending, setPending] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/university/join-requests', { locale })
      .then((json) => {
        setPending(json.data?.pending || []);
        setAll(json.data?.all || []);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [locale]);

  useEffect(() => { load(); }, [load]);

  async function decide(id, action) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/api/v1/university/join-requests/${id}/${action}`, {});
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Join Requests')}</h1>
          <p className="text-small">{t('Students who asked to join your university on the platform — approving links their account to you automatically.')}</p>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard label={locale === 'ar' ? 'قيد الانتظار' : 'Pending'} value={pending.length} icon="clock" accent="var(--uip-gold-600, #b7791f)" />
        <StatCard label={locale === 'ar' ? 'إجمالي الطلبات' : 'Total Requests'} value={all.length} icon="users" accent="var(--uip-indigo-600, #4f46e5)" />
      </div>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {loading && <p className="text-small">{t('Loading…')}</p>}

      {!loading && (
        <>
          <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Awaiting Review')}</h2>
          {pending.length === 0 ? (
            <div className="card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
              <p className="text-small text-muted">{t('No join requests waiting for review.')}</p>
            </div>
          ) : (
            <div className="table-responsive card glass-panel" style={{ marginBottom: 'var(--space-6)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{locale === 'ar' ? 'الطالب' : 'Student'}</th>
                    <th>{locale === 'ar' ? 'الرقم الجامعي' : 'Student #'}</th>
                    <th>{locale === 'ar' ? 'الكلية / القسم' : 'Faculty / Department'}</th>
                    <th>{locale === 'ar' ? 'السنة' : 'Year'}</th>
                    <th>{locale === 'ar' ? 'تاريخ الطلب' : 'Requested'}</th>
                    <th>{locale === 'ar' ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/university/students/${r.student_id}`}><strong>{r.student_name}</strong></Link>
                        <br /><span className="text-caption">{r.email}</span>
                      </td>
                      <td>{r.student_number}</td>
                      <td>{r.faculty}<br /><span className="text-caption">{r.department}</span></td>
                      <td>{r.academic_year}</td>
                      <td>{r.requested_at}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <Link to={`/university/students/${r.student_id}`} className="btn btn-outline btn-sm" title={t('View Profile')}>
                            <Icon name="user" size={14} />
                          </Link>
                          <button type="button" className="btn btn-primary btn-sm" title={t('Approve')} disabled={busyId === r.id} onClick={() => decide(r.id, 'approve')}>
                            <Icon name="check" size={14} />
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" title={t('Reject')} disabled={busyId === r.id} onClick={() => decide(r.id, 'reject')}>
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('All Requests')}</h2>
          {all.length === 0 ? (
            <div className="card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
              <p className="text-small text-muted">{t('No requests yet.')}</p>
            </div>
          ) : (
            <div className="table-responsive card glass-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{locale === 'ar' ? 'الطالب' : 'Student'}</th>
                    <th>{locale === 'ar' ? 'الكلية / القسم' : 'Faculty / Department'}</th>
                    <th>{locale === 'ar' ? 'تاريخ الطلب' : 'Requested'}</th>
                    <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((r) => {
                    const meta = STATUS_META[r.status] || STATUS_META.pending;
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link to={`/university/students/${r.student_id}`}><strong>{r.student_name}</strong></Link>
                          <br /><span className="text-caption">{r.email}</span>
                        </td>
                        <td>{r.faculty}<br /><span className="text-caption">{r.department}</span></td>
                        <td>{r.requested_at}</td>
                        <td><span className={`badge ${meta.class}`}>{meta[locale]}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
