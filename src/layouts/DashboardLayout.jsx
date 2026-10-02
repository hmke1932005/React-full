import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import BottomNav from '../components/BottomNav';
import AiAssistantWidget from '../components/ai-assistant/AiAssistantWidget';
import { useAuth } from '../context/AuthContext';
import { getNavConfig } from '../config/navConfig';
import { useLanguage } from '../context/LanguageContext';
import { PageMetaProvider, PageMetaSync } from '../context/PageMetaContext';
import { api } from '../api/client';
import { getPortalBrand } from '../config/portalBrand';

// "UIP / DASHBOARD" eyebrow shown above every Insight-portal page title.
function useEyebrow(role, enabled) {
  const { pathname } = useLocation();
  const { locale } = useLanguage();
  if (!enabled) return null;
  const items = Object.values(getNavConfig(role)).flat();
  const hit = items
    .filter((i) => i.route && (pathname === i.route || pathname.startsWith(`${i.route}/`)))
    .sort((a, b) => b.route.length - a.route.length)[0];
  const seg = pathname.split('/').filter(Boolean).slice(1, 2)[0] || '';
  const name = hit ? (hit[locale] || hit.en) : seg.replace(/-/g, ' ');
  return `UIP / ${name}`;
}

// Ported from layouts/header.php + layouts/footer.php's <div class="app-shell">
// structure: fixed sidebar, topbar + routed content on the right, bottom nav
// on mobile. Used as the element for every protected route group — see App.jsx.
export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  // Every portal uses the Insight Platform shell (see
  // styles/css/insight-portal.css); per-portal differences (brand subtitle,
  // promo card, search scope) come from config/portalBrand.js.
  const insight = true;
  const shellKind = getPortalBrand(user?.role).shell;
  const isStudentShell = shellKind === 'student';
  const isStaffShell = shellKind === 'staff';
  const isAdminShell = shellKind === 'admin';
  const isFacultyShell = shellKind === 'faculty' || isAdminShell;
  const [unreadMessages, setUnreadMessages] = useState(0);
  const eyebrow = useEyebrow(user?.role, insight);

  // Student sidebar shows an unread-messages badge; the count comes from the
  // same dashboard-stats payload the dashboard uses (best-effort, no badge on failure).
  useEffect(() => {
    if (!isStudentShell) return undefined;
    let cancelled = false;
    api.get('/api/v1/students/dashboard-stats')
      .then((json) => { if (!cancelled) setUnreadMessages(Number(json?.data?.unread_messages) || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isStudentShell]);

  // Desktop: collapse the sidebar to icons. Mobile (<=768px, where the
  // sidebar is an off-canvas drawer): open/close the drawer instead.
  const toggleSidebar = () => {
    if (insight && window.matchMedia('(min-width: 769px)').matches) setCollapsed((c) => !c);
    else setSidebarOpen((o) => !o);
  };

  return (
    <PageMetaProvider>
    {(isStudentShell || isStaffShell || isFacultyShell) && <PageMetaSync role={user?.role} onlyWithoutHeader={isStaffShell} />}
    <div className={`app-shell${insight ? ' app-shell--insight' : ''}${isStudentShell ? ' app-shell--student' : ''}${isStaffShell ? ' app-shell--staff' : ''}${isFacultyShell ? ` app-shell--student app-shell--${shellKind}` : ''}`}>
      <Sidebar role={user?.role} user={user} isOpen={sidebarOpen} collapsed={collapsed} unread={unread} unreadMessages={unreadMessages} onClose={() => setSidebarOpen(false)} />

      {/* Mobile scrim — reuses .sidebar-overlay from responsive.css (only
          rendered/visible at the same breakpoint the off-canvas sidebar is). */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' is-visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="app-shell__content">
        <Topbar
          role={user?.role}
          user={user}
          onMenuClick={toggleSidebar}
          collapsed={collapsed}
          onUnreadChange={setUnread}
          onLogout={logout}
        />

        <main className="app-shell__main">
          {eyebrow && !isStudentShell && !isStaffShell && !isFacultyShell && <div className="insight-eyebrow">{eyebrow}</div>}
          <Outlet />
        </main>
      </div>

      <BottomNav role={user?.role} onMoreClick={() => setSidebarOpen(true)} />

      {/* Mounted once per authenticated layout — same rule as
          layouts/footer.php's <?php if (Session::userId()): ?>
          [data-ai-assistant-root] — every portal that uses DashboardLayout
          gets the widget. */}
      {user && <AiAssistantWidget role={user.role} user={user} />}
    </div>
    </PageMetaProvider>
  );
}
