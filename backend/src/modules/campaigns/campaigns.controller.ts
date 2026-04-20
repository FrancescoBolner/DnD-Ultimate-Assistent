import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../auth/auth.types';
import * as campaignsService from './campaigns.service';
import * as charactersService from '../plugins/core/characters/characters.service';

/* ── GET /api/campaigns ── */
export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const campaigns = await campaignsService.getCampaignsForUser(userId);
    res.json({ campaigns });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/campaigns ── */
export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { name, description } = req.body as { name: string; description?: string };

    if (!name?.trim()) {
      res.status(400).json({ message: 'Campaign name is required' });
      return;
    }

    const campaign = await campaignsService.createCampaign(name.trim(), description ?? '', userId);
    res.status(201).json({ campaign });
  } catch (err) {
    next(err);
  }
}

/* ── POST /api/campaigns/join ── */
export async function joinHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { invite_code } = req.body as { invite_code: string };

    if (!invite_code?.trim()) {
      res.status(400).json({ message: 'Invite code is required' });
      return;
    }

    const campaign = await campaignsService.findByInviteCode(invite_code.trim());
    if (!campaign) {
      res.status(404).json({ message: 'No campaign found with that invite code' });
      return;
    }

    if (campaign.dm_id === userId) {
      res.status(400).json({ message: 'You are already the DM of this campaign' });
      return;
    }

    const existingStatus = await campaignsService.getPlayerStatus(campaign.id, userId);

    if (existingStatus === 'banned') {
      res.status(403).json({ message: 'You are banned from this campaign' });
      return;
    }
    if (existingStatus === 'active') {
      res.status(400).json({ message: 'You are already a member of this campaign' });
      return;
    }
    if (existingStatus === 'invited') {
      res.status(409).json({ message: 'Your join request is already pending DM approval' });
      return;
    }

    await campaignsService.addPlayer(campaign.id, userId);
    res.json({ campaign, message: 'Join request sent — waiting for DM approval' });
  } catch (err) {
    next(err);
  }
}

/* ── DELETE /api/campaigns/:id/leave ── */
export async function leaveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const campaignId = parseInt(req.params['id'] as string, 10);

    await campaignsService.removePlayer(campaignId, userId);
    res.json({ message: 'Left campaign' });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/campaigns/:id/members ── */
export async function membersHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const members = await campaignsService.getMembersForCampaign(campaignId);
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/campaigns/:id/players ── */
export async function getPlayersHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const players = await campaignsService.getPlayersForCampaign(campaignId);
    res.json({ players });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/campaigns/:id/characters ── */
export async function charactersHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const characters = await charactersService.getCharactersForCampaign(campaignId);
    res.json({ characters });
  } catch (err) {
    next(err);
  }
}

/* ── PUT /api/campaigns/:id ── */
export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const campaign = await campaignsService.updateCampaign(campaignId, req.body);
    if (!campaign) { res.status(404).json({ message: 'Campaign not found' }); return; }
    res.json({ campaign });
  } catch (err) { next(err); }
}

/* ── DELETE /api/campaigns/:id ── */
export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const { confirmName } = req.body as { confirmName?: string };

    const campaign = await campaignsService.getCampaignById(campaignId);
    if (!campaign) { res.status(404).json({ message: 'Campaign not found' }); return; }

    if (!confirmName || confirmName !== campaign.name) {
      res.status(400).json({ message: 'Type the campaign name exactly to confirm deletion' });
      return;
    }

    await campaignsService.deleteCampaign(campaignId);
    res.json({ message: 'Campaign deleted' });
  } catch (err) { next(err); }
}

/* ── POST /api/campaigns/:id/characters ── */
export async function createCharacterHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const campaignId = parseInt(req.params['id'] as string, 10);

    const campaign = await campaignsService.getCampaignById(campaignId);
    if (!campaign) {
      res.status(404).json({ message: 'Campaign not found' });
      return;
    }

    const isDm = campaign.dm_id === userId;
    const isPlayer = !isDm && await campaignsService.isPlayerInCampaign(campaignId, userId);

    if (!isDm && !isPlayer) {
      res.status(403).json({ message: 'You are not a member of this campaign' });
      return;
    }

    const { name, race, class: cls, level, stats, hp_max, ac, speed, image, backstory } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: 'Character name is required' });
      return;
    }

    const character = await charactersService.createCharacter({
      // DM creates unassigned; player creates assigned to themselves
      player_id: isDm ? null : userId,
      campaign_id: campaignId,
      name: name.trim(), race, class: cls, level,
      stats, hp_max, ac, speed, image, backstory,
    });

    res.status(201).json({ character });
  } catch (err) {
    next(err);
  }
}

/* ── DELETE /api/campaigns/:id/members/:userId ── */
export async function kickPlayerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const targetUserId = parseInt(req.params['userId'] as string, 10);

    const campaign = await campaignsService.getCampaignById(campaignId);
    if (!campaign) { res.status(404).json({ message: 'Campaign not found' }); return; }

    if (campaign.dm_id === targetUserId) {
      res.status(400).json({ message: 'Cannot kick the DM' });
      return;
    }

    const isMember = await campaignsService.isPlayerInCampaign(campaignId, targetUserId);
    if (!isMember) {
      res.status(404).json({ message: 'Player not found in this campaign' });
      return;
    }

    await campaignsService.kickPlayer(campaignId, targetUserId);
    res.json({ message: 'Player kicked' });
  } catch (err) { next(err); }
}

/* ── POST /api/campaigns/:id/members/:userId/ban ── */
export async function banPlayerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const targetUserId = parseInt(req.params['userId'] as string, 10);

    const campaign = await campaignsService.getCampaignById(campaignId);
    if (!campaign) { res.status(404).json({ message: 'Campaign not found' }); return; }

    if (campaign.dm_id === targetUserId) {
      res.status(400).json({ message: 'Cannot ban the DM' });
      return;
    }

    await campaignsService.banPlayer(campaignId, targetUserId);
    res.json({ message: 'Player banned' });
  } catch (err) { next(err); }
}

/* ── POST /api/campaigns/:id/members/:userId/accept ── */
export async function acceptPlayerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const targetUserId = parseInt(req.params['userId'] as string, 10);
    await campaignsService.acceptPlayer(campaignId, targetUserId);
    res.json({ message: 'Player accepted' });
  } catch (err) { next(err); }
}

/* ── DELETE /api/campaigns/:id/members/:userId/reject ── */
export async function rejectPlayerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const targetUserId = parseInt(req.params['userId'] as string, 10);
    await campaignsService.rejectPlayer(campaignId, targetUserId);
    res.json({ message: 'Player rejected' });
  } catch (err) { next(err); }
}

/* ── POST /api/campaigns/:id/members/:userId/unban ── */
export async function unbanPlayerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const targetUserId = parseInt(req.params['userId'] as string, 10);
    await campaignsService.unbanPlayer(campaignId, targetUserId);
    res.json({ message: 'Player unbanned' });
  } catch (err) { next(err); }
}

/* ── DELETE /api/campaigns/:id/members/:userId/entry ── */
export async function deletePlayerEntryHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const targetUserId = parseInt(req.params['userId'] as string, 10);
    await campaignsService.deletePlayerEntry(campaignId, targetUserId);
    res.json({ message: 'Player entry removed' });
  } catch (err) { next(err); }
}

/* ── POST /api/campaigns/:id/members/:userId/reinvite ── */
export async function reinvitePlayerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const targetUserId = parseInt(req.params['userId'] as string, 10);
    await campaignsService.reinvitePlayer(campaignId, targetUserId);
    res.json({ message: 'Player re-invited' });
  } catch (err) { next(err); }
}

/* ── POST /api/campaigns/:id/invite-code ── */
export async function regenerateInviteCodeHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['id'] as string, 10);
    const inviteCode = await campaignsService.regenerateInviteCode(campaignId);
    res.json({ inviteCode });
  } catch (err) { next(err); }
}

/* ── POST /api/campaigns/:id/transfer ── */
export async function transferOwnershipHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const campaignId = parseInt(req.params['id'] as string, 10);
    const { newDmId } = req.body as { newDmId?: number };

    if (!newDmId) {
      res.status(400).json({ message: 'newDmId is required' });
      return;
    }

    if (newDmId === userId) {
      res.status(400).json({ message: 'You are already the DM' });
      return;
    }

    // Verify new DM is a member of the campaign
    const isMember = await campaignsService.isPlayerInCampaign(campaignId, newDmId);
    if (!isMember) {
      res.status(400).json({ message: 'Target user is not a member of this campaign' });
      return;
    }

    await campaignsService.transferOwnership(campaignId, userId, newDmId);
    res.json({ message: 'Ownership transferred' });
  } catch (err) { next(err); }
}
