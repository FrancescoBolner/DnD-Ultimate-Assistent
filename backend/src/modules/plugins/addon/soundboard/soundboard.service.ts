import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface SoundRow {
  id: number;
  campaign_id: number;
  name: string;
  url: string;
  icon: string | null;
  volume: number;
  show_in_popup: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSoundInput {
  name: string;
  url: string;
  icon?: string | null;
  volume?: number;
}

export interface UpdateSoundInput {
  name?: string;
  url?: string;
  icon?: string | null;
  volume?: number;
  show_in_popup?: boolean;
}

export async function listByCampaign(campaignId: number): Promise<SoundRow[]> {
  const [rows] = await pool.execute<(SoundRow & RowDataPacket)[]>(
    'SELECT * FROM `soundboard_sounds` WHERE `campaign_id` = ? ORDER BY `created_at` ASC',
    [campaignId],
  );
  return rows.map(r => ({ ...r, show_in_popup: Boolean(r.show_in_popup) }));
}

export async function getById(id: number): Promise<SoundRow | null> {
  const [rows] = await pool.execute<(SoundRow & RowDataPacket)[]>(
    'SELECT * FROM `soundboard_sounds` WHERE `id` = ?',
    [id],
  );
  return rows[0] ? { ...rows[0], show_in_popup: Boolean(rows[0].show_in_popup) } : null;
}

export async function createSound(campaignId: number, input: CreateSoundInput): Promise<SoundRow> {
  const volume = Math.min(1, Math.max(0, input.volume ?? 1));
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO `soundboard_sounds` (`campaign_id`, `name`, `url`, `icon`, `volume`) VALUES (?, ?, ?, ?, ?)',
    [campaignId, input.name, input.url, input.icon ?? null, volume],
  );
  return (await getById(result.insertId))!;
}

export async function updateSound(id: number, input: UpdateSoundInput): Promise<SoundRow | null> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined)   { fields.push('`name` = ?');   values.push(input.name); }
  if (input.url  !== undefined)   { fields.push('`url` = ?');    values.push(input.url); }
  if (input.icon !== undefined)   { fields.push('`icon` = ?');   values.push(input.icon ?? null); }
  if (input.volume !== undefined) {
    fields.push('`volume` = ?');
    values.push(Math.min(1, Math.max(0, input.volume)));
  }
  if (input.show_in_popup !== undefined) {
    fields.push('`show_in_popup` = ?');
    values.push(input.show_in_popup ? 1 : 0);
  }

  if (fields.length === 0) return getById(id);

  values.push(id);
  await pool.execute(
    `UPDATE \`soundboard_sounds\` SET ${fields.join(', ')} WHERE \`id\` = ?`,
    values,
  );
  return getById(id);
}

export async function deleteSound(id: number): Promise<void> {
  await pool.execute('DELETE FROM `soundboard_sounds` WHERE `id` = ?', [id]);
}
