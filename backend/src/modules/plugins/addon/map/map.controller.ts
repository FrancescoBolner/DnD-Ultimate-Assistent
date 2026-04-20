import { Response, NextFunction } from 'express';
import type { AppRequest } from '../../../../core/types/express';
import { pool } from '../../../../config/db';
import { RowDataPacket } from 'mysql2';
import * as svc from './map.service';

export async function listHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const isDm = req.campaignRole === 'dm';
    const maps = await svc.listByCampaign(campaignId, { visibleOnly: !isDm });
    res.json({ maps });
  } catch (err) { next(err); }
}

export async function getHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const map = await svc.getById(id);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }
    res.json({ map });
  } catch (err) { next(err); }
}

export async function createHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const campaignId = parseInt(req.params['campaignId'] as string, 10);
    const map = await svc.create({ ...req.body, campaign_id: campaignId });
    res.status(201).json({ map });
  } catch (err) { next(err); }
}

export async function updateHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const map = await svc.update(id, req.body);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }
    res.json({ map });
  } catch (err) { next(err); }
}

export async function updateViewStateHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const map = await svc.getById(id);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }
    await svc.updateViewState(id, map.campaign_id, req.body);
    res.json({ message: 'View state updated' });
  } catch (err) { next(err); }
}

export async function deleteHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await svc.remove(id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

// -- Map Entities --

export async function listEntitiesHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const mapId = parseInt(req.params['id'] as string, 10);
    const entities = await svc.listEntities(mapId);
    res.json({ entities });
  } catch (err) { next(err); }
}

export async function createEntityHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const mapId = parseInt(req.params['id'] as string, 10);
    const map = await svc.getById(mapId);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }
    const entity = await svc.createEntity({ ...req.body, map_id: mapId }, map.campaign_id);
    res.status(201).json({ entity });
  } catch (err) { next(err); }
}

export async function updateEntityHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const mapId = parseInt(req.params['id'] as string, 10);
    const entityId = parseInt(req.params['entityId'] as string, 10);
    const map = await svc.getById(mapId);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }

    const isDm = req.campaignRole === 'dm';

    if (!isDm) {
      // Players may only update x/y of their own character token when the plugin allows it

      // 1. Check players_can_move_tokens in the map plugin config
      const [pluginRows] = await pool.execute<RowDataPacket[]>(
        `SELECT config FROM campaign_plugins WHERE campaign_id = ? AND slug = 'map' LIMIT 1`,
        [map.campaign_id],
      );
      const pluginConfig = pluginRows[0]
        ? (typeof pluginRows[0].config === 'string'
          ? JSON.parse(pluginRows[0].config)
          : pluginRows[0].config)
        : {};
      if (!pluginConfig?.players_can_move_tokens) {
        res.status(403).json({ message: 'Players are not allowed to move tokens' });
        return;
      }

      // 2. Fetch the entity and confirm it is the player's own character
      const [entRows] = await pool.execute<RowDataPacket[]>(
        `SELECT me.entity_type, me.entity_id, c.player_id
           FROM map_entities me
           LEFT JOIN characters c ON c.id = me.entity_id AND me.entity_type = 'character'
          WHERE me.id = ?`,
        [entityId],
      );
      const ent = entRows[0];
      if (!ent) { res.status(404).json({ message: 'Entity not found' }); return; }
      if (ent.entity_type !== 'character' || ent.player_id !== req.user!.userId) {
        res.status(403).json({ message: 'You can only move your own character token' });
        return;
      }

      // 3. Players may only change x and y � strip everything else
      const { x, y } = req.body as { x?: number; y?: number };
      if (x === undefined && y === undefined) {
        res.status(400).json({ message: 'No position provided' });
        return;
      }
      const entity = await svc.updateEntity(entityId, { x, y }, map.campaign_id, mapId);
      if (!entity) { res.status(404).json({ message: 'Entity not found' }); return; }
      res.json({ entity });
      return;
    }

    // DM: update anything
    const entity = await svc.updateEntity(entityId, req.body, map.campaign_id, mapId);
    if (!entity) { res.status(404).json({ message: 'Entity not found' }); return; }
    res.json({ entity });
  } catch (err) { next(err); }
}

export async function deleteEntityHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const mapId = parseInt(req.params['id'] as string, 10);
    const entityId = parseInt(req.params['entityId'] as string, 10);
    const map = await svc.getById(mapId);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }
    await svc.removeEntity(entityId, map.campaign_id, mapId);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

// -- Range Marks --

export async function listRangeMarksHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const mapId = parseInt(req.params['id'] as string, 10);
    const rangeMarks = await svc.listRangeMarks(mapId);
    res.json({ rangeMarks });
  } catch (err) { next(err); }
}

export async function createRangeMarkHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const mapId = parseInt(req.params['id'] as string, 10);
    const map = await svc.getById(mapId);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }
    const rangeMark = await svc.createRangeMark({ ...req.body, map_id: mapId }, map.campaign_id);
    res.status(201).json({ rangeMark });
  } catch (err) { next(err); }
}

export async function updateRangeMarkHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const mapId = parseInt(req.params['id'] as string, 10);
    const markId = parseInt(req.params['markId'] as string, 10);
    const map = await svc.getById(mapId);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }
    const rangeMark = await svc.updateRangeMark(markId, req.body, map.campaign_id, mapId);
    if (!rangeMark) { res.status(404).json({ message: 'Range mark not found' }); return; }
    res.json({ rangeMark });
  } catch (err) { next(err); }
}

export async function deleteRangeMarkHandler(req: AppRequest, res: Response, next: NextFunction) {
  try {
    const mapId = parseInt(req.params['id'] as string, 10);
    const markId = parseInt(req.params['markId'] as string, 10);
    const map = await svc.getById(mapId);
    if (!map) { res.status(404).json({ message: 'Map not found' }); return; }
    await svc.removeRangeMark(markId, map.campaign_id, mapId);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}
