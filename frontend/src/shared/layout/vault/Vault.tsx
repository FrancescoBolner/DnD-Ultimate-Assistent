/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  X, SlidersHorizontal, ArrowUpDown, Layers, LayoutGrid,
  LayoutList, Plus, ChevronUp, ChevronDown,
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useCampaign } from '../../../app/providers/useCampaign';
import { useAuth }     from '../../../app/providers/useAuth';
import { useUI }       from '../../../app/providers/useUI';
import { Button, Select, SearchBar } from '../../ui';
import * as campaignsApi from '../../../services/api/campaigns';
import * as creaturesApi from '../../../services/api/creatures';
import * as effectsApi   from '../../../services/api/effects';
import * as abilitiesApi from '../../../services/api/abilities';
import * as itemsApi     from '../../../services/api/items';
import {
  getUserSettings, updateUserSettings,
  DEFAULT_USER_PREFERENCES,
  type VaultTabPrefs,
} from '../../../services/api/settings';
import { onCreatureUpdated } from '../../../services/socket';
import { TABS }        from './vault.constants';
import { VaultListHeader, VaultListRow, VaultCard } from './VaultViews';
import VaultDetailPanel from './VaultDetailPanel';
import { SheetViewer } from '../../plugins/views/sheet/SheetViewer';
import type {
  VaultTab, LayoutMode, AnyEntry,
  Character, Creature, Effect, Ability, Item,
} from './vault.types';
import './Vault.css';

/* ── Group separator ── */

function GroupSeparator({ label }: { label: string }) {
  return (
    <div className="vault__group-sep">
      <div className="vault__group-sep__line" />
      <span className="vault__group-sep__label">{label}</span>
      <div className="vault__group-sep__line" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Main Vault component
   ══════════════════════════════════════════════════════ */

export default function Vault() {
  const { activeCampaignId, isDm, characters: sharedCharacters, permissions, refreshCharacters } = useCampaign();
  const { user } = useAuth();
  const { vaultOpen, vaultTab, openVault, closeVault, sidebarCollapsed } = useUI();

  type SortEntry = { key: string; dir: 'asc' | 'desc' };
  const [layout,    setLayout]   = useState<LayoutMode>('cards');
  const [search,    setSearch]   = useState('');
  const [filterBy,  setFilterBy] = useState<string>('');
  const [sortStack, setSortStack] = useState<SortEntry[]>([{ key: 'name', dir: 'asc' }]);
  const [groupBy,   setGroupBy]   = useState<string>('');
  const [sheetUrl,  setSheetUrl]  = useState<string | null>(null);

  /* ── Per-tab prefs: loaded from user settings, saved with debounce ── */
  const allUserPrefsRef = useRef<typeof DEFAULT_USER_PREFERENCES>({ ...DEFAULT_USER_PREFERENCES });
  const allTabPrefsRef  = useRef<Record<string, VaultTabPrefs>>({});
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyTabPrefs(p: VaultTabPrefs) {
    setLayout((p.layout as LayoutMode | undefined) ?? 'cards');
    setSortStack(p.sortStack ?? [{ key: 'name', dir: 'asc' }]);
    setFilterBy(p.filterBy ?? '');
    setGroupBy(p.groupBy ?? '');
  }

  function scheduleSave(tab: string, prefs: VaultTabPrefs) {
    allTabPrefsRef.current = { ...allTabPrefsRef.current, [tab]: prefs };
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(async () => {
      try {
        const merged = { ...allUserPrefsRef.current, vault_prefs: allTabPrefsRef.current };
        const updated = await updateUserSettings({ preferences: merged });
        allUserPrefsRef.current = updated.preferences;
      } catch { /* ignore */ }
    }, 800);
  }

  // Load per-tab prefs when vault opens
  useEffect(() => {
    if (!vaultOpen) return;
    let cancelled = false;
    getUserSettings().then(us => {
      if (cancelled) return;
      allUserPrefsRef.current = us.preferences;
      const vp = (us.preferences.vault_prefs ?? {}) as Record<string, VaultTabPrefs>;
      allTabPrefsRef.current = vp;
      const p = vp[(vaultTab || 'characters')];
      if (p) applyTabPrefs(p);
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultOpen]);

  // Save prefs when they change (debounced)
  useEffect(() => {
    if (!vaultOpen) return;
    const tab = (vaultTab || 'characters') as VaultTab;
    scheduleSave(tab, { layout, sortStack, filterBy, groupBy });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, sortStack, filterBy, groupBy]);

  const handleSort = useCallback((key: string) => {
    setSortStack(prev =>
      prev[0]?.key === key
        ? [{ key, dir: (prev[0].dir === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' }, ...prev.slice(1)]
        : [{ key, dir: 'asc' as const }, ...prev.filter(s => s.key !== key)].slice(0, 3)
    );
  }, []);

  const [detailEntry, setDetailEntry] = useState<AnyEntry | null | undefined>(undefined);
  // undefined = panel closed, null = new entry, AnyEntry = viewing/editing
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');

  const [vaultData, setVaultData] = useState<Record<VaultTab, AnyEntry[]>>({
    characters: [], npc: [], enemy: [], effects: [], abilities: [], items: [],
  });
  const [loading, setLoading] = useState(false);

  const activeTab = (vaultTab || 'characters') as VaultTab;

  /* ── Keep vault characters in sync when shared context updates ── */
  useEffect(() => {
    if (activeTab === 'characters') {
      setVaultData(prev => ({ ...prev, characters: sharedCharacters as any[] }));
    }
  }, [sharedCharacters, activeTab]);

  /* ── Keep vault creatures (npc/enemy) in sync via socket ── */
  useEffect(() => {
    return onCreatureUpdated(payload => {
      setVaultData(prev => ({
        ...prev,
        npc:   prev.npc.map((c: any)   => c.id === payload.id ? { ...c, ...payload } : c),
        enemy: prev.enemy.map((c: any) => c.id === payload.id ? { ...c, ...payload } : c),
      }));
    });
  }, []);

  /* ── Player-mode: characters always visible; other tabs only when players_can_see_vault ── */
  const visibleTabs = isDm
    ? TABS
    : TABS.filter(t => t.key === 'characters' || permissions.players_can_see_vault);

  /* ── Load data from API when vault opens or tab changes ── */
  const loadData = useCallback(async () => {
    if (!activeCampaignId) return;
    setLoading(true);
    try {
      if (activeTab === 'characters') {
        // characters are kept live in CampaignProvider — just sync the local snapshot
        setVaultData(prev => ({ ...prev, characters: sharedCharacters as any[] }));
      } else if (activeTab === 'npc' || activeTab === 'enemy') {
        const all = await creaturesApi.listCreatures(activeCampaignId);
        const npcs = all.filter(c => c.type === 'npc' || c.type === 'ally' || c.type === 'beast');
        const enemies = all.filter(c => c.type === 'enemy');
        setVaultData(prev => ({ ...prev, npc: npcs as any[], enemy: enemies as any[] }));
      } else if (activeTab === 'effects') {
        const effects = await effectsApi.listEffects(activeCampaignId);
        setVaultData(prev => ({ ...prev, effects: effects as any[] }));
      } else if (activeTab === 'abilities') {
        const abilities = await abilitiesApi.listAbilities(activeCampaignId);
        setVaultData(prev => ({ ...prev, abilities: abilities as any[] }));
      } else if (activeTab === 'items') {
        const items = await itemsApi.listItems(activeCampaignId);
        setVaultData(prev => ({ ...prev, items: items as any[] }));
      }
    } catch (err) {
      console.error('Failed to load vault data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCampaignId, activeTab, sharedCharacters]);

  useEffect(() => {
    if (vaultOpen && activeCampaignId) loadData();
  }, [vaultOpen, activeTab, activeCampaignId, loadData]);

  /* ── Save handler (calls API) ── */
  async function handleSave(saved: AnyEntry) {
    if (!activeCampaignId)
      throw new Error('No campaign selected — go to Home and enter a campaign first.');

    const isNew = !(saved as any).id || typeof (saved as any).id !== 'number' || (saved as any).id > 1e12;

    if (activeTab === 'characters') {
      const body = {
        name: (saved as Character).name,
        race: (saved as Character).race,
        class: (saved as Character).class,
        level: (saved as Character).level,
        stats: (saved as Character).stats as unknown as Record<string, number> | undefined,
        hp_max: (saved as Character).hp_max,
        hp_current: (saved as Character).hp_current,
        hp_temp: (saved as Character).hp_temp ?? 0,
        ac: (saved as Character).ac,
        speed: (saved as Character).speed,
        image: (saved as Character).image,
        backstory: (saved as Character).backstory,
      };
      if (isNew) {
        await campaignsApi.createCharacter(activeCampaignId, body);
        await refreshCharacters();
      } else {
        await campaignsApi.updateCharacter((saved as any).id, body);
        // socket 'character:updated' will propagate the change via CampaignProvider
      }
    } else if (activeTab === 'npc' || activeTab === 'enemy') {
      const body: any = {
        name: (saved as Creature).name,
        type: (saved as Creature).type,
        cr: (saved as Creature).cr,
        size: (saved as Creature).size,
        stats: (saved as Creature).stats,
        hp_max: (saved as Creature).hp_max,
        hp_current: (saved as Creature).hp_current,
        hp_temp: (saved as Creature).hp_temp ?? 0,
        ac: (saved as Creature).ac,
        speed: (saved as Creature).speed,
        race: (saved as Creature).race ?? null,
        religion: (saved as Creature).religion ?? null,
        image: (saved as Creature).image,
        sheet_image: (saved as Creature).sheet_image ?? null,
        notes: (saved as Creature).notes,
        tags: (saved as Creature).tags ?? null,
        is_active: (saved as Creature).is_active,
      };
      if (isNew) await creaturesApi.createCreature(activeCampaignId, body);
      else       await creaturesApi.updateCreature((saved as any).id, body);
      // For new creatures loadData fetches the new row; for updates socket handles it
      if (isNew) await loadData();
    } else if (activeTab === 'effects') {
      const body: any = {
        name: (saved as Effect).name,
        description: (saved as Effect).description,
        duration: (saved as Effect).duration,
        trigger_moment: (saved as Effect).trigger_moment,
        damage: (saved as Effect).damage,
        damage_type: (saved as Effect).damage_type,
        save_type: (saved as Effect).save_type,
        save_dc: (saved as Effect).save_dc,
        apply_on_save: (saved as Effect).apply_on_save,
        conditions: (saved as Effect).conditions,
        stat_modifiers: (saved as Effect).stat_modifiers,
        is_concentration: (saved as Effect).is_concentration,
      };
      if (isNew) await effectsApi.createEffect(activeCampaignId, body);
      else       await effectsApi.updateEffect((saved as any).id, body);
      await loadData();
    } else if (activeTab === 'abilities') {
      const body: any = {
        name: (saved as Ability).name,
        description: (saved as Ability).description,
        action_type: (saved as Ability).action_type,
        damage: (saved as Ability).damage,
        damage_type: (saved as Ability).damage_type,
        hit_bonus: (saved as Ability).hit_bonus,
        range: (saved as Ability).range,
        cooldown: (saved as Ability).cooldown,
        uses_max: (saved as Ability).uses_max,
        uses_current: (saved as Ability).uses_current,
      };
      if (isNew) await abilitiesApi.createAbility(activeCampaignId, body);
      else       await abilitiesApi.updateAbility((saved as any).id, body);
      await loadData();
    } else {
      const body: any = {
        name: (saved as Item).name,
        description: (saved as Item).description,
        type: (saved as Item).type,
        rarity: (saved as Item).rarity,
        quantity: (saved as Item).quantity,
        weight: (saved as Item).weight,
        value: (saved as Item).value,
        is_equipped: (saved as Item).is_equipped,
        is_attuned: (saved as Item).is_attuned,
      };
      if (isNew) await itemsApi.createItem(activeCampaignId, body);
      else       await itemsApi.updateItem((saved as any).id, body);
      await loadData();
    }

    setDetailEntry(undefined);
  }

  async function handleDelete(entry: AnyEntry) {
    const id = (entry as any).id;
    if (!id) return;
    const entryName = (entry as any).name ?? 'this entry';
    if (!window.confirm(`Delete "${entryName}"? This cannot be undone.`)) return;
    try {
      if (activeTab === 'characters') {
        await campaignsApi.deleteCharacter(id);
        await refreshCharacters();
      } else {
        if (activeTab === 'npc' || activeTab === 'enemy') await creaturesApi.deleteCreature(id);
        else if (activeTab === 'effects')                 await effectsApi.deleteEffect(id);
        else if (activeTab === 'abilities')               await abilitiesApi.deleteAbility(id);
        else                                               await itemsApi.deleteItem(id);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  const rawData = vaultData[activeTab];

  /* ── All tags from npc/enemy data (for drawer autocomplete) ── */
  const npcEnemyTags = useMemo(() => {
    const tagSet = new Set<string>();
    [...vaultData.npc, ...vaultData.enemy].forEach(e =>
      ((e as any).tags ?? []).forEach((t: string) => tagSet.add(t))
    );
    return Array.from(tagSet).sort();
  }, [vaultData.npc, vaultData.enemy]);

  /* ── Dynamic filter options ── */
  const filterOptions = useMemo(() => {
    const seen = new Set<string>();
    const byGroup: Record<string, { value: string; label: string }[]> = {};
    const add = (group: string, val: string, label?: string) => {
      const key = `${group}|${val}`;
      if (!val || seen.has(key)) return;
      seen.add(key);
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push({ value: val, label: label ?? val });
    };

    for (const entry of rawData) {
      const e = entry as any;
      if (activeTab === 'characters') {
        if (e.race)  add('Race',  e.race);
        if (e.class) add('Class', e.class);
      } else if (activeTab === 'npc' || activeTab === 'enemy') {
        (e.tags ?? []).forEach((t: string) => add('Tag', t));
        if (e.race)     add('Race',     e.race);
        if (e.religion) add('Religion', e.religion);
        if (e.size)     add('Size',     e.size);
        if (e.cr)       add('CR',       String(e.cr), `CR ${e.cr}`);
      } else if (activeTab === 'effects') {
        if (e.damage_type)    add('Damage type',    e.damage_type);
        if (e.trigger_moment) add('Trigger moment', e.trigger_moment);
        if (e.save_type)      add('Save type',      e.save_type);
      } else if (activeTab === 'abilities') {
        if (e.action_type) add('Action type', e.action_type);
        if (e.damage_type) add('Damage type', e.damage_type);
        if (e.cooldown)    add('Cooldown',    String(e.cooldown));
      } else if (activeTab === 'items') {
        if (e.type)   add('Type',   e.type,   e.type.charAt(0).toUpperCase() + e.type.slice(1));
        if (e.rarity) add('Rarity', e.rarity, e.rarity.replace('_', ' '));
      }
    }
    return Object.entries(byGroup).flatMap(([group, items]) =>
      items.sort((a, b) => a.label.localeCompare(b.label)).map(o => ({ ...o, group }))
    );
  }, [rawData, activeTab]);

  /* ── Dynamic group-by options ── */
  const groupByOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (activeTab === 'characters') {
      if (rawData.some(e => (e as any).class)) opts.push({ value: 'class', label: 'Class' });
      if (rawData.some(e => (e as any).race))  opts.push({ value: 'race',  label: 'Race'  });
    } else if (activeTab === 'npc' || activeTab === 'enemy') {
      if (rawData.some(e => (e as any).size))     opts.push({ value: 'size',     label: 'Size'     });
      if (rawData.some(e => (e as any).race))     opts.push({ value: 'race',     label: 'Race'     });
      if (rawData.some(e => (e as any).religion)) opts.push({ value: 'religion', label: 'Religion' });
      const maxTags = rawData.reduce((max, e) => Math.max(max, ((e as any).tags ?? []).length), 0);
      for (let i = 0; i < maxTags; i++) {
        opts.push({ value: `tag_${i}`, label: `Tag #${i + 1}` });
      }
    } else if (activeTab === 'items') {
      if (rawData.some(e => (e as any).type))   opts.push({ value: 'type',   label: 'Type'   });
      if (rawData.some(e => (e as any).rarity)) opts.push({ value: 'rarity', label: 'Rarity' });
    } else if (activeTab === 'abilities') {
      if (rawData.some(e => (e as any).action_type)) opts.push({ value: 'action_type', label: 'Action type' });
    }
    return opts;
  }, [rawData, activeTab]);

  /* ── Sort options ── */
  const orderOptions: { value: string; label: string }[] = [
    { value: 'name', label: 'Name' },
    ...(activeTab === 'characters' ? [
      { value: 'race',  label: 'Race'  }, { value: 'class', label: 'Class' },
      { value: 'level', label: 'Level' }, { value: 'hp',    label: 'HP Max' },
      { value: 'hp_curr', label: 'HP Curr' }, { value: 'ac', label: 'AC' },
      { value: 'speed', label: 'Speed' },
    ] : []),
    ...((activeTab === 'npc' || activeTab === 'enemy') ? [
      { value: 'race',  label: 'Race'  }, { value: 'size',  label: 'Size'  },
      { value: 'cr',    label: 'CR'    }, { value: 'hp',    label: 'HP Max' },
      { value: 'hp_curr', label: 'HP Curr' }, { value: 'ac', label: 'AC' },
      { value: 'tags',  label: 'Tags'  },
    ] : []),
    ...(activeTab === 'effects' ? [
      { value: 'duration',       label: 'Duration' }, { value: 'damage_type', label: 'Damage' },
      { value: 'trigger_moment', label: 'Trigger'  }, { value: 'save_type',   label: 'Save'   },
    ] : []),
    ...(activeTab === 'abilities' ? [
      { value: 'action_type', label: 'Action'   }, { value: 'range',       label: 'Range'    },
      { value: 'damage_type', label: 'Damage'   }, { value: 'hit_bonus',   label: 'Hit'      },
      { value: 'cooldown',    label: 'Cooldown'  },
    ] : []),
    ...(activeTab === 'items' ? [
      { value: 'type',     label: 'Type'   }, { value: 'rarity', label: 'Rarity' },
      { value: 'quantity', label: 'Qty'    }, { value: 'value',  label: 'Value'  },
    ] : []),
  ];

  /* ── Filter + sort ── */
  const filtered = useMemo(() => {
    let data = [...rawData];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(d => {
        const e = d as any;
        if (e.name?.toLowerCase().includes(q)) return true;
        if (Array.isArray(e.tags) && e.tags.some((t: string) => t.toLowerCase().includes(q))) return true;
        const textFields = [
          'race','religion','class','type','rarity','action_type','damage_type',
          'cr','size','duration','trigger_moment','range','cooldown',
          'description','notes','backstory','save_type',
        ] as const;
        return textFields.some(f => e[f]?.toString().toLowerCase().includes(q));
      });
    }

    if (filterBy) {
      data = data.filter(d => {
        const e = d as any;
        if (Array.isArray(e.tags) && e.tags.some((t: string) => t.toLowerCase() === filterBy.toLowerCase())) return true;
        return Object.values(e).some(v =>
          typeof v === 'string' && v.toLowerCase() === filterBy.toLowerCase()
        );
      });
    }

    const RARITY_ORDER = ['common','uncommon','rare','very_rare','legendary','artifact'];
    const cmpVal = (key: string, a: any, b: any, dir: 'asc'|'desc'): number => {
      let c = 0;
      switch (key) {
        case 'name':           c = (a.name ?? '').localeCompare(b.name ?? ''); break;
        case 'race':           c = (a.race ?? '').localeCompare(b.race ?? ''); break;
        case 'size':           c = (a.size ?? '').localeCompare(b.size ?? ''); break;
        case 'class':          c = (a.class ?? '').localeCompare(b.class ?? ''); break;
        case 'action_type':    c = (a.action_type ?? '').localeCompare(b.action_type ?? ''); break;
        case 'damage_type':    c = (a.damage_type ?? '').localeCompare(b.damage_type ?? ''); break;
        case 'duration':       c = (a.duration ?? '').localeCompare(b.duration ?? ''); break;
        case 'trigger_moment': c = (a.trigger_moment ?? '').localeCompare(b.trigger_moment ?? ''); break;
        case 'save_type':      c = (a.save_type ?? '').localeCompare(b.save_type ?? ''); break;
        case 'range':          c = (a.range ?? '').localeCompare(b.range ?? ''); break;
        case 'cooldown':       c = (a.cooldown ?? '').localeCompare(b.cooldown ?? ''); break;
        case 'type':           c = (a.type ?? '').localeCompare(b.type ?? ''); break;
        case 'value':          c = (a.value ?? '').localeCompare(b.value ?? ''); break;
        case 'tags':           c = (a.tags?.[0] ?? '').localeCompare(b.tags?.[0] ?? ''); break;
        case 'rarity':         c = RARITY_ORDER.indexOf(a.rarity ?? '') - RARITY_ORDER.indexOf(b.rarity ?? ''); break;
        case 'level':          c = (a.level      ?? 0) - (b.level      ?? 0); break;
        case 'hp':             c = (a.hp_max     ?? 0) - (b.hp_max     ?? 0); break;
        case 'hp_curr':        c = (a.hp_current ?? 0) - (b.hp_current ?? 0); break;
        case 'speed':          c = (a.speed      ?? 0) - (b.speed      ?? 0); break;
        case 'ac':             c = (a.ac         ?? 0) - (b.ac         ?? 0); break;
        case 'cr':             c = parseFloat(a.cr ?? '0') - parseFloat(b.cr ?? '0'); break;
        case 'hit_bonus':      c = (a.hit_bonus  ?? 0) - (b.hit_bonus  ?? 0); break;
        case 'quantity':       c = (a.quantity   ?? 0) - (b.quantity   ?? 0); break;
        case 'is_equipped':    c = (a.is_equipped ? 1 : 0) - (b.is_equipped ? 1 : 0); break;
      }
      return dir === 'desc' ? -c : c;
    };
    data.sort((a, b) => {
      for (const { key, dir } of sortStack) {
        const c = cmpVal(key, a as any, b as any, dir);
        if (c !== 0) return c;
      }
      return 0;
    });
    return data;
  }, [rawData, search, filterBy, sortStack]);

  /* ── Grouping ── */
  const grouped = useMemo(() => {
    if (!groupBy) return [{ key: null as string | null, entries: filtered }];
    const map = new Map<string, AnyEntry[]>();
    for (const entry of filtered) {
      const e = entry as any;
      let key: string;
      if (groupBy.startsWith('tag_')) {
        const idx = parseInt(groupBy.slice(4), 10);
        const tagVal = ((e.tags as string[]) ?? [])[idx];
        key = tagVal != null ? tagVal : '— Untagged —';
      } else {
        const val = e[groupBy];
        key = val != null && val !== '' ? String(val) : '— Unknown —';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        const aSpecial = a.startsWith('—');
        const bSpecial = b.startsWith('—');
        if (aSpecial && !bSpecial) return 1;
        if (!aSpecial && bSpecial) return -1;
        return a.localeCompare(b);
      })
      .map(([key, entries]) => ({ key, entries }));
  }, [filtered, groupBy]);

  if (!vaultOpen) return null;



  return (
    <div className={`vault-fullscreen${sidebarCollapsed ? ' vault-fullscreen--collapsed' : ''}`}>
      {/* ── Tab bar ── */}
      <nav className="vault__tabbar">
        <div className="vault__tabbar-left">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`vault__navtab${activeTab === key ? ' vault__navtab--active' : ''}`}
              onClick={() => {
                // Save current tab prefs to cache before switching
                allTabPrefsRef.current[activeTab] = { layout, sortStack, filterBy, groupBy };
                openVault(key);
                setSearch('');
                // Load the new tab's prefs (or defaults)
                const p = allTabPrefsRef.current[key];
                if (p) applyTabPrefs(p);
                else { setFilterBy(''); setSortStack([{ key: 'name', dir: 'asc' }]); setGroupBy(''); setLayout('cards'); }
                setDetailEntry(undefined); setDetailMode('view');
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <button className="vault__navtab vault__navtab--close" onClick={closeVault} title="Close Vault">
          <X size={16} />
        </button>
      </nav>

      {/* ── Toolbar ── */}
      <div className="vault__toolbar">
        <SearchBar
          placeholder={`Search ${activeTab}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          className="vault__searchbar"
        />

        <Select variant="compact" icon={<ArrowUpDown size={13} />}
          value={sortStack[0]?.key ?? 'name'}
          onChange={e => handleSort(e.target.value)}
          options={orderOptions}
        />
        <button
          className="vault__sort-dir"
          onClick={() => handleSort(sortStack[0]?.key ?? 'name')}
          title={sortStack[0]?.dir === 'desc' ? 'Descending — click to ascend' : 'Ascending — click to descend'}
        >
          {sortStack[0]?.dir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>

        <Select variant="compact" icon={<SlidersHorizontal size={13} />}
          value={filterBy} onChange={e => setFilterBy(e.target.value)}
          placeholder="FilterBy"
          options={filterOptions}
        />

        <Select variant="compact" icon={<Layers size={13} />}
          value={groupBy} onChange={e => setGroupBy(e.target.value)}
          placeholder="GroupBy"
          options={groupByOptions}
        />

        <div className="vault__layout-toggle">
          <button
            className={`vault__layout-btn${layout === 'list' ? ' vault__layout-btn--active' : ''}`}
            onClick={() => setLayout('list')} title="List view"
          >
            <LayoutList size={15} />
          </button>
          <button
            className={`vault__layout-btn${layout === 'cards' ? ' vault__layout-btn--active' : ''}`}
            onClick={() => setLayout('cards')} title="Card view"
          >
            <LayoutGrid size={15} />
          </button>
        </div>

        {isDm && (
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setDetailEntry(null); setDetailMode('edit'); }}>
            Add
          </Button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="vault__body">
        <div className="vault__content">
          {loading && (
            <div className="vault__empty"><p>Loading…</p></div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="vault__empty">
              <p>No {activeTab} found.</p>
              <span>Try a different search or add a new entry.</span>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <>
              {layout === 'list' && <VaultListHeader tab={activeTab} sortStack={sortStack} onSort={handleSort} />}
              {grouped.map(({ key, entries }) => (
                <div key={key ?? '__all'} className="vault__group">
                  {groupBy && key !== null && <GroupSeparator label={key} />}
                  {layout === 'list' ? (
                    <div className="vault__list">
                      {entries.map(entry => (
                        <VaultListRow
                          key={(entry as any).id}
                          tab={activeTab}
                          entry={entry}
                          onView={() => { setDetailEntry(entry); setDetailMode('view'); }}
                          onSheet={url => setSheetUrl(url)}
                          onEdit={(isDm || (activeTab === 'characters' && permissions.players_can_edit_own_character && (entry as any).player_id === user?.id))
                            ? () => { setDetailEntry(entry); setDetailMode('edit'); }
                            : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="vault__cards">
                      {entries.map(entry => (
                        <VaultCard
                          key={(entry as any).id}
                          tab={activeTab}
                          entry={entry}
                          onView={() => { setDetailEntry(entry); setDetailMode('view'); }}
                          onSheet={url => setSheetUrl(url)}
                          onEdit={(isDm || (activeTab === 'characters' && permissions.players_can_edit_own_character && (entry as any).player_id === user?.id))
                            ? () => { setDetailEntry(entry); setDetailMode('edit'); }
                            : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {detailEntry !== undefined && (
          <VaultDetailPanel
            key={`${(detailEntry as any)?.id ?? 'new'}`}
            tab={activeTab}
            entry={detailEntry}
            mode={detailMode}
            isDm={isDm}
            userId={user?.id}
            canEdit={isDm || (activeTab === 'characters' && permissions.players_can_edit_own_character && (detailEntry as any)?.player_id === user?.id)}
            onClose={() => { setDetailEntry(undefined); setDetailMode('view'); }}
            onSwitchToEdit={() => setDetailMode('edit')}
            onSave={handleSave}
            onDelete={isDm && detailEntry !== null ? () => { handleDelete(detailEntry!); setDetailEntry(undefined); } : undefined}
            existingTags={npcEnemyTags}
          />
        )}
      </div>
      {sheetUrl && <SheetViewer url={sheetUrl} onClose={() => setSheetUrl(null)} />}
    </div>
  );
}
