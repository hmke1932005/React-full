import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import AuthLayout from '../layouts/AuthLayout';
import Icon from '../components/Icon';
import { useLanguage, useTranslations } from '../context/LanguageContext';
import i18nCommon from '../i18n/common';
import i18nPage from '../i18n/auth/pages';

const translations = { ...i18nCommon, ...i18nPage };

// Decorative only — unknown slugs fall back to a generic user icon.
const ROLE_ICONS = {
  student: 'user', supervisor: 'users', university: 'building', company: 'briefcase',
  investor: 'dollar', researcher: 'flask', designer: 'palette', faculty: 'award',
};

// Mirrors app/Views/auth/select-role.php + RoleSelectionController.
// Hands off to /auth/register?role=<slug>, same as the PHP version.
export default function SelectRole() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/auth/roles')
      .then((json) => { if (!cancelled) setRoles(json.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <AuthLayout title={t('Who are you?')} subtitle={t('Pick the account type that fits you to continue to registration')}>
      <div className="auth-roles">
        {roles.map((r) => (
          <Link key={r.slug} to={`/auth/register?role=${encodeURIComponent(r.slug)}`} className="auth-role">
            <span className="auth-role__icon"><Icon name={ROLE_ICONS[r.slug] || 'user'} size={20} /></span>
            <span className="auth-role__label">{r.label?.[locale] ?? r.label?.en ?? r.slug}</span>
            <span className="auth-role__go"><Icon name="chevron-right" size={18} /></span>
          </Link>
        ))}
      </div>

      <div className="auth-footer-link">
        {t('Already have an account?')} <Link to="/auth/login" className="auth-link">{t('Sign in')}</Link>
      </div>
    </AuthLayout>
  );
}
