import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import AuthLayout from '../layouts/AuthLayout';
import AuthStatus from '../components/auth/AuthStatus';
import { useTranslations } from '../context/LanguageContext';
import i18nCommon from '../i18n/common';
import i18nPage from '../i18n/auth/pages';

const translations = { ...i18nCommon, ...i18nPage };

// Mirrors app/Views/auth/verify-email.php + VerifyEmailController::handle().
export default function VerifyEmail() {
  const t = useTranslations(translations);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading'); // 'loading' | 'verified' | 'invalid'

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return undefined;
    }
    let cancelled = false;
    api.get('/api/v1/auth/verify-email', { token })
      .then(() => { if (!cancelled) setStatus('verified'); })
      .catch(() => { if (!cancelled) setStatus('invalid'); });
    return () => { cancelled = true; };
  }, [token]);

  if (status === 'loading') {
    return (
      <AuthLayout>
        <AuthStatus tone="loading" title={t('Verify email')}>{t('Verifying your email…')}</AuthStatus>
      </AuthLayout>
    );
  }

  const verified = status === 'verified';

  return (
    <AuthLayout>
      <AuthStatus
        tone={verified ? 'success' : 'danger'}
        icon={verified ? 'check-circle' : 'x-circle'}
        title={verified ? t('Email verified') : t('Verification link invalid')}
        actions={<Link to="/auth/login" className="auth-btn">{t('Go to sign in')}</Link>}
      >
        {verified ? t('You can now sign in to your account.') : t('The link is expired or incorrect.')}
      </AuthStatus>
    </AuthLayout>
  );
}
