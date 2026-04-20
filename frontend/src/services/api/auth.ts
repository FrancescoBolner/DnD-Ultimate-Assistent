import { api, setAccessToken } from './client';
import type { User } from '../../shared/types';

/* ── Response shapes ── */
interface AuthResponse {
  user: User;
  accessToken: string;
}

interface MeResponse {
  user: User;
}

/* ── Public API ── */

export async function login(identifier: string, password: string): Promise<User> {
  const data = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password },
    noAuth: true,
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function register(
  email: string,
  username: string,
  password: string,
): Promise<User> {
  const data = await api<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, username, password },
    noAuth: true,
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function refreshSession(): Promise<User | null> {
  try {
    const data = await api<AuthResponse>('/auth/refresh', {
      method: 'POST',
      noAuth: true,
    });
    setAccessToken(data.accessToken);
    return data.user;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function getMe(): Promise<User> {
  const data = await api<MeResponse>('/auth/me');
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}
