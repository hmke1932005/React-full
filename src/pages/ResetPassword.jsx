import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import AuthLayout from '../layouts/AuthLayout';
import Icon from '../components/Icon';
import AuthStatus from '../components/auth/AuthStatus';
import { PasswordField } from '../components/auth/AuthField';
import { useTranslations } from '../context/LanguageContext';
import i18nCommon from '../i18n/common';
import i18nPage from '../i18n/auth/pages';

const translations = { ...i18nCommon, ...i18nPage };

// Mirrors app/Views/auth/reset-password.php + ResetPasswordController::submit().
export default function ResetPassword() {
  const t = useTranslations(translations);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const mismatch = passwordConfirmation !== '' && password !== passwordConfirmation;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setError(t("Passwords don't match."));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/v1/auth/reset-password', {
        token,
        password,
        password_confirmation: passwordConfirmation,
      });
      navigate('/auth/login', {
        state: { success: t('Your password has been reset. Please log in.') },
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (token === '') {
    return (
      <AuthLayout>
        <AuthStatus
          tone="danger"
          icon="x-circle"
          title={t('Link invalid')}
          actions={(
            <>
              <Link to="/auth/forgot-password" className="auth-btn">{t('Request a new link')}</Link>
              <Link to="/auth/login" className="auth-btn auth-btn--ghost">{t('Back to sign in')}</Link>
            </>
          )}
        >
          {t('This reset link is invalid or has expired.')}
        </AuthStatus>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('Reset your password')}
      subtitle={t('Choose a new password for your account')}
      error={error}
    >
      <form onSubmit={handleSubmit}>
        <PasswordField
          id="password"
          label={t('New password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          hint={t('At least 8 characters')}
          showStrength
          showCapsWarning
          required
          autoFocus
        />
        <PasswordField
          id="password_confirmation"
          label={t('Confirm password')}
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          error={mismatch ? t("Passwords don't match.") : undefined}
          required
        />

        <button type="submit" className={`auth-btn ${submitting ? 'is-loading' : ''}`} disabled={submitting || mismatch}>
          <span>{submitting ? t('Resetting…') : t('Reset password')}</span>
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
