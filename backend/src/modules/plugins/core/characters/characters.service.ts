import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { emitCharacterUpdated } from '../../../../realtime/socket';

/* ── Types ── */
export interface CharacterRow {
  id: number;
  player_id: number | null;
  campaign_id: number;
  name: string;
  race: string | null;
  class: string | null;
  level: number;
  stats: Record<string, number> | null;
  hp_max: number;
  hp_current: number;
  hp_temp: number;
  ac: number;
  speed: number;
  image: string | null;
  backstory: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CharacterCreateData {
  player_id?: number | null;
  campaign_id: number;
  name: string;
  race?: string;
  class?: string;
  level?: number;
  stats?: Record<string, number>;
  hp_max?: number;
  hp_current?: number;
  hp_temp?: number;
  ac?: number;
  speed?: number;
  image?: string;
  backstory?: string;
}

/* ── Queries ── */

export async function getCharactersForCampaign(campaignId: number): Promise<CharacterRow[]> {
  const [rows] = await pool.execute<(CharacterRow & RowDataPacket)[]>(
    'SELECT * FROM characters WHERE campaign_id = ? AND is_active = TRUE',
    [campaignId],
  );
  return rows;
}

export async function getCharacterById(id: number): Promise<CharacterRow | null> {
  const [rows] = await pool.execute<(CharacterRow & RowDataPacket)[]>(
    'SELECT * FROM characters WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export async function createCharacter(data: CharacterCreateData): Promise<CharacterRow> {
  const hp = data.hp_max ?? 1;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO characters
       (player_id, campaign_id, name, race, class, level, stats, hp_max, hp_current, ac, speed, image, backstory)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.player_id ?? null,
      data.campaign_id,
      data.name,
      data.race ?? null,
      data.class ?? null,
      data.level ?? 1,
      data.stats ? JSON.stringify(data.stats) : null,
      hp,
      hp,
      data.ac ?? 10,
      data.speed ?? 30,
      data.image ?? null,
      data.backstory ?? null,
    ],
  );
  const character = await getCharacterById(result.insertId);
  return character!;
}

export async function assignCharacterToPlayer(
  characterId: number,
  userId: number,
): Promise<void> {
  await pool.execute(
    'UPDATE characters SET player_id = ? WHERE id = ?',
    [userId, characterId],
  );
}

export async function setCharacterPlayer(
  characterId: number,
  userId: number | null,
): Promise<void> {
  await pool.execute(
    'UPDATE characters SET player_id = ? WHERE id = ?',
    [userId, characterId],
  );
}

export async function updateCharacter(id: number, data: Partial<CharacterCreateData>): Promise<CharacterRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)      { fields.push('name = ?');      values.push(data.name); }
  if (data.race !== undefined)      { fields.push('race = ?');      values.push(data.race || null); }
  if (data.class !== undefined)     { fields.push('class = ?');     values.push(data.class || null); }
  if (data.level !== undefined)     { fields.push('level = ?');     values.push(data.level); }
  if (data.stats !== undefined)     { fields.push('stats = ?');     values.push(JSON.stringify(data.stats)); }
  if (data.hp_max !== undefined)     { fields.push('hp_max = ?');     values.push(data.hp_max); }
  if (data.hp_current !== undefined)  { fields.push('hp_current = ?'); values.push(data.hp_current); }
  if (data.hp_temp !== undefined)     { fields.push('hp_temp = ?');    values.push(data.hp_temp); }
  if (data.ac !== undefined)        { fields.push('ac = ?');        values.push(data.ac); }
  if (data.speed !== undefined)     { fields.push('speed = ?');     values.push(data.speed); }
  if (data.image !== undefined)     { fields.push('image = ?');     values.push(data.image || null); }
  if (data.backstory !== undefined) { fields.push('backstory = ?'); values.push(data.backstory || null); }

  if (fields.length === 0) return getCharacterById(id);
  values.push(id);
  await pool.execute(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  const updated = await getCharacterById(id);
  if (updated) {
    emitCharacterUpdated(updated.campaign_id, {
      id:         updated.id,
      name:       updated.name,
      race:       updated.race ?? null,
      class:      updated.class ?? null,
      level:      updated.level,
      stats:      updated.stats,
      hp_max:     updated.hp_max,
      hp_current: updated.hp_current,
      hp_temp:    updated.hp_temp,
      ac:         updated.ac,
      speed:      updated.speed,
      image:      updated.image ?? null,
      backstory:  updated.backstory ?? null,
    });
  }
  return updated;
}

export async function deleteCharacter(id: number): Promise<void> {
  await pool.execute('DELETE FROM characters WHERE id = ?', [id]);
}
