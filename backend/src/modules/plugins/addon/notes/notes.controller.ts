import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../../../auth/auth.types';
import * as svc from './notes.service';

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const userId = req.user!.userId;
    const notes = await svc.listByCampaign(campaignId, userId);
    res.json({ notes });
  } catch (err) { next(err); }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const userId = req.user!.userId;
    const note = await svc.getById(id);
    if (!note) { res.status(404).json({ message: 'Note not found' }); return; }

    // Private notes can only be viewed by their owner
    if (note.is_private && note.user_id !== userId) {
      res.status(403).json({ message: 'This note is private' });
      return;
    }

    res.json({ note });
  } catch (err) { next(err); }
}

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const userId = req.user!.userId;
    const { title, content, is_private, character_id } = req.body;
    if (!title?.trim()) { res.status(400).json({ message: 'Title is required' }); return; }
    const note = await svc.create({
      campaign_id: campaignId, user_id: userId,
      title: title.trim(), content, is_private, character_id,
    });
    res.status(201).json({ note });
  } catch (err) { next(err); }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const userId = req.user!.userId;

    const existing = await svc.getById(id);
    if (!existing) { res.status(404).json({ message: 'Note not found' }); return; }
    if (existing.user_id !== userId) {
      res.status(403).json({ message: 'You can only edit your own notes' });
      return;
    }

    const note = await svc.update(id, req.body);
    res.json({ note });
  } catch (err) { next(err); }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const userId = req.user!.userId;

    const existing = await svc.getById(id);
    if (!existing) { res.status(404).json({ message: 'Note not found' }); return; }
    if (existing.user_id !== userId) {
      res.status(403).json({ message: 'You can only delete your own notes' });
      return;
    }

    await svc.remove(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
