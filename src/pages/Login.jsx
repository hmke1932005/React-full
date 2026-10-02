import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, ApiError } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import AuthLayout from '../layouts/AuthLayout';
import Icon from '../components/Icon';
import { AuthField, PasswordField } from '../components/auth/AuthField';
import { roleHome } from '../config/roleHome';
import { useTranslations } from '../context/LanguageContext';
import i18nCommon from '../i18n/common';
import i18nPage from '../i18n/auth/login';

const translations = { ...i18nCommon, ...i18nPage };

export default function Login() {
  const t = useTranslations(translations);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  // Register.jsx / ResetPassword.jsx redirect here with a flash message in
  // location.state (same as Session::flash + redirect on the PHP side).
  const [success] = useState(location.state?.success ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        navigate('/auth/two-factor', { state: { csrfToken: result.csrfToken } });
        return;
      }
      navigate(roleHome(result.role));
    } catch (err) {
      setError(err instanceof ApiError ? errorMessage(err) : t('Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title={t('Welcome back')} subtitle={t('Sign in to access your dashboard')} error={error} success={success}>
      <form onSubmit={handleSubmit} noValidate={false}>
        <AuthField
          id="email"
          type="email"
          label={t('Email')}
          icon="mail"
          ltr
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
        />

        <PasswordField
          id="password"
          label={t('Password')}
          labelAside={
            <Link to="/auth/forgot-password" className="auth-link" style={{ fontSize: '0.8125rem' }}>
              {t('Forgot password?')}
            </Link>
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          showCapsWarning
          required
        />

        <button type="submit" className={`auth-btn ${submitting ? 'is-loading' : ''}`} disabled={submitting}>
          <span>{submitting ? t('Signing in…') : t('Sign in')}</span>
          {!submitting && <span className="auth-dir-icon"><Icon name="arrow-right" size={18} /></span>}
        </button>
      </form>

      <div className="auth-footer-link">
        {t("Don't have an account?")} <Link to="/auth/register" className="auth-link">{t('Create one')}</Link>
      </div>
    </AuthLayout>
  );
}
