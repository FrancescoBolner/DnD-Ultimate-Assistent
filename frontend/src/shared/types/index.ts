/* =============================================================
   Shared types – mirrors the DB schema
   ============================================================= */

// ── Users ──
export interface User {
  id: number;
  email: string;
  username: string;
  avatar?: string;
  is_admin: boolean;
}

// ── Campaigns ──
export interface Campaign {
  id: number;
  name: string;
  description?: string;
  dm_id: number;
  invite_code?: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  image?: string;
  /** Only set when the current user is a player (not DM). 'invited' = pending approval. */
  player_status?: 'active' | 'invited' | null;
}

// ── Characters ──
export interface Character {
  id: number;
  player_id: number | null;
  campaign_id: number;
  name: string;
  race?: string;
  class?: string;
  level: number;
  stats?: Stats;
  hp_max: number;
  hp_current: number;
  hp_temp: number;
  ac: number;
  speed: number;
  image?: string;
  backstory?: string;
  is_active: boolean;
}

// ── Creatures ──
export interface Creature {
  id: number;
  campaign_id: number;
  name: string;
  type: 'npc' | 'enemy' | 'ally' | 'beast';
  cr?: string;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  stats?: Stats;
  hp_max: number;
  hp_current: number;
  hp_temp: number;
  ac: number;
  speed: number;
  image?: string;
  sheet_image?: string | null;
  notes?: string;
  tags?: string[];
  is_active: boolean;
}

// ── Stats ──
export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

// ── Effects ──
export interface Effect {
  id: number;
  campaign_id?: number;
  name: string;
  description?: string;
  duration?: string;
  trigger_moment?: string;
  damage?: string;
  damage_type?: string;
  save_type?: string;
  save_dc?: number;
  apply_on_save: 'half' | 'negate' | 'none';
  conditions?: string[];
  stat_modifiers?: Record<string, number>;
  is_concentration: boolean;
}

// ── Abilities ──
export interface Ability {
  id: number;
  campaign_id: number;
  owner_char_id?: number;
  owner_creature_id?: number;
  name: string;
  description?: string;
  action_type: 'action' | 'bonus' | 'reaction' | 'passive' | 'legendary' | 'free';
  damage?: string;
  damage_type?: string;
  hit_bonus?: number;
  range?: string;
  cooldown?: string;
  uses_max?: number;
  uses_current?: number;
}

// ── Combat ──
export interface Combat {
  id: number;
  campaign_id: number;
  name?: string;
  round: number;
  status: 'pending' | 'active' | 'paused' | 'completed';
  current_participant_id?: number;
}

export interface CombatParticipant {
  id: number;
  combat_id: number;
  char_id?: number;
  creature_id?: number;
  initiative: number;
  hp_current: number;
  hp_max?: number;
  hp_temp?: number;
  is_active: boolean;
  name?: string; // joined from char/creature
  type?: 'character' | 'creature';
  effects?: CombatEffect[];
}

export interface CombatEffect {
  id: string;
  name: string;
  turns_left: number;
  source_effect_id?: number | null;
  is_custom?: boolean;
}

// ── Notes ──
export interface Note {
  id: number;
  campaign_id: number;
  user_id: number;
  character_id?: number;
  title: string;
  content?: string;
  is_private: boolean;
}

// ── Items ──
export interface Item {
  id: number;
  campaign_id: number;
  owner_char_id?: number;
  owner_creature_id?: number;
  name: string;
  description?: string;
  type: string;
  rarity?: string;
  quantity: number;
  weight?: number;
  value?: string;
  properties?: Record<string, unknown>;
  is_equipped: boolean;
  is_attuned: boolean;
}

// ── Soundboard ──
export interface Sound {
  id: number;
  campaign_id: number;
  name: string;
  url: string;
  icon: string | null;
  volume: number;
  show_in_popup?: boolean;
  created_at: string;
  updated_at: string;
}

// ── Plugin system ──
export type PluginSlug =
  | 'creatures'
  | 'characters'
  | 'combat'
  | 'map'
  | 'screen'
  | 'soundboard';

export type PluginViewMode = 'widget' | 'fullscreen' | 'popup' | 'hidden';

// ── Screen plugin types ──
export type ScreenPreset  = '1-big' | '2-half' | '1+2' | '4-grid';
export type ScreenAspect  = '16:9' | '4:3' | '21:9' | '16:10';
export type ScreenSlotType = 'empty' | 'text' | 'image' | 'entity' | 'entity_list' | 'plugin';

export interface ScreenListEntry {
  type: 'character' | 'creature' | 'item';
  id: number;
  show_hp: boolean;
  show_name?: boolean; // defaults to true when undefined
}

export interface ScreenSlotContent {
  type: ScreenSlotType;
  text?: string;
  text_title?: string;
  image_url?: string;
  entity_type?: 'character' | 'creature' | 'item';
  entity_id?: number;
  entity_show_hp?: boolean;
  entity_list_entries?: ScreenListEntry[];
  plugin_slug?: string;
  bg_image?: string;
}

export interface ScreenSlot {
  id: string;
  content: ScreenSlotContent;
}

export interface ScreenLayoutData {
  preset: ScreenPreset;
  slots: ScreenSlot[];
  aspect: ScreenAspect;
  bg_image?: string;
  show_text_bg?: boolean;
}

// ── Campaign members ──
export interface CampaignMember {
  user_id: number;
  username: string;
  avatar?: string;
  role: 'dm' | 'player';
}

export interface CampaignPlayer {
  user_id: number;
  username: string;
  avatar?: string;
  status: 'invited' | 'active' | 'left' | 'kicked' | 'banned';
  joined_at: string;
}

export interface PluginType {
  slug: PluginSlug;
  label: string;
  description?: string;
  icon: string | null;
  is_dm_only: boolean;
  category: 'core' | 'addon';
}

export interface CampaignPlugin {
  campaign_id: number;
  slug: string;
  is_enabled: boolean;
  config?: Record<string, unknown>;
}

// ── Map types ──
export interface MapViewState {
  originX: number;
  originY: number;
  scale: number;
  /** DM canvas pixel width when this state was saved.
   *  Player views divide world-units-per-pixel by this to show the same world area
   *  regardless of their own screen size. */
  dmWidth?: number;
  dmHeight?: number;
}

export interface MapImageNode {
  name?: string;
  src: string;
  x: number;
  y: number;
  size: number;
  appearScale: number;
  children?: MapImageNode[];
  mark?: string;
  markType?: string;
}

export interface MapGeneralMark {
  markType: string;
  name: string;
  mark?: string;
  x: number;
  y: number;
  parentPath?: string;
}

export interface MapSound {
  name?: string;
  src: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  minScale: number;
  maxScale?: number;
  volume?: number;
  parentPath?: string;
}

export interface MapData {
  mapName?: string;
  config: MapImageNode[];
  generalMarks: MapGeneralMark[];
  sounds: MapSound[];
  gallery?: unknown[];
  /** Native viewport width/height in world units. When set, player views are clamped to this area. */
  nativeWidth?: number;
  nativeHeight?: number;
}

export interface MapRecord {
  id: number;
  campaign_id: number;
  name: string;
  image: string | null;
  data: MapData | null;
  grid_size: number;
  is_visible: boolean;
  view_state: MapViewState | null;
}

export interface MapEntity {
  id: number;
  map_id: number;
  entity_type: 'character' | 'creature' | 'custom_npc' | 'custom_enemy';
  entity_id: number;
  x: number;
  y: number;
  scale: number;
  parent_path: string | null;
  label: string | null;
}

export type RangeMarkShape = 'circle' | 'line' | 'cylinder' | 'cone' | 'point';

export interface MapRangeMark {
  id: number;
  map_id: number;
  shape: RangeMarkShape;
  x: number;
  y: number;
  x2: number | null;
  y2: number | null;
  x3: number | null;
  y3: number | null;
  radius: number;
  color: string;
  parent_path: string | null;
}
