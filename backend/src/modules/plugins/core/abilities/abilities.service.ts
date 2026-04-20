import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface AbilityRow {
  id: number;
  campaign_id: number;
  owner_char_id: number | null;
  owner_creature_id: number | null;
  name: string;
  description: string | null;
  action_type: 'action' | 'bonus' | 'reaction' | 'passive' | 'legendary' | 'free';
  damage: string | null;
  damage_type: string | null;
  hit_bonus: number | null;
  range: string | null;
  cooldown: string | null;
  uses_max: number | null;
  uses_current: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function listByCampaign(campaignId: number): Promise<AbilityRow[]> {
  const [rows] = await pool.execute<(AbilityRow & RowDataPacket)[]>(
    'SELECT * FROM abilities WHERE campaign_id = ? ORDER BY name',
    [campaignId],
  );
  return rows;
}

export async function listByOwner(type: 'char' | 'creature', ownerId: number): Promise<AbilityRow[]> {
  const col = type === 'char' ? 'owner_char_id' : 'owner_creature_id';
  const [rows] = await pool.execute<(AbilityRow & RowDataPacket)[]>(
    `SELECT * FROM abilities WHERE ${col} = ? ORDER BY name`,
    [ownerId],
  );
  return rows;
}

export async function getById(id: number): Promise<AbilityRow | null> {
  const [rows] = await pool.execute<(AbilityRow & RowDataPacket)[]>(
    'SELECT * FROM abilities WHERE id = ?', [id],
  );
  return rows[0] ?? null;
}

export interface AbilityCreateData {
  campaign_id: number;
  owner_char_id?: number | null;
  owner_creature_id?: number | null;
  name: string;
  description?: string;
  action_type?: string;
  damage?: string;
  damage_type?: string;
  hit_bonus?: number;
  range?: string;
  cooldown?: string;
  uses_max?: number;
  uses_current?: number;
  notes?: string;
}

export async function create(data: AbilityCreateData): Promise<AbilityRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO abilities
       (campaign_id, owner_char_id, owner_creature_id, name, description,
        action_type, damage, damage_type, hit_bonus, \`range\`, cooldown,
        uses_max, uses_current, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.campaign_id,
      data.owner_char_id ?? null, data.owner_creature_id ?? null,
      data.name, data.description ?? null,
      data.action_type ?? 'action',
      data.damage ?? null, data.damage_type ?? null,
      data.hit_bonus ?? null, data.range ?? null, data.cooldown ?? null,
      data.uses_max ?? null, data.uses_current ?? null,
      data.notes ?? null,
    ],
  );
  return (await getById(result.insertId))!;
}

export async function update(id: number, data: Partial<AbilityCreateData>): Promise<AbilityRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)        { fields.push('name = ?');        values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description || null); }
  if (data.action_type !== undefined) { fields.push('action_type = ?'); values.push(data.action_type); }
  if (data.damage !== undefined)      { fields.push('damage = ?');      values.push(data.damage || null); }
  if (data.damage_type !== undefined) { fields.push('damage_type = ?'); values.push(data.damage_type || null); }
  if (data.hit_bonus !== undefined)   { fields.push('hit_bonus = ?');   values.push(data.hit_bonus); }
  if (data.range !== undefined)       { fields.push('`range` = ?');     values.push(data.range || null); }
  if (data.cooldown !== undefined)    { fields.push('cooldown = ?');    values.push(data.cooldown || null); }
  if (data.uses_max !== undefined)    { fields.push('uses_max = ?');    values.push(data.uses_max); }
  if (data.uses_current !== undefined){ fields.push('uses_current = ?');values.push(data.uses_current); }
  if (data.notes !== undefined)       { fields.push('notes = ?');       values.push(data.notes || null); }
  if (data.owner_char_id !== undefined)     { fields.push('owner_char_id = ?');     values.push(data.owner_char_id ?? null); }
  if (data.owner_creature_id !== undefined) { fields.push('owner_creature_id = ?'); values.push(data.owner_creature_id ?? null); }

  if (fields.length === 0) return getById(id);
  values.push(id);
  await pool.execute(`UPDATE abilities SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  return getById(id);
}

export async function remove(id: number): Promise<void> {
  await pool.execute('DELETE FROM abilities WHERE id = ?', [id]);
}
