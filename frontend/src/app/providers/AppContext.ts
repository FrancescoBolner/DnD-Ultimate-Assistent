import { createContext } from 'react';
import type { Campaign, CampaignMember, Character, User, PluginSlug, PluginViewMode } from '../../shared/types';
import type { CharacterCreateData } from '../../services/api/campaigns';

export interface ActivePlugin {
  slug: PluginSlug;
  viewMode: PluginViewMode;
}

export interface AppState {
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  campaigns: Campaign[];
  activeCampaignId: number | null;
  activeCampaign: Campaign | null;
  isDm: boolean;
  editMode: boolean;
  enabledPlugins: PluginSlug[];

  // Plugin display
  activePlugins: ActivePlugin[];
  fullscreenPlugin: PluginSlug | null;
  popupPlugins: PluginSlug[];

  // Vault
  vaultOpen: boolean;
  vaultTab: string;

  // Settings panel
  settingsOpen: boolean;

  // Sidebar
  sidebarCollapsed: boolean;

  // Actions
  setActiveCampaign: (id: number) => void;
  toggleEditMode: () => void;
  openFullscreen: (slug: PluginSlug) => void;
  closeFullscreen: () => void;
  togglePopup: (slug: PluginSlug) => void;
  openVault: (tab?: string) => void;
  closeVault: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  closeAll: () => void;
  toggleSidebar: () => void;
  loginUser: (identifier: string, password: string) => Promise<void>;
  registerUser: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  createCampaign: (name: string, description: string) => Promise<void>;
  joinCampaign: (inviteCode: string) => Promise<Campaign>;
  leaveCampaign: (campaignId: number) => Promise<void>;
  updateProfile: (data: { username?: string; password?: string; newPassword?: string; avatar?: string }) => Promise<void>;
  getCampaignMembers: (campaignId: number) => Promise<CampaignMember[]>;
  getCampaignCharacters: (campaignId: number) => Promise<Character[]>;
  createCharacter: (campaignId: number, data: CharacterCreateData) => Promise<void>;
  assignCharacter: (characterId: number) => Promise<void>;
  refreshCampaigns: () => Promise<void>;
}

export type { CharacterCreateData };

export const AppContext = createContext<AppState | null>(null);
