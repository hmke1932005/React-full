import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/faculty/graduation';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/faculty/graduation.php, talking to the real JSON
 * API (GET /api/v1/graduation — App\Controllers\Api\GraduationApiController
 * ::index(), which already resolves a Faculty caller's scope via
 * universityOrFacultyScope() and narrows listForUniversity() to that
 * faculty_id — same shape as UniversityGraduation.jsx, no separate
 * faculty-only endpoint needed). Revoke happens inline here (POST
 * .../revoke with a reason prompt), same as the legacy per-row form;
 * review/approve and certificate-edit live on their own routed pages
 * (FacultyGraduationReview.jsx / FacultyGraduationEdit.jsx).
 */

const TABS = ['eligible', 'graduated', 'revoked'];
const TAB_LABEL = {
  eligible: { en: 'Eligible to Graduate', ar: 'مؤهلون للتخرج' },
  graduated: { en: 'Graduated', ar: 'خريجون' },
  revoked: { en: 'Revoked', ar: 'ملغى' },
};

export default function FacultyGraduation() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [lists, setLists] = useState({ eligible: [], graduated: [], revoked: [] });
  const [tab, setTab] = useState('eligible');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/graduation')
      .then((json) => setLists({
        eligible: json.data?.eligible || [],
        graduated: json.data?.graduated || [],
        revoked: json.data?.revoked || [],
      }))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRevoke(studentId) {
    const reason = window.prompt(locale === 'ar' ? 'سبب الإلغاء؟' : 'Reason for revoking?');
    if (!reason) return;
    if (!window.confirm(locale === 'ar' ? 'تأكيد إلغاء التخرج؟' : 'Confirm revoking this graduation?')) return;

    setBusyId(studentId);
    setActionError(null);
    try {
      await api.post(`/api/v1/graduation/${studentId}/revoke`, { reason });
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Graduation Records')}</h1>
          <p className="text-small">
            {locale === 'ar'
              ? 'مراجعة أهلية الطلاب واعتماد أو إلغاء تخرجهم.'
              : 'Review student eligibility and approve or revoke graduation.'}
          </p>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(key)}
          >
            {TAB_LABEL[key][locale]} ({(lists[key] || []).length})
          </button>
        ))}
      </div>

      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && tab === 'eligible' && (
        <div className="table-responsive card glass-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>{locale === 'ar' ? 'الطالب' : 'Student'}</th>
                <th>{locale === 'ar' ? 'الرقم الجامعي' : 'Student #'}</th>
                <th>{locale === 'ar' ? 'درجة المشروع' : 'Project Grade'}</th>
                <th>{locale === 'ar' ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {lists.eligible.map((entry) => {
                const student = entry.student || {};
                const grade = entry.finalized_grade;
                return (
                  <tr key={student.id}>
                    <td><strong>{student.full_name || '—'}</strong></td>
                    <td>{student.student_number || '—'}</td>
                    <td>{grade ? `${grade.total_score}/${grade.max_score}${grade.letter_grade ? ` (${grade.letter_grade})` : ''}` : '—'}</td>
                    <td>
                      <Link to={`/faculty/graduation/${student.id}/review`} className="btn btn-primary btn-sm">
                        {t('Review & Approve')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {lists.eligible.length === 0 && (
                <tr><td colSpan={4} className="text-small text-muted" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>{t('No students currently eligible to graduate.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && tab === 'graduated' && (
        <div className="table-responsive card glass-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>{locale === 'ar' ? 'الطالب' : 'Student'}</th>
                <th>{locale === 'ar' ? 'رقم الشهادة' : 'Certificate #'}</th>
                <th>{locale === 'ar' ? 'تاريخ التخرج' : 'Graduation Date'}</th>
                <th>{locale === 'ar' ? 'المعدل النهائي' : 'Final GPA'}</th>
                <th>{locale === 'ar' ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {lists.graduated.map((g) => (
                <tr key={g.student_id}>
                  <td><strong>{g.student_name || '—'}</strong></td>
                  <td>{g.certificate_number}</td>
                  <td>{g.graduation_date}</td>
                  <td>{g.final_gpa !== null && g.final_gpa !== undefined ? g.final_gpa : '—'}</td>
                  <td style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <a
                      href={`/faculty/graduation/${g.student_id}/certificate`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                      title={t('View Certificate')}
                    >
                      <Icon name="award" size={14} />
                    </a>
                    <Link to={`/faculty/graduation/${g.student_id}/edit`} className="btn btn-outline btn-sm" title={t('Edit Certificate')}>
                      <Icon name="edit" size={14} />
                    </Link>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--color-danger)' }}
                      disabled={busyId === g.student_id}
                      onClick={() => handleRevoke(g.student_id)}
                    >
                      {t('Revoke')}
                    </button>
                  </td>
                </tr>
              ))}
              {lists.graduated.length === 0 && (
                <tr><td colSpan={5} className="text-small text-muted" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>{t('No graduates yet.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && tab === 'revoked' && (
        <div className="table-responsive card glass-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>{locale === 'ar' ? 'الطالب' : 'Student'}</th>
                <th>{locale === 'ar' ? 'رقم الشهادة' : 'Certificate #'}</th>
                <th>{locale === 'ar' ? 'تاريخ الإلغاء' : 'Revoked At'}</th>
                <th>{locale === 'ar' ? 'السبب' : 'Reason'}</th>
              </tr>
            </thead>
            <tbody>
              {lists.revoked.map((g) => (
                <tr key={g.student_id}>
                  <td><strong>{g.student_name || '—'}</strong></td>
                  <td>{g.certificate_number}</td>
                  <td>{g.revoked_at || '—'}</td>
                  <td>{g.revoke_reason || '—'}</td>
                </tr>
              ))}
              {lists.revoked.length === 0 && (
                <tr><td colSpan={4} className="text-small text-muted" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>{t('No revoked records.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
