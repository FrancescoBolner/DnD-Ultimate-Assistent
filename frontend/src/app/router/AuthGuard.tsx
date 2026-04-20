import { Navigate } from 'react-router-dom';
import { useApp } from '../providers/useApp';
import type { ReactNode } from 'react';

/**
 * Wraps protected routes.
 * - While the session is being restored, shows a loading indicator.
 * - If no user after loading, redirects to /login.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, authLoading } = useApp();

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--color-text-muted, #888)',
      }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
