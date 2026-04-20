import { useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { Campaign, CampaignMember, Character, CampaignPlayer, PluginSlug, PluginViewMode } from '../../shared/types';
import * as campaignsApi from '../../services/api/campaigns';
import * as settingsApi from '../../services/api/settings';
import type { CampaignPermissions, CampaignPluginData } from '../../services/api/settings';
import { DEFAULT_CAMPAIGN_PERMISSIONS } from '../../services/api/settings';
import type { CharacterCreateData } from '../../services/api/campaigns';
import { CampaignContext, type ActivePlugin } from './CampaignContext';
import { useAuth } from './useAuth';
import {
  joinCampaign as socketJoinRoom,
  leaveCampaign as socketLeaveRoom,
  onCharacterUpdated,
} from '../../services/socket';

export function CampaignProvider({ children }: { children: ReactNode }) {
  const { user, authLoading } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignIdRaw] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('activeCampaignId');
    return saved ? parseInt(saved, 10) : null;
  });
  const [allCampaignPlugins, setAllCampaignPlugins] = useState<CampaignPluginData[]>([]);
  const [pluginOrder, setPluginOrder] = useState<string[]>([]);
  const [gridColumns, setGridColumns] = useState(3);
  const [permissions, setPermissions] = useState<CampaignPermissions>(DEFAULT_CAMPAIGN_PERMISSIONS);

  /* ── Shared character state (real-time via socket) ── */
  const [characters, setCharacters] = useState<Character[]>([]);
  const [campaignPlayers, setCampaignPlayers] = useState<CampaignPlayer[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);

  /* ── Load campaigns from API ── */
  const loadCampaigns = useCallback(async () => {
    try {
      const data = await campaignsApi.listCampaigns();
      setCampaigns(data);
    } catch {
      // not logged in or API unavailable
    }
  }, []);

  /* ── Load campaigns when user changes ── */
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) {
        setCampaigns([]);
        setAllCampaignPlugins([]);
        setPermissions(DEFAULT_CAMPAIGN_PERMISSIONS);
        setCharacters([]);
        setCampaignPlayers([]);
        // Only clear campaign selection when auth has fully resolved (= explicit logout).
        // While authLoading=true we may have user=null before the session is restored —
        // clearing here would wipe the sessionStorage-restored ID and trigger a redirect.
        if (!authLoading) {
          setActiveCampaignIdRaw(null);
          sessionStorage.removeItem('activeCampaignId');
        }
        return;
      }
      try {
        const data = await campaignsApi.listCampaigns();
        if (!active) return;
        setCampaigns(data);
      } catch { /* not logged in or API unavailable */ }
    })();
    return () => { active = false; };
  }, [user, authLoading]);

  /* ── Load characters + players when active campaign changes ── */
  const loadCharacters = useCallback(async () => {
    if (!activeCampaignId || !user) {
      setCharacters([]);
      setCampaignPlayers([]);
      return;
    }
    setCharactersLoading(true);
    try {
      const activeCamp = campaigns.find(c => c.id === activeCampaignId) ?? null;
      const userIsDm = !!(activeCamp && activeCamp.dm_id === user.id);
      const [chars, players] = await Promise.all([
        campaignsApi.getCampaignCharacters(activeCampaignId),
        userIsDm
          ? campaignsApi.getCampaignPlayers(activeCampaignId).catch(() => [] as CampaignPlayer[])
          : Promise.resolve([] as CampaignPlayer[]),
      ]);
      setCharacters(chars);
      setCampaignPlayers(players);
    } catch {
      setCharacters([]);
      setCampaignPlayers([]);
    } finally {
      setCharactersLoading(false);
    }
  }, [activeCampaignId, user, campaigns]);

  useEffect(() => { loadCharacters(); }, [loadCharacters]);

  /* ── Socket: join campaign room + apply real-time HP updates ── */
  useEffect(() => {
    if (!activeCampaignId) return;
    socketJoinRoom(activeCampaignId);
    const unsub = onCharacterUpdated(payload => {
      setCharacters(prev =>
        prev.map(c =>
          c.id === payload.id
            ? { ...c, ...payload } as Character
            : c,
        ),
      );
    });
    return () => {
      unsub();
      socketLeaveRoom(activeCampaignId);
    };
  }, [activeCampaignId]);

  /** Optimistically patch one character in the shared list without re-fetching. */
  const patchCharacter = useCallback((id: number, patch: Partial<Character>) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, []);

  const refreshCharacters = useCallback(() => loadCharacters(), [loadCharacters]);

  /* ── Load enabled plugins + permissions when active campaign changes ── */
  useEffect(() => {
    let active = true;
    (async () => {
      if (!activeCampaignId || !user) {
        setAllCampaignPlugins([]);
        setPluginOrder([]);
        setGridColumns(3);
        setPermissions(DEFAULT_CAMPAIGN_PERMISSIONS);
        return;
      }
      try {
        const cs = await settingsApi.getCampaignSettings(activeCampaignId);
        if (!active) return;
        setAllCampaignPlugins(cs.plugins);
        const layout = cs.settings.layout;
        setPluginOrder(Array.isArray(layout?.order) ? layout.order : []);
        setGridColumns(typeof layout?.columns === 'number' ? layout.columns : 3);
        setPermissions(cs.settings.permissions);
      } catch {
        if (!active) return;
        setAllCampaignPlugins([]);
        setPluginOrder([]);
        setGridColumns(3);
        setPermissions(DEFAULT_CAMPAIGN_PERMISSIONS);
      }
    })();
    return () => { active = false; };
  }, [activeCampaignId, user]);

  const activeCampaign = campaigns.find(c => c.id === activeCampaignId) ?? null;
  const isDm = !!(user && activeCampaign && activeCampaign.dm_id === user.id);

  const canPlayerSeePlugin = useCallback((w: CampaignPluginData): boolean => {
    if (isDm) return true;
    if (w.is_dm_only) return false;
    return w.config?.visible_to_players !== false;
  }, [isDm]);

  /* ── Derive widget plugins: DM uses widget flag; players use visible_to_players independently ── */
  const enabledPlugins: PluginSlug[] = useMemo(() => {
    const enabled = isDm
      ? allCampaignPlugins
          .filter(w => w.is_enabled && w.config?.widget !== false)
          .map(w => w.slug as PluginSlug)
      : allCampaignPlugins
          .filter(w => w.is_enabled && !w.is_dm_only && w.config?.visible_to_players !== false)
          .map(w => w.slug as PluginSlug);
    if (pluginOrder.length === 0) return enabled;
    const ordered: PluginSlug[] = [];
    for (const slug of pluginOrder) {
      if (enabled.includes(slug as PluginSlug)) ordered.push(slug as PluginSlug);
    }
    for (const slug of enabled) {
      if (!ordered.includes(slug)) ordered.push(slug);
    }
    return ordered;
  }, [allCampaignPlugins, isDm, pluginOrder]);

  /* ── All globally enabled slugs (any mode) ── */
  const allEnabledSlugs: PluginSlug[] = useMemo(() => {
    return allCampaignPlugins
      .filter(w => w.is_enabled)
      .filter(canPlayerSeePlugin)
      .map(w => w.slug as PluginSlug);
  }, [allCampaignPlugins, canPlayerSeePlugin]);

  /* ── Derive sidebar plugins: DM uses fullscreen flag; players use fullscreen_to_players independently ── */
  const sidebarPlugins: PluginSlug[] = useMemo(() => {
    const visible = allCampaignPlugins
      .filter(w => w.is_enabled)
      .filter(w => {
        if (isDm) return w.config?.fullscreen !== false;
        if (w.is_dm_only) return false;
        if (w.slug === 'characters' && w.config?.allow_player_fullscreen === false) return false;
        return w.config?.fullscreen_to_players !== false;
      })
      .map(w => w.slug as PluginSlug);
    if (pluginOrder.length === 0) return visible;
    const ordered: PluginSlug[] = [];
    for (const slug of pluginOrder) {
      if (visible.includes(slug as PluginSlug)) ordered.push(slug as PluginSlug);
    }
    for (const slug of visible) {
      if (!ordered.includes(slug)) ordered.push(slug);
    }
    return ordered;
  }, [allCampaignPlugins, pluginOrder, isDm]);

  /* ── Derive popup-enabled plugins: is_enabled AND config.popup not explicitly false ── */
  const popupEnabledSlugs: PluginSlug[] = useMemo(() => {
    // Players never see popup widgets.
    if (!isDm) return [];
    return allCampaignPlugins
      .filter(w => w.is_enabled)
      .filter(w => w.config?.popup !== false)
      .filter(canPlayerSeePlugin)
      .map(w => w.slug as PluginSlug);
  }, [allCampaignPlugins, canPlayerSeePlugin, isDm]);

  const activePlugins: ActivePlugin[] = enabledPlugins.map(slug => ({
    slug, viewMode: 'widget' as PluginViewMode,
  }));

  const setActiveCampaign = useCallback((id: number) => {
    setActiveCampaignIdRaw(id);
    sessionStorage.setItem('activeCampaignId', String(id));
  }, []);

  const refreshCampaigns = useCallback(() => loadCampaigns(), [loadCampaigns]);

  const refreshPlugins = useCallback(async () => {
    if (!activeCampaignId) return;
    try {
      const cs = await settingsApi.getCampaignSettings(activeCampaignId);
      setAllCampaignPlugins(cs.plugins);
      const layout = cs.settings?.layout;
      if (typeof layout?.columns === 'number') setGridColumns(layout.columns);
      if (Array.isArray(layout?.order)) setPluginOrder(layout.order as string[]);
    } catch { /* ignore */ }
  }, [activeCampaignId]);

  const createCampaign = useCallback(async (name: string, description: string) => {
    await campaignsApi.createCampaign(name, description);
    await loadCampaigns();
  }, [loadCampaigns]);

  const joinCampaign = useCallback(async (inviteCode: string): Promise<Campaign> => {
    const campaign = await campaignsApi.joinCampaign(inviteCode);
    await loadCampaigns();
    return campaign;
  }, [loadCampaigns]);

  const leaveCampaign = useCallback(async (campaignId: number) => {
    await campaignsApi.leaveCampaign(campaignId);
    if (activeCampaignId === campaignId) {
      setActiveCampaignIdRaw(null);
      sessionStorage.removeItem('activeCampaignId');
    }
    await loadCampaigns();
  }, [activeCampaignId, loadCampaigns]);

  const getCampaignMembers = useCallback(
    (id: number): Promise<CampaignMember[]> => campaignsApi.getCampaignMembers(id), [],
  );
  const getCampaignCharacters = useCallback(
    (id: number): Promise<Character[]> => campaignsApi.getCampaignCharacters(id), [],
  );
  const createCharacter = useCallback(
    (campaignId: number, data: CharacterCreateData) =>
      campaignsApi.createCharacter(campaignId, data).then(() => undefined), [],
  );
  const assignCharacter = useCallback(
    (characterId: number) => campaignsApi.assignCharacter(characterId), [],
  );

  const togglePlugin = useCallback(async (slug: PluginSlug, enabled: boolean) => {
    if (!activeCampaignId) return;
    const plugin = allCampaignPlugins.find(w => w.slug === slug);
    if (!plugin) return;
    await settingsApi.updateCampaignPlugins(activeCampaignId, [
      { slug: plugin.slug, is_enabled: enabled, config: plugin.config ?? undefined },
    ]);
    // Reload settings to reflect the change
    try {
      const cs = await settingsApi.getCampaignSettings(activeCampaignId);
      setAllCampaignPlugins(cs.plugins);
    } catch { /* ignore */ }
  }, [activeCampaignId, allCampaignPlugins]);

  const toggleWidgetMode = useCallback(async (slug: PluginSlug, enabled: boolean) => {
    if (!activeCampaignId) return;
    const plugin = allCampaignPlugins.find(w => w.slug === slug);
    if (!plugin) return;
    const newConfig = { ...(plugin.config ?? {}), widget: enabled };
    // Enabling widget mode also ensures the plugin is globally active
    const newIsEnabled = enabled ? true : plugin.is_enabled;
    await settingsApi.updateCampaignPlugins(activeCampaignId, [
      { slug: plugin.slug, is_enabled: newIsEnabled, config: newConfig },
    ]);
    try {
      const cs = await settingsApi.getCampaignSettings(activeCampaignId);
      setAllCampaignPlugins(cs.plugins);
    } catch { /* ignore */ }
  }, [activeCampaignId, allCampaignPlugins]);

  const togglePopupMode = useCallback(async (slug: PluginSlug, enabled: boolean) => {
    if (!activeCampaignId) return;
    const plugin = allCampaignPlugins.find(w => w.slug === slug);
    if (!plugin) return;
    const newConfig: Record<string, unknown> = { ...(plugin.config ?? {}), popup: enabled };
    // When enabling popup, inherit popup_scale from any other popup-enabled plugin that already has it
    if (enabled && typeof newConfig.popup_scale !== 'number') {
      const existingScale = allCampaignPlugins.find(
        p => p.slug !== slug && p.config?.popup === true && typeof p.config?.popup_scale === 'number',
      )?.config?.popup_scale;
      if (typeof existingScale === 'number') newConfig.popup_scale = existingScale;
    }
    // Enabling popup also ensures is_enabled is true
    const newIsEnabled = enabled ? true : plugin.is_enabled;
    await settingsApi.updateCampaignPlugins(activeCampaignId, [
      { slug: plugin.slug, is_enabled: newIsEnabled, config: newConfig },
    ]);
    try {
      const cs = await settingsApi.getCampaignSettings(activeCampaignId);
      setAllCampaignPlugins(cs.plugins);
    } catch { /* ignore */ }
  }, [activeCampaignId, allCampaignPlugins]);

  const togglePluginFullscreen = useCallback(async (slug: PluginSlug, enabled: boolean) => {
    if (!activeCampaignId) return;
    const plugin = allCampaignPlugins.find(w => w.slug === slug);
    if (!plugin) return;
    const newConfig = { ...(plugin.config ?? {}), fullscreen: enabled };
    // When enabling fullscreen, also ensure the plugin is globally active
    const newIsEnabled = enabled ? true : plugin.is_enabled;
    await settingsApi.updateCampaignPlugins(activeCampaignId, [
      { slug: plugin.slug, is_enabled: newIsEnabled, config: newConfig },
    ]);
    try {
      const cs = await settingsApi.getCampaignSettings(activeCampaignId);
      setAllCampaignPlugins(cs.plugins);
    } catch { /* ignore */ }
  }, [activeCampaignId, allCampaignPlugins]);

  const reorderPlugin = useCallback(async (slug: PluginSlug, direction: 'up' | 'down') => {
    if (!activeCampaignId) return;
    const order = [...enabledPlugins];
    const idx = order.indexOf(slug);
    if (idx < 0) return;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    setPluginOrder(order);
    try {
      await settingsApi.updateCampaignSettings(activeCampaignId, { layout: { order, columns: gridColumns } });
    } catch { /* ignore */ }
  }, [activeCampaignId, enabledPlugins, gridColumns]);

  const movePlugin = useCallback(async (draggedSlug: PluginSlug, targetSlug: PluginSlug | null) => {
    if (draggedSlug === targetSlug || !activeCampaignId) return;
    // Work within the full campaign plugin order list (covers all modes)
    const allSlugs = allCampaignPlugins.map(w => w.slug as PluginSlug);
    const base = pluginOrder.length > 0 ? [...pluginOrder] as PluginSlug[] : allSlugs;
    // Ensure dragged slug is present
    if (!base.includes(draggedSlug)) base.push(draggedSlug);
    const fromIdx = base.indexOf(draggedSlug);
    base.splice(fromIdx, 1);
    if (targetSlug === null) {
      // Move to the very end
      base.push(draggedSlug);
    } else {
      if (!base.includes(targetSlug)) base.push(targetSlug);
      const toIdx = base.indexOf(targetSlug);
      base.splice(toIdx, 0, draggedSlug); // insert before targetSlug
    }
    setPluginOrder(base);
    try {
      await settingsApi.updateCampaignSettings(activeCampaignId, { layout: { order: base, columns: gridColumns } });
    } catch { /* ignore */ }
  }, [activeCampaignId, allCampaignPlugins, pluginOrder, gridColumns]);

  const pluginConfig = useCallback((slug: PluginSlug): Record<string, unknown> | null => {
    const plugin = allCampaignPlugins.find(w => w.slug === slug);
    return plugin?.config ?? null;
  }, [allCampaignPlugins]);

  const setGridColumnsAndSave = useCallback(async (cols: number) => {
    setGridColumns(cols);
    if (!activeCampaignId) return;
    try {
      await settingsApi.updateCampaignSettings(activeCampaignId, { layout: { columns: cols, order: pluginOrder } });
    } catch { /* ignore */ }
  }, [activeCampaignId, pluginOrder]);

  return (
    <CampaignContext.Provider value={{
      campaigns, activeCampaignId, activeCampaign, isDm, permissions, enabledPlugins, allEnabledSlugs,
      sidebarPlugins, popupEnabledSlugs, activePlugins, gridColumns,
      characters, campaignPlayers, charactersLoading, refreshCharacters, patchCharacter,
      setActiveCampaign, refreshCampaigns, refreshPlugins, createCampaign, joinCampaign, leaveCampaign,
      getCampaignMembers, getCampaignCharacters, createCharacter, assignCharacter,
      togglePlugin, toggleWidgetMode, togglePopupMode, togglePluginFullscreen, reorderPlugin, movePlugin, pluginConfig,
      setGridColumns: setGridColumnsAndSave,
    }}>
      {children}
    </CampaignContext.Provider>
  );
}
