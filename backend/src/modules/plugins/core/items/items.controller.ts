import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../auth/auth.types';
import * as svc from './items.service';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const items = await svc.listByCampaign(campaignId);
    res.json({ items });
  } catch (err) { next(err); }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const item = await svc.getById(id);
    if (!item) { res.status(404).json({ message: 'Item not found' }); return; }
    res.json({ item });
  } catch (err) { next(err); }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const { name, ...rest } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: 'Name is required' }); return; }
    const item = await svc.create({ ...rest, campaign_id: campaignId, name: name.trim() });
    res.status(201).json({ item });
  } catch (err) { next(err); }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const item = await svc.update(id, req.body);
    if (!item) { res.status(404).json({ message: 'Item not found' }); return; }
    res.json({ item });
  } catch (err) { next(err); }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await svc.remove(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
