# UIP — React Frontend (Pilot)

React (Vite) rebuild of the UIP frontend, talking to the existing PHP
backend over its REST API (`routes/api.php`) using Bearer/JWT auth.

## What's here so far

- `src/api/client.js` — fetch wrapper with Bearer auth + automatic token
  refresh on 401 (mirrors `public/assets/js/api-client.js`, but uses the
  JWT pair the backend already issues on JSON login instead of the
  session-cookie + CSRF flow, since that's what the backend comments say
  it's meant for React clients).
- `src/context/AuthContext.jsx` — login/logout, current user (id + role)
  decoded from the JWT.
- `src/pages/Login.jsx` — full pilot page, same fields/classes as
  `app/Views/auth/login.php`.
- `src/pages/Dashboard.jsx` — placeholder protected page; fetches the
  role's `/me` endpoint if one's mapped, otherwise just shows a stub.
- `src/components/ProtectedRoute.jsx` — redirects to `/auth/login` when
  not authenticated.
- `src/styles/` — the existing design-system CSS (`public/assets/css/*`)
  copied over as-is and re-exported via `src/styles/index.css`, so
  components can keep using the same class names (`btn`, `form-input`,
  `card`, CSS variables like `var(--color-primary)`, ...).

## Running it

1. Start the PHP backend (however you normally do — e.g. `php -S
   localhost:8000 -t public`).
2. `npm install`
3. `npm run dev` — Vite dev server on :5173, proxying `/api/*` to
   `http://localhost:8000` (edit the target in `vite.config.js` if your
   backend runs elsewhere).

## Shared layout (added)

- `src/components/Icon.jsx` — every icon from `app/Helpers/IconHelper.php`
  ported 1:1 as inline SVG (same paths, same viewBox) — no icon library
  dependency, pixel-identical to the old views.
- `src/config/navConfig.js` — sidebar nav sections per role, ported from
  `uip_nav_config()` in `app/Views/layouts/sidebar.php`. Covers the 4
  primary portals (student, university, company,
  admin) — add the rest (faculty, security_*, data_analyst,
  supervisor, academic_staff) the same way when you convert those portals.
- `src/components/Sidebar.jsx` / `BottomNav.jsx` — desktop sidebar +
  mobile bottom nav, ported from `uip_sidebar()` / `uip_bottom_nav()`.
  Uses the same `.sidebar`, `.sidebar.is-open`, `.bottom-nav` classes/CSS
  as before, so the responsive breakpoints in `responsive.css` still work
  unmodified.
- `src/components/Topbar.jsx` — search box (per-role placeholder), theme
  toggle, notifications bell (real data from `GET /api/v1/notifications`
  + `/counts`), avatar dropdown (profile/settings/logout).
- `src/context/ThemeContext.jsx` — client-side dark/light toggle
  (`localStorage`-only for now; swap in the real
  `POST /{role}/settings/theme` call once Settings is converted, same as
  `$rolesWithThemeEndpoint` did server-side).
- `src/layouts/DashboardLayout.jsx` — wraps `<Outlet/>` with
  Sidebar + Topbar + BottomNav. Every protected route now renders inside
  it (see `App.jsx`) — a new page just needs a `<Route>` added there, the
  chrome is already handled.

## Next steps (pick up from here)

1. **Register / Forgot password / 2FA pages** — same pattern as Login,
   view source in `app/Views/auth/*.php`.
2. **One real dashboard** (pick a role, e.g. Company) — replace the
   `ME_ENDPOINT` stub in `Dashboard.jsx` with real cards/data from
   `/api/v1/companies/me`, `/api/v1/companies/discover`, etc. Add its
   `<Route>` inside `DashboardLayout` in `App.jsx`.
3. Repeat the pattern per role/section. Each `routes/api.php` group
   maps pretty directly to one React page + a handful of `api.get(...)`
   calls, rendered inside the existing layout.
4. Remaining nav roles in `navConfig.js` (faculty, security_admin,
   security_officer, data_analyst, supervisor, academic_staff)
   — copy from `sidebar.php`'s `$configs` array as you convert each one.

## Auth pages (added)

All ported from `app/Views/auth/*.php` + their controllers — same fields,
same validation, same redirects:

- `src/layouts/AuthLayout.jsx` — shared brand-panel + form-card shell.
  Ported from the `<style>` block embedded inside `auth_layout_open()` in
  `app/Views/layouts/auth-layout.php` — that inline block (not the
  standalone `public/assets/css/pages/auth.css`, which turns out to be
  dead code no view ever `<link>`s) is what actually renders, so
  `src/styles/css/pages/auth.css` here is a port of the live styles.
  `Login.jsx` now uses this shell too (it originally used a few CSS
  classes — `.auth-layout`, etc. — that don't exist anywhere in the
  design system; fixed as part of this pass).
- `src/pages/Register.jsx` — full_name/email/role/password, role list
  from the real `GET /api/v1/auth/roles`. Leaves out the student-only
  university/faculty/department/program cascade: the PHP form's
  university list comes from a server-rendered view
  (`UniversityRepository::allForRegistration()`), and there's no
  `/api/v1/*` route exposing it pre-login — `/api/v1/universities`
  requires `AuthMiddleware`. Since the backend already treats those
  fields as fully optional, they're just omitted rather than invented.
- `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx` — token
  read from the URL (`?token=`) via `useSearchParams`.
- `src/pages/TwoFactor.jsx` — code + "remember this device", wired to
  `completeTwoFactor`/`cancelTwoFactor` in `AuthContext.jsx`. **Known
  backend gap**: `routes/api.php` puts `CSRFMiddleware` on
  `/auth/two-factor/verify` and `/cancel`, which only exempts requests
  already carrying a Bearer token — but at this point in the flow no
  token has been issued yet, and there's no endpoint that hands a JSON
  client a CSRF token. As it stands today these two calls will 419. Not
  papered over here — needs a backend fix (e.g. exempt this route pair,
  or add a way to fetch a CSRF token for a pending 2FA session).
- `src/pages/VerifyEmail.jsx`, `src/pages/ConfirmEmailChange.jsx` — read
  `?token=`, call the matching `GET /api/v1/auth/*` endpoint, show the
  same verified/invalid states as the PHP views.
- `src/pages/SelectRole.jsx` — links out to `/auth/register?role=<slug>`.
- `src/api/client.js` gained `errorMessage(err)` — the backend's
  `validate()` helper returns a generic "The given data was invalid."
  message plus a `field => [messages]` map; this surfaces the real
  field messages instead of just the generic one.



- CSRF is *not* needed from this app — Bearer requests are exempt
  (`app/Middleware/CSRFMiddleware.php`). Session-cookie based routes
  still require it if you ever call them directly.
- Tokens are stored in `localStorage` for simplicity. If you want
  shorter-lived exposure, swap to storing the access token in memory
  (React state/context) and only the refresh token in `localStorage` —
  the access token is short-lived (15 min default) anyway.
