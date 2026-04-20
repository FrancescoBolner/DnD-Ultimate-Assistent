import { pool } from '../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PLUGIN_REGISTRY, CORE_PLUGIN_SLUGS, getPluginBySlug } from '../plugins/plugin-registry';
import type { PluginDefinition } from '../plugins/plugin-registry';

/* ══════════════════════════════════════════════════════════════
   User Settings
   ══════════════════════════════════════════════════════════════ */

export interface UserSettingsRow {
  user_id: number;
  dark_mode: boolean;
  layout: unknown;
  preferences: unknown;
  updated_at: string;
}

export async function getUserSettings(userId: number): Promise<UserSettingsRow | null> {
  const [rows] = await pool.execute<(UserSettingsRow & RowDataPacket)[]>(
    'SELECT id AS user_id, dark_mode, layout, preferences, updated_at FROM users WHERE id = ?',
    [userId],
  );
  return rows[0] ?? null;
}

export async function upsertUserSettings(
  userId: number,
  data: { dark_mode?: boolean; layout?: unknown; preferences?: unknown },
): Promise<UserSettingsRow> {
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  if (data.dark_mode !== undefined)   { fields.push('dark_mode = ?');   values.push(data.dark_mode); }
  if (data.layout !== undefined)      { fields.push('layout = ?');      values.push(JSON.stringify(data.layout)); }
  if (data.preferences !== undefined) { fields.push('preferences = ?'); values.push(JSON.stringify(data.preferences)); }
  if (fields.length > 0) {
    values.push(userId);
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return (await getUserSettings(userId))!;
}

/* ══════════════════════════════════════════════════════════════
   Campaign Settings
   ══════════════════════════════════════════════════════════════ */

export interface CampaignSettingsRow {
  campaign_id: number;
  layout: unknown;
  permissions: unknown;
  updated_at: string;
}

export async function getCampaignSettings(campaignId: number): Promise<CampaignSettingsRow | null> {
  const [rows] = await pool.execute<(CampaignSettingsRow & RowDataPacket)[]>(
    'SELECT id AS campaign_id, layout, permissions, updated_at FROM campaigns WHERE id = ?',
    [campaignId],
  );
  return rows[0] ?? null;
}

export async function upsertCampaignSettings(
  campaignId: number,
  data: { layout?: unknown; permissions?: unknown },
): Promise<CampaignSettingsRow> {
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  if (data.layout !== undefined)      { fields.push('layout = ?');      values.push(JSON.stringify(data.layout)); }
  if (data.permissions !== undefined) { fields.push('permissions = ?'); values.push(JSON.stringify(data.permissions)); }
  if (fields.length > 0) {
    values.push(campaignId);
    await pool.execute(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return (await getCampaignSettings(campaignId))!;
}

/* ══════════════════════════════════════════════════════════════
   Campaign Plugins  (enable / disable + config)
   Plugin metadata comes from code (plugin-registry.ts).
   The DB only stores per-campaign activation and config.
   ══════════════════════════════════════════════════════════════ */

/** Row as stored in the DB (no metadata — enriched later). */
interface CampaignPluginDbRow {
  id: number;
  campaign_id: number;
  slug: string;
  is_enabled: boolean;
  config: unknown;
}

/** Row returned to callers, enriched with code-defined metadata. */
export interface CampaignPluginRow {
  id: number;
  campaign_id: number;
  slug: string;
  is_enabled: boolean;
  config: unknown;
  /* from code registry */
  label: string;
  description: string | null;
  icon: string | null;
  is_dm_only: boolean;
}

function enrichPlugin(row: CampaignPluginDbRow): CampaignPluginRow | null {
  const def = getPluginBySlug(row.slug);
  if (!def) return null; // slug no longer known in code → skip
  return {
    ...row,
    label: def.label,
    description: def.description,
    icon: def.icon,
    is_dm_only: def.is_dm_only,
  };
}

export async function getCampaignPlugins(campaignId: number): Promise<CampaignPluginRow[]> {
  const [rows] = await pool.execute<(CampaignPluginDbRow & RowDataPacket)[]>(
    `SELECT id, campaign_id, slug, is_enabled, config
     FROM campaign_plugins
     WHERE campaign_id = ?
     ORDER BY id ASC`,
    [campaignId],
  );
  const enriched: CampaignPluginRow[] = [];
  for (const r of rows) {
    const p = enrichPlugin(r);
    if (p) enriched.push(p);
  }
  return enriched;
}

/** Returns the full plugin registry from code (replaces the old getPluginTypes DB query). */
export function getPluginDefinitions(): PluginDefinition[] {
  return PLUGIN_REGISTRY;
}

export async function upsertCampaignPlugin(
  campaignId: number,
  slug: string,
  data: { is_enabled?: boolean; config?: unknown },
): Promise<void> {
  await pool.execute(
    `INSERT INTO campaign_plugins (campaign_id, slug, is_enabled, config)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), config = VALUES(config)`,
    [
      campaignId,
      slug,
      data.is_enabled ?? true,
      data.config ? JSON.stringify(data.config) : null,
    ],
  );
}

export async function bulkUpsertCampaignPlugins(
  campaignId: number,
  plugins: { slug: string; is_enabled: boolean; config?: unknown }[],
): Promise<CampaignPluginRow[]> {
  for (const w of plugins) {
    await upsertCampaignPlugin(campaignId, w.slug, {
      is_enabled: w.is_enabled,
      config: w.config,
    });
  }
  return getCampaignPlugins(campaignId);
}

/** Insert core plugins for a newly-created campaign. */
export async function insertCorePluginsForCampaign(campaignId: number): Promise<void> {
  for (const slug of CORE_PLUGIN_SLUGS) {
    await upsertCampaignPlugin(campaignId, slug, {
      is_enabled: true,
      config: { widget: true, fullscreen: true, popup: false },
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   Campaign details (name, description, status, image)
   ══════════════════════════════════════════════════════════════ */

export async function updateCampaignDetails(
  campaignId: number,
  data: { name?: string; description?: string; status?: string; image?: string },
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  if (data.name !== undefined)        { fields.push('name = ?');        values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.status !== undefined)      { fields.push('status = ?');      values.push(data.status); }
  if (data.image !== undefined)       { fields.push('image = ?');       values.push(data.image); }
  if (fields.length === 0) return;
  values.push(campaignId);
  await pool.execute(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function getCampaignById(campaignId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM campaigns WHERE id = ?',
    [campaignId],
  );
  return rows[0] ?? null;
}

/** Check if user is DM of campaign */
export async function isDmOfCampaign(userId: number, campaignId: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM campaigns WHERE id = ? AND dm_id = ?',
    [campaignId, userId],
  );
  return rows.length > 0;
}

/** Check if user is an active player of campaign */
export async function isActivePlayerOfCampaign(userId: number, campaignId: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT 1 FROM campaign_players WHERE campaign_id = ? AND user_id = ? AND status = 'active'",
    [campaignId, userId],
  );
  return rows.length > 0;
}
