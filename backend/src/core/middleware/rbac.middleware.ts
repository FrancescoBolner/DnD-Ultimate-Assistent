import { Response, NextFunction } from 'express';
import { pool } from '../../config/db';
import { RowDataPacket } from 'mysql2';
import type { AppRequest } from '../types/express';

/* ══════════════════════════════════════════════════════════════
   RBAC Middleware
   
   These middleware functions MUST run AFTER requireAuth
   (which attaches req.user).
   ══════════════════════════════════════════════════════════════ */

/**
 * Require the current user to be a platform admin (users.is_admin = TRUE).
 */
export function requireAdmin(req: AppRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  // We need to check the DB since is_admin is not in the JWT payload
  pool.execute<RowDataPacket[]>(
    'SELECT is_admin FROM users WHERE id = ? AND is_active = TRUE',
    [req.user.userId],
  ).then(([rows]) => {
    if (!rows[0] || !rows[0].is_admin) {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }
    next();
  }).catch(next);
}

/**
 * Resolve campaign membership from a route parameter.
 *
 * Looks for `:campaignId` or `:id` in req.params.
 * Sets req.campaignId and req.campaignRole ('dm' | 'player').
 *
 * @param requiredRole  If set, only that role passes (e.g., 'dm').
 * @param paramName     The route param that holds the campaign ID (default: tries 'campaignId' then 'id').
 */
export function requireCampaignMember(requiredRole?: 'dm' | 'player', paramName?: string) {
  return async (req: AppRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const campaignId = parseCampaignIdFromParams(req, paramName);
    if (!campaignId) {
      res.status(400).json({ message: 'Campaign ID is required' });
      return;
    }

    try {
      const role = await resolveCampaignRole(req.user.userId, campaignId);
      if (!role) {
        res.status(403).json({ message: 'You are not a member of this campaign' });
        return;
      }

      if (requiredRole && role !== requiredRole) {
        res.status(403).json({ message: `This action requires the ${requiredRole.toUpperCase()} role` });
        return;
      }

      req.campaignId = campaignId;
      req.campaignRole = role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Shorthand: require DM role. Equivalent to requireCampaignMember('dm').
 */
export function requireDm(paramName?: string) {
  return requireCampaignMember('dm', paramName);
}

/**
 * For entity-level routes (e.g., PUT /api/creatures/:id):
 * Looks up the entity by ID, resolves its campaign_id, then
 * checks campaign membership.
 *
 * @param tableName   The database table to look up (e.g., 'creatures')
 * @param paramName   The route param that holds the entity ID (default: 'id')
 * @param requiredRole  If set, only that role passes.
 */
export function requireCampaignScope(
  tableName: string,
  requiredRole?: 'dm' | 'player',
  paramName = 'id',
) {
  return async (req: AppRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const entityId = parseInt(req.params[paramName] as string, 10);
    if (isNaN(entityId)) {
      res.status(400).json({ message: 'Valid entity ID is required' });
      return;
    }

    try {
      // Look up entity's campaign_id
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT campaign_id FROM \`${tableName}\` WHERE id = ?`,
        [entityId],
      );

      if (!rows[0]) {
        res.status(404).json({ message: 'Entity not found' });
        return;
      }

      const campaignId = rows[0].campaign_id as number | null;

      // If entity has no campaign (e.g. global/system effects), allow any authenticated user
      if (campaignId === null || campaignId === undefined) {
        next();
        return;
      }

      // Check membership
      const role = await resolveCampaignRole(req.user.userId, campaignId);
      if (!role) {
        res.status(403).json({ message: 'You are not a member of this campaign' });
        return;
      }

      if (requiredRole && role !== requiredRole) {
        res.status(403).json({ message: `This action requires the ${requiredRole.toUpperCase()} role` });
        return;
      }

      req.campaignId = campaignId;
      req.campaignRole = role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/* ══════════════════════════════════════════════════════════════
   Internal helpers
   ══════════════════════════════════════════════════════════════ */

/**
 * Resolve campaign role for a user:
 * - 'dm' if campaigns.dm_id = userId
 * - 'player' if active in campaign_players
 * - null if not a member
 */
async function resolveCampaignRole(
  userId: number,
  campaignId: number,
): Promise<'dm' | 'player' | null> {
  // Check if DM
  const [dmRows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM campaigns WHERE id = ? AND dm_id = ?',
    [campaignId, userId],
  );
  if (dmRows.length > 0) return 'dm';

  // Check if active player
  const [playerRows] = await pool.execute<RowDataPacket[]>(
    "SELECT 1 FROM campaign_players WHERE campaign_id = ? AND user_id = ? AND status = 'active'",
    [campaignId, userId],
  );
  if (playerRows.length > 0) return 'player';

  return null;
}

/**
 * Extract campaign ID from route params, trying multiple param names.
 */
function parseCampaignIdFromParams(req: AppRequest, paramName?: string): number | null {
  const raw = paramName
    ? req.params[paramName]
    : (req.params['campaignId'] ?? req.params['id']);

  if (!raw) return null;

  const id = parseInt(raw as string, 10);
  return isNaN(id) ? null : id;
}
