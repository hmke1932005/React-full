import { useEffect, useState } from 'react';
import SettingsShell from '../../components/settings/SettingsShell';
import { NotificationsCard, PasswordCard, AppearanceCard, LanguageCard } from '../settings/shared';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import { api, errorMessage } from '../../api/client';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/supervisor/settings';

const translations = { ...i18nCommon, ...i18nPage };

const BASE = '/api/v1/supervisor/settings';

// Mirrors SupervisorManagementService::PERMISSIONS exactly (same list
// UniversitySupervisors.jsx already uses for the invite/edit form).
const PERMISSIONS = [
  { key: 'view_students', en: 'View Assigned Students', ar: 'عرض الطلاب المُسندين' },
  { key: 'manage_projects', en: 'Review & Approve Projects', ar: 'مراجعة واعتماد المشاريع' },
  { key: 'manage_messages', en: 'Messages', ar: 'الرسائل' },
  { key: 'view_reports', en: 'Reports', ar: 'التقارير' },
];

/**
 * Mirrors app/Views/supervisor/settings.php, talking to the real JSON API
 * (GET/PATCH /api/v1/supervisor/settings/* — SupervisorSettingsApiController,
 * ported from the old Supervisor\SupervisorSettingsController). Your Profile
 * (name/email/department/title/permissions/scope) is read-only here —
 * exactly like the old view said, only the inviting university edits those,
 * via /api/v1/supervisors/{id}. This page only has the two cards
 * SupervisorSettingsApiController actually backs: notification preferences
 * and password change — no avatar/2FA/team, the old controller never had
 * them for a supervisor login either.
 */
export default function SupervisorSettings() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get(BASE)
      .then((json) => { if (!cancelled) setData(json.data); })
      .catch((err) => { if (!cancelled) setLoadError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (loadError) return <p style={{ color: 'var(--color-danger)', padding: 'var(--space-5)' }}>{loadError}</p>;
  if (!data) return null;

  const supervisor = data.supervisor;
  const scopes = data.scopes || [];
  const myPermissions = supervisor && supervisor.permissions ? supervisor.permissions.split(',') : [];

  const scopeLabel = (s) => {
    if (s.scope_type === 'project') {
      return locale === 'ar' ? (s.project_title_ar || s.project_title_en || '') : (s.project_title_en || s.project_title_ar || '');
    }
    return s.scope_value;
  };

  // No theme/language endpoint on this portal's API: Appearance and Language
  // apply live (and are remembered on this device).
  const sections = [
    {
      key: 'profile', label: { en: 'Profile', ar: 'الملف الشخصي' }, icon: 'user',
      content: (
      <div className="card glass-panel">
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>{t('Your Profile')}</h2>
            {supervisor ? (
              <>
                <p className="text-small"><strong>{t('Name')}:</strong> {supervisor.full_name}</p>
                <p className="text-small"><strong>{t('Email')}:</strong> {supervisor.email}</p>
                <p className="text-small"><strong>{t('Department')}:</strong> {supervisor.department || '—'}</p>
                <p className="text-small"><strong>{t('Title')}:</strong> {supervisor.title || '—'}</p>
                <p className="text-caption" style={{ marginTop: 'var(--space-3)' }}>{t('Only your university can edit these details and your permissions.')}</p>

                <h2 className="text-h4" style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-2)' }}>{t('Your Permissions')}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {PERMISSIONS.map((p) => (
                    <span key={p.key} className={`badge ${myPermissions.includes(p.key) ? 'badge-success' : 'badge-neutral'}`}>
                      {p[locale] || p.en}
                    </span>
                  ))}
                </div>

                <h2 className="text-h4" style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-2)' }}>{t('Your Scope')}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {scopes.length === 0 ? (
                    <span className="text-caption text-muted">{t('No scope assigned yet.')}</span>
                  ) : scopes.map((s, i) => (
                    <span key={i} className="badge badge-neutral">
                      {s.scope_type.charAt(0).toUpperCase() + s.scope_type.slice(1)}: {scopeLabel(s)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-small text-muted">{t('Your account is not currently active.')}</p>
            )}
          </div>
      ),
    },
    { key: 'appearance', label: { en: 'Appearance', ar: 'المظهر' }, icon: 'palette', content: <AppearanceCard /> },
    { key: 'language', label: { en: 'Language', ar: 'اللغة' }, icon: 'globe', content: <LanguageCard /> },
    {
      key: 'notifications', label: { en: 'Notification Preferences', ar: 'تفضيلات الإشعارات' }, icon: 'bell',
      content: (
        <NotificationsCard
          base={BASE}
          categories={data.notification_categories}
          mutedInitial={data.muted_categories}
          digestInitial={data.digest_frequency}
          quietHoursInitial={data.quiet_hours}
        />
      ),
    },
    { key: 'security', label: { en: 'Security', ar: 'الأمان' }, icon: 'lock', content: <PasswordCard base={BASE} /> },
  ];

  return (
    <SettingsShell
      title={t('Settings')}
      subtitle={locale === 'ar' ? 'بياناتك وتفضيلاتك وأمان حسابك.' : 'Your details, preferences and account security.'}
      sections={sections}
    />
  );
}
