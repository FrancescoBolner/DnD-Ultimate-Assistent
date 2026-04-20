import { pool } from '../../config/db';
import type { UserRow, SafeUser } from '../../auth/auth.types';
import { RowDataPacket } from 'mysql2';

/* ── Helpers ── */
function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    avatar: row.avatar,
    is_admin: row.is_admin,
  };
}

/* ── Queries ── */

export async function findByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<(UserRow & RowDataPacket)[]>(
    'SELECT * FROM users WHERE email = ?',
    [email],
  );
  return rows[0] ?? null;
}

export async function findByUsername(username: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<(UserRow & RowDataPacket)[]>(
    'SELECT * FROM users WHERE username = ?',
    [username],
  );
  return rows[0] ?? null;
}

export async function findByEmailOrUsername(identifier: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<(UserRow & RowDataPacket)[]>(
    'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
    [identifier, identifier],
  );
  return rows[0] ?? null;
}

export async function findById(id: number): Promise<UserRow | null> {
  const [rows] = await pool.execute<(UserRow & RowDataPacket)[]>(
    'SELECT * FROM users WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export async function createUser(
  email: string,
  username: string,
  passwordHash: string,
): Promise<SafeUser> {
  const [result] = await pool.execute(
    'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)',
    [email, username, passwordHash],
  );
  const insertId = (result as any).insertId as number;
  const user = await findById(insertId);
  return toSafeUser(user!);
}

export async function updateLastLogin(userId: number): Promise<void> {
  await pool.execute(
    'UPDATE users SET last_login = NOW() WHERE id = ?',
    [userId],
  );
}

export async function getSafeUser(id: number): Promise<SafeUser | null> {
  const row = await findById(id);
  return row ? toSafeUser(row) : null;
}

export async function updateUser(
  id: number,
  data: { username?: string; avatar?: string | null; passwordHash?: string },
): Promise<SafeUser | null> {
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];

  if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username); }
  if (data.avatar !== undefined)   { fields.push('avatar = ?');   values.push(data.avatar);   }
  if (data.passwordHash !== undefined) { fields.push('password_hash = ?'); values.push(data.passwordHash); }

  if (fields.length === 0) return getSafeUser(id);

  values.push(id);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return getSafeUser(id);
}

export async function deleteUser(id: number): Promise<void> {
  // Campaigns where dm_id = id cascade-delete automatically (FK ON DELETE CASCADE).
  // Remove campaign_players rows where the user is a player first
  // (FK already handles it, but explicit for clarity).
  await pool.execute('DELETE FROM users WHERE id = ?', [id]);
}
