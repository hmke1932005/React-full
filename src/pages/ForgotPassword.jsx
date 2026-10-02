import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import AuthLayout from '../layouts/AuthLayout';
import Icon from '../components/Icon';
import AuthStatus from '../components/auth/AuthStatus';
import { AuthField } from '../components/auth/AuthField';
import { useTranslations } from '../context/LanguageContext';
import i18nCommon from '../i18n/common';
import i18nPage from '../i18n/auth/pages';

const translations = { ...i18nCommon, ...i18nPage };

// Mirrors app/Views/auth/forgot-password.php + ForgotPasswordController::submit().
export default function ForgotPassword() {
  const t = useTranslations(translations);
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sentMessage, setSentMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const json = await api.post('/api/v1/auth/forgot-password', { email });
      // Deliberately the same message whether or not the email exists —
      // ForgotPasswordController never reveals which.
      setSentMessage(json.message || 'If an account with that email exists, a reset link has been sent.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentMessage) {
    return (
      <AuthLayout>
        <AuthStatus
          tone="success"
          icon="mail"
          title={t('Check your inbox')}
          actions={(
            <>
              <Link to="/auth/login" className="auth-btn">{t('Back to sign in')}</Link>
              <button type="button" className="auth-btn auth-btn--ghost" onClick={() => setSentMessage(null)}>
                {t('Use a different email')}
              </button>
            </>
          )}
        >
          <p style={{ margin: '0 0 10px' }}>{t(sentMessage)}</p>
          <p style={{ margin: 0, fontSize: '0.8125rem' }}>{t('The link expires shortly. Not there? Check your spam folder.')}</p>
        </AuthStatus>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('Forgot your password?')}
      subtitle={t("Enter your email and we'll send you a reset link")}
      error={error}
    >
      <form onSubmit={handleSubmit}>
        <AuthField
          id="email"
          type="email"
          label={t('Email')}
          icon="mail"
          ltr
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
        />

        <button type="submit" className={`auth-btn ${submitting ? 'is-loading' : ''}`} disabled={submitting}>
          <span>{submitting ? t('Sending…') : t('Send reset link')}</span>
          {!submitting && <span className="auth-dir-icon"><Icon name="arrow-right" size={18} /></span>}
        </button>
      </form>

      <div className="auth-footer-link">
        <Link to="/auth/login" className="auth-link auth-back">
          <span className="auth-dir-icon"><Icon name="arrow-left" size={16} /></span> {t('Back to sign in')}
        </Link>
      </div>
    </AuthLayout>
  );
}
