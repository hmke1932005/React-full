import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/graduation-review';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/graduation-review.php. Data comes from
 * GET /api/v1/graduation/{studentId} (App\Controllers\Api\
 * GraduationApiController::show() -> eligibility, same GraduationService::
 * checkEligibility() shape the Blade page's checklist reads). Approve
 * posts to .../approve, same manual-override branch (reason required)
 * the legacy page enforces when the student doesn't meet every check.
 */
export default function UniversityGraduationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [degreeAr, setDegreeAr] = useState('');
  const [degreeEn, setDegreeEn] = useState('');
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/api/v1/graduation/${id}`)
      .then((json) => setEligibility(json.data?.eligibility || null))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(manualOverride) {
    const confirmMsg = manualOverride
      ? (locale === 'ar' ? 'هذا الطالب لا يستوفي شروط التخرج. متأكد من الاعتماد اليدوي؟ سيتم تسجيل هذا الإجراء.' : 'This student does not meet the graduation requirements. Approve manually anyway? This action will be logged.')
      : (locale === 'ar' ? 'اعتماد تخرج هذا الطالب؟ سيتم إصدار شهادة وإخطار الطالب.' : "Approve this student's graduation? A certificate will be issued and the student notified.");
    if (!window.confirm(confirmMsg)) return;

    setFormError(null);
    setSaving(true);
    try {
      await api.post(`/api/v1/graduation/${id}/approve`, {
        degree_title_ar: degreeAr,
        degree_title_en: degreeEn,
        notes,
        manual_override: manualOverride ? 1 : 0,
        override_reason: manualOverride ? overrideReason : '',
      });
      navigate('/university/graduation?tab=graduated');
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-small">{t('Loading…')}</p>;
  if (error) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;
  if (!eligibility) return null;

  const student = eligibility.student || {};

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{student.full_name || '—'}</h1>
          <p className="text-small">{t('Student #: ')}{student.student_number || '—'}</p>
        </div>
      </div>

      <div className="card glass-panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <h2 className="text-h4" style={{ marginBottom: 'var(--space-3)' }}>{t('Graduation requirements')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {(eligibility.checks || []).map((check) => (
            <div key={check.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {check.met ? (
                <span style={{ color: 'var(--color-success)' }}><Icon name="check-circle" size={18} /></span>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}><Icon name="x-circle" size={18} /></span>
              )}
              <span className="text-small">{check.label?.[locale] || check.label?.en}</span>
            </div>
          ))}
        </div>

        {eligibility.finalized_grade && (
          <p className="text-small" style={{ marginTop: 'var(--space-3)' }}>
            {t('Graduation project grade: ')}
            <strong>
              {eligibility.finalized_grade.total_score}/{eligibility.finalized_grade.max_score}
              {eligibility.finalized_grade.letter_grade ? ` (${eligibility.finalized_grade.letter_grade})` : ''}
            </strong>
          </p>
        )}

        <p className="text-small" style={{ marginTop: 'var(--space-2)' }}>
          {t('Current GPA: ')}<strong>{student.gpa !== null && student.gpa !== undefined ? student.gpa : '—'}</strong>
        </p>
      </div>

      {formError && <p style={{ color: 'var(--color-danger)' }}>{formError}</p>}

      {eligibility.eligible ? (
        <div className="card glass-panel">
          <h2 className="text-h4" style={{ marginBottom: 'var(--space-3)' }}>{t('Approve graduation')}</h2>
          <form onSubmit={(e) => { e.preventDefault(); handleApprove(false); }}>
            <div className="form-group">
              <label className="form-label">{t('Degree title (Arabic)')}</label>
              <input className="form-input" value={degreeAr} onChange={(e) => setDegreeAr(e.target.value)} placeholder={t('e.g. بكالوريوس علوم حاسب')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Degree title (English)')}</label>
              <input className="form-input" value={degreeEn} onChange={(e) => setDegreeEn(e.target.value)} placeholder="e.g. Bachelor of Science in Computer Science" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Internal notes (optional)')}</label>
              <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Icon name="award" size={14} /> {t('Approve Graduation & Issue Certificate')}
            </button>
          </form>
        </div>
      ) : eligibility.already_graduated ? (
        <div className="card glass-panel">
          <p className="text-small text-muted">{t('This student has already graduated.')}</p>
        </div>
      ) : (
        <>
          <div className="card glass-panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
            <p className="text-small text-muted">{t('Graduation cannot be approved until the student meets all requirements above.')}</p>
          </div>

          <div className="card glass-panel" style={{ padding: 'var(--space-5)', border: '1px solid var(--color-warning, #f59e0b)' }}>
            <h2 className="text-h4" style={{ marginBottom: 'var(--space-2)', color: 'var(--color-warning, #b45309)' }}>
              <Icon name="alert-triangle" size={16} /> {t('Manual override approval')}
            </h2>
            <p className="text-small text-muted" style={{ marginBottom: 'var(--space-3)' }}>
              {t('Use this only for exceptional cases (e.g. graduating without a formal project grade). The reason is recorded on this student\'s audit trail.')}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleApprove(true); }}>
              <div className="form-group">
                <label className="form-label">{t('Degree title (Arabic)')}</label>
                <input className="form-input" value={degreeAr} onChange={(e) => setDegreeAr(e.target.value)} placeholder={t('e.g. بكالوريوس علوم حاسب')} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('Degree title (English)')}</label>
                <input className="form-input" value={degreeEn} onChange={(e) => setDegreeEn(e.target.value)} placeholder="e.g. Bachelor of Science in Computer Science" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('Reason for manual override (required)')}</label>
                <textarea className="form-input" rows={3} required value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('Additional internal notes (optional)')}</label>
                <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-outline" style={{ borderColor: 'var(--color-warning, #f59e0b)', color: 'var(--color-warning, #b45309)' }} disabled={saving}>
                <Icon name="alert-triangle" size={14} /> {t('Manually Approve & Issue Certificate')}
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
