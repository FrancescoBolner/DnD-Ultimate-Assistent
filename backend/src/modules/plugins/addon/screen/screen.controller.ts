import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../auth/auth.types';
import * as svc from './screen.service';
import { emitScreenUpdated } from '../../../../realtime/socket';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const screens = await svc.listByCampaign(campaignId);
    res.json({ screens });
  } catch (err) { next(err); }
}

export async function activeHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const screen = await svc.getActive(campaignId);
    if (!screen) { res.json({ screen: null }); return; }
    res.json({ screen });
  } catch (err) { next(err); }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const screen = await svc.getById(id);
    if (!screen) { res.status(404).json({ message: 'Screen not found' }); return; }
    res.json({ screen });
  } catch (err) { next(err); }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const screen = await svc.create({ ...req.body, campaign_id: campaignId });
    res.status(201).json({ screen });
  } catch (err) { next(err); }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const screen = await svc.update(id, req.body);
    if (!screen) { res.status(404).json({ message: 'Screen not found' }); return; }
    res.json({ screen });
  } catch (err) { next(err); }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await svc.remove(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

export async function pushHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const layout = req.body.layout ?? {};
    const screen = await svc.upsertActive(campaignId, layout as Record<string, unknown>);
    emitScreenUpdated(campaignId, screen.layout ?? {});
    res.json({ screen });
  } catch (err) { next(err); }
}

export async function stopHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    await svc.deactivateAll(campaignId);
    emitScreenUpdated(campaignId, null);
    res.json({ message: 'Screen stopped' });
  } catch (err) { next(err); }
}

export async function listPresetsHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const presets = await svc.listPresets(campaignId);
    res.json({ presets });
  } catch (err) { next(err); }
}

export async function savePresetHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const { name, layout } = req.body;
    const preset = await svc.createPreset(campaignId, name ?? 'New Screen', layout ?? {});
    res.status(201).json({ preset });
  } catch (err) { next(err); }
}

export async function updatePresetHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['presetId'] as string, 10);
    const preset = await svc.updatePreset(id, req.body);
    if (!preset) { res.status(404).json({ message: 'Preset not found' }); return; }
    res.json({ preset });
  } catch (err) { next(err); }
}

export async function deletePresetHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['presetId'] as string, 10);
    await svc.deletePreset(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
