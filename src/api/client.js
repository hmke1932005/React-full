/**
 * API client — React equivalent of public/assets/js/api-client.js, adapted
 * for the SPA case.
 *
 * The old client authenticated via the PHP session cookie + a CSRF token
 * (app/Middleware/CSRFMiddleware.php). That still works, but the backend
 * *also* issues a JWT access/refresh pair on JSON login specifically for
 * this purpose (see LoginController::submit — "a React client uses the
 * Bearer token"), and CSRFMiddleware explicitly exempts any request
 * carrying `Authorization: Bearer ...`. So this client uses Bearer auth:
 * no CSRF token needed, and no reliance on a same-origin cookie, so this
 * app can be hosted separately from the PHP backend if you want.
 *
 * Access tokens are short-lived (JWT_ACCESS_TTL, default 900s/15min).
 * On a 401 we transparently redeem the refresh token
 * (POST /api/v1/auth/refresh-token) and retry once — see requestWithAuth.
 *
 * Deliberately `sessionStorage`, not `localStorage`: `localStorage` is
 * shared across *every* tab/window open on this origin, so signing in as
 * two different accounts in two tabs of the same browser (e.g. testing
 * a University portal session next to a Student portal session) used to
 * make the second login silently overwrite the first tab's token —
 * whichever tab logged in last "won", and the other tab kept sending
 * requests under the wrong identity. `sessionStorage` is scoped per tab, so
 * each tab keeps its own independent session.
 */

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const ACCESS_KEY = 'uip_access_token';
const REFRESH_KEY = 'uip_refresh_token';

export function getTokens() {
  return {
    accessToken: sessionStorage.getItem(ACCESS_KEY),
    refreshToken: sessionStorage.getItem(REFRESH_KEY),
  };
}

export function setTokens({ access_token, refresh_token }) {
  if (access_token) sessionStorage.setItem(ACCESS_KEY, access_token);
  if (refresh_token) sessionStorage.setItem(REFRESH_KEY, refresh_token);
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

function buildUrl(path, params) {
  if (!params) return path;
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.append(k, v);
  });
  const qs = usp.toString();
  return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;
}

async function rawRequest(method, path, { params, body, formData, headers } = {}) {
  const url = buildUrl(path, params);
  const { accessToken } = getTokens();
  const opts = {
    method,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  };

  if (method !== 'GET' && method !== 'HEAD') {
    if (formData) {
      opts.body = formData;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body || {});
    }
  }

  let response;
  try {
    response = await fetch(url, opts);
  } catch {
    throw new ApiError('Network error — please check your connection.', 0, null);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw new ApiError(`Request failed (${response.status})`, response.status, null);
    return response;
  }

  const json = await response.json();
  if (json && json.success === false) {
    throw new ApiError(json.message || 'Request failed.', response.status, json);
  }
  return json;
}

// Redeems the refresh token for a new access+refresh pair. Concurrent 401s
// share a single in-flight refresh instead of each firing their own.
let refreshPromise = null;
async function refreshAccessToken() {
  const { refreshToken } = getTokens();
  if (!refreshToken) throw new ApiError('Not authenticated.', 401, null);

  if (!refreshPromise) {
    refreshPromise = rawRequest('POST', '/api/v1/auth/refresh-token', {
      body: { refresh_token: refreshToken },
    })
      .then((json) => {
        setTokens(json.data);
        return json.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(method, path, opts) {
  try {
    return await rawRequest(method, path, opts);
  } catch (err) {
    // Skip retry for the auth endpoints themselves to avoid loops.
    if (err instanceof ApiError && err.status === 401 && !path.startsWith('/api/v1/auth/')) {
      try {
        await refreshAccessToken();
      } catch {
        clearTokens();
        throw err;
      }
      return rawRequest(method, path, opts);
    }
    throw err;
  }
}

/**
 * Renders an ApiError for display. The backend's validate() helper
 * (Core\Controller::validate) returns a generic "The given data was
 * invalid." message plus a field=>[messages] `errors` map (see
 * Validator::errors()) — this surfaces those field messages instead of
 * just the generic one, same info a web form's inline field errors would
 * show, since there's no per-field rendering here (yet).
 */
export function errorMessage(err) {
  const fieldErrors = err?.payload?.errors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const messages = Object.values(fieldErrors).flat();
    if (messages.length) return messages.join(' ');
  }
  return err?.message || 'Something went wrong. Please try again.';
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  /** GET a file. Same Bearer + refresh-on-401 path as every other call; returns the Response. */
  blob: (path, params) => request('GET', path, { params, headers: { Accept: '*/*' } }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  postForm: (path, formData) => request('POST', path, { formData }),
  putForm: (path, formData) => request('PUT', path, { formData }),
  del: (path, body) => request('DELETE', path, { body }),
};

// `delete` is a valid object-property name (not a reserved word in this
// position), so this is a safe alias — several pages (FacultyStudents,
// UniversityStudents, UniversityAcademicStaff, UniversitySupervisors,
// FacultyAcademicStaff) call `api.delete(...)` instead
// of `api.del(...)`, which previously threw "api.delete is not a
// function" since only `del` was exported.
api.delete = api.del;
