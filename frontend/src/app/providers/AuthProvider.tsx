import { useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User } from '../../shared/types';
import * as authApi from '../../services/api/auth';
import * as usersApi from '../../services/api/users';
import * as settingsApi from '../../services/api/settings';
import { DEFAULT_USER_LAYOUT } from '../../services/api/settings';
import { useIdleLogout } from '../../shared/hooks/useIdleLogout';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(DEFAULT_USER_LAYOUT.auto_logout_minutes);

  /* ── Restore session on mount ── */
  useEffect(() => {
    authApi.refreshSession()
      .then(u => { if (u) setUser(u); })
      .finally(() => setAuthLoading(false));
  }, []);

  /* ── Load auto-logout setting when user is known ── */
  useEffect(() => {
    if (!user) return;
    settingsApi.getUserSettings()
      .then(us => setAutoLogoutMinutes(us.layout.auto_logout_minutes ?? DEFAULT_USER_LAYOUT.auto_logout_minutes))
      .catch(() => { /* keep default */ });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Auth actions ── */
  const loginUser = useCallback(async (identifier: string, password: string) => {
    setAuthError(null);
    try {
      const u = await authApi.login(identifier, password);
      setUser(u);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAuthError(msg);
      throw err;
    }
  }, []);

  const registerUser = useCallback(async (email: string, username: string, password: string) => {
    setAuthError(null);
    try {
      const u = await authApi.register(email, username, password);
      setUser(u);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setAuthError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  /* ── Auto-logout after user-configured inactivity period ── */
  const idleTimeoutMs = autoLogoutMinutes > 0 ? autoLogoutMinutes * 60 * 1000 : null;
  useIdleLogout(logout, !!user && idleTimeoutMs !== null, idleTimeoutMs ?? undefined);

  const updateProfile = useCallback(async (data: {
    username?: string; password?: string; newPassword?: string; avatar?: string;
  }) => {
    const updatedUser = await usersApi.updateProfile(data);
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, authLoading, authError,
      loginUser, registerUser, logout, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
