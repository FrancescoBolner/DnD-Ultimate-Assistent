function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return fromEnv;
  // Fallback for LAN/dev: use the same host the frontend was opened from.
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  return `${protocol}//${host}:3000/api`;
}

const API_BASE = resolveApiBase();

/**
 * Rewrites any http://localhost:PORT or http://127.0.0.1:PORT occurrences in a
 * raw JSON string to use the actual backend origin.
 * No-ops when already on localhost (dev machine).
 */
function rewriteLocalhostInJson(text: string): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return text;
  if (!text.includes('localhost') && !text.includes('127.0.0.1')) return text;
  const backendOrigin = API_BASE.replace(/\/api$/, ''); // e.g. https://dnd-ultimate-assistent.onrender.com
  const frontendOrigin = window.location.origin;        // e.g. https://dnd-ultimate-assistent.vercel.app
  return text.replace(
    /http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g,
    (_match, _h, port) => {
      // Port 3000 is the backend; any other port (e.g. 5173) is the frontend dev server.
      return port === ':3000' ? backendOrigin : frontendOrigin;
    },
  );
}

/**
 * Reverse of rewriteLocalhostInJson.
 * Before sending a request body, normalise backend-origin URLs back to
 * canonical localhost so the database always stores localhost URLs.
 * No-ops when already on localhost (dev machine).
 */
function normalizeBodyUrls(text: string): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return text;
  const backendOrigin = API_BASE.replace(/\/api$/, '');
  const frontendOrigin = window.location.origin;

  // Normalise backend-origin URLs → http://localhost:3000
  const escapedBackend = backendOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let result = text.replace(new RegExp(escapedBackend, 'g'), 'http://localhost:3000');

  // Normalise frontend-origin URLs → http://localhost:5173
  if (frontendOrigin !== backendOrigin) {
    const escapedFrontend = frontendOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedFrontend, 'g'), 'http://localhost:5173');
  }

  return result;
}

/** Returns the backend origin (e.g. http://localhost:3000) without the /api suffix */
export function getApiOrigin(): string {
  return API_BASE.replace(/\/api$/, '');
}

/* ────────────────────────────────────────────
   In-memory access token store
   ──────────────────────────────────────────── */
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/* ────────────────────────────────────────────
   Generic fetch wrapper
   ──────────────────────────────────────────── */

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip automatic Authorization header */
  noAuth?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // send the httpOnly cookie
    });
    if (!res.ok) return null;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { body, noAuth, ...rest } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };

  if (!noAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    credentials: 'include',
    body: body ? normalizeBodyUrls(JSON.stringify(body)) : undefined,
  });

  // If 401 and we had a token, try silent refresh once
  if (res.status === 401 && !noAuth && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers,
        credentials: 'include',
        body: body ? normalizeBodyUrls(JSON.stringify(body)) : undefined,
      });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(error.message || 'Request failed'), {
      status: res.status,
    });
  }

  const text = await res.text();
  return JSON.parse(rewriteLocalhostInJson(text)) as T;
}
