/* ══════════════════════════════════════════════════════════════
   Plugin Registry  –  single source of truth for all plugins
   ══════════════════════════════════════════════════════════════
   Every plugin known to the system is defined here.
   The DB table `plugin_types` is removed; `campaign_plugins`
   now references plugins by slug (VARCHAR) directly.
   ══════════════════════════════════════════════════════════════ */

export interface PluginDefinition {
  slug: string;
  label: string;
  description: string;
  icon: string | null;
  is_dm_only: boolean;
  category: 'core' | 'addon';
}

export const PLUGIN_REGISTRY: PluginDefinition[] = [
  { slug: 'creatures',  label: 'Creatures',  description: 'Manage NPCs, enemies and allies',         icon: null, is_dm_only: false, category: 'core' },
  { slug: 'characters', label: 'Characters', description: 'Manage player characters',                icon: null, is_dm_only: false, category: 'core' },
  { slug: 'combat',     label: 'Combat',     description: 'Initiative tracker and combat management', icon: null, is_dm_only: false, category: 'addon' },
  { slug: 'map',        label: 'Map',        description: 'Interactive map viewer with tokens',        icon: null, is_dm_only: false, category: 'addon' },
  { slug: 'screen',     label: 'Screen',     description: 'Display visual content to players',         icon: null, is_dm_only: false, category: 'addon' },
];

export const CORE_PLUGIN_SLUGS = PLUGIN_REGISTRY.filter(p => p.category === 'core').map(p => p.slug);
export const ADDON_PLUGIN_SLUGS = PLUGIN_REGISTRY.filter(p => p.category === 'addon').map(p => p.slug);

export function getPluginBySlug(slug: string): PluginDefinition | undefined {
  return PLUGIN_REGISTRY.find(p => p.slug === slug);
}
