import { Request } from 'express';
import type { TokenPayload } from '../../auth/auth.types';

/**
 * Extended Express Request that carries auth and campaign context
 * set by middleware.
 */
export interface AppRequest extends Request {
  /** Set by requireAuth middleware */
  user?: TokenPayload;

  /** Set by campaign-scoped middleware (requireCampaignMember, requireCampaignScope) */
  campaignId?: number;

  /** Role of the current user within the resolved campaign */
  campaignRole?: 'dm' | 'player';
}
