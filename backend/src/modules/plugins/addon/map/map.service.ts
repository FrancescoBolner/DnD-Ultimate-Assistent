import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { emitMapUpdated, emitMapViewState, emitMapEntitiesUpdated, emitMapRangeMarksUpdated } from '../../../../realtime/socket';

// ── Map Row ──

export interface MapRow {
  id: number;
  campaign_id: number;
  name: string;
  image: string | null;
  data: Record<string, unknown> | null;
  grid_size: number;
  is_visible: boolean;
  view_state: { originX: number; originY: number; scale: number } | null;
  created_at: Date;
  updated_at: Date;
}

export async function listByCampaign(campaignId: number, opts?: { visibleOnly?: boolean }): Promise<MapRow[]> {
  const query = opts?.visibleOnly
    ? 'SELECT * FROM map WHERE campaign_id = ? AND is_visible = 1 ORDER BY name'
    : 'SELECT * FROM map WHERE campaign_id = ? ORDER BY name';
  const [rows] = await pool.execute<(MapRow & RowDataPacket)[]>(query, [campaignId]);
  return rows.map(r => ({
    ...r,
    data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
    view_state: typeof r.view_state === 'string' ? JSON.parse(r.view_state) : r.view_state,
  }));
}

export async function getById(id: number): Promise<MapRow | null> {
  const [rows] = await pool.execute<(MapRow & RowDataPacket)[]>(
    'SELECT * FROM map WHERE id = ?', [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
    view_state: typeof r.view_state === 'string' ? JSON.parse(r.view_state) : r.view_state,
  };
}

export interface MapCreateData {
  campaign_id: number;
  name?: string;
  image?: string;
  data?: Record<string, unknown>;
  grid_size?: number;
  is_visible?: boolean;
}

export async function create(data: MapCreateData): Promise<MapRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO map (campaign_id, name, image, data, grid_size, is_visible)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.campaign_id, data.name ?? 'Map',
      data.image ?? null, data.data ? JSON.stringify(data.data) : null,
      data.grid_size ?? 50, data.is_visible ?? false,
    ],
  );
  const map = (await getById(result.insertId))!;
  emitMapUpdated(data.campaign_id);
  return map;
}

export async function update(id: number, data: Partial<MapCreateData>): Promise<MapRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)       { fields.push('name = ?');       values.push(data.name); }
  if (data.image !== undefined)      { fields.push('image = ?');      values.push(data.image || null); }
  if (data.data !== undefined)       { fields.push('data = ?');       values.push(JSON.stringify(data.data)); }
  if (data.grid_size !== undefined)  { fields.push('grid_size = ?');  values.push(data.grid_size); }
  if (data.is_visible !== undefined) { fields.push('is_visible = ?'); values.push(data.is_visible); }

  if (fields.length === 0) return getById(id);
  values.push(id);
  await pool.execute(`UPDATE map SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  const map = await getById(id);
  if (map) emitMapUpdated(map.campaign_id);
  return map;
}

export async function updateViewState(
  id: number,
  campaignId: number,
  viewState: { originX: number; originY: number; scale: number },
): Promise<void> {
  await pool.execute('UPDATE map SET view_state = ? WHERE id = ?', [JSON.stringify(viewState), id]);
  emitMapViewState(campaignId, id, viewState);
}

export async function remove(id: number): Promise<void> {
  const map = await getById(id);
  await pool.execute('DELETE FROM map WHERE id = ?', [id]);
  if (map) emitMapUpdated(map.campaign_id);
}

// ── Map Entities ──

export interface MapEntityRow {
  id: number;
  map_id: number;
  entity_type: 'character' | 'creature' | 'custom_npc' | 'custom_enemy';
  entity_id: number;
  x: number;
  y: number;
  scale: number;
  parent_path: string | null;
  label: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function listEntities(mapId: number): Promise<MapEntityRow[]> {
  const [rows] = await pool.execute<(MapEntityRow & RowDataPacket)[]>(
    'SELECT * FROM map_entities WHERE map_id = ? ORDER BY id', [mapId],
  );
  return rows;
}

export interface MapEntityCreateData {
  map_id: number;
  entity_type: 'character' | 'creature' | 'custom_npc' | 'custom_enemy';
  entity_id: number;
  x: number;
  y: number;
  scale?: number;
  parent_path?: string | null;
  label?: string | null;
}

export async function createEntity(data: MapEntityCreateData, campaignId: number): Promise<MapEntityRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO map_entities (map_id, entity_type, entity_id, x, y, scale, parent_path, label)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.map_id, data.entity_type, data.entity_id, data.x, data.y, data.scale ?? 1, data.parent_path ?? null, data.label ?? null],
  );
  const [rows] = await pool.execute<(MapEntityRow & RowDataPacket)[]>(
    'SELECT * FROM map_entities WHERE id = ?', [result.insertId],
  );
  emitMapEntitiesUpdated(campaignId, data.map_id);
  return rows[0];
}

export async function updateEntity(
  id: number,
  data: Partial<Omit<MapEntityCreateData, 'map_id' | 'entity_type' | 'entity_id'>>,
  campaignId: number,
  mapId: number,
): Promise<MapEntityRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.x !== undefined)           { fields.push('x = ?');           values.push(data.x); }
  if (data.y !== undefined)           { fields.push('y = ?');           values.push(data.y); }
  if (data.scale !== undefined)       { fields.push('scale = ?');       values.push(data.scale); }
  if (data.parent_path !== undefined) { fields.push('parent_path = ?'); values.push(data.parent_path); }
  if (data.label !== undefined)       { fields.push('label = ?');       values.push(data.label); }

  if (fields.length === 0) {
    const [rows] = await pool.execute<(MapEntityRow & RowDataPacket)[]>('SELECT * FROM map_entities WHERE id = ?', [id]);
    return rows[0] ?? null;
  }
  values.push(id);
  await pool.execute(`UPDATE map_entities SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  const [rows] = await pool.execute<(MapEntityRow & RowDataPacket)[]>('SELECT * FROM map_entities WHERE id = ?', [id]);
  emitMapEntitiesUpdated(campaignId, mapId);
  return rows[0] ?? null;
}

export async function removeEntity(id: number, campaignId: number, mapId: number): Promise<void> {
  await pool.execute('DELETE FROM map_entities WHERE id = ?', [id]);
  emitMapEntitiesUpdated(campaignId, mapId);
}

// ── Map Range Marks ──

export interface MapRangeMarkRow {
  id: number;
  map_id: number;
  shape: string;
  x: number;
  y: number;
  x2: number | null;
  y2: number | null;
  x3: number | null;
  y3: number | null;
  radius: number;
  color: string;
  parent_path: string | null;
  created_at: Date;
}

export async function listRangeMarks(mapId: number): Promise<MapRangeMarkRow[]> {
  const [rows] = await pool.execute<(MapRangeMarkRow & RowDataPacket)[]>(
    'SELECT * FROM map_range_marks WHERE map_id = ? ORDER BY id', [mapId],
  );
  return rows;
}

export interface MapRangeMarkCreateData {
  map_id: number;
  shape?: string;
  x: number;
  y: number;
  x2?: number | null;
  y2?: number | null;
  x3?: number | null;
  y3?: number | null;
  radius: number;
  color?: string;
  parent_path?: string | null;
}

export async function createRangeMark(data: MapRangeMarkCreateData, campaignId: number): Promise<MapRangeMarkRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO map_range_marks (map_id, shape, x, y, x2, y2, x3, y3, radius, color, parent_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [data.map_id, data.shape ?? 'circle', data.x, data.y, data.x2 ?? null, data.y2 ?? null, data.x3 ?? null, data.y3 ?? null, data.radius, data.color ?? '#ff5252', data.parent_path ?? null],
  );
  const [rows] = await pool.execute<(MapRangeMarkRow & RowDataPacket)[]>(
    'SELECT * FROM map_range_marks WHERE id = ?', [result.insertId],
  );
  emitMapRangeMarksUpdated(campaignId, data.map_id);
  return rows[0];
}

export async function updateRangeMark(
  id: number,
  data: { x?: number; y?: number; x2?: number | null; y2?: number | null; x3?: number | null; y3?: number | null },
  campaignId: number,
  mapId: number,
): Promise<MapRangeMarkRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.x  !== undefined) { fields.push('x = ?');  values.push(data.x); }
  if (data.y  !== undefined) { fields.push('y = ?');  values.push(data.y); }
  if (data.x2 !== undefined) { fields.push('x2 = ?'); values.push(data.x2); }
  if (data.y2 !== undefined) { fields.push('y2 = ?'); values.push(data.y2); }
  if (data.x3 !== undefined) { fields.push('x3 = ?'); values.push(data.x3); }
  if (data.y3 !== undefined) { fields.push('y3 = ?'); values.push(data.y3); }
  if (fields.length === 0) {
    const [rows] = await pool.execute<(MapRangeMarkRow & RowDataPacket)[]>('SELECT * FROM map_range_marks WHERE id = ?', [id]);
    return rows[0] ?? null;
  }
  values.push(id);
  await pool.execute(`UPDATE map_range_marks SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  const [rows] = await pool.execute<(MapRangeMarkRow & RowDataPacket)[]>('SELECT * FROM map_range_marks WHERE id = ?', [id]);
  emitMapRangeMarksUpdated(campaignId, mapId);
  return rows[0] ?? null;
}

export async function removeRangeMark(id: number, campaignId: number, mapId: number): Promise<void> {
  await pool.execute('DELETE FROM map_range_marks WHERE id = ?', [id]);
  emitMapRangeMarksUpdated(campaignId, mapId);
}
