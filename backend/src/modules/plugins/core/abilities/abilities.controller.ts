import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../auth/auth.types';
import * as svc from './abilities.service';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const abilities = await svc.listByCampaign(campaignId);
    res.json({ abilities });
  } catch (err) { next(err); }
}

export async function listByOwnerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const type = (req.params['ownerType'] as string) as 'char' | 'creature';
    const ownerId = parseInt(req.params['ownerId'] as string, 10);
    const abilities = await svc.listByOwner(type, ownerId);
    res.json({ abilities });
  } catch (err) { next(err); }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const ability = await svc.getById(id);
    if (!ability) { res.status(404).json({ message: 'Ability not found' }); return; }
    res.json({ ability });
  } catch (err) { next(err); }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const { name, ...rest } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: 'Name is required' }); return; }
    const ability = await svc.create({ ...rest, campaign_id: campaignId, name: name.trim() });
    res.status(201).json({ ability });
  } catch (err) { next(err); }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const ability = await svc.update(id, req.body);
    if (!ability) { res.status(404).json({ message: 'Ability not found' }); return; }
    res.json({ ability });
  } catch (err) { next(err); }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await svc.remove(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
