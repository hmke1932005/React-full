/**
 * Sidebar nav sections per role — ported from uip_nav_config() in
 * app/Views/layouts/sidebar.php.
 *
 * Covers the 4 primary portals (student, university,
 * admin). The PHP source also defines faculty, security_admin,
 * security_officer, data_analyst, supervisor, and academic_staff
 * — add them here the same way when you get to converting those portals;
 * the shape is identical, just copy the relevant block from sidebar.php's
 * $configs array and translate the PHP array literal to a JS object.
 */

const COMMON_ACCOUNT_ITEMS = [
  { key: 'messages', en: 'Messages', ar: 'الرسائل', icon: 'message', built: true },
  { key: 'notifications', en: 'Notifications', ar: 'الإشعارات', icon: 'bell', built: true },
  { key: 'settings', en: 'Settings', ar: 'الإعدادات', icon: 'settings', built: true },
];

const RAW_CONFIGS = {
  // Student portal — order/labels follow the Student design (Light/Dark).
  // Company Discovery / Internships / Hackathons / Events are in the design but
  // have no backend, so they are intentionally NOT built or listed.
  student: {
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/student/dashboard', built: true },
      { key: 'projects', en: 'My Projects', ar: 'مشاريعي', icon: 'projects', route: '/student/projects', built: true },
      { key: 'ai-analysis', en: 'AI Analysis', ar: 'تحليل الذكاء الاصطناعي', icon: 'sparkles', route: '/student/ai-analysis', built: true },
      { key: 'portfolio', en: 'Portfolio', ar: 'ملفي الإبداعي', icon: 'folder', route: '/student/portfolio', built: true },
      { key: 'my-exams', en: 'Exams', ar: 'الامتحانات', icon: 'file', route: '/student/my-exams', built: true },
      { key: 'graduation', en: 'Graduation Requirements', ar: 'متطلبات التخرج', icon: 'check-circle', route: '/student/graduation', built: true },
      { key: 'github', en: 'GitHub Integration', ar: 'ربط GitHub', icon: 'github', route: '/student/github', built: true },
      { key: 'patents', en: 'Patent Portal', ar: 'بوابة براءات الاختراع', icon: 'shield', route: '/student/patents', built: true },
    ],
    // Existing pages that are not part of the design's sidebar. Kept so no
    // working feature becomes unreachable.
    community: [
      { key: 'feed', en: 'University Feed', ar: 'موجز الجامعة', icon: 'chat', route: '/student/feed', built: true },
      { key: 'announcements', en: 'Announcements', ar: 'الإعلانات', icon: 'bell', route: '/student/announcements', built: true },
      { key: 'group-hub', en: 'Group Hub', ar: 'مركز المجموعة', icon: 'users', route: '/student/group-hub', built: true },
      { key: 'group-chat', en: 'Group Chat', ar: 'دردشة المجموعة', icon: 'message-square', route: '/student/group-chat', built: true },
      { key: 'contacts', en: 'My Contacts', ar: 'جهات اتصالي', icon: 'inbox', route: '/student/contacts', built: true },
      { key: 'discovery', en: 'Project Discovery', ar: 'استكشاف المشاريع', icon: 'search', route: '/student/discovery', built: true },
    ],
  },
  university: {
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/university/dashboard', built: true },
      { key: 'feed', en: 'University Feed', ar: 'موجز الجامعة', icon: 'message', route: '/university/feed', built: true },
      { key: 'announcements', en: 'Announcements', ar: 'الإعلانات', icon: 'bell', route: '/university/announcements', built: true },
      { key: 'approvals', en: 'Project Approvals', ar: 'اعتماد المشاريع', icon: 'check-circle', route: '/university/approvals', built: true },
      { key: 'students', en: 'Students', ar: 'الطلاب', icon: 'users', route: '/university/students', built: true },
      { key: 'graduation', en: 'Graduation Records', ar: 'سجلات التخرج', icon: 'award', route: '/university/graduation', built: true },
      { key: 'faculties', en: 'Faculties', ar: 'الكليات', icon: 'building', route: '/university/faculties', built: true },
      { key: 'academic-staff', en: 'Academic Staff', ar: 'أعضاء هيئة التدريس', icon: 'users', route: '/university/academic-staff', built: true },
      { key: 'join-requests', en: 'Join Requests', ar: 'طلبات الانضمام', icon: 'users', route: '/university/join-requests', built: true },
      { key: 'verification', en: 'Verification', ar: 'التحقق', icon: 'shield', route: '/university/verification', built: true },
    ],
    // Faculty-style layout: Workspace → Account, then a "More" group.
    more: [
      { key: 'portfolio', en: 'Portfolio', ar: 'الملف العام', icon: 'award', route: '/university/portfolio', built: true },
      { key: 'reports', en: 'Reports', ar: 'التقارير', icon: 'file', route: '/university/reports', built: true },
      { key: 'analytics', en: 'Analytics', ar: 'التحليلات', icon: 'chart', route: '/university/analytics', built: true },
      { key: 'statistics', en: 'Innovation Statistics', ar: 'إحصاءات الابتكار', icon: 'bar-chart', route: '/university/analytics', built: true },
    ],
  },
  // Faculty Portal — ported 1:1 from sidebar.php's 'faculty' $configs
  // entry. A Faculty login is a "mini university" tenant scoped to one
  // faculty_id (migration 106). All React pages now built: dashboard,
  // approvals (+ detail), students, academic staff, settings, graduation
  // (+ review/edit/certificate), messages, notifications — see
  // FacultyDashboard.jsx/FacultyApprovals.jsx/FacultyStudents.jsx/
  // FacultyAcademicStaff.jsx/FacultySettings.jsx/FacultyGraduation*.jsx.
  faculty: {
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/faculty/dashboard', built: true },
      { key: 'approvals', en: 'Project Approvals', ar: 'اعتماد المشاريع', icon: 'check-circle', route: '/faculty/approvals', built: true },
      { key: 'students', en: 'Students', ar: 'الطلاب', icon: 'users', route: '/faculty/students', built: true },
      { key: 'academic-staff', en: 'Academic Staff', ar: 'أعضاء هيئة التدريس', icon: 'users', route: '/faculty/academic-staff', built: true },
      { key: 'graduation', en: 'Graduation Records', ar: 'سجلات التخرج', icon: 'award', route: '/faculty/graduation', built: true },
    ],
    more: [
      { key: 'portfolio', en: 'Portfolio', ar: 'الملف العام', icon: 'award', route: '/faculty/portfolio', built: true },
    ],
  },
  // Exam & Assessment System (Rounds 1-8) — first React pages for this role;
  // no PHP sidebar.php block ever existed for academic_staff (that portal
  // was never built server-side), so this is authored fresh straight
  // against the Laravel exam-system API rather than ported from a view.
  // Round 1: dashboard + question banks + exam builder. Round 2 (targeting/
  // publish) reuses the exam builder as its entry point (a "Manage
  // Targeting & Publish" button on AcademicStaffExamBuilder.jsx, not a
  // separate top-level nav item — targeting is per-exam, same pattern as
  // "Add Question" not getting its own nav item). Later rounds (attempts/
  // grading/security/AI/pools/analytics) add their own entries here as
  // they land — don't restructure this block, just append.
  academic_staff: {
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/academic-staff/dashboard', built: true },
      { key: 'question-banks', en: 'Question Banks', ar: 'بنوك الأسئلة', icon: 'layers', route: '/academic-staff/question-banks', built: true },
      { key: 'exams', en: 'Exams', ar: 'الامتحانات', icon: 'file', route: '/academic-staff/exams', built: true },
      // Round 8+ — pick-an-exam hub pages (AcademicStaffExamPicker.jsx) so
      // Attempts/Grading, Targeting/Publish and Analytics each get a real
      // Sidebar entry instead of only being reachable from inside a
      // specific exam's builder.
      { key: 'attempts', en: 'Attempts & Grading', ar: 'المحاولات والتصحيح', icon: 'edit', route: '/academic-staff/attempts', built: true },
      { key: 'targets', en: 'Targeting & Publish', ar: 'الاستهداف والنشر', icon: 'filter', route: '/academic-staff/targets', built: true },
      { key: 'analytics', en: 'Analytics', ar: 'الإحصائيات', icon: 'bar-chart', route: '/academic-staff/analytics', built: true },
      // Public share page — reuses the same role-agnostic
      // /api/v1/portfolios/* (PortfoliosApiController) headline/about/
      // is_public + share_url the Student portal uses. Academic staff
      // can't own Projects (ProjectsApiController::store() only allows
      // student only), so this is headline/about + share link only
      // — no featured-projects grid, see AcademicStaffPortfolio.jsx.
      { key: 'portfolio', en: 'Public Profile', ar: 'الملف العام', icon: 'award', route: '/academic-staff/portfolio', built: true },
    ],
  },
  // بند 9 (Supervisors)، جزء 3. سطح مقيّد بالنطاق: كل صفحة هنا بتعرض بس
  // اللي SupervisorAssignmentRepository بترجعه لنطاق المشرف (كلية/قسم/سنة/
  // مجموعة/مشروع صريح) — مش روستر الجامعة كلها. messages/notifications
  // مقفولين built:false تحت (ACCOUNT_ITEM_OVERRIDES) لحد ما موديول
  // الرسائل/الإشعارات نفسه ينتقل لللارافيل (بند 18/19).
  supervisor: {
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/supervisor/dashboard', built: true },
      { key: 'students', en: 'My Students', ar: 'طلابي', icon: 'users', route: '/supervisor/students', built: true },
      { key: 'projects', en: 'My Projects', ar: 'مشاريعي', icon: 'folder', route: '/supervisor/projects', built: true },
    ],
  },
  data_analyst: {
    // Insight Platform layout: the seven primary analyst areas come first,
    // in the order of the new design. The remaining analyst tools stay
    // reachable under "More tools" so no existing page loses its entry point.
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/data-analysis/dashboard', built: true },
      { key: 'da-forecasting', en: 'Forecasting', ar: 'التنبؤات', icon: 'trend', route: '/data-analysis/forecasting', built: true },
      { key: 'da-data-quality', en: 'Data Quality', ar: 'جودة البيانات', icon: 'shield', route: '/data-analysis/data-quality', built: true },
      { key: 'da-advanced-analytics', en: 'Advanced Analytics', ar: 'التحليلات المتقدمة', icon: 'bar-chart', route: '/data-analysis/advanced-analytics', built: true },
      { key: 'da-segments', en: 'Data Segments', ar: 'تقسيمات البيانات', icon: 'filter', route: '/data-analysis/segments', built: true },
      { key: 'da-exports', en: 'Exports', ar: 'التصدير', icon: 'download', route: '/data-analysis/exports', built: true },
      { key: 'da-reports', en: 'Reports', ar: 'التقارير', icon: 'file', route: '/data-analysis/reports', built: true },
    ],
    tools: [
      { key: 'da-dashboards', en: 'Saved Dashboards', ar: 'اللوحات المحفوظة', icon: 'grid', route: '/data-analysis/dashboards', built: true },
      { key: 'da-explorer', en: 'Data Explorer', ar: 'مستكشف البيانات', icon: 'layers', route: '/data-analysis/data-explorer', built: true },
      { key: 'da-queries', en: 'SQL Query Builder', ar: 'أداة بناء استعلامات SQL', icon: 'terminal', route: '/data-analysis/queries', built: true },
      { key: 'da-kpis', en: 'KPI Management', ar: 'إدارة المؤشرات', icon: 'award', route: '/data-analysis/kpis', built: true },
      { key: 'da-report-files', en: 'Report Files', ar: 'ملفات التقارير', icon: 'upload', route: '/data-analysis/report-files', built: true },
      { key: 'da-workspace', en: 'Team Workspace', ar: 'مساحة الفريق', icon: 'users', route: '/data-analysis/workspace', built: true },
      { key: 'da-ai-insights', en: 'AI Insights', ar: 'رؤى الذكاء الاصطناعي', icon: 'sparkles', route: '/data-analysis/ai-insights', built: true },
    ],
  },
  admin: {
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/admin/dashboard', built: true },
      { key: 'users', en: 'Users & Roles', ar: 'المستخدمون والأدوار', icon: 'users', route: '/admin/users', built: true },
      { key: 'roles', en: 'Roles & Permissions', ar: 'الأدوار والصلاحيات', icon: 'shield', route: '/admin/roles', built: true },
      { key: 'team', en: 'Team Management', ar: 'إدارة فريق الإشراف', icon: 'users', route: '/admin/team', built: true },
      { key: 'universities', en: 'Institutions', ar: 'المؤسسات', icon: 'building', route: '/admin/universities', built: true },
      { key: 'companies', en: 'Companies', ar: 'الشركات', icon: 'briefcase', route: '/admin/companies', built: true },
      { key: 'approvals', en: 'Verification & Approvals', ar: 'التحقق والاعتماد', icon: 'check-circle', route: '/admin/approvals', built: true },
      { key: 'projects', en: 'Projects & Moderation', ar: 'المشاريع والإشراف', icon: 'projects', route: '/admin/projects', built: true },
      { key: 'system-activity', en: 'System Activity', ar: 'نشاط النظام', icon: 'pulse', route: '/admin/activity', built: true },
      { key: 'featured-projects', en: 'Featured Projects', ar: 'المشاريع المميزة', icon: 'sparkles', route: '/admin/featured-projects', built: true },
    ],
    security: [
      { key: 'security-logs', en: 'Security Logs', ar: 'سجلات الأمان', icon: 'shield', route: '/admin/security-logs', built: true },
      { key: 'audit-logs', en: 'Audit Logs', ar: 'سجلات التدقيق', icon: 'lock', route: '/admin/audit-logs', built: true },
      { key: 'reports', en: 'Reports', ar: 'التقارير', icon: 'file', route: '/admin/reports', built: true },
    ],
    // Security Portal pages, reachable by admin too: the backend already allows
    // it (config/roles.php portal_prefixes.security includes 'admin', and every
    // /api/v1/security/* controller accepts security_admin/security_officer/admin).
    // Keys are prefixed 'sec-' so they never collide with the admin items above
    // (e.g. 'reports') — BottomNav/PageMeta look items up by key/route.
    securityPortal: [
      { key: 'sec-incidents', en: 'Incidents', ar: 'الحوادث', icon: 'shield', route: '/security/incidents', built: true },
      { key: 'sec-vulnerabilities', en: 'Vulnerabilities', ar: 'الثغرات', icon: 'alert', route: '/security/vulnerabilities', built: true },
      { key: 'sec-alerts', en: 'Alerts', ar: 'التنبيهات', icon: 'bell', route: '/security/alerts', built: true },
      { key: 'sec-sessions', en: 'Sessions', ar: 'الجلسات', icon: 'monitor', route: '/security/sessions', built: true },
      { key: 'sec-logs', en: 'Audit & Security Logs', ar: 'سجلات الأمان', icon: 'note', route: '/security/logs', built: true },
      { key: 'sec-policies', en: 'Security Policies', ar: 'سياسات الأمان', icon: 'lock', route: '/security/policies', built: true },
      { key: 'sec-reports', en: 'Security Reports', ar: 'تقارير الأمان', icon: 'file', route: '/security/reports', built: true },
    ],
    messaging: [
      { key: 'messaging-oversight', en: 'Messaging Oversight', ar: 'إشراف الرسائل', icon: 'eye', route: '/admin/messaging/oversight', built: true },
      { key: 'messaging-analytics', en: 'Messaging Analytics', ar: 'تحليلات الرسائل', icon: 'bar-chart', route: '/admin/messaging/analytics', built: true },
      { key: 'messaging-settings', en: 'Messaging Settings', ar: 'إعدادات الرسائل', icon: 'settings', route: '/admin/messaging/settings', built: true },
      { key: 'notification-settings', en: 'Notification Settings', ar: 'إعدادات الإشعارات', icon: 'bell', route: '/admin/notifications/settings', built: true },
    ],
    ai: [
      { key: 'analytics', en: 'Platform Analytics', ar: 'تحليلات المنصة', icon: 'chart', route: '/admin/analytics', built: true },
      { key: 'statistics', en: 'Innovation Statistics', ar: 'إحصاءات الابتكار', icon: 'bar-chart', route: '/admin/statistics', built: true },
      { key: 'code-review', en: 'AI Code Review', ar: 'مراجعة الكود بالذكاء الاصطناعي', icon: 'sparkles', route: '/admin/ai-code-review', built: true },
      { key: 'ai-assistant-settings', en: 'AI Assistant Settings', ar: 'إعدادات المساعد الذكي', icon: 'sparkles', route: '/admin/ai-assistant-settings', built: true },
      { key: 'faq-intents', en: 'FAQ / Smart Answers', ar: 'الأسئلة الشائعة والإجابات الذكية', icon: 'message-square', route: '/admin/faq-intents', built: true },
    ],
    future: [
      { key: 'mobile', en: 'Mobile App Management', ar: 'إدارة تطبيق الجوال', icon: 'grid', route: '/admin/mobile', built: true },
    ],
  },
  // Security Portal — ported 1:1 from sidebar.php's 'security_admin' /
  // 'security_officer' $configs entries. Both roles share the same items
  // except security_admin also gets Security Policies (security_officer
  // does not — matches SecurityPolicyController::canEdit() being
  // admin-only for policy edits).
  security_admin: {
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/security/dashboard', built: true },
      { key: 'incidents', en: 'Incidents', ar: 'الحوادث', icon: 'shield', route: '/security/incidents', built: true },
      { key: 'vulnerabilities', en: 'Vulnerabilities', ar: 'الثغرات', icon: 'alert', route: '/security/vulnerabilities', built: true },
      { key: 'alerts', en: 'Alerts', ar: 'التنبيهات', icon: 'bell', route: '/security/alerts', built: true },
      { key: 'sessions', en: 'Sessions', ar: 'الجلسات', icon: 'monitor', route: '/security/sessions', built: true },
      { key: 'logs', en: 'Audit & Security Logs', ar: 'سجلات الأمان', icon: 'note', route: '/security/logs', built: true },
      { key: 'policies', en: 'Security Policies', ar: 'سياسات الأمان', icon: 'lock', route: '/security/policies', built: true },
      { key: 'reports', en: 'Security Reports', ar: 'تقارير الأمان', icon: 'file', route: '/security/reports', built: true },
      { key: 'report-files', en: 'Report Files', ar: 'ملفات التقارير', icon: 'archive', route: '/security/report-files', built: true },
    ],
  },
  security_officer: {
    main: [
      { key: 'dashboard', en: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', route: '/security/dashboard', built: true },
      { key: 'incidents', en: 'Incidents', ar: 'الحوادث', icon: 'shield', route: '/security/incidents', built: true },
      { key: 'vulnerabilities', en: 'Vulnerabilities', ar: 'الثغرات', icon: 'alert', route: '/security/vulnerabilities', built: true },
      { key: 'alerts', en: 'Alerts', ar: 'التنبيهات', icon: 'bell', route: '/security/alerts', built: true },
      { key: 'sessions', en: 'Sessions', ar: 'الجلسات', icon: 'monitor', route: '/security/sessions', built: true },
      { key: 'logs', en: 'Audit & Security Logs', ar: 'سجلات الأمان', icon: 'note', route: '/security/logs', built: true },
      { key: 'reports', en: 'Security Reports', ar: 'تقارير الأمان', icon: 'file', route: '/security/reports', built: true },
      { key: 'report-files', en: 'Report Files', ar: 'ملفات التقارير', icon: 'archive', route: '/security/report-files', built: true },
    ],
  },
};

export const ROLE_LABELS = {
  student: { en: 'Student Portal', ar: 'بوابة الطالب' },
  university: { en: 'University Portal', ar: 'بوابة الجامعة' },
  faculty: { en: 'Faculty Portal', ar: 'بوابة الكلية' },
  supervisor: { en: 'Supervisor Portal', ar: 'بوابة المشرف' },
  admin: { en: 'Admin Dashboard', ar: 'لوحة تحكم المشرف' },
  data_analyst: { en: 'Data Analysis Portal', ar: 'بوابة تحليل البيانات' },
  security_admin: { en: 'Security Portal', ar: 'بوابة الأمان' },
  security_officer: { en: 'Security Portal', ar: 'بوابة الأمان' },
  academic_staff: { en: 'Academic Staff Portal', ar: 'بوابة عضو هيئة التدريس' },
};

export const SECTION_TITLES = {
  main: { en: 'Workspace', ar: 'مساحة العمل' },
  more: { en: 'More', ar: 'المزيد' },
  ai: { en: 'AI & Discovery', ar: 'الذكاء الاصطناعي والاستكشاف' },
  opportunities: { en: 'Opportunities', ar: 'الفرص' },
  community: { en: 'Community', ar: 'المجتمع' },
  security: { en: 'Security & Audit', ar: 'الأمان والتدقيق' },
  securityPortal: { en: 'Security Portal', ar: 'بوابة الأمان' },
  messaging: { en: 'Messaging Admin', ar: 'إدارة الرسائل' },
  future: { en: 'Future Features', ar: 'ميزات قادمة' },
  tools: { en: 'More tools', ar: 'أدوات إضافية' },
  account: { en: 'Account', ar: 'الحساب' },
};

// Roles whose URL prefix differs from their role slug — mirrors
// config('roles.portal_prefixes') on the backend (data_analyst's portal
// lives at /data-analysis/*, not /data_analyst/*; academic_staff's portal
// lives at /academic-staff/*, not /academic_staff/* — same reason).
const PORTAL_PREFIX_OVERRIDES = {
  data_analyst: 'data-analysis',
  security_admin: 'security',
  security_officer: 'security',
  academic_staff: 'academic-staff',
};

// Per-role overrides for COMMON_ACCOUNT_ITEMS. Faculty Settings now has
// its React page (FacultySettings.jsx, wired to FacultySettingsApiController)
// so it no longer needs a `built: false` override here — left as an empty
// entry so a future portal-specific override has somewhere obvious to go.
const ACCOUNT_ITEM_OVERRIDES = {
  student: { messages: { icon: 'chat' } },
  // بند 18 (Messaging)/19 (Notifications) — supervisor.messages/notifications
  // اتقفلوا هنا قبل كده لأن /supervisor/messages و/supervisor/notifications
  // ما كانوش مسجلين في App.jsx، رغم إن الـ API (/api/v1/messaging،
  // /api/v1/notifications) شغال ومشترك بين كل الأدوار من غير قيد role.
  // دلوقتي الراوتس اتسجلت (زي أي بورتال تاني)، فالـ override اتشال.
  // AcademicStaffSettingsApiController now exists (routes/api.php
  // '/academic-staff/settings/*') and AcademicStaffSettings.jsx is wired
  // up — Settings is no longer locked, so this override is gone. Left as
  // a comment (not an empty entry) so it's clear why academic_staff isn't
  // listed here anymore, same as the Faculty note above.
};


/** Portal URL prefix for a role — mirrors uip_portal_prefix() on the backend. */
export function portalPrefix(role) {
  return PORTAL_PREFIX_OVERRIDES[role] || role || 'student';
}

/** Returns { main: [...], ai: [...], ..., account: [...] } for a role,
 *  same shape as uip_nav_config() in sidebar.php. */
export function getNavConfig(role) {
  const sections = RAW_CONFIGS[role] || RAW_CONFIGS.student;
  const prefix = portalPrefix(role);
  const overrides = ACCOUNT_ITEM_OVERRIDES[role] || {};
  const account = COMMON_ACCOUNT_ITEMS.map((item) => ({
    ...item,
    ...(overrides[item.key] || {}),
    route: `/${prefix}/${item.key}`,
  }));
  // Student design: Workspace → Account (Messages/Notifications/Settings stay
  // visible without scrolling); the extra Community pages come last.
  if (role === 'student') {
    const { community, ...rest } = sections;
    return { ...rest, account, ...(community ? { community } : {}) };
  }
  if (role === 'admin') {
    const { main, ...rest } = sections;
    return { main, account, ...rest };
  }
  if (role === 'faculty' || role === 'university') {
    const { more, ...rest } = sections;
    return { ...rest, account, ...(more ? { more } : {}) };
  }
  return { ...sections, account };
}
