import { createContext } from 'react';
import type { Campaign, CampaignMember, Character, CampaignPlayer, PluginSlug, PluginViewMode } from '../../shared/types';
import type { CharacterCreateData } from '../../services/api/campaigns';
import type { CampaignPermissions } from '../../services/api/settings';

export interface ActivePlugin {
  slug: PluginSlug;
  viewMode: PluginViewMode;
}

export interface CampaignState {
  campaigns: Campaign[];
  activeCampaignId: number | null;
  activeCampaign: Campaign | null;
  isDm: boolean;
  permissions: CampaignPermissions;
  /** Plugins shown as widgets in the dashboard grid (is_enabled && config.widget !== false) */
  enabledPlugins: PluginSlug[];
  /** All globally enabled (is_enabled) plugins regardless of widget/fullscreen/popup toggles */
  allEnabledSlugs: PluginSlug[];
  /** Plugins shown in the sidebar fullscreen list (is_enabled && config.fullscreen !== false) */
  sidebarPlugins: PluginSlug[];
  /** Plugins that can be opened as a floating popup (is_enabled && config.popup !== false) */
  popupEnabledSlugs: PluginSlug[];
  activePlugins: ActivePlugin[];
  gridColumns: number;

  /** Live character list for the active campaign – updated in real-time via socket */
  characters: Character[];
  campaignPlayers: CampaignPlayer[];
  charactersLoading: boolean;
  refreshCharacters: () => Promise<void>;
  /** Optimistically patch a single character in the shared list (e.g. HP change) */
  patchCharacter: (id: number, patch: Partial<Character>) => void;

  setActiveCampaign: (id: number) => void;
  refreshCampaigns: () => Promise<void>;
  /** Re-fetch plugin settings for the active campaign (call after Settings saves plugin changes) */
  refreshPlugins: () => Promise<void>;
  createCampaign: (name: string, description: string) => Promise<void>;
  joinCampaign: (inviteCode: string) => Promise<Campaign>;
  leaveCampaign: (campaignId: number) => Promise<void>;
  getCampaignMembers: (campaignId: number) => Promise<CampaignMember[]>;
  getCampaignCharacters: (campaignId: number) => Promise<Character[]>;
  createCharacter: (campaignId: number, data: CharacterCreateData) => Promise<void>;
  assignCharacter: (characterId: number) => Promise<void>;
  togglePlugin: (slug: PluginSlug, enabled: boolean) => Promise<void>;
  /** Enable or disable a plugin's widget (dashboard grid) mode without affecting other modes */
  toggleWidgetMode: (slug: PluginSlug, enabled: boolean) => Promise<void>;
  /** Enable or disable a plugin's fullscreen (sidebar) mode */
  togglePluginFullscreen: (slug: PluginSlug, enabled: boolean) => Promise<void>;
  /** Enable or disable a plugin's popup (floating bubble) mode */
  togglePopupMode: (slug: PluginSlug, enabled: boolean) => Promise<void>;
  reorderPlugin: (slug: PluginSlug, direction: 'up' | 'down') => Promise<void>;
  /** Drag-and-drop reorder: move draggedSlug before targetSlug (or to end if targetSlug is null) */
  movePlugin: (draggedSlug: PluginSlug, targetSlug: PluginSlug | null) => Promise<void>;
  setGridColumns: (cols: number) => Promise<void>;
  /** Get the persisted config object for a plugin (or null if not found) */
  pluginConfig: (slug: PluginSlug) => Record<string, unknown> | null;
}

export type { CharacterCreateData };

export const CampaignContext = createContext<CampaignState | null>(null);
