import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/notification-settings';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/admin/notification-settings.php, talking to the real
 * JSON API (app/Controllers/Api/AdminNotificationSettingsApiController.php
 * — new, added alongside this page; reuses the exact same
 * NotificationService calls the Blade view already made). Platform-wide
 * automatic archive/delete policy for read notifications, distinct from
 * "My Notifications". Nothing here is invented.
 */

export default function AdminNotificationSettings() {
  const t = useTranslations(translations);
  const [archiveDays, setArchiveDays] = useState(0);
  const [deleteDays, setDeleteDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/api/v1/admin/notification-settings')
      .then((json) => {
        setArchiveDays(Number(json.data?.archive_days ?? 0));
        setDeleteDays(Number(json.data?.delete_days ?? 0));
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch('/api/v1/admin/notification-settings', { archive_days: archiveDays, delete_days: deleteDays });
      setSuccess('Notification retention policy saved.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Notification Settings')}</h1>
          <p className="text-small">{t('Platform-wide automatic archive/delete policy for read notifications.')}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-small">{t('Loading…')}</p>
      ) : (
        <div className="adm-panel">
          <div className="adm-panel__head">
            <h2 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
              <Icon name="folder" size={18} /> {t('Notification Retention Policy')}
            </h2>
          </div>
          <p className="text-caption" style={{ marginBottom: 'var(--space-4)' }}>
            A value of 0 disables that half of the policy. Applied by a scheduled cron job
            (cron/apply_notification_retention.php) running once a day.
          </p>
          {success && <p style={{ color: "var(--color-success)" }}>{success}</p>}
          {error && <p className="form-error">{error}</p>}
          <form onSubmit={handleSubmit} className="adm-filter-form">
            <div className="grid-2" style={{ gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">{t('Auto-archive read notifications after (days, 0 = disabled)')}</label>
                <input type="number" min="0" max="3650" className="form-input" value={archiveDays} onChange={(e) => setArchiveDays(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('Auto-delete archived notifications after (days, 0 = disabled)')}</label>
                <input type="number" min="0" max="3650" className="form-input" value={deleteDays} onChange={(e) => setDeleteDays(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} disabled={saving}>
              <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
