import { api } from './client';

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

export interface VaultTabPrefs {
  layout?: 'list' | 'cards';
  sortStack?: Array<{ key: string; dir: 'asc' | 'desc' }>;
  filterBy?: string;
  groupBy?: string;
}

/** App-level user settings stored in the `layout` DB column. */
export interface UserLayout {
  language: string;
  font_size: number;
  dice_animation: boolean;
  auto_save_notes: boolean;
  show_tooltips: boolean;
  compact_mode: boolean;
  /** Idle logout timeout in minutes. 0 = disabled. */
  auto_logout_minutes: number;
}

/** Per-campaign / vault state stored in the `preferences` DB column. */
export interface UserPreferences {
  vault_prefs?: Record<string, VaultTabPrefs>;
  widget_states?: Record<string, {
    plugins?: string[];
    states?: Record<string, 'bubble' | 'open'>;
    positions?: Record<string, { x: number; y: number }>;
  }>;
}

export interface UserSettings {
  user_id: number;
  dark_mode: boolean;
  layout: UserLayout;
  preferences: UserPreferences;
}

export interface CampaignPermissions {
  players_can_see_vault: boolean;
  players_can_edit_own_character: boolean;
  players_see_initiative: boolean;
  players_see_monster_hp: boolean;
  players_see_monster_ac: boolean;
  players_see_creature_hp: boolean;
  players_can_move_tokens: boolean;
  players_can_add_notes: boolean;
}

export interface CampaignSettingsData {
  campaign_id: number;
  layout: { columns?: number; order?: string[] } | null;
  permissions: CampaignPermissions;
}

export interface PluginDefinition {
  slug: string;
  label: string;
  description: string;
  icon: string | null;
  is_dm_only: boolean;
  category: 'core' | 'addon';
}

export interface CampaignPluginData {
  id: number;
  campaign_id: number;
  slug: string;
  is_enabled: boolean;
  config: Record<string, unknown> | null;
  label: string;
  description: string | null;
  icon: string | null;
  is_dm_only: boolean;
}

/* ══════════════════════════════════════════════════════════════
   Default values
   ══════════════════════════════════════════════════════════════ */

export const DEFAULT_USER_LAYOUT: UserLayout = {
  language: 'en',
  font_size: 14,
  dice_animation: true,
  auto_save_notes: true,
  show_tooltips: true,
  compact_mode: false,
  auto_logout_minutes: 30,
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {};

export const DEFAULT_CAMPAIGN_PERMISSIONS: CampaignPermissions = {
  players_can_see_vault: false,
  players_can_edit_own_character: false,
  players_see_initiative: true,
  players_see_monster_hp: false,
  players_see_monster_ac: false,
  players_see_creature_hp: true,
  players_can_move_tokens: false,
  players_can_add_notes: true,
};

/* ══════════════════════════════════════════════════════════════
   API calls
   ══════════════════════════════════════════════════════════════ */

export async function getUserSettings(): Promise<UserSettings> {
  const res = await api<{ settings: UserSettings }>('/settings/user');
  return {
    ...res.settings,
    layout: {
      ...DEFAULT_USER_LAYOUT,
      ...(typeof res.settings.layout === 'object' && res.settings.layout !== null
        ? res.settings.layout as Partial<UserLayout>
        : {}),
    },
    preferences: {
      ...DEFAULT_USER_PREFERENCES,
      ...(typeof res.settings.preferences === 'object' && res.settings.preferences !== null
        ? res.settings.preferences
        : {}),
    },
  };
}

export async function updateUserSettings(data: {
  dark_mode?: boolean;
  layout?: Partial<UserLayout>;
  preferences?: Partial<UserPreferences>;
}): Promise<UserSettings> {
  const res = await api<{ settings: UserSettings }>('/settings/user', {
    method: 'PUT',
    body: data,
  });
  return {
    ...res.settings,
    layout: {
      ...DEFAULT_USER_LAYOUT,
      ...(typeof res.settings.layout === 'object' && res.settings.layout !== null
        ? res.settings.layout as Partial<UserLayout>
        : {}),
    },
    preferences: {
      ...DEFAULT_USER_PREFERENCES,
      ...(typeof res.settings.preferences === 'object' && res.settings.preferences !== null
        ? res.settings.preferences
        : {}),
    },
  };
}

export async function getCampaignSettings(campaignId: number): Promise<{
  settings: CampaignSettingsData;
  plugins: CampaignPluginData[];
  pluginDefinitions: PluginDefinition[];
  campaign: { id: number; name: string; description?: string; status: string; image?: string };
}> {
  const res = await api<{
    settings: CampaignSettingsData | null;
    plugins: CampaignPluginData[];
    pluginDefinitions: PluginDefinition[];
    campaign: { id: number; name: string; description?: string; status: string; image?: string };
  }>(`/settings/campaign/${campaignId}`);

  return {
    settings: {
      campaign_id: campaignId,
      layout: res.settings?.layout ?? null,
      permissions: {
        ...DEFAULT_CAMPAIGN_PERMISSIONS,
        ...(typeof res.settings?.permissions === 'object' && res.settings?.permissions !== null
          ? res.settings.permissions as Partial<CampaignPermissions>
          : {}),
      },
    },
    plugins: res.plugins,
    pluginDefinitions: res.pluginDefinitions,
    campaign: res.campaign,
  };
}

export async function updateCampaignSettings(
  campaignId: number,
  data: {
    permissions?: CampaignPermissions;
    layout?: { columns?: number; order?: string[] };
    campaign?: { name?: string; description?: string; status?: string; image?: string };
  },
): Promise<{ settings: CampaignSettingsData; campaign: unknown }> {
  return api(`/settings/campaign/${campaignId}`, {
    method: 'PUT',
    body: data,
  });
}

export async function updateCampaignPlugins(
  campaignId: number,
  plugins: { slug: string; is_enabled: boolean; config?: unknown }[],
): Promise<{ plugins: CampaignPluginData[] }> {
  return api(`/settings/campaign/${campaignId}/plugins`, {
    method: 'PUT',
    body: { plugins },
  });
}
