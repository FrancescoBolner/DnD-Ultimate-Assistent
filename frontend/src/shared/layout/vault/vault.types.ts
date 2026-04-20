export type VaultTab = 'characters' | 'npc' | 'enemy' | 'effects' | 'abilities' | 'items';
export type LayoutMode = 'list' | 'cards';

export interface Stats { str: number; dex: number; con: number; int: number; wis: number; cha: number; }

export interface Character {
  id: number; name: string; race?: string; class?: string;
  level: number;
  stats?: Stats;
  hp_max: number; hp_current: number; hp_temp?: number;
  ac: number; speed: number;
  image?: string; backstory?: string; is_active: boolean;
}

export interface Creature {
  id: number; name: string;
  type: 'npc' | 'enemy' | 'ally' | 'beast';
  cr?: string;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  stats?: Stats;
  hp_max: number; hp_current: number; hp_temp?: number;
  ac: number; speed: number;
  race?: string; religion?: string;
  image?: string; sheet_image?: string | null; notes?: string; tags?: string[]; is_active: boolean;
}

export interface Effect {
  id: number; name: string; description?: string;
  duration?: string; trigger_moment?: string;
  damage?: string; damage_type?: string;
  save_type?: string; save_dc?: number;
  apply_on_save: 'half' | 'negate' | 'none';
  conditions?: string[];
  stat_modifiers?: Record<string, number>;
  is_concentration: boolean;
  notes?: string;
}

export interface Ability {
  id: number; name: string; description?: string;
  action_type: 'action' | 'bonus' | 'reaction' | 'passive' | 'legendary' | 'free';
  damage?: string; damage_type?: string;
  hit_bonus?: number; range?: string; cooldown?: string;
  uses_max?: number; uses_current?: number;
  notes?: string;
  owner_char_id?: number; owner_creature_id?: number;
}

export interface Item {
  id: number; name: string; description?: string;
  type: 'weapon' | 'armor' | 'shield' | 'potion' | 'scroll' | 'wondrous' | 'gear' | 'treasure' | 'other';
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
  quantity: number; weight?: number; value?: string;
  properties?: Record<string, unknown>;
  is_equipped: boolean; is_attuned: boolean;
  notes?: string;
  owner_char_id?: number; owner_creature_id?: number;
}

export type AnyEntry = Character | Creature | Effect | Ability | Item;
