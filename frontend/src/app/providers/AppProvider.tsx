import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { CampaignProvider } from './CampaignProvider';
import { UIProvider } from './UIProvider';

/**
 * Composes the three focused providers.
 * Order matters: CampaignProvider uses useAuth() internally.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CampaignProvider>
        <UIProvider>
          {children}
        </UIProvider>
      </CampaignProvider>
    </AuthProvider>
  );
}