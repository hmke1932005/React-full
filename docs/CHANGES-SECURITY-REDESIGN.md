# Security portal redesign — what changed

## Colors (all portals, light + dark)
- `src/styles/css/variables.css`, `themes/dark.css`: new palette from Light.png / Dark.png
  (primary #515FFF, canvas #F6F7FC / #101420, surfaces #FFFFFF / #171E2E, sidebar #FBFCFF / #121826)
  plus a severity scale: `--sev-critical|high|medium|low|info`.
- Fonts: Inter (Latin) + Cairo (Arabic) loaded in `index.html`.

## Shell
- Sidebar: "UIP Security · Control Center" brand, shield tile logo, user card at the bottom.
  Nav labels/icons match the design; the dead "Meetings" link is removed for security roles.
- Topbar: name + role chip. Fixed the search box sitting in the middle of the bar
  (glass-panel pseudo-elements were acting as flex items).

## Pages (`src/pages/security/*`, shared parts in `src/components/security/`)
Dashboard, Incidents, Incident detail, Vulnerabilities, Alerts, Sessions, Audit & Security Logs,
Policies, Reports, Report Files, Settings. API calls are unchanged.

## Design bugs fixed
- Empty filter dropdowns -> always show a value ("All statuses"...).
- Incident STATUS column reused severity colors -> own status scale.
- Dashboard range picker was blank -> 7/14/30 days; Auto-refresh polls every 30 s; LIVE/PAUSED chip.
- Clipped/unbalanced table columns; compact dates in dense tables.
- Native `window.confirm` -> dialogs (revoke session, delete report/evidence, forget device, unlock account).
- Nested `<form>` in toolbars (React DOM warning).

## Completed (missing in the mock-ups)
- Loading skeletons, empty states, error states with retry, pagination.
- Policies: section sub-nav, unsaved-changes bar + Discard, confirm step for high-impact policies, save toast.
- Arabic strings (`src/i18n/security/design.js`), RTL checked.

## Needs backend (not invented)
- Dashboard "Security activity" has no time-series endpoint, so it is bucketed client-side from recent
  incidents/events. If the API returns `activity: [{date, incidents, events}]` it is used automatically.
