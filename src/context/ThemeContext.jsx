import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Client-only equivalent of public/assets/js/dark-mode.js. The PHP app
// persists theme_preference server-side per user (POST /{role}/settings/theme)
// for the roles listed in header.php's $rolesWithThemeEndpoint — once you
// convert the Settings page, swap the localStorage write below for an
// api.patch('/api/v1/.../preferences', { theme }) call to match.
const STORAGE_KEY = 'uip_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
