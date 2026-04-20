import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../auth/auth.types';
import * as svc from './creatures.service';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const creatures = await svc.listByCampaign(campaignId);
    res.json({ creatures });
  } catch (err) { next(err); }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const creature = await svc.getById(id);
    if (!creature) { res.status(404).json({ message: 'Creature not found' }); return; }
    res.json({ creature });
  } catch (err) { next(err); }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const { name, type, cr, size, stats, hp_max, ac, speed, image, sheet_image, notes, tags, race, religion } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: 'Name is required' }); return; }
    const creature = await svc.create({ campaign_id: campaignId, name: name.trim(), type, cr, size, stats, hp_max, ac, speed, image, sheet_image, notes, tags, race, religion });
    res.status(201).json({ creature });
  } catch (err) { next(err); }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const creature = await svc.update(id, req.body);
    if (!creature) { res.status(404).json({ message: 'Creature not found' }); return; }
    res.json({ creature });
  } catch (err) { next(err); }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await svc.remove(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
