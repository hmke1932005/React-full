# Admin portal redesign — batch 1 (shell + palette)

- `src/styles/css/admin-portal.css` (new, imported in `src/styles/index.css`) — Admin palette (light #4830F0 on #F9FAFC, dark #6058F8 on #141821 / cards #1B212F / sidebar #11151E) and shell styling.
- `src/config/portalBrand.js` — admin uses `shell: 'admin'` (no promo card, "Super Admin" role label).
- `src/layouts/DashboardLayout.jsx` — admin gets `app-shell--student app-shell--admin`.
- `src/components/Sidebar.jsx` — admin: letter tile, bottom user card, theme switch + "UIP AI Assistant", counters.
- `src/components/Topbar.jsx` — admin: "Workspace › Page" breadcrumb, search, "Ask AI" button, role under the avatar name.
- `src/config/navConfig.js` — admin sidebar order: Workspace → Account → the rest (no item removed).

Next batches: Dashboard, Users & Roles (+details), Institutions/Companies, Verification, Moderation, Analytics, System Activity, Reports, Settings.
Build: `npm install && npm run build`.

# Batch 2 — Dashboard, Users & Roles, User Details

Build verified: `npm install && npm run build` passes.

- `src/pages/admin/AdminDashboard.jsx` — new layout: KPI cards, Needs Your Attention (built from real counters only), Users by Role (bars from `/api/v1/admin/roles` users_count), Recent Activity, AI overview, Security Logs link, Universities Awaiting Review table. The design's "Platform Growth" chart is NOT drawn: the API has no time-series data yet (nothing invented).
- `src/pages/admin/AdminUsers.jsx` — "Users & Roles": KPI row from `counts_by_status`, filter bar, avatar + role/status badges, pagination footer, row links to details. `window.confirm()` replaced by in-page "Confirm action" dialog. Reads `?status=` from the URL (used by the dashboard links).
- `src/pages/admin/AdminUserDetails.jsx` (new) — route `/admin/users/:uuid`: profile card, tabs Overview / Roles & Permissions (read-only matrix from the role's permission groups, union of primary + additional roles) / Activity (audit-log search by the user's email) / Security (suspend/reactivate, block IP, delete). Optional fields (last sign-in, email verified, 2FA) appear only when the API returns them.
- `src/components/admin/adminUi.jsx` (new) — Avatar, StatusBadge, RoleBadge, ConfirmModal, UserModal (the existing add/edit + secondary-roles dialog, behavior unchanged).
- `src/styles/css/admin-portal.css` — `adm-*` styles, badges in the Admin palette.
- `src/App.jsx` — route for User Details. `src/config/navConfig.js` — sidebar label "Users & Roles".

Not covered by the design's data (left out rather than faked): growth chart, per-user permission *editing* (use Roles page), user "Organization", "risk"/"documents" columns of verification requests (next batches).

# Batch 3 — Institutions, Companies, Verification & Approvals

Build verified: `npm run build` passes.

- `src/pages/admin/AdminUniversities.jsx` — "Institutions": KPI row (from `meta.counts`), filter bar, avatar rows, pagination footer, "View" details dialog built from the list row (no extra endpoint assumed), re-verification dialog kept, `confirm()` replaced by the in-page dialog. Same API: list / verify / reject / reverification / delete.
- `src/pages/admin/AdminCompanies.jsx` (new, `/admin/companies`) — there is no companies API, so this is a view over accounts with primary role `company` via `/api/v1/admin/users` (list, suspend, activate; rows link to User Details). Industry / projects / verification columns from the design are not shown (no data).
- `src/pages/admin/AdminApprovals.jsx` — "Verification & Approvals" with two tabs: Institutions (pending/verified/rejected queue with Verify / Reject) and Project approvals (existing oversight list + logged override). "Risk" and "Documents" columns not shown (no data).
- `src/App.jsx` — route `/admin/companies`. `src/config/navConfig.js` — sidebar: "Institutions", "Companies", "Verification & Approvals".

Open question for the backend: if `GET /api/v1/admin/universities/{id}` exists, University Details can become a full page like User Details.

# Batch 4 — Projects & Moderation, Platform Analytics, System Activity (+ dashboard growth chart)

Build verified: `npm run build` passes.

- Dashboard: "Platform Growth" area chart is now drawn from `user_growth` in `/api/v1/analytics/overview` (correction to batch 2, which said no data source existed).
- `src/pages/admin/AdminProjects.jsx` (new, `/admin/projects`): projects list from `/api/v1/admin/approvals` + "Moderate" dialog (approve & publish / request changes → draft / remove → rejected), reason required and logged via the existing override endpoint. No moderation-flag data exists in the API, so flags / severity / "Clear flag" are not shown.
- `src/pages/admin/AdminAnalyticsDashboard.jsx`: Platform Analytics redesign (KPIs, growth chart, role adoption, ecosystem, leaderboards, most viewed/interacted, 30-day trends). Same endpoints.
- `src/pages/admin/AdminSystemActivity.jsx` (new, `/admin/activity`): tabs "Security events" (security-logs API) and "Admin actions" (audit-logs API), search, severity filter, CSV export. `/admin/security-logs` and `/admin/audit-logs` now open this page on the matching tab; the old AdminSecurityLogs/AdminAuditLogs files were removed. Response-time / uptime / CPU tiles from the design have no data source and are not shown.
- `src/components/admin/adminUi.jsx`: AreaChart + Pager. `admin-portal.css`: chart, segmented/choice, ranking styles.
- Sidebar: added "Projects & Moderation" and "System Activity"; "Analytics Dashboard" renamed "Platform Analytics".

# Batch 5 — Reports, Settings, Notifications, Messages

Build verified: `npm run build` passes.

- `src/pages/admin/AdminReports.jsx`: new layout — "Create Report" button + modal (type from the real `meta.reportTypes`, CSV only), one card per real report type, Scheduled Reports table (type / frequency / recipient / last + next run / status, run-now, pause-resume, delete), history table with the shared Pager. `confirm()` replaced by the in-page "Confirm action" dialog. Same endpoints as before.
- Settings: `SettingsShell` is shared, so only CSS changed (scoped to Admin): sections now show as the design's top tabs. Tabs from the design that have no backend (Integrations, Billing, ...) were NOT added.
- Notifications / Messages (shared pages): Admin panel styling in CSS; fixed hover/tab states that were invisible in the light theme.
- Removed dead files `AdminAuditLogs.jsx` and `AdminSecurityLogs.jsx` (no route used them since batch 4).

# Batch 6 — Detail pages (University, Verification Request, Company, Moderation Project)

Build verified: `npm run build` passes.

- `src/pages/admin/AdminUniversityDetails.jsx` (new, `/admin/universities/:id`): University Details AND Verification Request Details (a verification request is the university record). Opened from Institutions ("View") or from Verification & Approvals ("Review", which keeps the back link and title of the approvals flow). Verify / Reject (pending only), Re-verification, Delete (danger zone), history built only from the dates the API returns. The old details dialog was removed.
- `src/pages/admin/AdminProjectDetails.jsx` (new, `/admin/projects/:id`): Moderation Project Details with the existing logged "Moderate" action. Extra scalar fields returned by the API are listed; nothing is invented.
- Company Details: `/admin/companies/:uuid` reuses `AdminUserDetails` (`company` prop → "Company Details", back link and delete go to Companies). Companies rows now open it.
- `src/components/admin/useRowLookup.js` (new): no detail endpoints are assumed. The page uses the row passed by the list through router state; on refresh / direct link it scans the existing list endpoint (max 15 pages) for the id.
- Not built (no data / endpoint): documents, risk score, moderation flags + "Clear flag", "Request more information".

# Batch 7 — Roles & Permissions, Team, Featured Projects, Profile (unification)

Build verified: `npm run build` passes. No API or behavior changes; markup/styles only (plus the dialog swaps below).

- `AdminRoles.jsx`: KPI row (roles / custom roles / users with a role, all from `/api/v1/admin/roles`), role cards in the Admin style, `confirm()` / `alert()` replaced by the in-page "Confirm action" dialog and an inline error. Page-level Breadcrumb removed (the top bar already shows it).
- `AdminTeam.jsx`: KPI row, avatar rows, shared status badge, `confirm()` replaced by the in-page dialog.
- `AdminFeaturedProjects.jsx`: KPI cards, Admin tables / filter bar / shared Pager; the hard-coded hex colors were removed.
- `AdminProfile.jsx`: profile card + account details panel (same avatar upload endpoint).
- `admin-portal.css`: `.adm-role-*` styles.

# Batch 8 — Messaging (Oversight, Conversation, Analytics, Settings)

Build verified: `npm run build` passes. No API changes; markup/styles plus the dialog swaps below.

- `AdminMessagingOversight.jsx`: Admin filter bar (search + type) and table, pager in the Admin style.
- `AdminMessagingConversation.jsx`: back link, avatar per message, panel; the two `confirm()` calls (delete message / delete attachment) replaced by the in-page "Confirm action" dialog.
- `AdminMessagingAnalytics.jsx`: KPI cards, Admin table, back link.
- `AdminMessagingSettings.jsx`: panels in the Admin style. NEW: disabling messaging for a portal now asks for confirmation (it blocks read + send for all of that portal's users immediately). Enabling is unchanged.

# Batch 9 — AI Code Review (list, history, compare) + AI Assistant Settings

Build verified: `npm run build` passes. No API changes.

- `AdminAiCodeReview.jsx`: KPI cards, Admin filter panel (inputs now use the shared form styles — they were unstyled), Admin table, pager. The per-row "Actions" `<details>` dropdown (it had no CSS and was clipped by the table's scroll container) is now an in-page dialog with the same actions (history, export, approve, re-run, note, score override). `confirm('Re-run analysis?')` → in-page "Confirm action" dialog; `alert('Export failed')` → inline error.
- `AdminAiCodeReviewHistory.jsx`, `AdminAiCodeReviewCompare.jsx`: back link, Admin panels / tables / score tiles; compare export failures show an inline error (the `alert()` and the missing `res.ok` check were fixed).
- `AdminAiAssistantSettings.jsx`: Admin panels, KPI tiles for usage analytics, Admin table for "By portal".
- `admin-portal.css`: `.adm-filter-form`, `.adm-export-row`, `.adm-actions-stack`.

# Batch 10 — Notification Settings, Search Results, Innovation Statistics, Mobile, FAQ Intents

Build verified: `npm run build` passes. No API changes.

- `AdminNotificationSettings.jsx`: Admin panel + shared form styles.
- `AdminSearchResults.jsx`: Admin panels/tables; Projects and Universities rows now have a "View" link to their detail pages. "View all" for projects now goes to Projects & Moderation (it used to go to an Approvals page that ignored `?q=`).
- `AdminUsers.jsx`, `AdminUniversities.jsx`, `AdminProjects.jsx`: read the initial search text from `?q=` (the topbar search links were dead before).
- `AdminStatistics.jsx`: KPI cards, Admin filter bar, panels, tables and bars (hard-coded gradients/accent colors removed).
- `AdminMobile.jsx`: KPI cards, panels, table; `confirm()` for Revoke replaced by the in-page "Confirm action" dialog.
- `AdminFaqIntents.jsx`: tabs, panels, tables in the Admin style; `confirm()` for Delete replaced by the in-page dialog.
- Removed dead `AdminAuditLogs.jsx` / `AdminSecurityLogs.jsx` (no route or import; they were still in the zip).

# Batch 11 — Settings cards + final code audit

Build verified: `npm run build` passes. No API changes.

- `AdminSettings.jsx`: all Admin cards (Profile, Security, Platform, Mail, AI, Team link) use the Admin panel style; toggle rows use `.adm-set-row`; `window.confirm()` for "Disable two-factor authentication" replaced by the in-page "Confirm action" dialog.
- `admin-portal.css`: shared Settings cards (Appearance, Language, Notification preferences, theme tiles) restyled, scoped to `.app-shell--admin`.
- Audit (static): no physical left/right CSS in `admin-portal.css` (RTL-safe logical properties only), no hard-coded hex colors in Admin pages except white text on the danger button, every CSS variable used by `admin-portal.css` is defined.
- Not done (needs a running app): visual comparison with the Light/Dark screenshots, RTL check in the browser, real-backend test.

# Batch 12 — AI Code Review "Actions" dialog as tabs
- `AdminAiCodeReview.jsx`: the Actions dialog is now 3 tabs — Review (Approve / Re-run / Version History), Export, Notes & score. Same endpoints and behavior.
- `admin-portal.css`: `.adm-actions-stack` has a min-height so the dialog doesn't jump between tabs.

# Batch 13 — Role permissions dialog redesign
- `AdminRoles.jsx` (`PermissionsModal`): the plain checkbox list is now a dialog with a header showing "N of M permissions granted", search, All/Granted filter, Grant all / Revoke all, one card per module (with a "x/y granted" badge and a module-level switch), and a row per permission (readable label + the real slug + description + switch). Footer shows unsaved-changes state; Save is disabled until something changes, and clicking the backdrop no longer closes the dialog when there are unsaved changes.
- Same endpoints and payload (`GET /api/v1/admin/roles/{slug}`, `PATCH .../permissions`). Reuses the shared `.switch` component.
- `admin-portal.css`: `.adm-perm*` styles (+ fix: module cards were squeezed by the flex column; search icon overlapped the placeholder).

# Batch 14 — Landing page (`/`)
- `src/pages/Landing.jsx`: rebuilt in the Admin/Faculty design language (classes `.lp2-*`). Same routes, same copy (EN/AR), same `/api/v1/public/landing` featured projects, same redirect for signed-in users. New: sticky flat nav (brand tile, anchors, language/theme toggles, Log in / Get Started), hero with a "Sample" AI Readiness card (ring + four signal bars), a stats strip, step cards with icons, role cards, flat featured-project cards, and a solid indigo CTA card.
- `src/styles/css/landing.css` (new, imported last in `index.css`): wrapper `.lp2` redefines the palette (light #4830F0 on #F9FAFC / dark #6058F8 on #141821) so ProjectCard, ReadinessRing, buttons and SiteFooter inside the page follow it. No gold accents, no glass panels, no hard-coded left/right.
- Old `.lp-*` rules in `pages/public.css` are kept: `PublicTopbar.jsx` (used by /projects and the other public pages) still uses them, so those pages keep the old look until they are restyled.
- Placeholders to replace with real data: the four numbers in the stats strip (2,400+ / 60+ / 1,500+ / <60s) and the four sub-scores in the sample card (91/84/88/85) were not coming from the API before either.

# Batch 15 — Verify Certificate (`/verify-certificate`)
- `src/pages/VerifyCertificate.jsx`: rebuilt in the same design language as the new Landing. Centered header with icon, a single search card (input + Verify; the button is disabled while empty/loading), and three clear result states: valid (green, "Verified" badge + facts grid), revoked (amber, name/university only — same rule as before), not found (red). Same endpoint (`GET /api/v1/public/verify-certificate?number=`), same copy (EN/AR), `?number=` still read from and written to the URL. The result area is `aria-live`.
- `src/components/LandingNav.jsx` (new): the sticky nav shared by Landing and Verify Certificate (`Landing.jsx` now uses it instead of its inline copy; it gained a "Verify a Certificate" link).
- `landing.css`: `.lp2-vc*` styles.
- Other public pages (`/projects`, project detail, privacy policy, portfolios, university/faculty profiles) still use `PublicTopbar` + the old look.
