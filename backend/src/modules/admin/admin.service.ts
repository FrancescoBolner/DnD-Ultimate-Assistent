import { pool } from '../../config/db';
import { RowDataPacket, ResultSetHeader, OkPacket } from 'mysql2';

/* ══════════════════════════════════════════════════════════════
   Admin Service — platform-level user & campaign management
   ══════════════════════════════════════════════════════════════ */

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  avatar?: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AdminCampaign {
  id: number;
  name: string;
  description?: string;
  dm_id: number;
  dm_username: string;
  status: string;
  player_count: number;
  created_at: string;
}

export interface PlatformStats {
  total_users: number;
  active_users: number;
  total_campaigns: number;
  active_campaigns: number;
  total_characters: number;
}

/* ── Users ── */

export async function listUsers(page = 1, limit = 50): Promise<{ users: AdminUser[]; total: number }> {
  const offset = (page - 1) * limit;

  const [countRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as total FROM users');
  const total = countRows[0].total as number;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, email, username, avatar, is_admin, is_active, created_at
     FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return { users: rows as AdminUser[], total };
}

export async function toggleUserActive(userId: number, isActive: boolean): Promise<void> {
  await pool.execute<ResultSetHeader>(
    'UPDATE users SET is_active = ? WHERE id = ?',
    [isActive, userId],
  );
}

export async function toggleUserAdmin(userId: number, isAdmin: boolean): Promise<void> {
  await pool.execute<ResultSetHeader>(
    'UPDATE users SET is_admin = ? WHERE id = ?',
    [isAdmin, userId],
  );
}

/* ── Campaigns ── */

export async function listCampaigns(page = 1, limit = 50): Promise<{ campaigns: AdminCampaign[]; total: number }> {
  const offset = (page - 1) * limit;

  const [countRows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as total FROM campaigns');
  const total = countRows[0].total as number;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.name, c.description, c.dm_id, u.username AS dm_username,
            c.status, c.created_at,
            (SELECT COUNT(*) FROM campaign_players cp WHERE cp.campaign_id = c.id AND cp.status = 'active') AS player_count
     FROM campaigns c
     JOIN users u ON u.id = c.dm_id
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return { campaigns: rows as AdminCampaign[], total };
}

/* ── Platform Stats ── */

export async function getPlatformStats(): Promise<PlatformStats> {
  const [[users]] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as total, SUM(is_active = TRUE) as active FROM users",
  );
  const [[campaigns]] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as total, SUM(status = 'active') as active FROM campaigns",
  );
  const [[chars]] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM characters",
  );

  return {
    total_users: users.total as number,
    active_users: (users.active ?? 0) as number,
    total_campaigns: campaigns.total as number,
    active_campaigns: (campaigns.active ?? 0) as number,
    total_characters: chars.total as number,
  };
}

/* ── Database Export / Import ── */

const EXPORT_TABLES = [
  'users',
  'campaigns',
  'campaign_players',
  'campaign_plugins',
  'characters',
  'creatures',
  'effects',
  'abilities',
  'ability_effects',
  'items',
  'combat',
] as const;

export async function exportDatabase(): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  for (const table of EXPORT_TABLES) {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM \`${table}\``);
      result[table] = rows;
    } catch {
      // Table may not exist yet — skip silently
    }
  }
  return result;
}

export async function importDatabase(
  data: Record<string, unknown[]>,
  strategy: 'replace' | 'ignore',
): Promise<{ imported: number; tables: string[] }> {
  let imported = 0;
  const tables: string[] = [];

  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    // Only allow whitelisted tables to prevent SQL injection via table name
    if (!(EXPORT_TABLES as readonly string[]).includes(table)) continue;

    const sample = rows[0] as Record<string, unknown>;
    const columns = Object.keys(sample);
    if (columns.length === 0) continue;

    const colList = columns.map(c => `\`${c}\``).join(', ');
    const placeholders = columns.map(() => '?').join(', ');

    const baseQuery = strategy === 'replace'
      ? `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})
         ON DUPLICATE KEY UPDATE ${columns.map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ')}`
      : `INSERT IGNORE INTO \`${table}\` (${colList}) VALUES (${placeholders})`;

    for (const row of rows as Record<string, unknown>[]) {
      const values = columns.map(c => {
        const v = row[c];
        // Serialize objects/arrays to JSON strings for JSON columns
        return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
      });
      try {
        await pool.execute<ResultSetHeader | OkPacket>(baseQuery, values as string[]);
        imported++;
      } catch {
        // Skip rows that fail (e.g. FK violations) without aborting the whole import
      }
    }
    tables.push(table);
  }

  return { imported, tables };
}

