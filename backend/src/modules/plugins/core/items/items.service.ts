import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ItemRow {
  id: number;
  campaign_id: number;
  owner_char_id: number | null;
  owner_creature_id: number | null;
  name: string;
  description: string | null;
  type: string;
  rarity: string | null;
  quantity: number;
  weight: number | null;
  value: string | null;
  properties: Record<string, unknown> | null;
  is_equipped: boolean;
  is_attuned: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function listByCampaign(campaignId: number): Promise<ItemRow[]> {
  const [rows] = await pool.execute<(ItemRow & RowDataPacket)[]>(
    'SELECT * FROM items WHERE campaign_id = ? ORDER BY name',
    [campaignId],
  );
  return rows;
}

export async function getById(id: number): Promise<ItemRow | null> {
  const [rows] = await pool.execute<(ItemRow & RowDataPacket)[]>(
    'SELECT * FROM items WHERE id = ?', [id],
  );
  return rows[0] ?? null;
}

export interface ItemCreateData {
  campaign_id: number;
  owner_char_id?: number | null;
  owner_creature_id?: number | null;
  name: string;
  description?: string;
  type?: string;
  rarity?: string;
  quantity?: number;
  weight?: number;
  value?: string;
  properties?: Record<string, unknown>;
  is_equipped?: boolean;
  is_attuned?: boolean;
  notes?: string;
}

export async function create(data: ItemCreateData): Promise<ItemRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO items
       (campaign_id, owner_char_id, owner_creature_id, name, description,
        type, rarity, quantity, weight, value, properties, is_equipped, is_attuned, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.campaign_id,
      data.owner_char_id ?? null, data.owner_creature_id ?? null,
      data.name, data.description ?? null,
      data.type ?? 'other', data.rarity ?? null,
      data.quantity ?? 1, data.weight ?? null, data.value ?? null,
      data.properties ? JSON.stringify(data.properties) : null,
      data.is_equipped ?? false, data.is_attuned ?? false,
      data.notes ?? null,
    ],
  );
  return (await getById(result.insertId))!;
}

export async function update(id: number, data: Partial<ItemCreateData>): Promise<ItemRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)           { fields.push('name = ?');           values.push(data.name); }
  if (data.description !== undefined)    { fields.push('description = ?');    values.push(data.description || null); }
  if (data.type !== undefined)           { fields.push('type = ?');           values.push(data.type); }
  if (data.rarity !== undefined)         { fields.push('rarity = ?');         values.push(data.rarity || null); }
  if (data.quantity !== undefined)       { fields.push('quantity = ?');       values.push(data.quantity); }
  if (data.weight !== undefined)         { fields.push('weight = ?');        values.push(data.weight); }
  if (data.value !== undefined)          { fields.push('value = ?');          values.push(data.value || null); }
  if (data.properties !== undefined)     { fields.push('properties = ?');     values.push(JSON.stringify(data.properties)); }
  if (data.is_equipped !== undefined)    { fields.push('is_equipped = ?');    values.push(data.is_equipped); }
  if (data.is_attuned !== undefined)     { fields.push('is_attuned = ?');     values.push(data.is_attuned); }
  if (data.notes !== undefined)          { fields.push('notes = ?');          values.push(data.notes || null); }
  if (data.owner_char_id !== undefined)  { fields.push('owner_char_id = ?');  values.push(data.owner_char_id ?? null); }
  if (data.owner_creature_id !== undefined) { fields.push('owner_creature_id = ?'); values.push(data.owner_creature_id ?? null); }

  if (fields.length === 0) return getById(id);
  values.push(id);
  await pool.execute(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  return getById(id);
}

export async function remove(id: number): Promise<void> {
  await pool.execute('DELETE FROM items WHERE id = ?', [id]);
}
