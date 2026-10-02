import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import AvatarUploader from '../../components/insight/AvatarUploader';
import SettingsShell from '../../components/settings/SettingsShell';
import { SavedBadge, NotificationsCard, PasswordCard, TwoFactorCard, AppearanceCard, LanguageCard, EmailToggleCard } from '../settings/shared';
import { useTheme } from '../../context/ThemeContext';
import { useTranslations } from '../../context/LanguageContext';
import { announceProfile } from '../../context/AuthContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/data-analysis/settings';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/data-analysis/settings.php, talking to the real JSON
 * API (app/Controllers/Api/DataAnalysisSettingsApiController.php —
 * already fully written, previously just not registered in routes/api.php;
 * that registration is the only backend change this page required, see
 * routes/api.php's '/data-analysis/settings' group). Every field/endpoint
 * below comes straight from that controller: full_name + contact_email
 * (with email-change confirmation flow) are editable here, unlike Student
 * whose profile card is read-only.
 */

const BASE = '/api/v1/data-analysis/settings';

export default function DataAnalysisSettings() {
  const t = useTranslations(translations);
  const { theme: liveTheme } = useTheme();
  const emailRef = useRef(null); // latest email-notification choice (null = not touched yet)
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

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Settings')}…</p>;
  if (loadError) return <p style={{ color: 'var(--color-danger)', padding: 'var(--space-5)' }}>{loadError}</p>;
  if (!data) return null;

  // Theme + email preference are saved together by this portal's API, so each
  // save sends the current value of the other one (live theme / last email choice).
  const savePrefs = (patch) => api.patch(`${BASE}/preferences`, {
    theme_preference: liveTheme,
    email_notifications: emailRef.current ?? !!data.email_notifications,
    ...patch,
  });

  const sections = [
    {
      key: 'profile', label: t('Profile'), icon: 'user',
      content: (
        <>
          <div className="card glass-panel">
            <h2 className="text-h3" style={{ marginBottom: 4 }}>{t('Profile photo')}</h2>
            <p className="text-small" style={{ marginBottom: 20 }}>{data.profile?.full_name} · <span className="badge badge-primary">{t('Data Analyst')}</span></p>
            <AvatarUploader name={data.profile?.full_name} avatarPath={data.profile?.avatar_path} />
          </div>
          <ProfileCard profile={data.profile} />
        </>
      ),
    },
    { key: 'appearance', label: t('Appearance'), icon: 'palette', content: <AppearanceCard persist={(theme) => savePrefs({ theme_preference: theme })} /> },
    { key: 'language', label: t('Language'), icon: 'globe', content: <LanguageCard /> },
    {
      key: 'notifications', label: t('Notification Preferences'), icon: 'bell',
      content: (
        <>
          <EmailToggleCard
            initial={data.email_notifications}
            description={t('Get emailed when scheduled reports and exports finish.')}
            persist={(on) => { emailRef.current = on; return savePrefs({ email_notifications: on }); }}
          />
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
      key: 'security', label: t('Security'), icon: 'lock',
      content: (
        <>
          <PasswordCard base={BASE} />
          <TwoFactorCard base={BASE} twoFactorInitial={data.two_factor} />
        </>
      ),
    },
  ];

  return <SettingsShell title={t('Settings')} subtitle={t('Account, appearance, and sign-in security.')} sections={sections} />;
}

function ProfileCard({ profile }) {
  const t = useTranslations(translations);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    setMessage(null);
    try {
      const json = await api.patch(`${BASE}/profile`, { full_name: fullName, contact_email: email });
      setSaved(true);
      setMessage(json.message || null);
      announceProfile({ full_name: fullName.trim(), email });
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
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">{t('Full Name')}</label>
          <input className="form-input" type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setSaved(false); }} required />
        </div>
        <div className="form-group">
          <label className="form-label">{t('Email')}</label>
          <input className="form-input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false); }} required />
        </div>
        {message && <p className="text-caption" style={{ color: 'var(--color-success)' }}>{message}</p>}
        {error && <p className="text-caption" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Icon name="check" size={18} /> {saving ? '…' : t('Save')}
        </button>
      </form>
    </div>
  );
}
