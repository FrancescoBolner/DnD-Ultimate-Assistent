import { Response, NextFunction } from 'express';
import type { AppRequest } from '../../../../core/types/express';
import * as svc from './combat.service';
import { emitCombatUpdated } from '../../../../realtime/socket';

export async function listHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const combats = await svc.listByCampaign(campaignId);
    res.json({ combats });
  } catch (err) { next(err); }
}

export async function activeHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const combat = await svc.getActiveCombat(campaignId);
    res.json({ combat });
  } catch (err) { next(err); }
}

export async function getHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const combat = await svc.getById(id);
    if (!combat) { res.status(404).json({ message: 'Combat not found' }); return; }
    res.json({ combat });
  } catch (err) { next(err); }
}

export async function createHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const combat = await svc.createCombat(campaignId, req.body.name);
    emitCombatUpdated(campaignId);
    res.status(201).json({ combat });
  } catch (err) { next(err); }
}

export async function startHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const result = await svc.startCombat(campaignId, req.body ?? { participants: [] });
    emitCombatUpdated(campaignId);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

export async function nextTurnHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const combatId = parseInt(req.params['id'] as string, 10);
    const result = await svc.advanceTurn(combatId);
    const campaignId = req.campaignId;
    if (campaignId) emitCombatUpdated(campaignId);
    res.json(result);
  } catch (err) { next(err); }
}

export async function updateHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const combat = await svc.updateCombat(id, req.body);
    if (!combat) { res.status(404).json({ message: 'Combat not found' }); return; }
    if (combat.campaign_id) emitCombatUpdated(combat.campaign_id);
    res.json({ combat });
  } catch (err) { next(err); }
}

export async function deleteHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const combat = await svc.getById(id);
    await svc.deleteCombat(id);
    if (combat?.campaign_id) emitCombatUpdated(combat.campaign_id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

export async function participantsHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const combatId = parseInt(req.params['id'] as string, 10);
    const participants = await svc.getParticipants(combatId);
    res.json({ participants });
  } catch (err) { next(err); }
}

export async function addParticipantHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const combatId = parseInt(req.params['id'] as string, 10);
    const participant = await svc.addParticipant(combatId, req.body);
    if (req.campaignId) emitCombatUpdated(req.campaignId);
    res.status(201).json({ participant });
  } catch (err) { next(err); }
}

export async function updateParticipantHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const participantId = parseInt(req.params['participantId'] as string, 10);
    await svc.updateParticipant(participantId, req.body);
    if (req.campaignId) emitCombatUpdated(req.campaignId);
    res.json({ message: 'Updated' });
  } catch (err) { next(err); }
}

export async function removeParticipantHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const participantId = parseInt(req.params['participantId'] as string, 10);
    await svc.removeParticipant(participantId);
    if (req.campaignId) emitCombatUpdated(req.campaignId);
    res.json({ message: 'Removed' });
  } catch (err) { next(err); }
}

export async function applyEffectHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const participantId = parseInt(req.params['participantId'] as string, 10);
    const participant = await svc.applyEffectToParticipant(participantId, req.body);
    if (req.campaignId) emitCombatUpdated(req.campaignId);
    res.json({ participant });
  } catch (err) { next(err); }
}

export async function updateEffectHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const participantId = parseInt(req.params['participantId'] as string, 10);
    const effectId = String(req.params['effectId'] ?? '');
    const turns = Number(req.body?.turns_left ?? 0);
    const participant = await svc.updateParticipantEffectTurns(participantId, effectId, turns);
    if (req.campaignId) emitCombatUpdated(req.campaignId);
    res.json({ participant });
  } catch (err) { next(err); }
}

export async function removeEffectHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const participantId = parseInt(req.params['participantId'] as string, 10);
    const effectId = String(req.params['effectId'] ?? '');
    const participant = await svc.removeParticipantEffect(participantId, effectId);
    if (req.campaignId) emitCombatUpdated(req.campaignId);
    res.json({ participant });
  } catch (err) { next(err); }
}
