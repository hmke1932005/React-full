# Faculty portal redesign (shell + palette)

- `src/styles/css/faculty-portal.css` (new) — Faculty palette (light #2A52D7 on #F5F4F0, dark #4F72F2 on #111214) and Faculty-specific components. Imported in `src/styles/index.css` after `staff-portal.css`.
- `src/config/portalBrand.js` — faculty entry now uses `shell: 'faculty'` (no promo card, "Search anything").
- `src/layouts/DashboardLayout.jsx` — faculty gets `app-shell--student app-shell--faculty` (student shell chrome + faculty palette); page titles go to the topbar.
- `src/components/Sidebar.jsx` — faculty: letter tile, bottom user card, theme switch, "UIP AI Assistant", notification counter.
- `src/components/Topbar.jsx` — faculty: title on the left, "Search anything" (goes to /faculty/students), counter badge on the bell, "Faculty" role chip.
- `src/config/navConfig.js` — faculty sidebar order: Workspace → Account → More (Portfolio).

Build: `npm install && npm run build` (the old `dist/` was removed from this zip).
