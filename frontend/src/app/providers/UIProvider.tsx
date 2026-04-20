import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { PluginSlug } from '../../shared/types';
import * as settingsApi from '../../services/api/settings';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '../../services/api/settings';
import { useAuth } from './useAuth';
import { useCampaign } from './useCampaign';
import { UIContext } from './UIContext';

export function UIProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeCampaignId, popupEnabledSlugs } = useCampaign();
  const [darkMode, setDarkModeRaw] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : true; // default dark
  });
  const [editMode, setEditMode] = useState(false);
  const [fullscreenPlugin, setFullscreenPlugin] = useState<PluginSlug | null>(() => {
    try { return (sessionStorage.getItem('fullscreenPlugin') as PluginSlug | null) ?? null; } catch { return null; }
  });
  const [popupPlugins, setPopupPlugins] = useState<PluginSlug[]>([]);
  const [popupStates, setPopupStatesRaw] = useState<Partial<Record<PluginSlug, 'bubble' | 'open'>>>({});
  const [popupPositions, setPopupPositionsRaw] = useState<Partial<Record<PluginSlug, { x: number; y: number }>>>({});
  const [draggingPlugin, setDraggingPlugin] = useState<PluginSlug | null>(null);
  // Track which campaign we last loaded popup state for (prevents save before load)
  const popupLoadedForCampaign = useRef<number | null>(null);
  const allUserPrefsRef = useRef<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const widgetSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultTab, setVaultTab] = useState('characters');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* ── Apply theme to <html> ── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  /* ── Sync dark mode preference from API when user logs in ── */
  useEffect(() => {
    if (!user) return;
    settingsApi.getUserSettings()
      .then(us => {
        setDarkMode(us.dark_mode);
        allUserPrefsRef.current = us.preferences;
      })
      .catch(() => { /* ignore – keep localStorage value */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setDarkMode = useCallback((dark: boolean) => {
    setDarkModeRaw(dark);
    localStorage.setItem('darkMode', String(dark));
  }, []);

  const toggleEditMode = useCallback(() => {
    setEditMode(v => {
      if (!v) { setVaultOpen(false); setSettingsOpen(false); }
      return !v;
    });
  }, []);

  /* ── Restore popup states from sessionStorage ONLY when the campaign changes ── */
  useEffect(() => {
    if (!activeCampaignId) {
      setPopupPlugins([]);
      setPopupStatesRaw({});
      setPopupPositionsRaw({});
      popupLoadedForCampaign.current = null;
      return;
    }
    // Skip if we already loaded for this campaign — avoid resetting on every plugin change
    if (popupLoadedForCampaign.current === activeCampaignId) return;
    try {
      const raw = sessionStorage.getItem(`popups_${activeCampaignId}`);
      if (raw) {
        const { plugins, states, positions } = JSON.parse(raw) as {
          plugins: PluginSlug[];
          states: Partial<Record<PluginSlug, 'bubble' | 'open'>>;
          positions?: Partial<Record<PluginSlug, { x: number; y: number }>>;
        };
        setPopupPlugins(Array.isArray(plugins) ? plugins : []);
        setPopupStatesRaw(states ?? {});
        setPopupPositionsRaw(positions ?? {});
      } else {
        const saved = allUserPrefsRef.current.widget_states?.[String(activeCampaignId)];
        if (saved) {
          setPopupPlugins((saved.plugins ?? []) as PluginSlug[]);
          setPopupStatesRaw((saved.states ?? {}) as Partial<Record<PluginSlug, 'bubble' | 'open'>>);
          setPopupPositionsRaw((saved.positions ?? {}) as Partial<Record<PluginSlug, { x: number; y: number }>>);
        } else {
          setPopupPlugins([]);
          setPopupStatesRaw({});
          setPopupPositionsRaw({});
        }
      }
    } catch { /* ignore */ }
    popupLoadedForCampaign.current = activeCampaignId;
  }, [activeCampaignId]); // intentionally NOT depending on popupEnabledSlugs

  /* ── When allowed popup slugs shrink (plugin disabled), remove stale popup states ── */
  useEffect(() => {
    if (!activeCampaignId || popupLoadedForCampaign.current !== activeCampaignId) return;
    // Don't run cleanup while plugins haven't loaded yet — would wipe restored state
    if (popupEnabledSlugs.length === 0) return;
    setPopupStatesRaw(prev => {
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([s]) => popupEnabledSlugs.includes(s as PluginSlug)),
      ) as Partial<Record<PluginSlug, 'bubble' | 'open'>>;
      return Object.keys(cleaned).length === Object.keys(prev).length ? prev : cleaned;
    });
    setPopupPlugins(prev => prev.filter(s => popupEnabledSlugs.includes(s)));
  }, [popupEnabledSlugs, activeCampaignId]);

  /* ── Persist popup plugins + states + positions to sessionStorage ── */
  useEffect(() => {
    if (!activeCampaignId || popupLoadedForCampaign.current !== activeCampaignId) return;
    sessionStorage.setItem(
      `popups_${activeCampaignId}`,
      JSON.stringify({ plugins: popupPlugins, states: popupStates, positions: popupPositions }),
    );
  }, [popupPlugins, popupStates, popupPositions, activeCampaignId]);

  /* ── Persist popup state + positions to user preferences (debounced) ── */
  useEffect(() => {
    if (!activeCampaignId || popupLoadedForCampaign.current !== activeCampaignId || !user) return;
    if (widgetSaveDebounceRef.current) clearTimeout(widgetSaveDebounceRef.current);
    widgetSaveDebounceRef.current = setTimeout(() => {
      allUserPrefsRef.current = {
        ...allUserPrefsRef.current,
        widget_states: {
          ...allUserPrefsRef.current.widget_states,
          [String(activeCampaignId)]: { plugins: popupPlugins, states: popupStates, positions: popupPositions },
        },
      };
      settingsApi.updateUserSettings({ preferences: allUserPrefsRef.current })
        .catch(err => console.error('Failed to save widget states:', err));
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupPlugins, popupStates, popupPositions, activeCampaignId]);

  const openFullscreen  = useCallback((slug: PluginSlug) => {
    setFullscreenPlugin(slug);
    try { sessionStorage.setItem('fullscreenPlugin', slug); } catch { /* ignore */ }
  }, []);
  const closeFullscreen = useCallback(() => {
    setFullscreenPlugin(null);
    try { sessionStorage.removeItem('fullscreenPlugin'); } catch { /* ignore */ }
  }, []);

  const togglePopup = useCallback((slug: PluginSlug) => {
    // Respect campaign config: only allow if popup is enabled for this plugin
    if (!popupEnabledSlugs.includes(slug)) return;
    setPopupPlugins(prev => {
      if (prev.includes(slug)) {
        setPopupStatesRaw(ps => { const n = { ...ps }; delete n[slug]; return n; });
        return prev.filter(s => s !== slug);
      }
      setPopupStatesRaw(ps => ({ ...ps, [slug]: 'open' }));
      return [...prev, slug];
    });
  }, [popupEnabledSlugs]);

  const setPopupExpanded = useCallback((slug: PluginSlug, expanded: boolean) => {
    setPopupStatesRaw(prev => ({ ...prev, [slug]: expanded ? 'open' : 'bubble' }));
  }, []);

  const setPopupPosition = useCallback((slug: PluginSlug, pos: { x: number; y: number } | null) => {
    setPopupPositionsRaw(prev => {
      if (pos === null) { const n = { ...prev }; delete n[slug]; return n; }
      return { ...prev, [slug]: pos };
    });
  }, []);

  const openVault = useCallback((tab = 'characters') => {
    setVaultTab(tab);
    setVaultOpen(true);
    setEditMode(false);
    setSettingsOpen(false);
  }, []);
  const closeVault    = useCallback(() => setVaultOpen(false), []);
  const openSettings  = useCallback(() => { setSettingsOpen(true); setVaultOpen(false); setEditMode(false); }, []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeAll      = useCallback(() => {
    setVaultOpen(false); setSettingsOpen(false); setEditMode(false);
    setFullscreenPlugin(null);
    try { sessionStorage.removeItem('fullscreenPlugin'); } catch { /* ignore */ }
  }, []);

  /* ── Global ESC handler ── */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (vaultOpen) { closeVault(); return; }
      if (settingsOpen) { closeSettings(); return; }
      if (fullscreenPlugin) { closeFullscreen(); return; }
      if (editMode) { toggleEditMode(); return; }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenPlugin, editMode, vaultOpen, settingsOpen, closeFullscreen, toggleEditMode, closeVault, closeSettings]);

  const resetPopups = useCallback(() => {
    setPopupPositionsRaw({});
    setPopupStatesRaw(prev =>
      Object.fromEntries(Object.keys(prev).map(k => [k, 'bubble'])) as Partial<Record<PluginSlug, 'bubble' | 'open'>>
    );
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed(v => !v), []);

  return (
    <UIContext.Provider value={{
      darkMode, editMode, fullscreenPlugin, popupPlugins, popupStates, popupPositions, draggingPlugin,
      vaultOpen, vaultTab, settingsOpen, sidebarCollapsed,
      setDarkMode, toggleEditMode, openFullscreen, closeFullscreen, togglePopup, setPopupExpanded,
      setPopupPosition, setDraggingPlugin, openVault, closeVault, openSettings, closeSettings, closeAll, resetPopups, toggleSidebar,
    }}>
      {children}
    </UIContext.Provider>
  );
}
