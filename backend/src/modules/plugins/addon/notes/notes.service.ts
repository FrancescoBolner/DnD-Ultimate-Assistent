import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface NoteRow {
  id: number;
  campaign_id: number;
  user_id: number;
  character_id: number | null;
  title: string;
  content: string | null;
  is_private: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function listByCampaign(campaignId: number, userId: number): Promise<NoteRow[]> {
  // Return own notes + public notes from others
  const [rows] = await pool.execute<(NoteRow & RowDataPacket)[]>(
    `SELECT * FROM notes
     WHERE campaign_id = ? AND (user_id = ? OR is_private = FALSE)
     ORDER BY updated_at DESC`,
    [campaignId, userId],
  );
  return rows;
}

export async function getById(id: number): Promise<NoteRow | null> {
  const [rows] = await pool.execute<(NoteRow & RowDataPacket)[]>(
    'SELECT * FROM notes WHERE id = ?', [id],
  );
  return rows[0] ?? null;
}

export interface NoteCreateData {
  campaign_id: number;
  user_id: number;
  character_id?: number | null;
  title: string;
  content?: string;
  is_private?: boolean;
}

export async function create(data: NoteCreateData): Promise<NoteRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO notes (campaign_id, user_id, character_id, title, content, is_private)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.campaign_id, data.user_id,
      data.character_id ?? null,
      data.title, data.content ?? null,
      data.is_private ?? true,
    ],
  );
  return (await getById(result.insertId))!;
}

export async function update(id: number, data: Partial<NoteCreateData>): Promise<NoteRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined)        { fields.push('title = ?');        values.push(data.title); }
  if (data.content !== undefined)      { fields.push('content = ?');      values.push(data.content || null); }
  if (data.is_private !== undefined)   { fields.push('is_private = ?');   values.push(data.is_private); }
  if (data.character_id !== undefined) { fields.push('character_id = ?'); values.push(data.character_id ?? null); }

  if (fields.length === 0) return getById(id);
  values.push(id);
  await pool.execute(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  return getById(id);
}

export async function remove(id: number): Promise<void> {
  await pool.execute('DELETE FROM notes WHERE id = ?', [id]);
}
