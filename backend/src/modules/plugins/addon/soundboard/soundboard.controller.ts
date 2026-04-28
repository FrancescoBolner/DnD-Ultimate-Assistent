import { Response, NextFunction } from 'express';
import type { AppRequest } from '../../../../core/types/express';
import * as svc from './soundboard.service';
import { emitSoundboardUpdated } from '../../../../realtime/socket';

/** GET /api/soundboard/campaign/:campaignId */
export async function listHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const sounds = await svc.listByCampaign(campaignId);
    res.json({ sounds });
  } catch (err) { next(err); }
}

/** POST /api/soundboard/campaign/:campaignId */
export async function createHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const { name, url, icon, volume } = req.body as {
      name: string;
      url: string;
      icon?: string | null;
      volume?: number;
    };

    if (!name || !url) {
      res.status(400).json({ message: 'name and url are required' });
      return;
    }

    const sound = await svc.createSound(campaignId, { name, url, icon, volume });
    emitSoundboardUpdated(campaignId);
    res.status(201).json({ sound });
  } catch (err) { next(err); }
}

/** PUT /api/soundboard/:id */
export async function updateHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const existing = await svc.getById(id);
    if (!existing) { res.status(404).json({ message: 'Sound not found' }); return; }

    const sound = await svc.updateSound(id, req.body);
    if (existing.campaign_id) emitSoundboardUpdated(existing.campaign_id);
    res.json({ sound });
  } catch (err) { next(err); }
}

/** DELETE /api/soundboard/:id */
export async function deleteHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const existing = await svc.getById(id);
    if (!existing) { res.status(404).json({ message: 'Sound not found' }); return; }

    await svc.deleteSound(id);
    emitSoundboardUpdated(existing.campaign_id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
