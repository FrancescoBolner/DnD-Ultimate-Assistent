import { createContext } from 'react';
import type { PluginSlug } from '../../shared/types';

export interface UIState {
  darkMode: boolean;
  editMode: boolean;
  fullscreenPlugin: PluginSlug | null;
  popupPlugins: PluginSlug[];
  /** Per-popup display state: 'bubble' (minimised circle) or 'open' (full panel) */
  popupStates: Partial<Record<PluginSlug, 'bubble' | 'open'>>;
  /** Per-popup window position (px from viewport top-left). null = default CSS position. */
  popupPositions: Partial<Record<PluginSlug, { x: number; y: number }>>;
  /** Slug currently being dragged in the widget grid (HTML5 DnD) */
  draggingPlugin: PluginSlug | null;
  vaultOpen: boolean;
  vaultTab: string;
  settingsOpen: boolean;
  sidebarCollapsed: boolean;

  setDarkMode: (dark: boolean) => void;
  toggleEditMode: () => void;
  openFullscreen: (slug: PluginSlug) => void;
  closeFullscreen: () => void;
  togglePopup: (slug: PluginSlug) => void;
  setPopupExpanded: (slug: PluginSlug, expanded: boolean) => void;
  setPopupPosition: (slug: PluginSlug, pos: { x: number; y: number } | null) => void;
  setDraggingPlugin: (slug: PluginSlug | null) => void;
  openVault: (tab?: string) => void;
  closeVault: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  closeAll: () => void;
  resetPopups: () => void;
  toggleSidebar: () => void;
}

export const UIContext = createContext<UIState | null>(null);
