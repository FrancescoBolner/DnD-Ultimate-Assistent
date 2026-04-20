import { pool } from '../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { insertCorePluginsForCampaign } from '../settings/settings.service';

/* ── Types ── */
export interface CampaignRow {
  id: number;
  name: string;
  description: string | null;
  dm_id: number;
  invite_code: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  image: string | null;
  created_at: Date;
  updated_at: Date;
  player_status?: 'active' | 'invited' | null;
}

export interface MemberRow {
  user_id: number;
  username: string;
  avatar: string | null;
  role: 'dm' | 'player';
}

export interface PlayerRow {
  user_id: number;
  username: string;
  avatar: string | null;
  status: 'invited' | 'active' | 'left' | 'kicked' | 'banned';
  joined_at: Date;
}

/* ── Helpers ── */
function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/* ── Queries ── */

export async function getCampaignsForUser(userId: number): Promise<CampaignRow[]> {
  const [rows] = await pool.execute<(CampaignRow & RowDataPacket)[]>(
    `SELECT c.*, NULL AS player_status FROM campaigns c WHERE c.dm_id = ?
     UNION
     SELECT c.*, cp.status AS player_status FROM campaigns c
       JOIN campaign_players cp ON cp.campaign_id = c.id
     WHERE cp.user_id = ? AND cp.status IN ('active', 'invited')`,
    [userId, userId],
  );
  return rows;
}

export async function getCampaignById(id: number): Promise<CampaignRow | null> {
  const [rows] = await pool.execute<(CampaignRow & RowDataPacket)[]>(
    'SELECT * FROM campaigns WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export async function createCampaign(
  name: string,
  description: string,
  dmId: number,
): Promise<CampaignRow> {
  const inviteCode = `${randomCode()}-${randomCode()}`;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO campaigns (name, description, dm_id, invite_code, status)
     VALUES (?, ?, ?, ?, 'active')`,
    [name, description || null, dmId, inviteCode],
  );
  const campaign = await getCampaignById(result.insertId);

  // Auto-insert core plugins for the new campaign
  await insertCorePluginsForCampaign(result.insertId);

  return campaign!;
}

export async function findByInviteCode(code: string): Promise<CampaignRow | null> {
  const [rows] = await pool.execute<(CampaignRow & RowDataPacket)[]>(
    "SELECT * FROM campaigns WHERE invite_code = ?",
    [code],
  );
  return rows[0] ?? null;
}

export async function addPlayer(campaignId: number, userId: number): Promise<void> {
  await pool.execute(
    `INSERT INTO campaign_players (campaign_id, user_id, status)
     VALUES (?, ?, 'invited')
     ON DUPLICATE KEY UPDATE
       status = IF(status IN ('left', 'kicked'), 'invited', status)`,
    [campaignId, userId],
  );
}

export async function getPlayerStatus(
  campaignId: number,
  userId: number,
): Promise<'invited' | 'active' | 'left' | 'kicked' | 'banned' | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT status FROM campaign_players WHERE campaign_id = ? AND user_id = ?',
    [campaignId, userId],
  );
  return (rows[0]?.status as any) ?? null;
}

export async function getPlayersForCampaign(campaignId: number): Promise<PlayerRow[]> {
  const [rows] = await pool.execute<(PlayerRow & RowDataPacket)[]>(
    `SELECT cp.user_id, u.username, u.avatar, cp.status, cp.joined_at
       FROM campaign_players cp
       JOIN users u ON u.id = cp.user_id
      WHERE cp.campaign_id = ?
      ORDER BY cp.joined_at ASC`,
    [campaignId],
  );
  return rows;
}

export async function acceptPlayer(campaignId: number, userId: number): Promise<void> {
  await pool.execute(
    `UPDATE campaign_players SET status = 'active'
      WHERE campaign_id = ? AND user_id = ? AND status = 'invited'`,
    [campaignId, userId],
  );
}

export async function rejectPlayer(campaignId: number, userId: number): Promise<void> {
  await pool.execute(
    `DELETE FROM campaign_players
      WHERE campaign_id = ? AND user_id = ? AND status = 'invited'`,
    [campaignId, userId],
  );
}

export async function unbanPlayer(campaignId: number, userId: number): Promise<void> {
  await pool.execute(
    `UPDATE campaign_players SET status = 'kicked'
      WHERE campaign_id = ? AND user_id = ? AND status = 'banned'`,
    [campaignId, userId],
  );
}

export async function deletePlayerEntry(campaignId: number, userId: number): Promise<void> {
  await pool.execute(
    `DELETE FROM campaign_players
      WHERE campaign_id = ? AND user_id = ? AND status IN ('left', 'kicked', 'banned')`,
    [campaignId, userId],
  );
}

export async function reinvitePlayer(campaignId: number, userId: number): Promise<void> {
  await pool.execute(
    `UPDATE campaign_players SET status = 'invited'
      WHERE campaign_id = ? AND user_id = ? AND status IN ('left', 'kicked')`,
    [campaignId, userId],
  );
}

export async function removePlayer(campaignId: number, userId: number): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "UPDATE campaign_players SET status = 'left' WHERE campaign_id = ? AND user_id = ?",
      [campaignId, userId],
    );
    await conn.execute(
      'UPDATE characters SET player_id = NULL WHERE campaign_id = ? AND player_id = ?',
      [campaignId, userId],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function isPlayerInCampaign(campaignId: number, userId: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT 1 FROM campaign_players WHERE campaign_id = ? AND user_id = ? AND status = 'active'",
    [campaignId, userId],
  );
  return rows.length > 0;
}

export async function isPlayerBanned(campaignId: number, userId: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT 1 FROM campaign_players WHERE campaign_id = ? AND user_id = ? AND status = 'banned'",
    [campaignId, userId],
  );
  return rows.length > 0;
}

export async function getMembersForCampaign(campaignId: number): Promise<MemberRow[]> {
  const [rows] = await pool.execute<(MemberRow & RowDataPacket)[]>(
    `SELECT u.id AS user_id, u.username, u.avatar, 'dm' AS role
       FROM campaigns c JOIN users u ON u.id = c.dm_id
      WHERE c.id = ?
     UNION
     SELECT u.id AS user_id, u.username, u.avatar, 'player' AS role
       FROM campaign_players cp JOIN users u ON u.id = cp.user_id
      WHERE cp.campaign_id = ? AND cp.status = 'active'
     ORDER BY role DESC`,
    [campaignId, campaignId],
  );
  return rows;
}

export async function updateCampaign(
  id: number,
  data: Partial<{ name: string; description: string; status: string; image: string }>,
): Promise<CampaignRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)        { fields.push('name = ?');        values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description || null); }
  if (data.status !== undefined)      { fields.push('status = ?');      values.push(data.status); }
  if (data.image !== undefined)       { fields.push('image = ?');       values.push(data.image || null); }

  if (fields.length === 0) return getCampaignById(id);
  values.push(id);
  await pool.execute(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  return getCampaignById(id);
}

export async function deleteCampaign(id: number): Promise<void> {
  await pool.execute('DELETE FROM campaigns WHERE id = ?', [id]);
}

/* ── Kick / Ban ── */

export async function kickPlayer(campaignId: number, userId: number): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "UPDATE campaign_players SET status = 'kicked' WHERE campaign_id = ? AND user_id = ?",
      [campaignId, userId],
    );
    await conn.execute(
      'UPDATE characters SET player_id = NULL WHERE campaign_id = ? AND player_id = ?',
      [campaignId, userId],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function banPlayer(campaignId: number, userId: number): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      "UPDATE campaign_players SET status = 'banned' WHERE campaign_id = ? AND user_id = ?",
      [campaignId, userId],
    );
    await conn.execute(
      'UPDATE characters SET player_id = NULL WHERE campaign_id = ? AND player_id = ?',
      [campaignId, userId],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* ── Invite code regeneration ── */

export async function regenerateInviteCode(campaignId: number): Promise<string> {
  const newCode = `${randomCode()}-${randomCode()}`;
  await pool.execute(
    'UPDATE campaigns SET invite_code = ? WHERE id = ?',
    [newCode, campaignId],
  );
  return newCode;
}

/* ── Ownership transfer ── */

export async function transferOwnership(
  campaignId: number,
  currentDmId: number,
  newDmId: number,
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Set new DM
    await conn.execute(
      'UPDATE campaigns SET dm_id = ? WHERE id = ?',
      [newDmId, campaignId],
    );

    // Remove new DM from campaign_players (they are now dm_id)
    await conn.execute(
      'DELETE FROM campaign_players WHERE campaign_id = ? AND user_id = ?',
      [campaignId, newDmId],
    );

    // Add old DM as a player
    await conn.execute(
      `INSERT INTO campaign_players (campaign_id, user_id, status)
       VALUES (?, ?, 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [campaignId, currentDmId],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
