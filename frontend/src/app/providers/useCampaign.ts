import { useContext } from 'react';
import { CampaignContext, type CampaignState } from './CampaignContext';

export function useCampaign(): CampaignState {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used within CampaignProvider');
  return ctx;
}

export type { CampaignState };
