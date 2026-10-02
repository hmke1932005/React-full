import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Icon from './Icon';
import { getNavConfig, SECTION_TITLES } from '../config/navConfig';
import { getPortalBrand, pick } from '../config/portalBrand';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';
import { AVATAR_EVENT, avatarSrc } from './insight/AvatarUploader';

export function displayName(user) {
  return user?.full_name || user?.name || (user?.email ? user.email.split('@')[0] : '') || '—';
}
export function initials(user) {
  const parts = displayName(user).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

/** Event the sidebar's "UIP AI Assistant" button fires; AiAssistantWidget opens on it. */
export const OPEN_AI_EVENT = 'uip:open-ai-assistant';

/**
 * Student portal only: the signed-in student's line under their name
 * ("Computer Science · Year 3") and photo, read defensively from
 * GET /api/v1/students/me (the same endpoint the topbar avatar already uses).
 */
function useStudentCard(enabled, endpoint) {
  const [card, setCard] = useState({ line: '', avatar: null, name: '' });
  useEffect(() => {
    if (!enabled || !endpoint) return undefined;
    let cancelled = false;
    api.get(endpoint)
      .then((json) => {
        if (cancelled) return;
        const d = json?.data || {};
        const prof = d.profile || d.user || d;
        const line = [prof.department_name || prof.program_name || prof.faculty_name, prof.academic_year].filter(Boolean).join(' · ');
        setCard({ line, avatar: prof.avatar_path || null, name: prof.full_name || '' });
      })
      .catch(() => {});
    const onAvatar = (e) => setCard((c) => ({ ...c, avatar: e.detail?.path || null }));
    window.addEventListener(AVATAR_EVENT, onAvatar);
    return () => { cancelled = true; window.removeEventListener(AVATAR_EVENT, onAvatar); };
  }, [enabled, endpoint]);
  return card;
}

// Ported from uip_sidebar() in app/Views/layouts/sidebar.php, then restyled
// to the Insight Platform look for every portal, and to the Student design
// for role "student" (user card on top, theme switch + AI button at the bottom).
export default function Sidebar({ role, user, isOpen, collapsed = false, unread = 0, unreadMessages = 0, onClose }) {
  const { locale } = useLanguage();
  const { theme, setTheme } = useTheme();
  const sections = getNavConfig(role);
  const brand = getPortalBrand(role);
  const promo = brand.promo;
  const isStudent = brand.shell === 'student';
  const isStaff = brand.shell === 'staff';
  const isFaculty = brand.shell === 'faculty' || brand.shell === 'admin';
  const letterTile = isStudent || isStaff || isFaculty;
  const card = useStudentCard(isStudent, brand.avatar);
  const shownName = card.name || displayName(user);

  return (
    <aside className={`sidebar glass-panel glass-panel--flat${isOpen ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar__brand">
        {brand.userCard ? (
          <span className="sidebar__logo sidebar__logo--tile" aria-hidden="true"><Icon name="shield" size={19} /></span>
        ) : letterTile ? (
          <span className="sidebar__logo sidebar__logo--tile sidebar__logo--letter" aria-hidden="true">U</span>
        ) : (
          <img className="sidebar__logo" src="/images/logo/uip-mark.png" srcSet="/images/logo/uip-mark@2x.png 2x" alt="" width="36" height="36" />
        )}
        <div className="sidebar__brand-text">
          <div className="sidebar__brand-name">
            {brand.name ? <>{brand.name.strong} <span className="sidebar__brand-light">{brand.name.light}</span></> : (brand.title ? pick(brand.title, locale) : 'UIP')}
          </div>
          <span className="sidebar__brand-sub">{pick(brand.sub, locale)}</span>
        </div>
        <button type="button" className="sidebar__close-btn" onClick={onClose} aria-label="Close menu">
          <Icon name="x" size={18} />
        </button>
      </div>

      {isStudent && user && (
        <Link to="/student/profile" className="sidebar__user sidebar__user--top" onClick={onClose} title={shownName}>
          <span className="sidebar__user-avatar" aria-hidden="true">
            {card.avatar ? <img src={avatarSrc(card.avatar)} alt="" /> : initials({ full_name: shownName })}
          </span>
          <div className="sidebar__user-text">
            <strong>{shownName}</strong>
            <span>{card.line || pick(brand.roleLabel, locale)}</span>
          </div>
        </Link>
      )}

      <nav className="sidebar__nav">
        {Object.entries(sections).map(([sectionKey, items]) => (
          <div key={sectionKey}>
            <div className="sidebar__section-title">
              {SECTION_TITLES[sectionKey]?.[locale] || SECTION_TITLES[sectionKey]?.en || sectionKey}
            </div>
            {items.map((item) => (
              <NavLink
                key={item.key}
                to={item.built ? item.route : '#'}
                className={({ isActive }) => `sidebar__link${isActive && item.built ? ' is-active' : ''}${item.built ? '' : ' is-disabled'}`}
                onClick={(e) => {
                  if (!item.built) e.preventDefault();
                  else onClose?.();
                }}
                aria-disabled={!item.built || undefined}
                title={collapsed ? (item[locale] || item.en) : undefined}
              >
                <Icon name={item.icon} size={18} />
                <span>{item[locale] || item.en}</span>
                {isStudent && item.key === 'messages' && unreadMessages > 0 && (
                  <span className="sidebar__count">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                )}
                {item.key === 'notifications' && unread > 0 && (
                  (isStudent || isFaculty)
                    ? <span className="sidebar__count">{unread > 9 ? '9+' : unread}</span>
                    : <span className="sidebar__dot" aria-hidden="true" />
                )}
                {!item.built && (
                  <span
                    className="badge badge-coming-soon"
                    style={{ marginInlineStart: 'auto', fontSize: 9, padding: '2px 6px' }}
                  >
                    {locale === 'ar' ? 'قريباً' : 'Soon'}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {(brand.userCard || isStaff || isFaculty) && user && (
        <div className="sidebar__user sidebar__user--bottom">
          <span className="sidebar__user-avatar" aria-hidden="true">{initials(user)}</span>
          <div className="sidebar__user-text">
            <strong>{displayName(user)}</strong>
            <span>{pick(brand.roleLabel, locale)}</span>
          </div>
        </div>
      )}

      {promo && (
        <div className="sidebar__promo">
          <Icon name="ai-spark" size={18} />
          <p>{pick(promo.text, locale)}</p>
          {promo.to && (
            <Link to={promo.to} onClick={onClose}>
              {pick(promo.cta, locale)} <Icon name={locale === 'ar' ? 'arrow-left' : 'arrow-right'} size={14} />
            </Link>
          )}
        </div>
      )}

      {(isStudent || isFaculty) && (
        <div className="sidebar__footer">
          <div className="theme-switch" role="group" aria-label={locale === 'ar' ? 'المظهر' : 'Theme'}>
            <button type="button" className={theme === 'light' ? 'is-active' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              <Icon name="sun" size={14} /> <span>{locale === 'ar' ? 'فاتح' : 'Light'}</span>
            </button>
            <button type="button" className={theme === 'dark' ? 'is-active' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              <Icon name="moon" size={14} /> <span>{locale === 'ar' ? 'داكن' : 'Dark'}</span>
            </button>
          </div>
          <button
            type="button"
            className="sidebar__ai-btn"
            onClick={() => { window.dispatchEvent(new Event(OPEN_AI_EVENT)); onClose?.(); }}
          >
            <Icon name="sparkles" size={16} /> <span>{locale === 'ar' ? 'مساعد UIP الذكي' : 'UIP AI Assistant'}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
