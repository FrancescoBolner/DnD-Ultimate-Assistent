import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ScreenRow {
  id: number;
  campaign_id: number;
  name: string;
  target: 'dm' | 'player';
  layout: Record<string, unknown> | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function listByCampaign(campaignId: number): Promise<ScreenRow[]> {
  const [rows] = await pool.execute<(ScreenRow & RowDataPacket)[]>(
    'SELECT * FROM screen WHERE campaign_id = ? ORDER BY name', [campaignId],
  );
  return rows;
}

export async function getById(id: number): Promise<ScreenRow | null> {
  const [rows] = await pool.execute<(ScreenRow & RowDataPacket)[]>(
    'SELECT * FROM screen WHERE id = ?', [id],
  );
  return rows[0] ?? null;
}

export interface ScreenCreateData {
  campaign_id: number;
  name?: string;
  target?: 'dm' | 'player';
  layout?: Record<string, unknown>;
  is_active?: boolean;
}

export async function create(data: ScreenCreateData): Promise<ScreenRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO screen (campaign_id, name, target, layout, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.campaign_id, data.name ?? 'Screen',
      data.target ?? 'dm',
      data.layout ? JSON.stringify(data.layout) : null,
      data.is_active ?? false,
    ],
  );
  return (await getById(result.insertId))!;
}

export async function update(id: number, data: Partial<ScreenCreateData>): Promise<ScreenRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)      { fields.push('name = ?');      values.push(data.name); }
  if (data.target !== undefined)    { fields.push('target = ?');    values.push(data.target); }
  if (data.layout !== undefined)    { fields.push('layout = ?');    values.push(JSON.stringify(data.layout)); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }

  if (fields.length === 0) return getById(id);
  values.push(id);
  await pool.execute(`UPDATE screen SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  return getById(id);
}

export async function remove(id: number): Promise<void> {
  await pool.execute('DELETE FROM screen WHERE id = ?', [id]);
}

export async function getActive(campaignId: number): Promise<ScreenRow | null> {
  const [rows] = await pool.execute<(ScreenRow & RowDataPacket)[]>(
    'SELECT * FROM screen WHERE campaign_id = ? AND is_active = TRUE LIMIT 1',
    [campaignId],
  );
  return rows[0] ?? null;
}

export async function deactivateAll(campaignId: number): Promise<void> {
  await pool.execute('UPDATE screen SET is_active = FALSE WHERE campaign_id = ?', [campaignId]);
}

export async function upsertActive(
  campaignId: number,
  layout: Record<string, unknown>,
): Promise<ScreenRow> {
  const existing = await getActive(campaignId);
  if (existing) {
    return (await update(existing.id, { layout, is_active: true }))!;
  }
  return create({ campaign_id: campaignId, name: 'Main Screen', target: 'player', layout, is_active: true });
}

// ─── Screen Presets ────────────────────────────────────────────────────────

export interface ScreenPresetRow {
  id: number;
  campaign_id: number;
  name: string;
  layout: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export async function listPresets(campaignId: number): Promise<ScreenPresetRow[]> {
  const [rows] = await pool.execute<(ScreenPresetRow & RowDataPacket)[]>(
    'SELECT * FROM screen_presets WHERE campaign_id = ? ORDER BY updated_at DESC', [campaignId],
  );
  return rows;
}

export async function getPresetById(id: number): Promise<ScreenPresetRow | null> {
  const [rows] = await pool.execute<(ScreenPresetRow & RowDataPacket)[]>(
    'SELECT * FROM screen_presets WHERE id = ?', [id],
  );
  return rows[0] ?? null;
}

export async function createPreset(
  campaignId: number, name: string, layout: Record<string, unknown>,
): Promise<ScreenPresetRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO screen_presets (campaign_id, name, layout) VALUES (?, ?, ?)',
    [campaignId, name, JSON.stringify(layout)],
  );
  return (await getPresetById(result.insertId))!;
}

export async function updatePreset(
  id: number, data: { name?: string; layout?: Record<string, unknown> },
): Promise<ScreenPresetRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name   !== undefined) { fields.push('name = ?');   values.push(data.name); }
  if (data.layout !== undefined) { fields.push('layout = ?'); values.push(JSON.stringify(data.layout)); }
  if (fields.length === 0) return getPresetById(id);
  values.push(id);
  await pool.execute(`UPDATE screen_presets SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  return getPresetById(id);
}

export async function deletePreset(id: number): Promise<void> {
  await pool.execute('DELETE FROM screen_presets WHERE id = ?', [id]);
}
