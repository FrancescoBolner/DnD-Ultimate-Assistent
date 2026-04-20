import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../auth/auth.types';
import * as charactersService from './characters.service';
import * as campaignsService from '../../../campaigns/campaigns.service';

/* ── PATCH /api/characters/:id/assign-player (DM only) ── */
export async function assignPlayerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const characterId = parseInt(req.params['id'] as string, 10);
    const { user_id } = req.body as { user_id: number | null };

    const character = await charactersService.getCharacterById(characterId);
    if (!character) {
      res.status(404).json({ message: 'Character not found' });
      return;
    }

    await charactersService.setCharacterPlayer(characterId, user_id ?? null);
    res.json({ message: 'Character player updated' });
  } catch (err) {
    next(err);
  }
}

/* ── PATCH /api/characters/:id/assign ── */
export async function assignHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const characterId = parseInt(req.params['id'] as string, 10);

    const character = await charactersService.getCharacterById(characterId);
    if (!character) {
      res.status(404).json({ message: 'Character not found' });
      return;
    }
    if (character.player_id !== null) {
      res.status(409).json({ message: 'Character is already assigned to a player' });
      return;
    }

    await charactersService.assignCharacterToPlayer(characterId, userId);
    res.json({ message: 'Character assigned' });
  } catch (err) {
    next(err);
  }
}

/* ── PUT /api/characters/:id ── */
export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const userId = req.user!.userId;

    const existing = await charactersService.getCharacterById(id);
    if (!existing) { res.status(404).json({ message: 'Character not found' }); return; }

    const campaign = await campaignsService.getCampaignById(existing.campaign_id);
    const isDm = campaign?.dm_id === userId;

    if (!isDm && existing.player_id !== userId) {
      res.status(403).json({ message: 'You can only edit your own character' });
      return;
    }

    const character = await charactersService.updateCharacter(id, req.body);
    if (!character) { res.status(404).json({ message: 'Character not found' }); return; }
    res.json({ character });
  } catch (err) { next(err); }
}

/* ── DELETE /api/characters/:id ── */
export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await charactersService.deleteCharacter(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
