import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import SettingsShell from '../../components/settings/SettingsShell';
import { SavedBadge, NotificationsCard, PasswordCard, TwoFactorCard, AppearanceCard, LanguageCard, EmailToggleCard } from '../settings/shared';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/academic-staff/settings';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Talks to app/Http/Controllers/Api/AcademicStaffSettingsApiController.php
 * (routes/api.php '/academic-staff/settings/*'). Same shared-card pattern
 * as StudentSettings.jsx/DataAnalysisSettings.jsx (src/pages/settings/
 * shared.jsx) — name/email are read-only here too (set by university/
 * faculty admin, not by the staff member), but unlike Student this
 * portal does have a real profile-update endpoint for the one field that
 * IS the staff member's own to edit: `bio` (academic_staff.bio).
 *
 * Previously locked with a "Soon" badge in the Sidebar
 * (ACCOUNT_ITEM_OVERRIDES.academic_staff.settings in navConfig.js) since
 * no controller/route existed yet — both now exist, so that override was
 * removed.
 */

const BASE = '/api/v1/academic-staff/settings';

export default function AcademicStaffSettings() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const { theme: liveTheme } = useTheme();
  const emailRef = useRef(null); // latest email-notification choice (null = untouched)
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

  // One PATCH /preferences carries language + theme + email, so each save
  // sends the current value of the other two.
  const savePrefs = (patch) => api.patch(`${BASE}/preferences`, {
    preferred_language: locale,
    theme_preference: liveTheme,
    email_notifications: emailRef.current ?? !!data.email_notifications,
    ...patch,
  });

  const sections = [
    {
      key: 'profile', label: { en: 'Profile', ar: 'الملف الشخصي' }, icon: 'user',
      content: (
        <>
          <div className="card glass-panel" style={{ textAlign: 'center' }}>
            <span
              style={{
                width: 96, height: 96, borderRadius: '50%',
                background: 'var(--insight-tint)', color: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 'var(--text-h1)', margin: '0 auto var(--space-4)',
              }}
            >
              {(data.profile?.full_name || '?').slice(0, 1)}
            </span>
            <h2 className="text-h3">{data.profile?.full_name}</h2>
            <span className="badge badge-primary">{t('Academic Staff')}</span>
          </div>
          <ProfileCard profile={data.profile} locale={locale} />
        </>
      ),
    },
    { key: 'appearance', label: { en: 'Appearance', ar: 'المظهر' }, icon: 'palette', content: <AppearanceCard persist={(theme) => savePrefs({ theme_preference: theme })} /> },
    { key: 'language', label: { en: 'Language', ar: 'اللغة' }, icon: 'globe', content: <LanguageCard persist={(lang) => savePrefs({ preferred_language: lang })} /> },
    {
      key: 'notifications', label: { en: 'Notification Preferences', ar: 'تفضيلات الإشعارات' }, icon: 'bell',
      content: (
        <>
          <EmailToggleCard initial={data.email_notifications} persist={(on) => { emailRef.current = on; return savePrefs({ email_notifications: on }); }} />
          <NotificationsCard
            base={BASE}
            categories={data.notification_categories}
            mutedInitial={data.muted_categories}
            digestInitial={data.digest_frequency}
            quietHoursInitial={data.quiet_hours}
          />
        </>
      ),
    },
    {
      key: 'security', label: { en: 'Security', ar: 'الأمان' }, icon: 'lock',
      content: (
        <>
          <PasswordCard base={BASE} />
          <TwoFactorCard base={BASE} twoFactorInitial={data.two_factor} />
        </>
      ),
    },
  ];

  return <SettingsShell title={t('Settings')} subtitle={t('Your account details and preferences.')} sections={sections} />;
}

function ProfileCard({ profile, locale }) {
  const t = useTranslations(translations);
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const rankName = locale === 'ar' ? profile?.rank_name_ar : profile?.rank_name_en;
  const facultyName = locale === 'ar' ? profile?.faculty_name_ar : profile?.faculty_name_en;
  const departmentName = locale === 'ar' ? profile?.department_name_ar : profile?.department_name_en;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(`${BASE}/profile`, { bio });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card glass-panel">
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>
        {t('Profile')} <SavedBadge show={saved} />
      </h2>
      <div className="form-group">
        <label className="form-label">{t('Name')}</label>
        <input className="form-input" type="text" value={profile?.full_name || ''} disabled />
      </div>
      <div className="form-group">
        <label className="form-label">{t('Email')}</label>
        <input className="form-input" type="email" value={profile?.email || ''} disabled />
      </div>
      {(rankName || facultyName || departmentName) && (
        <div className="form-group">
          <label className="form-label">{t('Position')}</label>
          <input
            className="form-input"
            type="text"
            value={[rankName, facultyName, departmentName].filter(Boolean).join(' · ')}
            disabled
          />
        </div>
      )}
      <p className="text-caption" style={{ marginBottom: 'var(--space-3)' }}>
        {t('Contact your university or faculty administration to change your name, email, or position.')}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">{t('Bio')}</label>
          <textarea
            className="form-input"
            rows={3}
            maxLength={1000}
            value={bio}
            onChange={(e) => { setBio(e.target.value); setSaved(false); }}
            placeholder={t('A short bio students and colleagues can see on your profile.')}
          />
        </div>
        {error && <p className="text-caption" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Icon name="check" size={16} /> {saving ? t('Saving…') : t('Save Bio')}
        </button>
      </form>
    </div>
  );
}
