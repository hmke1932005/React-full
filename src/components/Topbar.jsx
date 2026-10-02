import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import Dropdown from './Dropdown';
import { api, ApiError } from '../api/client';
import { portalPrefix } from '../config/navConfig';
import { getPortalBrand, pick } from '../config/portalBrand';
import { AVATAR_EVENT, avatarSrc } from './insight/AvatarUploader';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { displayName, initials, OPEN_AI_EVENT } from './Sidebar';
import { usePageMetaValue } from '../context/PageMetaContext';

const TXT = {
  en: {
    toggle: 'Toggle sidebar', noNotif: 'No new notifications', viewAll: 'View all notifications',
    profile: 'Profile', settings: 'Settings', logout: 'Log out', switchLang: 'Switch to English', theme: 'Toggle theme', bell: 'Notifications',
    now: 'just now', m: (n) => `${n}m ago`, h: (n) => `${n}h ago`, d: (n) => `${n}d ago`,
  },
  ar: {
    toggle: 'تبديل القائمة الجانبية', noNotif: 'لا توجد إشعارات جديدة', viewAll: 'عرض كل الإشعارات',
    profile: 'الملف الشخصي', settings: 'الإعدادات', logout: 'تسجيل الخروج', switchLang: 'التبديل للإنجليزية', theme: 'تبديل المظهر', bell: 'الإشعارات',
    now: 'الآن', m: (n) => `منذ ${n} د`, h: (n) => `منذ ${n} س`, d: (n) => `منذ ${n} يوم`,
  },
};

// Roles with a real results page wired to a /api/v1/search-shaped endpoint
// declare it as `search.route` in config/portalBrand.js. Every other role's
// search box stays display-only (submit is a no-op), same as before.

function timeAgo(dateStr, tx) {
  const diff = (Date.now() - new Date(String(dateStr).replace(' ', 'T')).getTime()) / 1000;
  if (!Number.isFinite(diff) || diff < 60) return tx.now;
  if (diff < 3600) return tx.m(Math.floor(diff / 60));
  if (diff < 86400) return tx.h(Math.floor(diff / 3600));
  return tx.d(Math.floor(diff / 86400));
}

// Each portal exposes the signed-in person's avatar under a slightly
// different key; read them all defensively.
const pickAvatar = (json) =>
  json?.data?.profile?.avatar_path || json?.data?.user?.avatar_path || json?.data?.avatar_path || null;

export default function Topbar({ role, user, onMenuClick, onLogout, collapsed = false, onUnreadChange }) {
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale } = useLanguage();
  const navigate = useNavigate();
  const prefix = portalPrefix(role);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [avatar, setAvatar] = useState(null);

  const brand = getPortalBrand(role);
  const isAdmin = brand.shell === 'admin';
  const isFaculty = brand.shell === 'faculty' || isAdmin;
  const isStudent = brand.shell === 'student' || isFaculty;
  const isStaff = brand.shell === 'staff';
  const meta = usePageMetaValue();
  const tx = TXT[locale] || TXT.en;

  // Show the profile photo for every portal, and follow live changes from
  // Settings / Profile (they dispatch AVATAR_EVENT after an upload).
  useEffect(() => {
    if (!brand.avatar) return undefined;
    let cancelled = false;
    api.get(brand.avatar)
      .then((json) => { if (!cancelled) setAvatar(pickAvatar(json)); })
      .catch(() => {});
    const onChange = (e) => setAvatar(e.detail?.path || null);
    window.addEventListener(AVATAR_EVENT, onChange);
    return () => { cancelled = true; window.removeEventListener(AVATAR_EVENT, onChange); };
  }, [brand.avatar]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/api/v1/notifications', { status: 'unread', per_page: 3 }),
      api.get('/api/v1/notifications/counts'),
    ])
      .then(([list, counts]) => {
        if (cancelled) return;
        setNotifications(list.data || []);
        const unread = counts.data?.unread ?? 0;
        setUnreadCount(unread);
        onUnreadChange?.(unread);
      })
      .catch((err) => {
        // Bell degrades to "no notifications" rather than breaking the page —
        // same fallback behavior as layouts/header.php.
        if (!(err instanceof ApiError)) console.error(err);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const searchPlaceholder = pick(brand.search?.placeholder, locale);
  const searchResultsRoute = brand.search?.route;
  const initial = initials(user);
  const roleLabel = pick(brand.roleLabel, locale);

  function submitSearch(e) {
    e.preventDefault();
    if (!searchResultsRoute) return;
    navigate(`${searchResultsRoute}?q=${encodeURIComponent(searchValue)}`);
  }

  return (
    <header className="topbar glass-panel glass-panel--flat">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button className="topbar__icon-btn" onClick={onMenuClick} aria-label={tx.toggle} aria-expanded={!collapsed}>
          <Icon name="panel-left" size={20} />
        </button>

        {(isStudent || isStaff) && (
          isAdmin ? (
            <nav className="topbar__crumbs" aria-label="Breadcrumb">
              <span>{locale === 'ar' ? 'مساحة العمل' : 'Workspace'}</span>
              <Icon name={locale === 'ar' ? 'chevron-left' : 'chevron-right'} size={12} />
              <strong>{meta.title}</strong>
            </nav>
          ) : (
          <div className="topbar__title">
            {meta.title && <h1>{meta.title}</h1>}
            {meta.subtitle && <p>{meta.subtitle}</p>}
          </div>
          )
        )}

        {isStudent ? null : searchResultsRoute ? (
          <form className="topbar__search" onSubmit={submitSearch}>
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ border: 'none', background: 'none', outline: 'none', color: 'var(--text-primary)', width: '100%' }}
            />
          </form>
        ) : (
          <div className="topbar__search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder={searchPlaceholder}
              style={{ border: 'none', background: 'none', outline: 'none', color: 'var(--text-primary)', width: '100%' }}
              disabled
            />
          </div>
        )}
      </div>

      <div className="topbar__actions">
        {isStudent && (
          <form
            className="topbar__search"
            onSubmit={(e) => { e.preventDefault(); navigate(`${isAdmin ? '/admin/search' : isFaculty ? '/faculty/students' : '/student/projects'}${searchValue.trim() ? `?q=${encodeURIComponent(searchValue.trim())}` : ''}`); }}
          >
            <Icon name="search" size={16} />
            <input type="search" placeholder={searchPlaceholder} aria-label={searchPlaceholder} value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
          </form>
        )}
        <button
          type="button"
          className="topbar__icon-btn"
          onClick={toggleLocale}
          aria-label={tx.switchLang}
          title={locale === 'ar' ? 'English' : 'العربية'}
        >
          <Icon name="globe" size={18} />
        </button>

        {!isStudent && <button
          type="button"
          className="topbar__icon-btn"
          onClick={toggleTheme}
          aria-label={tx.theme}
          aria-pressed={theme === 'dark'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>}

        <Dropdown
          trigger={
            <button className="topbar__icon-btn" aria-label={tx.bell} style={{ position: 'relative' }}>
              <Icon name="bell" size={18} />
              {unreadCount > 0 && (isStaff || isFaculty) && (
                <span className="topbar__count">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
              {unreadCount > 0 && !isStaff && !isFaculty && (
                <span
                  className="status-dot--live"
                  style={{
                    position: 'absolute',
                    top: 8,
                    insetInlineEnd: 8,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--color-danger)',
                  }}
                />
              )}
            </button>
          }
          menuClassName="notif-dropdown"
        >
          {notifications.length === 0 ? (
            <div className="notif-item">
              <Icon name="bell" size={16} />
              <div><p className="text-small" style={{ margin: 0 }}>{tx.noNotif}</p></div>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`notif-item${n.is_read ? '' : ' is-unread'}`}>
                <Icon name={n.icon || 'bell'} size={16} />
                <div>
                  <p className="text-small" style={{ margin: 0 }}>{n.title}</p>
                  <span className="text-caption">{timeAgo(n.created_at, tx)}</span>
                </div>
              </div>
            ))
          )}
          <Link to={`/${prefix}/notifications`} className="dropdown__item" style={{ justifyContent: 'center', color: 'var(--color-primary)' }}>
            {tx.viewAll}
          </Link>
        </Dropdown>

        {isFaculty && !isAdmin && <span className="topbar__role-chip">{locale === 'ar' ? 'الكلية' : 'Faculty'}</span>}
        {isAdmin && (
          <button type="button" className="topbar__ask-ai" onClick={() => window.dispatchEvent(new Event(OPEN_AI_EVENT))}>
            <Icon name="sparkles" size={14} /> <span>{locale === 'ar' ? 'اسأل الذكاء' : 'Ask AI'}</span>
          </button>
        )}

        <Dropdown
          trigger={
            <button className="dropdown__item" style={{ width: 'auto', gap: 'var(--space-2)' }}>
              <span
                className="topbar__avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 'var(--text-small)',
                }}
              >
                {avatar ? <img src={avatarSrc(avatar)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initial}
              </span>
              <span className="topbar__user-text">
                <strong>{displayName(user)}</strong>
                {roleLabel && <span>{roleLabel}</span>}
              </span>
              <Icon name="chevron-down" size={14} />
            </button>
          }
        >
          <Link to={`/${prefix}/profile`} className="dropdown__item"><Icon name="user" size={16} /> {tx.profile}</Link>
          <Link to={`/${prefix}/settings`} className="dropdown__item"><Icon name="settings" size={16} /> {tx.settings}</Link>
          <div className="divider" style={{ margin: 'var(--space-2) 0' }} />
          <button
            type="button"
            className="dropdown__item"
            style={{ color: 'var(--color-danger)', width: '100%', textAlign: 'start' }}
            onClick={onLogout}
          >
            <Icon name="logout" size={16} /> {tx.logout}
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
