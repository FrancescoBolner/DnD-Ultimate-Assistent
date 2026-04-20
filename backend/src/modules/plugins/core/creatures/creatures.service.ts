import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { emitCreatureUpdated } from '../../../../realtime/socket';

export interface CreatureRow {
  id: number;
  campaign_id: number;
  name: string;
  type: 'npc' | 'enemy' | 'ally' | 'beast';
  cr: string | null;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  stats: Record<string, number> | null;
  hp_max: number;
  hp_current: number;
  hp_temp: number;
  ac: number;
  speed: number;
  image: string | null;
  sheet_image: string | null;
  notes: string | null;
  tags: string[] | null;
  race: string | null;
  religion: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function listByCampaign(campaignId: number): Promise<CreatureRow[]> {
  const [rows] = await pool.execute<(CreatureRow & RowDataPacket)[]>(
    'SELECT * FROM creatures WHERE campaign_id = ? ORDER BY name',
    [campaignId],
  );
  return rows;
}

export async function getById(id: number): Promise<CreatureRow | null> {
  const [rows] = await pool.execute<(CreatureRow & RowDataPacket)[]>(
    'SELECT * FROM creatures WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export interface CreatureCreateData {
  campaign_id: number;
  name: string;
  type?: string;
  cr?: string;
  size?: string;
  stats?: Record<string, number>;
  hp_max?: number;
  hp_current?: number;
  hp_temp?: number;
  ac?: number;
  speed?: number;
  image?: string;
  sheet_image?: string;
  notes?: string;
  tags?: string[];
  race?: string;
  religion?: string;
}

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

export async function create(data: CreatureCreateData): Promise<CreatureRow> {
  const hp = data.hp_max ?? 1;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO creatures
       (campaign_id, name, type, cr, size, stats, hp_max, hp_current, ac, speed, image, sheet_image, notes, tags, race, religion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.campaign_id, data.name,
      data.type ?? 'enemy', data.cr ?? null, cap(data.size ?? 'medium'),
      data.stats ? JSON.stringify(data.stats) : null,
      hp, hp,
      data.ac ?? 10, data.speed ?? 30,
      data.image ?? null, data.sheet_image ?? null, data.notes ?? null,
      data.tags ? JSON.stringify(data.tags) : null,
      data.race ?? null, data.religion ?? null,
    ],
  );
  return (await getById(result.insertId))!;
}

export async function update(id: number, data: Partial<CreatureCreateData>): Promise<CreatureRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)  { fields.push('name = ?');  values.push(data.name); }
  if (data.type !== undefined)  { fields.push('type = ?');  values.push(data.type); }
  if (data.cr !== undefined)    { fields.push('cr = ?');    values.push(data.cr || null); }
  if (data.size !== undefined)  { fields.push('size = ?');  values.push(cap(data.size)); }
  if (data.stats !== undefined) { fields.push('stats = ?'); values.push(JSON.stringify(data.stats)); }
  if (data.hp_max !== undefined) {
    fields.push('hp_max = ?', 'hp_current = ?');
    values.push(data.hp_max, data.hp_max);
  }
  if (data.hp_current !== undefined) { fields.push('hp_current = ?'); values.push(data.hp_current); }
  if (data.hp_temp    !== undefined) { fields.push('hp_temp = ?');    values.push(data.hp_temp); }
  if (data.ac !== undefined)    { fields.push('ac = ?');    values.push(data.ac); }
  if (data.speed !== undefined) { fields.push('speed = ?'); values.push(data.speed); }
  if (data.image       !== undefined) { fields.push('image = ?');       values.push(data.image       || null); }
  if (data.sheet_image !== undefined) { fields.push('sheet_image = ?'); values.push(data.sheet_image || null); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes || null); }
  if (data.tags     !== undefined) { fields.push('tags = ?');     values.push(data.tags ? JSON.stringify(data.tags) : null); }
  if (data.race     !== undefined) { fields.push('race = ?');     values.push(data.race     || null); }
  if (data.religion !== undefined) { fields.push('religion = ?'); values.push(data.religion || null); }

  if (fields.length === 0) return getById(id);

  values.push(id);
  await pool.execute(`UPDATE creatures SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  const updated = await getById(id);
  if (updated) {
    emitCreatureUpdated(updated.campaign_id, {
      id:       updated.id,
      name:     updated.name,
      type:     updated.type,
      cr:       updated.cr ?? null,
      size:     updated.size,
      stats:    updated.stats,
      hp_max:   updated.hp_max,
      hp_current: updated.hp_current,
      hp_temp:  updated.hp_temp,
      ac:       updated.ac,
      speed:    updated.speed,
      image:       updated.image       ?? null,
      sheet_image: updated.sheet_image ?? null,
      notes:       updated.notes       ?? null,
      tags:     updated.tags,
      race:     updated.race ?? null,
      religion: updated.religion ?? null,
    });
  }
  return updated;
}

export async function remove(id: number): Promise<void> {
  await pool.execute('DELETE FROM creatures WHERE id = ?', [id]);
}
