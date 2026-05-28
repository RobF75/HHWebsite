import { API_BASE } from './api';
import type { ApiEnvelope, CurrentUser } from './types';

// Access token lives in memory + localStorage; the refresh token is an
// httpOnly cookie set by the backend (path /api/auth). All auth requests use
// credentials:'include' so that cookie travels with refresh/login/logout.
const ACCESS_KEY = 'ff_access_token';

let accessToken: string | null = localStorage.getItem(ACCESS_KEY);

function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem(ACCESS_KEY, token);
  else localStorage.removeItem(ACCESS_KEY);
}

export function getAccessToken() {
  return accessToken;
}

interface AuthResponse {
  user: CurrentUser;
  accessToken: string;
  expiresAt: string;
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body || !body.success || body.data === undefined) {
    throw new Error(body?.error?.message || `Request failed (${res.status})`);
  }
  return body.data;
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
  const data = await parse<AuthResponse>(res);
  setAccessToken(data.accessToken);
  return data.user;
}

export interface RegisterPayload {
  email: string;
  password: string;
  business_name: string;
  contact_name?: string;
  phone?: string;
  customer_number?: string;
}

export async function registerCustomer(payload: RegisterPayload): Promise<CurrentUser> {
  const res = await fetch(`${API_BASE}/auth/register-customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await parse<AuthResponse>(res);
  setAccessToken(data.accessToken);
  return data.user;
}

// Exchange the refresh cookie for a fresh access token. Returns false when the
// session is gone (no/expired refresh cookie) so callers can treat as logged out.
async function refresh(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    setAccessToken(null);
    return false;
  }
  const body = (await res.json().catch(() => null)) as ApiEnvelope<{ accessToken: string }> | null;
  if (!body?.success || !body.data?.accessToken) {
    setAccessToken(null);
    return false;
  }
  setAccessToken(body.data.accessToken);
  return true;
}

// fetch wrapper that attaches the bearer token and transparently refreshes once
// on a 401 before retrying.
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init.headers || {}),
      },
    });

  let res = await doFetch();
  if (res.status === 401 && (await refresh())) {
    res = await doFetch();
  }
  return res;
}

export async function authedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(path, init);
  return parse<T>(res);
}

export async function fetchMe(): Promise<CurrentUser | null> {
  try {
    return await authedJson<CurrentUser>('/auth/me');
  } catch {
    return null;
  }
}

// Restore a session on app load: if we have no access token, try a refresh
// (the httpOnly cookie may still be valid), then load the user.
export async function restoreSession(): Promise<CurrentUser | null> {
  if (!accessToken) {
    const ok = await refresh();
    if (!ok) return null;
  }
  return fetchMe();
}

export async function logout(): Promise<void> {
  try {
    await authedFetch('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}
