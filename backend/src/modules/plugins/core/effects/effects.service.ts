import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface EffectRow {
  id: number;
  campaign_id: number | null;
  name: string;
  description: string | null;
  duration: string | null;
  trigger_moment: string | null;
  damage: string | null;
  damage_type: string | null;
  save_type: string | null;
  save_dc: number | null;
  apply_on_save: 'half' | 'negate' | 'none';
  conditions: string[] | null;
  stat_modifiers: Record<string, number> | null;
  is_concentration: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function listByCampaign(campaignId: number): Promise<EffectRow[]> {
  const [rows] = await pool.execute<(EffectRow & RowDataPacket)[]>(
    'SELECT * FROM effects WHERE campaign_id = ? OR campaign_id IS NULL ORDER BY name',
    [campaignId],
  );
  return rows;
}

export async function getById(id: number): Promise<EffectRow | null> {
  const [rows] = await pool.execute<(EffectRow & RowDataPacket)[]>(
    'SELECT * FROM effects WHERE id = ?', [id],
  );
  return rows[0] ?? null;
}

export interface EffectCreateData {
  campaign_id?: number | null;
  name: string;
  description?: string;
  duration?: string;
  trigger_moment?: string;
  damage?: string;
  damage_type?: string;
  save_type?: string;
  save_dc?: number;
  apply_on_save?: string;
  conditions?: string[];
  stat_modifiers?: Record<string, number>;
  is_concentration?: boolean;
  notes?: string;
}

export async function create(data: EffectCreateData): Promise<EffectRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO effects
       (campaign_id, name, description, duration, trigger_moment,
        damage, damage_type, save_type, save_dc, apply_on_save,
        conditions, stat_modifiers, is_concentration, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.campaign_id ?? null, data.name,
      data.description ?? null, data.duration ?? null, data.trigger_moment ?? null,
      data.damage ?? null, data.damage_type ?? null,
      data.save_type ?? null, data.save_dc ?? null,
      data.apply_on_save ?? 'none',
      data.conditions ? JSON.stringify(data.conditions) : null,
      data.stat_modifiers ? JSON.stringify(data.stat_modifiers) : null,
      data.is_concentration ?? false,
      data.notes ?? null,
    ],
  );
  return (await getById(result.insertId))!;
}

export async function update(id: number, data: Partial<EffectCreateData>): Promise<EffectRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)           { fields.push('name = ?');            values.push(data.name); }
  if (data.description !== undefined)    { fields.push('description = ?');     values.push(data.description || null); }
  if (data.duration !== undefined)       { fields.push('duration = ?');        values.push(data.duration || null); }
  if (data.trigger_moment !== undefined) { fields.push('trigger_moment = ?');  values.push(data.trigger_moment || null); }
  if (data.damage !== undefined)         { fields.push('damage = ?');          values.push(data.damage || null); }
  if (data.damage_type !== undefined)    { fields.push('damage_type = ?');     values.push(data.damage_type || null); }
  if (data.save_type !== undefined)      { fields.push('save_type = ?');       values.push(data.save_type || null); }
  if (data.save_dc !== undefined)        { fields.push('save_dc = ?');         values.push(data.save_dc); }
  if (data.apply_on_save !== undefined)  { fields.push('apply_on_save = ?');   values.push(data.apply_on_save); }
  if (data.conditions !== undefined)     { fields.push('conditions = ?');      values.push(JSON.stringify(data.conditions)); }
  if (data.stat_modifiers !== undefined) { fields.push('stat_modifiers = ?');  values.push(JSON.stringify(data.stat_modifiers)); }
  if (data.is_concentration !== undefined) { fields.push('is_concentration = ?'); values.push(data.is_concentration); }
  if (data.notes !== undefined)          { fields.push('notes = ?');           values.push(data.notes || null); }

  if (fields.length === 0) return getById(id);
  values.push(id);
  await pool.execute(`UPDATE effects SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  return getById(id);
}

export async function remove(id: number): Promise<void> {
  await pool.execute('DELETE FROM effects WHERE id = ?', [id]);
}
