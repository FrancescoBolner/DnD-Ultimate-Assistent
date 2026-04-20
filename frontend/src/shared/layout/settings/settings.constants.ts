import { SlidersHorizontal, BookOpen, Users, LayoutGrid, Info } from 'lucide-react';

export type SettingsTab = 'general' | 'campaign' | 'permissions' | 'plugins' | 'about';

export const USER_TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'General', icon: SlidersHorizontal },
];

export const DM_TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'campaign',    label: 'Campaign',    icon: BookOpen  },
  { key: 'permissions', label: 'Permissions', icon: Users     },
  { key: 'plugins',     label: 'Plugins',     icon: LayoutGrid },
];

export const ABOUT_TAB: { key: SettingsTab; label: string; icon: React.ElementType } = {
  key: 'about', label: 'About', icon: Info,
};

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
];

export const FONT_SIZES = [
  { value: '12', label: '12 px' },
  { value: '13', label: '13 px' },
  { value: '14', label: '14 px (default)' },
  { value: '15', label: '15 px' },
  { value: '16', label: '16 px' },
  { value: '18', label: '18 px' },
];

export const STATUS_OPTIONS = [
  { value: 'active',    label: 'Active' },
  { value: 'paused',    label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived',  label: 'Archived' },
];

export const AUTO_LOGOUT_OPTIONS = [
  { value: '0',   label: 'Disabled' },
  { value: '15',  label: '15 minutes' },
  { value: '30',  label: '30 minutes (default)' },
  { value: '60',  label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours' },
];
