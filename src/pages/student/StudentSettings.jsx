import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import AvatarUploader from '../../components/insight/AvatarUploader';
import SettingsShell from '../../components/settings/SettingsShell';
import { ROW_BETWEEN, SavedBadge, NotificationsCard, PasswordCard, TwoFactorCard, AppearanceCard, LanguageCard, EmailToggleCard } from '../settings/shared';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/settings';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/student/settings.php, talking to the real JSON API
 * (app/Controllers/Api/StudentSettingsApiController.php — routes/api.php
 * '/student/settings/*'). Every field/endpoint below comes straight from
 * that controller: it has no profile-update route (name/email are set at
 * registration, not here), so the Profile card is read-only.
 */

const BASE = '/api/v1/student/settings';

export default function StudentSettings() {
  const t = useTranslations(translations);
  const { theme: liveTheme } = useTheme();
  const { locale: liveLocale } = useLanguage();
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

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>Loading settings…</p>;
  if (loadError) return <p style={{ color: 'var(--color-danger)', padding: 'var(--space-5)' }}>{loadError}</p>;
  if (!data) return null;

  // One PATCH /preferences carries language + theme + email, so each save
  // sends the current value of the other two.
  const savePrefs = (patch) => api.patch(`${BASE}/preferences`, {
    preferred_language: liveLocale,
    theme_preference: liveTheme,
    email_notifications: emailRef.current ?? !!data.email_notifications,
    ...patch,
  });

  const sections = [
    {
      key: 'profile', label: { en: 'Profile', ar: 'الملف الشخصي' }, icon: 'user',
      content: (
        <>
          <div className="card glass-panel">
            <h2 className="text-h3" style={{ marginBottom: 4 }}>{liveLocale === 'ar' ? 'الصورة الشخصية' : 'Profile photo'}</h2>
            <p className="text-small" style={{ marginBottom: 20 }}>{data.profile?.full_name} · <span className="badge badge-primary">{liveLocale === 'ar' ? 'طالب' : 'Student'}</span></p>
            <AvatarUploader
              name={data.profile?.full_name}
              avatarPath={data.profile?.avatar_path}
              endpoint="/api/v1/students/me/avatar"
              profileEndpoint="/api/v1/students/me"
            />
          </div>
          <ProfileCard profile={data.profile} />
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
          <MessagingPrivacyCard readReceiptsInitial={data.read_receipts_enabled} />
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

  return (
    <SettingsShell
      title={t('Settings')}
      subtitle={liveLocale === 'ar' ? 'تفاصيل حسابك وتفضيلاتك.' : 'Your account details and preferences.'}
      sections={sections}
    />
  );
}

function ProfileCard({ profile }) {
  const t = useTranslations(translations);
  return (
    <div className="card glass-panel">
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>Profile</h2>
      <div className="form-group">
        <label className="form-label">{t('Name')}</label>
        <input className="form-input" type="text" value={profile?.full_name || ''} disabled />
      </div>
      <div className="form-group">
        <label className="form-label">{t('Email')}</label>
        <input className="form-input" type="email" value={profile?.email || ''} disabled />
      </div>
      <p className="text-caption">Contact university administration to change your name or email.</p>
    </div>
  );
}

function MessagingPrivacyCard({ readReceiptsInitial }) {
  const [readReceipts, setReadReceipts] = useState(!!readReceiptsInitial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(`${BASE}/messaging-privacy`, { read_receipts_enabled: readReceipts });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card glass-panel">
      <h2 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>
        <Icon name="message" size={18} /> Messaging Privacy <SavedBadge show={saved} />
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={ROW_BETWEEN}>
          <div>
            <label className="form-label" style={{ margin: 0 }}>Read Receipts</label>
            <p className="text-caption" style={{ margin: '2px 0 0' }}>Let others see when you've read their messages.</p>
          </div>
          <span className="switch">
            <input type="checkbox" checked={readReceipts} onChange={(e) => { setReadReceipts(e.target.checked); setSaved(false); }} aria-label="Read Receipts" />
            <span className="switch__track" aria-hidden="true" />
          </span>
        </div>
        {error && <p className="text-caption" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
