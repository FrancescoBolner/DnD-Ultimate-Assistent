import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../auth/auth.types';
import * as svc from './effects.service';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const effects = await svc.listByCampaign(campaignId);
    res.json({ effects });
  } catch (err) { next(err); }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const effect = await svc.getById(id);
    if (!effect) { res.status(404).json({ message: 'Effect not found' }); return; }
    res.json({ effect });
  } catch (err) { next(err); }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const { name, ...rest } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: 'Name is required' }); return; }
    const effect = await svc.create({ ...rest, campaign_id: campaignId, name: name.trim() });
    res.status(201).json({ effect });
  } catch (err) { next(err); }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const effect = await svc.update(id, req.body);
    if (!effect) { res.status(404).json({ message: 'Effect not found' }); return; }
    res.json({ effect });
  } catch (err) { next(err); }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await svc.remove(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
