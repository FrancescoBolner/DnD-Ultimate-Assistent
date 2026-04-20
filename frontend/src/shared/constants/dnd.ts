/* ── D&D Constants (shared across Home, Vault, Dashboard) ── */

export const DND_CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard',
] as const;

export const DND_RACES = [
  'Human', 'Elf', 'High Elf', 'Wood Elf', 'Dark Elf (Drow)',
  'Dwarf', 'Hill Dwarf', 'Mountain Dwarf',
  'Halfling', 'Lightfoot Halfling', 'Stout Halfling',
  'Gnome', 'Forest Gnome', 'Rock Gnome',
  'Half-Elf', 'Half-Orc', 'Tiefling', 'Dragonborn',
  'Aasimar', 'Genasi', 'Goliath', 'Tabaxi', 'Kenku', 'Lizardfolk',
] as const;

export const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/* Core combat effects available without any DB seed data. */
export const CORE_COMBAT_EFFECTS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
  'Bless',
  'Bane',
  'Haste',
  'Slow',
  'Hex',
  'Hunter\'s Mark',
] as const;

export function abilityModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
