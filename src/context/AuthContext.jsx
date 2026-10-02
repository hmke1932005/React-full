import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, getTokens, setTokens, clearTokens } from '../api/client';

const AuthContext = createContext(null);

/** Decodes the (unsigned-by-us, already-verified-by-the-server) JWT payload
 *  just to read `role`/`sub` for the UI — never trust this for authorization,
 *  the backend re-checks the signature on every request. */
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** Builds the `user` state shape from decoded JWT claims — `name`/`email`
 *  are the display claims UipJwtService::issueTokenPair() now embeds
 *  alongside `sub`/`role` (both nullable for tokens issued before that
 *  change / a since-deleted user), used anywhere the app needs to show
 *  the signed-in user's name (e.g. Meeting Room's own video tile label). */
function userFromClaims(claims) {
  return { id: claims.sub, role: claims.role, full_name: claims.name ?? null, email: claims.email ?? null };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, role, full_name, email } | null
  const [status, setStatus] = useState('loading'); // 'loading' | 'authenticated' | 'guest'

  useEffect(() => {
    const { accessToken } = getTokens();
    if (!accessToken) {
      setStatus('guest');
      return;
    }
    const claims = decodeJwt(accessToken);
    if (claims?.sub) {
      setUser(userFromClaims(claims));
      setStatus('authenticated');
    } else {
      clearTokens();
      setStatus('guest');
    }
  }, []);

  /** POST /api/v1/auth/login. Returns { requiresTwoFactor, csrfToken } on
   *  success so the caller can route to the 2FA screen with the token it
   *  needs (see completeTwoFactor below); throws ApiError on failure. */
  const login = useCallback(async (email, password) => {
    const json = await api.post('/api/v1/auth/login', { email, password });
    if (json.data?.requires_2fa) {
      return { requiresTwoFactor: true, csrfToken: json.data.csrf_token };
    }
    setTokens(json.data);
    const claims = decodeJwt(json.data.access_token);
    setUser(userFromClaims(claims));
    setStatus('authenticated');
    return { requiresTwoFactor: false, role: claims.role };
  }, []);

  /** POST /api/v1/auth/two-factor/verify — step 2 of login when the account
   *  has 2FA enabled (see login() above). Same shape as login(): stores the
   *  issued tokens and marks the user authenticated on success.
   *
   *  Unlike /login and /logout, this runs before any Bearer token exists,
   *  so CSRFMiddleware's Bearer exemption doesn't apply — it still needs
   *  the session-bound `_csrf_token` LoginController now hands back
   *  alongside `requires_2fa` (see login() above / LoginController::submit). */
  const completeTwoFactor = useCallback(async (code, rememberDevice, csrfToken) => {
    const json = await api.post('/api/v1/auth/two-factor/verify', {
      code,
      remember_device: rememberDevice,
      _csrf_token: csrfToken,
    });
    setTokens(json.data);
    const claims = decodeJwt(json.data.access_token);
    setUser(userFromClaims(claims));
    setStatus('authenticated');
    return { role: claims.role };
  }, []);

  /** POST /api/v1/auth/two-factor/cancel — "sign in as someone else" from
   *  the two-factor screen. Same CSRF token as completeTwoFactor above. */
  const cancelTwoFactor = useCallback(async (csrfToken) => {
    await api.post('/api/v1/auth/two-factor/cancel', { _csrf_token: csrfToken });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Even if the server call fails, clear local tokens so the UI
      // reflects logged-out state — a dead access token isn't useful.
    }
    clearTokens();
    setUser(null);
    setStatus('guest');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, completeTwoFactor, cancelTwoFactor, logout }),
    [user, status, login, completeTwoFactor, cancelTwoFactor, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { ApiError };
