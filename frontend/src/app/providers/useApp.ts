import { useAuth, type AuthState } from './useAuth';
import { useCampaign, type CampaignState } from './useCampaign';
import { useUI, type UIState } from './useUI';

/**
 * Backward-compatible hook that merges all three contexts.
 * Prefer the focused hooks (useAuth, useCampaign, useUI) in new code.
 */
export type AppState = AuthState & CampaignState & UIState;

export function useApp(): AppState {
  const auth = useAuth();
  const campaign = useCampaign();
  const ui = useUI();
  return { ...auth, ...campaign, ...ui };
}

export type { AuthState, CampaignState, UIState };
