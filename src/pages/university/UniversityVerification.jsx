import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/verification';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/verification.php. Data comes from
 * GET /api/v1/university/verification (App\Controllers\Api\
 * UniversityVerificationApiController::index() -> UniversityVerificationService
 * ::statusFor() + UniversityReverificationLogRepository::forUniversity()).
 * Document upload posts multipart to .../documents — never itself changes
 * verification_status; that stays an Admin decision.
 */

const STATUS_META = {
  verified: { class: 'badge-success', icon: 'shield', en: 'Verified', ar: 'موثقة' },
  pending: { class: 'badge-primary', icon: 'clock', en: 'Pending', ar: 'قيد المراجعة' },
  rejected: { class: 'badge-danger', icon: 'x-circle', en: 'Rejected', ar: 'مرفوضة' },
  unverified: { class: 'badge-neutral', icon: 'shield', en: 'Unverified', ar: 'غير موثقة' },
};
const DOC_STATUS_META = {
  approved: { class: 'badge-success', en: 'Approved', ar: 'معتمد' },
  pending: { class: 'badge-primary', en: 'Pending', ar: 'قيد المراجعة' },
  rejected: { class: 'badge-danger', en: 'Rejected', ar: 'مرفوض' },
};
const REVERIF_EVENT_META = {
  notified: { class: 'badge-primary', icon: 'bell', en: 'Expiry warning sent', ar: 'إرسال تنبيه بالانتهاء' },
  auto_renewed: { class: 'badge-success', icon: 'check-circle', en: 'Auto-renewed', ar: 'تجديد تلقائي' },
  reverted_pending: { class: 'badge-danger', icon: 'x-circle', en: 'Reverted to pending', ar: 'رجوع لقيد المراجعة' },
  failed: { class: 'badge-danger', icon: 'alert-triangle', en: 'Re-verification failed', ar: 'فشل إعادة التحقق' },
};

function timeAgo(dateStr, locale) {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return locale === 'ar' ? 'اليوم' : 'today';
  if (days === 1) return locale === 'ar' ? 'منذ يوم' : '1 day ago';
  return locale === 'ar' ? `منذ ${days} يوم` : `${days} days ago`;
}

export default function UniversityVerification() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [university, setUniversity] = useState(null);
  const [verification, setVerification] = useState({ status: 'unverified', documents: [], history: [] });
  const [reverifLog, setReverifLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/university/verification')
      .then((json) => {
        setUniversity(json.data?.university || null);
        setVerification(json.data?.verification || { status: 'unverified', documents: [], history: [] });
        setReverifLog(json.data?.reverification_log || []);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('document', file);
      if (notes) formData.append('notes', notes);
      await api.postForm('/api/v1/university/verification/documents', formData);
      setFile(null);
      setNotes('');
      load();
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <p className="text-small">{t('Loading…')}</p>;
  if (error && !university) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;

  const meta = STATUS_META[verification.status] || STATUS_META.unverified;
  const name = university ? (locale === 'ar' ? (university.official_name_ar || university.official_name_en) : (university.official_name_en || university.official_name_ar)) : '—';

  const expiresAt = university?.verification_expires_at || null;
  const autoOn = university ? Number(university.auto_reverify_enabled ?? 1) === 1 : false;
  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : null;

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('University Verification')}</h1>
          <p className="text-small">{t("Your university's verification status on the platform, and its supporting documents.")}</p>
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)', flexShrink: 0 }}>
              <Icon name={meta.icon} size={28} />
            </div>
            <div style={{ flex: 1 }}>
              <span className={`badge ${meta.class}`}>{meta[locale]}</span>
              <h2 className="text-h2" style={{ margin: 'var(--space-2) 0 0' }}>{name}</h2>
              {verification.verified_at && (
                <p className="text-caption" style={{ margin: 0 }}>
                  {locale === 'ar' ? 'بتاريخ' : 'On'} {new Date(verification.verified_at).toLocaleDateString('en-GB')}
                  {verification.verified_by ? ` · ${verification.verified_by}` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="card glass-panel">
            <h3 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>{t('Submitted Documents')}</h3>
            {verification.documents.length === 0 ? (
              <p className="text-small text-muted">{t('No documents submitted yet.')}</p>
            ) : (
              verification.documents.map((doc) => {
                const dm = DOC_STATUS_META[doc.status] || DOC_STATUS_META.pending;
                return (
                  <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <Icon name="file" size={18} />
                      <div>
                        <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{doc.notes || t('Verification document')}</p>
                        <span className="text-caption">{t('Uploaded')} {timeAgo(doc.created_at, locale)}</span>
                      </div>
                    </div>
                    <span className={`badge ${dm.class}`}>{dm[locale]}</span>
                  </div>
                );
              })
            )}

            {uploadError && <p style={{ color: 'var(--color-danger)', marginTop: 'var(--space-3)' }}>{uploadError}</p>}

            <form onSubmit={handleUpload} style={{ marginTop: 'var(--space-4)' }}>
              <input
                className="form-input"
                type="text"
                placeholder={t('Document description (optional)')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ marginBottom: 'var(--space-3)' }}
              />
              <label
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 'var(--space-2)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)',
                  border: '2px dashed var(--border-subtle)', cursor: 'pointer', textAlign: 'center',
                }}
              >
                <Icon name="upload" size={26} />
                <span className="text-small" style={{ fontWeight: 600 }}>{t('Drag & drop a document here')}</span>
                <span className="text-caption">{t('or click to browse (PDF, DOC, DOCX)')}</span>
                <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              {file && <p className="text-caption" style={{ marginTop: 'var(--space-2)' }}>{file.name}</p>}
              <button type="submit" className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-3)' }} disabled={!file || uploading}>
                <Icon name="upload" size={16} /> {uploading ? (locale === 'ar' ? 'جارٍ الرفع…' : 'Uploading…') : t('Upload Document')}
              </button>
            </form>
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card glass-panel">
            <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Verification History')}</h3>
            {verification.history.length === 0 ? (
              <p className="text-small text-muted">{locale === 'ar' ? 'لا يوجد سجل بعد.' : 'No history yet.'}</p>
            ) : (
              verification.history.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="check" size={14} />
                  </span>
                  <div>
                    <p className="text-small" style={{ margin: 0 }}>{h.label}</p>
                    <span className="text-caption">{new Date(h.date).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card glass-panel">
            <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Automatic Re-verification')}</h3>
            {verification.status === 'verified' && expiresAt ? (
              <>
                <p className="text-small" style={{ margin: '0 0 var(--space-2)' }}>
                  {t('Current verification expires on')} <strong>{new Date(expiresAt).toLocaleDateString('en-GB')}</strong>
                  {daysLeft !== null && (
                    <> ({daysLeft >= 0 ? (locale === 'ar' ? `بعد ${daysLeft} يوم` : `in ${daysLeft} day(s)`) : t('expired')})</>
                  )}
                </p>
                <p className="text-caption" style={{ margin: '0 0 var(--space-3)' }}>
                  {autoOn
                    ? (locale === 'ar' ? 'سيتم التجديد تلقائيًا عند الانتهاء طالما لا توجد مشاكل قائمة.' : "It will renew automatically at expiry as long as there's nothing outstanding.")
                    : t('Auto-renew is off for your university — at expiry it will need a manual admin review.')}
                </p>
              </>
            ) : (
              <p className="text-small text-muted" style={{ margin: '0 0 var(--space-3)' }}>
                {locale === 'ar' ? 'تُفعَّل إعادة التحقق التلقائي بعد أول توثيق للجامعة.' : "Automatic re-verification activates once your university's first verification is approved."}
              </p>
            )}

            {reverifLog.length > 0 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                {reverifLog.map((ev, i) => {
                  const em = REVERIF_EVENT_META[ev.event] || REVERIF_EVENT_META.notified;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }}>
                      <Icon name={em.icon} size={14} />
                      <span className={`badge ${em.class}`}>{em[locale]}</span>
                      <span className="text-caption">{new Date(ev.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
