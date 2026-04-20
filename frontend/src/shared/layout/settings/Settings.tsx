import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Save, RotateCcw, AlertTriangle, Info, LayoutGrid, GripVertical, Plus, Trash2,
} from 'lucide-react';

const CORE_SLUGS = ['creatures', 'characters'] as const;
import { useCampaign } from '../../../app/providers/useCampaign';
import { useUI }       from '../../../app/providers/useUI';
import { Button, Input, Select, Modal, Slider } from '../../ui';
import { Switch } from '../../ui/components/Switch';
import * as campaignApi from '../../../services/api/campaigns';
import * as settingsApi from '../../../services/api/settings';
import type {
  UserSettings,
  UserLayout,
  CampaignSettingsData,
  CampaignPermissions,
  CampaignPluginData,
  PluginDefinition,
} from '../../../services/api/settings';
import { DEFAULT_USER_LAYOUT, DEFAULT_CAMPAIGN_PERMISSIONS } from '../../../services/api/settings';
import {
  USER_TABS, DM_TABS, ABOUT_TAB,
  LANGUAGES, FONT_SIZES, STATUS_OPTIONS, AUTO_LOGOUT_OPTIONS,
} from './settings.constants';
import type { SettingsTab } from './settings.constants';
import PlayerManagement from './PlayerManagement';
import './Settings.css';

/* ── Helpers ── */

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings__section">
      <h3 className="settings__section-heading">{title}</h3>
      <div className="settings__section-body">{children}</div>
    </div>
  );
}

function FieldRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="settings__field-row">
      <div className="settings__field-text">
        <span className="settings__field-label">{label}</span>
        {description && <span className="settings__field-desc">{description}</span>}
      </div>
      <div className="settings__field-control">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════════════ */

export default function Settings() {
  const { isDm, activeCampaignId, refreshCampaigns, refreshPlugins, gridColumns } = useCampaign();
  const { settingsOpen, closeSettings, sidebarCollapsed, setDarkMode } = useUI();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  /* ── Local grid-column state (save-only — does not apply until Save is clicked) ── */
  const [localGridColumns, setLocalGridColumns] = useState<1 | 2 | 3 | 4>(gridColumns as 1 | 2 | 3 | 4);
  const [savedGridColumns, setSavedGridColumns] = useState<1 | 2 | 3 | 4>(gridColumns as 1 | 2 | 3 | 4);

  /* ── Drag-and-drop state for plugin table reordering ── */
  const dragPluginSlug = useRef<string | null>(null);
  const [draggingRowSlug, setDraggingRowSlug] = useState<string | null>(null);
  const [dropTargetSlug, setDropTargetSlug]   = useState<string | null>(null);
  const [dropBeforeRow, setDropBeforeRow] = useState(false);

  /* ── Data state ── */
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [savedUserSettings, setSavedUserSettings] = useState<UserSettings | null>(null);

  const [campaignSettings, setCampaignSettings] = useState<CampaignSettingsData | null>(null);
  const [savedCampaignSettings, setSavedCampaignSettings] = useState<CampaignSettingsData | null>(null);

  const [campaignDetails, setCampaignDetails] = useState<{
    name: string; description: string; status: string; image: string;
  }>({ name: '', description: '', status: 'active', image: '' });
  const [savedCampaignDetails, setSavedCampaignDetails] = useState<typeof campaignDetails | null>(null);

  const [plugins, setPlugins] = useState<CampaignPluginData[]>([]);
  const [savedPlugins, setSavedPlugins] = useState<CampaignPluginData[]>([]);
  const [pluginDefs, setPluginDefs] = useState<PluginDefinition[]>([]);
  const [addonSlugToAdd, setAddonSlugToAdd] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ── Load settings when panel opens ── */
  useEffect(() => {
    if (!settingsOpen) return;
    setLoading(true);

    (async () => {
      try {
        const us = await settingsApi.getUserSettings();
        setUserSettings(us);
        setSavedUserSettings(us);
        setDarkMode(us.dark_mode);
      } catch { /* ignore */ }

      if (isDm && activeCampaignId) {
        try {
          const cs = await settingsApi.getCampaignSettings(activeCampaignId);
          setCampaignSettings(cs.settings);
          setSavedCampaignSettings(cs.settings);
          setPluginDefs(cs.pluginDefinitions);
          const initCols = (typeof cs.settings?.layout?.columns === 'number'
            ? cs.settings.layout.columns : gridColumns) as 1 | 2 | 3 | 4;
          setLocalGridColumns(initCols);
          setSavedGridColumns(initCols);

          const mergedPlugins: CampaignPluginData[] = cs.pluginDefinitions.map(def => {
            const existing = cs.plugins.find(w => w.slug === def.slug);
            return existing ?? {
              id: 0,
              campaign_id: activeCampaignId!,
              slug: def.slug,
              is_enabled: false,
              config: null,
              label: def.label,
              description: def.description,
              icon: def.icon,
              is_dm_only: def.is_dm_only,
            };
          });
          // Sort by saved layout.order so the table reflects the user's saved ordering
          const savedOrder = cs.settings.layout?.order;
          const orderedPlugins = Array.isArray(savedOrder) && savedOrder.length > 0
            ? [...mergedPlugins].sort((a, b) => {
                const ai = savedOrder.indexOf(a.slug);
                const bi = savedOrder.indexOf(b.slug);
                if (ai === -1 && bi === -1) return 0;
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              })
            : mergedPlugins;
          setPlugins(orderedPlugins);
          setSavedPlugins(orderedPlugins);
          const det = {
            name: cs.campaign.name ?? '',
            description: cs.campaign.description ?? '',
            status: cs.campaign.status ?? 'active',
            image: cs.campaign.image ?? '',
          };
          setCampaignDetails(det);
          setSavedCampaignDetails(det);
        } catch { /* ignore */ }
      }
      setLoading(false);
    })();
  // gridColumns and setDarkMode are intentionally omitted: gridColumns is only
  // needed as a one-time fallback when settings first open; setDarkMode is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, isDm, activeCampaignId]);

  /* ── Dirty detection ── */
  const userDirty = useMemo(
    () => !!userSettings && !!savedUserSettings && !deepEqual(userSettings, savedUserSettings),
    [userSettings, savedUserSettings],
  );
  const campaignDirty = useMemo(
    () =>
      (!!campaignSettings && !!savedCampaignSettings && !deepEqual(campaignSettings, savedCampaignSettings)) ||
      (!!savedCampaignDetails && !deepEqual(campaignDetails, savedCampaignDetails)),
    [campaignSettings, savedCampaignSettings, campaignDetails, savedCampaignDetails],
  );
  const pluginsDirty = useMemo(
    () => !deepEqual(plugins, savedPlugins),
    [plugins, savedPlugins],
  );
  const gridColumnsDirty = localGridColumns !== savedGridColumns;
  const isDirty = userDirty || campaignDirty || pluginsDirty || gridColumnsDirty;

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (userDirty && userSettings) {
        const updated = await settingsApi.updateUserSettings({
          dark_mode: userSettings.dark_mode,
          layout: userSettings.layout,
        });
        setUserSettings(updated);
        setSavedUserSettings(updated);
        setDarkMode(updated.dark_mode); // apply dark-mode only on Save
      }

      if (campaignDirty && activeCampaignId) {
        const payload: Parameters<typeof settingsApi.updateCampaignSettings>[1] = {};

        if (campaignSettings && savedCampaignSettings && !deepEqual(campaignSettings.permissions, savedCampaignSettings.permissions)) {
          payload.permissions = campaignSettings.permissions;
        }
        if (savedCampaignDetails && !deepEqual(campaignDetails, savedCampaignDetails)) {
          payload.campaign = {};
          if (campaignDetails.name !== savedCampaignDetails.name) payload.campaign.name = campaignDetails.name;
          if (campaignDetails.description !== savedCampaignDetails.description) payload.campaign.description = campaignDetails.description;
          if (campaignDetails.status !== savedCampaignDetails.status) payload.campaign.status = campaignDetails.status;
          if (campaignDetails.image !== savedCampaignDetails.image) payload.campaign.image = campaignDetails.image;
        }

        await settingsApi.updateCampaignSettings(activeCampaignId, payload);

        const cs = await settingsApi.getCampaignSettings(activeCampaignId);
        setCampaignSettings(cs.settings);
        setSavedCampaignSettings(cs.settings);
        const det = {
          name: cs.campaign.name ?? '',
          description: cs.campaign.description ?? '',
          status: cs.campaign.status ?? 'active',
          image: cs.campaign.image ?? '',
        };
        setCampaignDetails(det);
        setSavedCampaignDetails(det);
        await refreshCampaigns();
      }

      if ((pluginsDirty || gridColumnsDirty) && activeCampaignId) {
        if (pluginsDirty) {
          const payload = plugins.map(w => ({
            slug: w.slug,
            is_enabled: w.is_enabled,
            config: w.config ?? undefined,
          }));
          const updated = await settingsApi.updateCampaignPlugins(activeCampaignId, payload);
          // Merge API-returned IDs while preserving our drag-reordered sequence
          const idMap = new Map(updated.plugins.map(p => [p.slug, p.id]));
          const ordered = plugins.map(p => ({ ...p, id: idMap.get(p.slug) ?? p.id }));
          setPlugins(ordered);
          setSavedPlugins(ordered);
        }
        // Always persist layout (plugin order + grid columns) together
        const orderedSlugs = plugins.map(w => w.slug);
        await settingsApi.updateCampaignSettings(activeCampaignId, {
          layout: { order: orderedSlugs, columns: localGridColumns },
        });
        setSavedGridColumns(localGridColumns);
        // Sync CampaignProvider state (gridColumns, pluginOrder, plugins)
        await refreshPlugins();
      }
    } catch (err) {
      console.error('Settings save error:', err);
    } finally {
      setSaving(false);
    }
  }, [userDirty, userSettings, campaignDirty, campaignSettings, savedCampaignSettings,
      campaignDetails, savedCampaignDetails, activeCampaignId, pluginsDirty, gridColumnsDirty,
      plugins, localGridColumns, refreshCampaigns, refreshPlugins, setDarkMode]);

  /* ── Reset ── */
  const handleReset = useCallback(() => {
    if (savedUserSettings) {
      setUserSettings(savedUserSettings);
      setDarkMode(savedUserSettings.dark_mode); // revert dark-mode preview
    }
    if (savedCampaignSettings) setCampaignSettings(savedCampaignSettings);
    if (savedCampaignDetails) setCampaignDetails(savedCampaignDetails);
    setSavedPlugins(prev => { setPlugins(prev); return prev; });
    setLocalGridColumns(savedGridColumns); // revert grid-columns preview
  }, [savedUserSettings, savedCampaignSettings, savedCampaignDetails, savedGridColumns, setDarkMode]);

  /* ── Close guard ── */
  const handleClose = useCallback(() => {
    if (isDirty) setDiscardOpen(true);
    else closeSettings();
  }, [isDirty, closeSettings]);

  const confirmDiscard = useCallback(() => {
    handleReset();
    setDiscardOpen(false);
    closeSettings();
  }, [handleReset, closeSettings]);

  /* ── Helpers for updating layout ── */
  const setPref = useCallback(<K extends keyof UserLayout>(key: K, value: UserLayout[K]) => {
    setUserSettings(prev => prev ? {
      ...prev,
      layout: { ...prev.layout, [key]: value },
    } : prev);
  }, []);

  const setPerm = useCallback(<K extends keyof CampaignPermissions>(key: K, value: CampaignPermissions[K]) => {
    setCampaignSettings(prev => prev ? {
      ...prev,
      permissions: { ...prev.permissions, [key]: value },
    } : prev);
  }, []);

  const togglePlugin = useCallback((slug: string, field: 'is_enabled', value: boolean) => {
    setPlugins(prev => prev.map(w =>
      w.slug === slug ? { ...w, [field]: value } : w,
    ));
  }, []);

  const togglePluginConfig = useCallback((slug: string, configKey: string, value: unknown) => {
    setPlugins(prev => prev.map(w =>
      w.slug === slug
        ? { ...w, config: { ...(w.config ?? {}), [configKey]: value } }
        : w,
    ));
  }, []);

  const enableAddon = useCallback((slug: string) => {
    setPlugins(prev => prev.map(w =>
      w.slug === slug
        ? {
            ...w,
            is_enabled: true,
            config: {
              widget: true,
              fullscreen: true,
              popup: true,
              visible_to_players: w.is_dm_only ? false : (w.config?.visible_to_players !== false),
              ...(w.config ?? {}),
            },
          }
        : w,
    ));
  }, []);

  /* ── Render guard ── */
  if (!settingsOpen) return null;

  const tabs = [...USER_TABS, ...(isDm ? DM_TABS : []), ABOUT_TAB];
  const prefs = userSettings?.layout ?? DEFAULT_USER_LAYOUT;
  const perms = campaignSettings?.permissions ?? DEFAULT_CAMPAIGN_PERMISSIONS;

  const campaignDetailsDirty = !!savedCampaignDetails && !deepEqual(campaignDetails, savedCampaignDetails);
  const permissionsDirty = !!campaignSettings && !!savedCampaignSettings
    && !deepEqual(campaignSettings.permissions, savedCampaignSettings.permissions);
  const tabDirty: Record<string, boolean> = {
    general: userDirty, campaign: campaignDetailsDirty,
    permissions: permissionsDirty,
    plugins: pluginsDirty || gridColumnsDirty, about: false,
  };

  return (
    <div className={`settings-fullscreen${sidebarCollapsed ? ' settings-fullscreen--collapsed' : ''}`}>

      {/* ── Tab bar ── */}
      <div className="settings__tabbar">
        <div className="settings__tabbar-left">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={[
                'settings__navtab',
                activeTab === key ? 'settings__navtab--active' : '',
                tabDirty[key] ? 'settings__navtab--dirty' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <button className="settings__navtab settings__navtab--close" onClick={handleClose} title="Close Settings">
          <X size={15} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="settings__body">
        {loading ? (
          <div className="settings__loading">Loading settings…</div>
        ) : (
          <>
            {/* ─── General ─── */}
            {activeTab === 'general' && userSettings && (
              <div className="settings__pane">
                <Section title="Display">
                  <Switch
                    checked={userSettings.dark_mode}
                    onChange={v => setUserSettings(prev => prev ? { ...prev, dark_mode: v } : prev)}
                    label="Dark Mode"
                    description="Switch between dark and light colour themes. Applied when you save."
                  />
                  <div className="settings__info-box">
                    <Info size={14} />
                    <span>Custom colour themes and accent colours will be available in a future update.</span>
                  </div>
                </Section>

                <Section title="Typography">
                  <FieldRow label="Font Size" description="Base font size for the interface.">
                    <Select variant="compact" value={String(prefs.font_size)}
                      onChange={e => setPref('font_size', Number(e.target.value))}>
                      {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </Select>
                  </FieldRow>
                </Section>

                <Section title="Language & Region">
                  <FieldRow label="Language" description="Choose the interface language.">
                    <Select variant="compact" value={prefs.language}
                      onChange={e => setPref('language', e.target.value)}>
                      {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </Select>
                  </FieldRow>
                </Section>

                <Section title="Behaviour">
                  <FieldRow label="Auto Logout" description="Log out automatically after this period of inactivity.">
                    <Select variant="compact" value={String(prefs.auto_logout_minutes)}
                      onChange={e => setPref('auto_logout_minutes', Number(e.target.value))}>
                      {AUTO_LOGOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </FieldRow>
                  <div className="settings__info-box">
                    <Info size={14} />
                    <span>More behaviour options will be available in a future update.</span>
                  </div>
                </Section>

              </div>
            )}

            {/* ─── Campaign (DM) ─── */}
            {activeTab === 'campaign' && isDm && (
              <div className="settings__pane">
                <Section title="Campaign Details">
                  <div className="settings__field-stack">
                    <Input label="Campaign Name" value={campaignDetails.name}
                      onChange={e => setCampaignDetails(prev => ({ ...prev, name: e.target.value }))} />
                    <Input label="Description" value={campaignDetails.description}
                      onChange={e => setCampaignDetails(prev => ({ ...prev, description: e.target.value }))} />
                    <FieldRow label="Status" description="Current campaign status.">
                      <Select variant="compact" value={campaignDetails.status}
                        onChange={e => setCampaignDetails(prev => ({ ...prev, status: e.target.value }))}>
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </Select>
                    </FieldRow>
                    <Input label="Campaign Image URL" placeholder="https://…" value={campaignDetails.image}
                      onChange={e => setCampaignDetails(prev => ({ ...prev, image: e.target.value }))} />
                  </div>
                </Section>

                {activeCampaignId && (
                  <Section title="Players">
                    <PlayerManagement campaignId={activeCampaignId} />
                  </Section>
                )}

                <Section title="Danger Zone">
                  <div className="settings__danger-zone">
                    <div className="settings__danger-zone-text">
                      <span className="settings__danger-zone-label">Delete Campaign</span>
                      <span className="settings__danger-zone-desc">
                        Permanently delete this campaign and all its data. This action cannot be undone.
                      </span>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      Delete Campaign
                    </Button>
                  </div>
                </Section>
              </div>
            )}

            {/* ─── Permissions (DM) ─── */}
            {activeTab === 'permissions' && isDm && campaignSettings && (
              <div className="settings__pane">
                <Section title="General Permissions">
                  <Switch checked={perms.players_can_see_vault} onChange={v => setPerm('players_can_see_vault', v)}
                    label="Players can see Vault" description="Allow players to browse the shared Vault (creatures, items, effects, abilities)." />
                  <Switch checked={perms.players_can_edit_own_character} onChange={v => setPerm('players_can_edit_own_character', v)}
                    label="Players can edit their character" description="Allow players to edit the stats and backstory of the character assigned to them." />
                  <Switch checked={perms.players_see_creature_hp} onChange={v => setPerm('players_see_creature_hp', v)}
                    label="Players can see creature HP" description="When off, all non-player entity HP bars are hidden from players." />
                </Section>

                <Section title="Plugin Visibility">
                  <p className="settings__section-intro">
                    Control which plugins players can see in the widget and fullscreen views.
                  </p>
                  <div className="settings__perm-plugin-table">
                    <div className="settings__perm-plugin-th">
                      <span>Plugin</span>
                      <span title="Visible as a widget on the player's dashboard">Player Widget</span>
                      <span title="Players can open this plugin in fullscreen view">Player Fullscreen</span>
                    </div>
                    {plugins.filter(p => p.is_enabled && !p.is_dm_only).map(p => {
                      const visWidget    = p.config?.visible_to_players !== false;
                      const visFullscreen = p.config?.fullscreen_to_players !== false;
                      return (
                        <div key={p.slug} className="settings__perm-plugin-row">
                          <span className="settings__perm-plugin-name">{p.label}</span>
                          <div className="settings__perm-plugin-cell">
                            <Switch
                              checked={visWidget}
                              onChange={v => togglePluginConfig(p.slug, 'visible_to_players', v)}
                            />
                          </div>
                          <div className="settings__perm-plugin-cell">
                            <Switch
                              checked={visFullscreen}
                              onChange={v => togglePluginConfig(p.slug, 'fullscreen_to_players', v)}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {plugins.filter(p => p.is_enabled && !p.is_dm_only).length === 0 && (
                      <div className="settings__perm-plugin-empty">No player-visible plugins enabled.</div>
                    )}
                  </div>
                </Section>
              </div>
            )}

            {/* ─── Plugins (DM) ─── */}
            {activeTab === 'plugins' && isDm && (
              <div className="settings__pane">

                {/* Grid columns selector */}
<Section title="Widget Size">
                  <p className="settings__section-intro">
                    Choose the widget size. Columns auto-fit to the screen — fewer fit as size grows.
                    Applied when you save.
                  </p>
                  <div className="settings__columns-selector">
                    {([
                      { n: 1, label: 'Small' },
                      { n: 2, label: 'Medium' },
                      { n: 3, label: 'Large' },
                      { n: 4, label: 'XLarge' },
                    ] as const).map(({ n, label }) => (
                      <button
                        key={n}
                        className={`settings__columns-btn${localGridColumns === n ? ' settings__columns-btn--active' : ''}`}
                        onClick={() => setLocalGridColumns(n)}
                        title={label}
                      >
                        <LayoutGrid size={13} />
                        {label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Plugin rows helper */}
                {(() => {
                  const handleDrop = (targetSlug: string) => {
                    const fromSlug = dragPluginSlug.current;
                    if (fromSlug === null || fromSlug === targetSlug) return;
                    setPlugins(prev => {
                      const arr = [...prev];
                      const fromIdx = arr.findIndex(p => p.slug === fromSlug);
                      const toIdx   = arr.findIndex(p => p.slug === targetSlug);
                      if (fromIdx === -1 || toIdx === -1) return prev;
                      const [item] = arr.splice(fromIdx, 1);
                      arr.splice(toIdx, 0, item);
                      return arr;
                    });
                    dragPluginSlug.current = null;
                    setDraggingRowSlug(null);
                    setDropTargetSlug(null);
                  };

                  const renderTable = () => {
                    const rows = plugins.filter(p => {
                      if ((CORE_SLUGS as readonly string[]).includes(p.slug)) return true;
                      return p.is_enabled;
                    });
                    return (
                      <div className="settings__plugin-table">
                        <div className="settings__plugin-th-row">
                          <span></span>{/* drag handle header */}
                          <span>Plugin</span>
                          <span title="Shown as a panel in the dashboard grid">Widget</span>
                          <span title="Opens in the sidebar fullscreen view">Fullscreen</span>
                          <span title="Available as a floating popup">Popup</span>
                          <span></span>
                        </div>
                        {rows.map(p => {
                          const isEnabled    = p.is_enabled;
                          const widget       = isEnabled && (p.config?.widget       !== false);
                          const fullscreen   = isEnabled && (p.config?.fullscreen   !== false);
                          const popup        = isEnabled && (p.config?.popup        !== false);
                          const off          = !isEnabled;

                          return (
                            <div
                              key={p.slug}
                              className={[
                                'settings__plugin-row',
                                off ? 'settings__plugin-row--off' : '',
                                draggingRowSlug === p.slug ? 'settings__plugin-row--drag-source' : '',
                                dropTargetSlug === p.slug && draggingRowSlug !== p.slug
                                  ? (dropBeforeRow ? 'settings__plugin-row--drop-before' : 'settings__plugin-row--drop-after')
                                  : '',
                              ].filter(Boolean).join(' ')}
                              draggable
                              onDragStart={(e) => {
                                dragPluginSlug.current = p.slug;
                                const el = e.currentTarget as HTMLElement;
                                const ghost = el.cloneNode(true) as HTMLElement;
                                ghost.style.cssText = `position:absolute;top:-9999px;left:0;width:${el.offsetWidth}px;opacity:0.9;pointer-events:none;`;
                                document.body.appendChild(ghost);
                                e.dataTransfer.setDragImage(ghost, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                                setTimeout(() => document.body.removeChild(ghost), 0);
                                setTimeout(() => setDraggingRowSlug(p.slug), 0);
                              }}
                              onDragOver={e => {
                                e.preventDefault();
                                setDropTargetSlug(p.slug);
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setDropBeforeRow(e.clientY < rect.top + rect.height / 2);
                              }}
                              onDrop={() => handleDrop(p.slug)}
                              onDragEnd={() => {
                                dragPluginSlug.current = null;
                                setDraggingRowSlug(null);
                                setDropTargetSlug(null);
                              }}
                            >
                              {/* Drag handle */}
                              <div className="settings__plugin-cell-drag">
                                <GripVertical size={14} className="settings__plugin-drag-icon" />
                              </div>
                              <div className="settings__plugin-cell-name">
                                <span className="settings__plugin-name">{p.label}</span>
                                {p.description && <span className="settings__plugin-desc">{p.description}</span>}
                              </div>
                              {/* Widget — dashboard grid panel */}
                              <div className="settings__plugin-cell-check">
                                <Switch
                                  checked={widget}
                                  onChange={v => {
                                    if (v && !isEnabled) togglePlugin(p.slug, 'is_enabled', true);
                                    togglePluginConfig(p.slug, 'widget', v);
                                  }}
                                />
                              </div>
                              {/* Fullscreen — sidebar full-screen view */}
                              <div className="settings__plugin-cell-check">
                                <Switch
                                  checked={fullscreen}
                                  onChange={v => {
                                    if (v && !isEnabled) togglePlugin(p.slug, 'is_enabled', true);
                                    togglePluginConfig(p.slug, 'fullscreen', v);
                                  }}
                                />
                              </div>
                              {/* Popup — floating popup when one is open */}
                              <div className="settings__plugin-cell-check">
                                <Switch
                                  checked={popup}
                                  onChange={v => {
                                    if (v && !isEnabled) togglePlugin(p.slug, 'is_enabled', true);
                                    togglePluginConfig(p.slug, 'popup', v);
                                  }}
                                />
                              </div>
                              {/* Remove — disable/remove addon plugin */}
                              <div className="settings__plugin-cell-check">
                                {!(CORE_SLUGS as readonly string[]).includes(p.slug) && p.is_enabled ? (
                                  <button
                                    type="button"
                                    className="settings__plugin-remove-btn"
                                    onClick={() => togglePlugin(p.slug, 'is_enabled', false)}
                                    title={`Disable ${p.label}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                ) : <span />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  };

                  const addonSlugs = new Set(pluginDefs.filter(d => !(CORE_SLUGS as readonly string[]).includes(d.slug)).map(d => d.slug));
                  const availableAddonOptions = plugins
                    .filter(p => addonSlugs.has(p.slug) && !p.is_enabled)
                    .map(p => ({ value: p.slug, label: p.label }));

                  return (
                    <Section title="Active Plugins">
                      <p className="settings__section-intro">
                        Drag rows to reorder plugins. Toggle where each plugin appears:
                        as a <strong>Widget</strong> in the dashboard grid, as a <strong>Fullscreen</strong> sidebar
                        view, or as a floating <strong>Popup</strong>. The last column controls player visibility.
                        Changes apply only when you save.
                      </p>

                      {renderTable()}

                      <div className="settings__plugin-add-addon-row">
                        <Select
                          value={addonSlugToAdd}
                          onChange={e => setAddonSlugToAdd(e.target.value)}
                          options={availableAddonOptions}
                          placeholder="Add an add-on plugin..."
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Plus size={12} />}
                          disabled={addonSlugToAdd === ''}
                          onClick={() => {
                            if (addonSlugToAdd === '') return;
                            enableAddon(addonSlugToAdd);
                            setAddonSlugToAdd('');
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </Section>
                  );
                })()}

                {/* ─── Per-plugin settings ─── */}
                {(() => {
                  const charData   = plugins.find(p => p.slug === 'characters');
                  const combatData = plugins.find(p => p.slug === 'combat');
                  const mapData    = plugins.find(p => p.slug === 'map');
                  if (!charData?.is_enabled && !combatData?.is_enabled && !mapData?.is_enabled) return null;
                  const cfg        = charData?.config ?? {};
                  const combatCfg  = combatData?.config ?? {};
                  const mapCfg     = mapData?.config ?? {};
                  return (
                    <Section title="Plugin Settings">
                      <p className="settings__section-intro">
                        Configure per-plugin behaviour. Changes apply when you save.
                      </p>
                      {(() => {
                        const popupEnabled = plugins.filter(p => p.is_enabled && p.config?.popup !== false);
                        if (popupEnabled.length === 0) return null;
                        const sharedScale = typeof popupEnabled[0].config?.popup_scale === 'number'
                          ? popupEnabled[0].config.popup_scale : 1;
                        return (
                          <Slider
                            value={sharedScale}
                            min={0.5}
                            max={3}
                            step={0.05}
                            onChange={v => {
                              const rounded = Number(v.toFixed(1));
                              setPlugins(prev => prev.map(p =>
                                p.is_enabled && p.config?.popup !== false
                                  ? { ...p, config: { ...(p.config ?? {}), popup_scale: rounded } }
                                  : p,
                              ));
                            }}
                            label="Popup size"
                            description="Scale all popup windows. Applied when you save."
                            formatValue={v => `${v.toFixed(1)}×`}
                          />
                        );
                      })()}
                      {charData?.is_enabled && (
                        <div className="settings__plugin-config-group">
                          <h4 className="settings__plugin-config-name">Characters</h4>
                          <Switch
                            checked={cfg.show_unassigned !== false}
                            onChange={v => togglePluginConfig('characters', 'show_unassigned', v)}
                            label="Show characters without a player"
                            description="Include characters not yet assigned to any player."
                          />
                          <Switch
                            checked={cfg.show_filter_bar !== false}
                            onChange={v => togglePluginConfig('characters', 'show_filter_bar', v)}
                            label="Show search bar"
                            description="Display the search and filter bar in the Characters plugin."
                          />
                          <Switch
                            checked={cfg.hide_stats_for_players === true}
                            onChange={v => togglePluginConfig('characters', 'hide_stats_for_players', v)}
                            label="Hide information for players"
                            description="When on, players will not see AC, stats and Speed chips in the Characters plugin."
                          />
                        </div>
                      )}

                      {combatData?.is_enabled && (
                        <div className="settings__plugin-config-group">
                          <h4 className="settings__plugin-config-name">Combat</h4>
                          <Switch
                            checked={combatCfg.show_combat_details !== false}
                            onChange={v => togglePluginConfig('combat', 'show_combat_details', v)}
                            label="Players can see combat details"
                            description="When off, players see the combat widget but only participant names — no HP, effects, or stats."
                          />
                          <Switch
                            checked={combatCfg.players_can_self_heal === true}
                            onChange={v => togglePluginConfig('combat', 'players_can_self_heal', v)}
                            label="Players can damage/heal themselves"
                            description="When on, players can apply damage or healing to their own characters during combat."
                          />
                          <Switch
                            checked={combatCfg.show_effects_to_players !== false}
                            onChange={v => togglePluginConfig('combat', 'show_effects_to_players', v)}
                            label="Show effects to players"
                            description="When off, players won't see active effects on combat participants."
                          />
                        </div>
                      )}
                      {mapData?.is_enabled && (
                        <div className="settings__plugin-config-group">
                          <h4 className="settings__plugin-config-name">Map</h4>
                          <Switch
                            checked={mapCfg.players_can_move_tokens === true}
                            onChange={v => togglePluginConfig('map', 'players_can_move_tokens', v)}
                            label="Players can move their own token"
                            description="When on, players can drag their character token on the map."
                          />
                          <Switch
                            checked={mapCfg.players_can_see_infobox !== false}
                            onChange={v => togglePluginConfig('map', 'players_can_see_infobox', v)}
                            label="Players can see entity info"
                            description="When on, clicking an entity shows HP, AC and speed to all players."
                          />
                          <Switch
                            checked={mapCfg.show_marks_by_default !== false}
                            onChange={v => togglePluginConfig('map', 'show_marks_by_default', v)}
                            label="See mark info"
                            description="When on, hovering over a location marker shows its name and description."
                          />
                        </div>
                      )}
                    </Section>
                  );
                })()}

              </div>
            )}

            {/* ─── About ─── */}
            {activeTab === 'about' && (
              <div className="settings__pane">
                <Section title="D&D Ultimate Assistant">
                  <div className="settings__about-block">
                    <span className="settings__about-version">Version 0.1.0</span>
                    <p className="settings__about-text">
                      A comprehensive virtual tabletop and campaign management tool
                      for Dungeons &amp; Dragons 5th Edition.
                    </p>
                  </div>
                </Section>
                <Section title="Credits">
                  <p className="settings__about-text">
                    Built with React, TypeScript, Express, and MySQL.
                    Uses Lucide icons and Inter typeface.
                  </p>
                </Section>
                <Section title="Support">
                  <p className="settings__about-text">
                    Report bugs or request features through the project repository.
                  </p>
                </Section>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Save / Reset bar ── */}
      {isDirty && (
        <div className="settings__action-bar">
          <div className="settings__action-bar-text">
            <AlertTriangle size={15} />
            <span>You have unsaved changes</span>
          </div>
          <div className="settings__action-bar-buttons">
            <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={handleReset} disabled={saving}>
              Reset
            </Button>
            <Button variant="primary" size="sm" icon={<Save size={13} />} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Discard changes modal ── */}
      <Modal open={discardOpen} onClose={() => setDiscardOpen(false)} title="Unsaved Changes" size="sm">
        <div className="settings__discard-modal">
          <p>You have unsaved changes. Do you want to keep editing or discard them?</p>
          <div className="settings__discard-actions">
            <Button variant="ghost" onClick={() => setDiscardOpen(false)}>Keep Editing</Button>
            <Button variant="danger" onClick={confirmDiscard}>Discard &amp; Close</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete campaign confirmation modal ── */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Campaign" size="sm">
        <div className="settings__discard-modal">
          <p>
            Are you sure you want to <strong>permanently delete</strong> this campaign?
            All data (characters, creatures, combat history) will be lost. This cannot be undone.
          </p>
          <div className="settings__discard-actions">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={13} />}
              disabled={deleting}
              onClick={async () => {
                if (!activeCampaignId) return;
                setDeleting(true);
                try {
                  await campaignApi.deleteCampaign(activeCampaignId);
                  await refreshCampaigns();
                  setDeleteConfirmOpen(false);
                  closeSettings();
                  navigate('/home', { replace: true });
                } catch (err) {
                  console.error('Delete campaign error:', err);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting…' : 'Delete Campaign'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
