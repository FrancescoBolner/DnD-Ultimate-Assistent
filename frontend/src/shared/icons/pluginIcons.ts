import {
  Skull, Users, Swords, Monitor, Map, Music2,
  type LucideIcon,
} from 'lucide-react';
import type { PluginSlug } from '../types';

/** Maps plugin slug → lucide icon component */
export const pluginIconMap: Record<PluginSlug, LucideIcon> = {
  creatures:  Skull,
  characters: Users,
  combat:     Swords,
  map:        Map,
  screen:     Monitor,
  soundboard: Music2,
};

export const pluginLabelMap: Record<PluginSlug, string> = {
  creatures:  'Creatures',
  characters: 'Characters',
  combat:     'Combat',
  map:        'Map',
  screen:     'Screen',
  soundboard: 'Soundboard',
};
