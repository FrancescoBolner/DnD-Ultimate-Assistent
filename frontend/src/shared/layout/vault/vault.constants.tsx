import { Users, Shield, Skull, Zap, Sparkles, Package, Sword } from 'lucide-react';
import type { VaultTab } from './vault.types';

export const TABS: { key: VaultTab; label: string; icon: React.ElementType }[] = [
  { key: 'characters', label: 'Characters', icon: Users },
  { key: 'npc',        label: 'NPC',        icon: Shield },
  { key: 'enemy',      label: 'Enemy',      icon: Skull },
  { key: 'abilities',  label: 'Abilities',  icon: Zap },
  { key: 'effects',    label: 'Effects',    icon: Sparkles },
  { key: 'items',      label: 'Items',      icon: Package },
];

export const RARITY_CLASS: Record<string, string> = {
  common: '', uncommon: 'rarity--uncommon', rare: 'rarity--rare',
  very_rare: 'rarity--very-rare', legendary: 'rarity--legendary',
};

export const CREATURE_RACES = [
  'Human', 'Elf', 'High Elf', 'Wood Elf', 'Dark Elf (Drow)',
  'Dwarf', 'Hill Dwarf', 'Mountain Dwarf',
  'Halfling', 'Lightfoot Halfling', 'Stout Halfling',
  'Gnome', 'Forest Gnome', 'Rock Gnome',
  'Half-Elf', 'Half-Orc', 'Tiefling', 'Dragonborn',
  'Aasimar', 'Genasi', 'Goliath', 'Tabaxi', 'Kenku', 'Lizardfolk',
];

export const RELIGIONS = [''];

/* ── Tab icon resolver ── */
export function TabIcon({ tab, size }: { tab: VaultTab; size: number }) {
  const map: Record<VaultTab, React.ElementType> = {
    characters: Users, npc: Shield, enemy: Skull,
    effects: Sparkles, abilities: Sword, items: Package,
  };
  const Icon = map[tab];
  return <Icon size={size} />;
}
