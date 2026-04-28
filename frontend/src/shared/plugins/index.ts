import type { ComponentType } from 'react';
import type { PluginSlug, PluginViewMode } from '../types';
import { CharactersPlugin } from './views/characters/CharactersPlugin';
import { CreaturesPlugin }  from './views/creatures/CreaturesPlugin';
import { CombatPlugin }     from './views/combat/CombatPlugin';
import { MapPlugin }        from './views/map/MapPlugin';
import { ScreenPlugin }     from './views/screen/ScreenPlugin';
import { SoundboardPlugin } from './views/soundboard/SoundboardPlugin';

export { default as PluginShell }       from './PluginShell';
export { default as PluginPlaceholder } from './PluginPlaceholder';

export type PluginComponentProps = { viewMode?: PluginViewMode };

/** Slug → plugin component map */
export const pluginRegistry: Record<PluginSlug, ComponentType<PluginComponentProps>> = {
  characters: CharactersPlugin,
  creatures:  CreaturesPlugin,
  combat:     CombatPlugin,
  map:        MapPlugin,
  screen:     ScreenPlugin,
  soundboard: SoundboardPlugin,
};

/**
 * Declares which view modes each plugin supports.
 * Omitting a slug here means the plugin supports all modes.
 */
export const pluginSupportedModes: Partial<Record<PluginSlug, PluginViewMode[]>> = {
  creatures:  ['widget', 'fullscreen', 'popup'],
  characters: ['widget', 'fullscreen', 'popup'],
  combat:     ['widget', 'fullscreen', 'popup'],
  map:        ['widget', 'fullscreen', 'popup'],
  screen:     ['widget', 'fullscreen', 'popup'],
  soundboard: ['widget', 'fullscreen', 'popup'],
};

/** Returns true if the plugin supports the given view mode. */
export function supportsMode(slug: PluginSlug, mode: PluginViewMode): boolean {
  const modes = pluginSupportedModes[slug];
  return !modes || modes.includes(mode);
}
