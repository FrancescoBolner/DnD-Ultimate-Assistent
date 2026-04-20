import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Square, Columns2, LayoutTemplate, LayoutGrid, Loader2, ExternalLink, X as XIcon,
  FolderOpen, Save as SaveIcon,
} from 'lucide-react';
import PluginShell from '../../PluginShell';
import { HpBar, Switch } from '../../../ui';
import { ComboSearch } from '../../../ui';
import type { ComboSearchItem } from '../../../ui';
import { useCampaign } from '../../../../app/providers/useCampaign';
import { CampaignContext } from '../../../../app/providers/CampaignContext';
import * as creaturesApi from '../../../../services/api/creatures';
import * as itemsApi from '../../../../services/api/items';
import {
  getActiveScreen, pushScreen, stopScreen,
  listScreenPresets, saveScreenPreset, updateScreenPreset, deleteScreenPreset,
  type ScreenPresetData,
} from '../../../../services/api/screens';
import { onScreenUpdated, onCreatureUpdated } from '../../../../services/socket';
import { pluginRegistry } from '../../index';
import { ScreenEmbedContext } from '../../ScreenEmbedContext';
import type {
  Character, Creature, Item, PluginViewMode,
  ScreenLayoutData, ScreenPreset, ScreenAspect, ScreenSlot, ScreenSlotContent, ScreenSlotType,
  ScreenListEntry,
} from '../../../types';
import '../plugin-view.css';
import './screen-plugin.css';

// ─── Constants ────────────────────────────────────────────────

const PRESET_SLOT_IDS: Record<ScreenPreset, string[]> = {
  '1-big':  ['main'],
  '2-half': ['left', 'right'],
  '1+2':    ['main', 'rt', 'rb'],
  '4-grid': ['tl', 'tr', 'bl', 'br'],
};

const PRESET_LABELS: Record<ScreenPreset, string> = {
  '1-big':  '1 Full',
  '2-half': '2 Half',
  '1+2':    '1+2',
  '4-grid': '4 Grid',
};

const ASPECT_VALUES: ScreenAspect[] = ['16:9', '4:3', '21:9', '16:10'];

const SLOT_TYPES: ScreenSlotType[] = ['empty', 'text', 'image', 'entity', 'plugin'];
const SLOT_TYPE_LABELS: Record<ScreenSlotType, string> = {
  empty:       'Empty',
  text:        'Text',
  image:       'Image',
  entity:      'Entity',
  entity_list: 'Entity',
  plugin:      'Plugin',
};

function makeDefaultLayout(preset: ScreenPreset = '1-big'): ScreenLayoutData {
  return {
    preset,
    slots: PRESET_SLOT_IDS[preset].map(id => ({ id, content: { type: 'empty' } })),
    aspect: '16:9',
  };
}

// ─── Preset icon ──────────────────────────────────────────────

function PresetIcon({ preset }: { preset: ScreenPreset }) {
  const size = 14;
  if (preset === '1-big')  return <Square size={size} />;
  if (preset === '2-half') return <Columns2 size={size} />;
  if (preset === '1+2')    return <LayoutTemplate size={size} />;
  return <LayoutGrid size={size} />;
}

// ─── Helpers ──────────────────────────────────────────────────

type AnyEntity = Character | Creature | Item;
type EntityKind = 'character' | 'creature' | 'item';

function hasHp(e: AnyEntity): e is Character | Creature {
  return 'hp_current' in e && 'hp_max' in e;
}

function getImg(e: AnyEntity): string | undefined {
  return 'image' in e ? (e as Character | Creature).image : undefined;
}

// ─── Slot content display (read-only) ─────────────────────────

function TextDisplay({ content }: { content: ScreenSlotContent }) {
  return (
    <div className="scr-content scr-content--text">
      {content.text_title && <h3 className="scr-text-title">{content.text_title}</h3>}
      {content.text && <p className="scr-text-body">{content.text}</p>}
    </div>
  );
}

function ImageDisplay({ content }: { content: ScreenSlotContent }) {
  if (!content.image_url) return <div className="scr-content scr-content--empty">No image</div>;
  return (
    <div className="scr-content scr-content--image">
      <img src={content.image_url} alt="" className="scr-img" />
    </div>
  );
}

function EntityListDisplay({
  content, characters, creatures, items,
}: { content: ScreenSlotContent; characters: Character[]; creatures: Creature[]; items: Item[] }) {
  // Support both list-style entries and legacy single entity_id
  const entries = (content.entity_list_entries && content.entity_list_entries.length > 0)
    ? content.entity_list_entries
    : content.entity_id != null
      ? [{ type: content.entity_type ?? 'character' as 'character' | 'creature' | 'item', id: content.entity_id, show_hp: content.entity_show_hp !== false }]
      : [];

  const resolve = (entry: ScreenListEntry): AnyEntity | undefined => {
    if (entry.type === 'character') return characters.find(c => c.id === entry.id);
    if (entry.type === 'item')     return items.find(i => i.id === entry.id);
    return creatures.find(c => c.id === entry.id);
  };

  // Single entry → full card
  if (entries.length === 1) {
    const entry = entries[0];
    const entity = resolve(entry);
    if (!entity) return <div className="scr-content scr-content--empty">—</div>;
    const img = getImg(entity);
    const showHp   = entry.show_hp && hasHp(entity);
    const showName = entry.show_name !== false;
    const hasInfo  = showName || showHp;
    return (
      <div className="scr-content scr-content--entity">
        {img && (
          <div className="scr-entity-img-wrap">
            <img src={img} alt={entity.name} className="scr-entity-img" />
          </div>
        )}
        {hasInfo && (
          <div className="scr-entity-info">
            {showName && <div className="scr-entity-name">{entity.name}</div>}
            {showHp && hasHp(entity) && (
              <div className="scr-entity-hpbar">
                <HpBar current={entity.hp_current} max={entity.hp_max} size="sm" showLabel />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Multiple entries → list
  return (
    <div className="scr-content scr-content--entity-list">
      {entries.length === 0 && <div className="scr-content--empty">—</div>}
      {entries.map((entry, i) => {
        const e = resolve(entry);
        if (!e) return null;
        const img = getImg(e);
        const showHp = entry.show_hp && hasHp(e);
        return (
          <div key={`${entry.type}-${entry.id}-${i}`} className="scr-list-row">
            {img ? <img src={img} alt={e.name} className="scr-list-img" /> : <div className="scr-list-img scr-list-img--placeholder" />}
            {entry.show_name !== false && <span className="scr-list-name">{e.name}</span>}
            {showHp && hasHp(e) && (
              <div className="scr-list-hpbar">
                <HpBar current={e.hp_current} max={e.hp_max} size="sm" showLabel={false} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PluginSnapshotDisplay({ content }: { content: ScreenSlotContent }) {
  // Hook must be called before any conditional return
  const campaignCtx = useCampaign();
  const slug = content.plugin_slug;
  if (!slug || !(slug in pluginRegistry) || slug === 'screen') {
    return <div className="scr-content scr-content--empty">{slug ? `Plugin: ${slug}` : 'No plugin'}</div>;
  }
  const Comp = pluginRegistry[slug as keyof typeof pluginRegistry];
  // Force isDm=false so embedded plugins always render in player/read-only mode
  return (
    <ScreenEmbedContext.Provider value={true}>
      <CampaignContext.Provider value={{ ...campaignCtx, isDm: false }}>
        <div className="scr-content scr-content--plugin">
          <div className="scr-plugin-inner">
            <Comp viewMode="popup" />
          </div>
        </div>
      </CampaignContext.Provider>
    </ScreenEmbedContext.Provider>
  );
}

function SlotDisplay({
  slot, characters, creatures, items,
}: { slot: ScreenSlot; characters: Character[]; creatures: Creature[]; items: Item[] }) {
  const { content } = slot;
  if (content.type === 'empty')       return <div className="scr-slot__empty" />;
  if (content.type === 'text')        return <TextDisplay content={content} />;
  if (content.type === 'image')       return <ImageDisplay content={content} />;
  if (content.type === 'entity' || content.type === 'entity_list') return <EntityListDisplay content={content} characters={characters} creatures={creatures} items={items} />;
  if (content.type === 'plugin')      return <PluginSnapshotDisplay content={content} />;
  return null;
}

// ─── Screen display (exported for Screen page) ───────────────

export interface ScreenDisplayProps {
  layout: ScreenLayoutData;
  characters: Character[];
  creatures: Creature[];
  items: Item[];
  interactive?: boolean;
  selectedSlotId?: string | null;
  onSlotClick?: (id: string) => void;
}

export function ScreenDisplay({
  layout, characters, creatures, items,
  interactive = false, selectedSlotId, onSlotClick,
}: ScreenDisplayProps) {
  const presetClass = `scr-grid--${layout.preset.replace('+', 'p')}`;

  const [arW, arH] = layout.aspect.split(':').map(Number);

  return (
    <div
      className={`scr-display-wrap${layout.show_text_bg ? ' scr-display-wrap--text-bg' : ''}`}
      style={{ '--scr-ar-w': arW, '--scr-ar-h': arH } as React.CSSProperties}
    >
      <div
        className="scr-display"
        style={{
          aspectRatio: layout.aspect.replace(':', ' / '),
          backgroundImage: layout.bg_image ? `url(${layout.bg_image})` : undefined,
        }}
      >
        <div className={`scr-grid ${presetClass}`}>
          {layout.slots.map(slot => {
            const isSelected = selectedSlotId === slot.id;
            return (
              <div
                key={slot.id}
                className={[
                  'scr-slot',
                  `scr-slot--${slot.id}`,
                  interactive ? 'scr-slot--interactive' : '',
                  isSelected ? 'scr-slot--selected' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  gridArea: slot.id,
                  backgroundImage: slot.content.bg_image ? `url(${slot.content.bg_image})` : undefined,
                }}
                onClick={interactive ? () => onSlotClick?.(slot.id) : undefined}
              >
                <SlotDisplay slot={slot} characters={characters} creatures={creatures} items={items} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Slot editor (DM controller) ──────────────────────────────

function makeAllEntityItems(
  characters: Character[], creatures: Creature[], items: Item[],
): (ComboSearchItem & { _kind: EntityKind })[] {
  return [
    ...characters.map(c => ({ id: `char-${c.id}`, label: c.name, badge: 'Character', badgeVariant: 'npc', _kind: 'character' as const })),
    ...creatures.map(c => ({ id: `cre-${c.id}`, label: c.name, badge: c.type, badgeVariant: c.type, _kind: 'creature' as const })),
    ...items.map(i => ({ id: `item-${i.id}`, label: i.name, badge: 'Item', badgeVariant: 'item', _kind: 'item' as const })),
  ];
}

function SlotEditor({
  slot, onUpdate, characters, creatures, items, portalZ,
}: {
  slot: ScreenSlot;
  onUpdate: (content: ScreenSlotContent) => void;
  characters: Character[];
  creatures: Creature[];
  items: Item[];
  portalZ: number;
}) {
  const { content } = slot;

  const allEnabledPlugins = useMemo(
    () => Object.keys(pluginRegistry).filter(s => s !== 'screen'),
    [],
  );

  /* entity_list helpers */
  const listEntries = useMemo(() => content.entity_list_entries ?? [], [content.entity_list_entries]);
  const allItems = useMemo(() => makeAllEntityItems(characters, creatures, items), [characters, creatures, items]);
  const listExclude = useMemo(
    () => new Set(listEntries.map(e =>
      e.type === 'character' ? `char-${e.id}` : e.type === 'creature' ? `cre-${e.id}` : `item-${e.id}`,
    )),
    [listEntries],
  );

  const addListEntry = (item: ComboSearchItem) => {
    const kind = (item as unknown as { _kind: EntityKind })._kind;
    const rawId = String(item.id).replace(/^(char|cre|item)-/, '');
    const entry: ScreenListEntry = { type: kind, id: parseInt(rawId), show_hp: false, show_name: true };
    onUpdate({ ...content, entity_list_entries: [...listEntries, entry] });
  };

  const removeListEntry = (idx: number) => {
    onUpdate({ ...content, entity_list_entries: listEntries.filter((_, i) => i !== idx) });
  };

  const toggleEntryHp = (idx: number) => {
    onUpdate({ ...content, entity_list_entries: listEntries.map((e, i) => i === idx ? { ...e, show_hp: !e.show_hp } : e) });
  };

  const toggleEntryName = (idx: number) => {
    onUpdate({ ...content, entity_list_entries: listEntries.map((e, i) => i === idx ? { ...e, show_name: e.show_name === false } : e) });
  };

  return (
    <div className="scr-slot-editor">
      {/* Content type tabs */}
      <div className="scr-type-tabs">
        {SLOT_TYPES.map(t => (
          <button
            key={t}
            className={`scr-type-tab${content.type === t ? ' scr-type-tab--active' : ''}`}
            onClick={() => onUpdate({ type: t })}
          >
            {SLOT_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Text ── */}
      {content.type === 'text' && (
        <div className="scr-form">
          <input
            className="scr-form__input"
            placeholder="Title (optional)"
            value={content.text_title ?? ''}
            onChange={e => onUpdate({ ...content, text_title: e.target.value || undefined })}
          />
          <textarea
            className="scr-form__textarea"
            placeholder="Body text…"
            rows={4}
            value={content.text ?? ''}
            onChange={e => onUpdate({ ...content, text: e.target.value })}
          />
        </div>
      )}

      {/* ── Image ── */}
      {content.type === 'image' && (
        <div className="scr-form">
          <input
            className="scr-form__input"
            placeholder="Image URL"
            value={content.image_url ?? ''}
            onChange={e => onUpdate({ ...content, image_url: e.target.value || undefined })}
          />
          {content.image_url && (
            <img src={content.image_url} alt="preview" className="scr-form__img-preview" />
          )}
        </div>
      )}

      {/* ── Entity (unified — supports multiple entries) ── */}
      {(content.type === 'entity' || content.type === 'entity_list') && (
        <div className="scr-form">
          <ComboSearch
            items={allItems as unknown as ComboSearchItem[]}
            excludeIds={listExclude}
            placeholder="Add character / creature / item…"
            onSelect={addListEntry}
            clearOnSelect
            portalZIndex={portalZ}
          />
          <div className="scr-list-entries">
            {listEntries.length === 0 && <p className="scr-form__hint">Add entries above.</p>}
            {listEntries.map((entry, idx) => {
              const e = entry.type === 'character' ? characters.find(c => c.id === entry.id)
                : entry.type === 'item' ? items.find(i => i.id === entry.id)
                : creatures.find(c => c.id === entry.id);
              const canHp = entry.type !== 'item';
              return (
                <div key={idx} className="scr-list-entry">
                  <span className="scr-list-entry__name">{e?.name ?? `#${entry.id}`}</span>
                  <span className="scr-list-entry__type">{entry.type}</span>
                  <button
                    className={`scr-list-entry__hp${entry.show_name !== false ? ' scr-list-entry__hp--on' : ''}`}
                    onClick={() => toggleEntryName(idx)}
                    title={entry.show_name !== false ? 'Hide name' : 'Show name'}
                  >Name</button>
                  {canHp && (
                    <button
                      className={`scr-list-entry__hp${entry.show_hp ? ' scr-list-entry__hp--on' : ''}`}
                      onClick={() => toggleEntryHp(idx)}
                      title={entry.show_hp ? 'Hide HP' : 'Show HP'}
                    >HP</button>
                  )}
                  <button className="scr-list-entry__remove" onClick={() => removeListEntry(idx)}>
                    <XIcon size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Plugin ── */}
      {content.type === 'plugin' && (
        <div className="scr-form">
          <select
            className="scr-form__select"
            value={content.plugin_slug ?? ''}
            onChange={e => onUpdate({ ...content, plugin_slug: e.target.value || undefined })}
          >
            <option value="">— Select active plugin —</option>
            {allEnabledPlugins.map(s => (
              <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Per-slot background */}
      {content.type !== 'empty' && (
        <div className="scr-form scr-form--bg">
          <input
            className="scr-form__input"
            placeholder="Slot background URL (optional)"
            value={content.bg_image ?? ''}
            onChange={e => onUpdate({ ...content, bg_image: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Push button ──────────────────────────────────────────────

function PushButton({ busy, disabled, onClick }: {
  busy: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button className="scr-push-btn" onClick={onClick} disabled={disabled}>
      {busy ? <Loader2 size={14} className="scr-spin" /> : <Send size={14} />}
      Push to Screen
    </button>
  );
}

// ─── Strip missing entity entries from a loaded layout ────────

function cleanLayout(
  layout: ScreenLayoutData,
  characters: Character[],
  creatures:  Creature[],
  items:      Item[],
): ScreenLayoutData {
  if (!layout?.slots) return layout;
  const charIds = new Set(characters.map(c => c.id));
  const creIds  = new Set(creatures.map(c => c.id));
  const itemIds = new Set(items.map(i => i.id));
  return {
    ...layout,
    slots: layout.slots.map(slot => {
      const { content } = slot;
      if (content.type !== 'entity' && content.type !== 'entity_list') return slot;
      const entries = (content.entity_list_entries ?? []).filter(e => {
        if (e.type === 'character') return charIds.has(e.id);
        if (e.type === 'item')      return itemIds.has(e.id);
        return creIds.has(e.id);
      });
      if (entries.length === 0) return { ...slot, content: { type: 'empty' as const } };
      return { ...slot, content: { ...content, entity_list_entries: entries } };
    }),
  };
}

// ─── Screen Preset Panel ──────────────────────────────────────

interface ScreenPresetPanelProps {
  mode:          'save' | 'load';
  presets:       ScreenPresetData[];
  currentLayout: ScreenLayoutData;
  characters:    Character[];
  creatures:     Creature[];
  items:         Item[];
  campaignId:    number;
  onClose:         () => void;
  onLoad:          (layout: ScreenLayoutData) => void;
  onPresetsChange: (presets: ScreenPresetData[]) => void;
}

function ScreenPresetPanel({
  mode, presets, currentLayout, characters, creatures, items,
  campaignId, onClose, onLoad, onPresetsChange,
}: ScreenPresetPanelProps) {
  const [search,      setSearch]      = useState('');
  const [newName,     setNewName]     = useState('New Screen');
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId,    setSavingId]    = useState<number | null>(null);

  const filtered = presets.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteScreenPreset(campaignId, id);
    onPresetsChange(presets.filter(p => p.id !== id));
  };

  const handleCardClick = async (preset: ScreenPresetData) => {
    if (editingId === preset.id) return;
    if (mode === 'load') {
      onLoad(cleanLayout(preset.layout as unknown as ScreenLayoutData, characters, creatures, items));
      onClose();
    } else {
      setSavingId(preset.id);
      try {
        const updated = await updateScreenPreset(
          campaignId, preset.id,
          { layout: currentLayout as unknown as Record<string, unknown> },
        );
        onPresetsChange(presets.map(p => p.id === preset.id ? updated : p));
        onClose();
      } finally { setSavingId(null); }
    }
  };

  const handleSaveNew = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const saved = await saveScreenPreset(
      campaignId, newName.trim() || 'New Screen',
      currentLayout as unknown as Record<string, unknown>,
    );
    onPresetsChange([saved, ...presets]);
    onClose();
  };

  const startEdit = (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingName(name);
  };

  const commitEdit = async (id: number) => {
    if (editingName.trim()) {
      const updated = await updateScreenPreset(campaignId, id, { name: editingName.trim() });
      onPresetsChange(presets.map(p => p.id === id ? updated : p));
    }
    setEditingId(null);
  };

  return (
    <div className="scr-panel-overlay" onClick={onClose}>
      <div className="scr-panel" onClick={e => e.stopPropagation()}>
        <div className="scr-panel__header">
          <span className="scr-panel__title">
            {mode === 'save' ? 'Save Screen' : 'Load Screen'}
          </span>
          <button className="scr-panel__close" onClick={onClose}><XIcon size={16} /></button>
        </div>
        <input
          className="scr-panel__search"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="scr-panel__grid">
          {mode === 'save' && (
            <div className="scr-preset-card scr-preset-card--new">
              <div className="scr-preset-card__hint">+ Save as new</div>
              <input
                className="scr-preset-card__new-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="New Screen"
                onClick={e => e.stopPropagation()}
              />
              <button className="scr-preset-card__save-btn" onClick={handleSaveNew}>
                Save
              </button>
            </div>
          )}

          {filtered.map(preset => (
            <div
              key={preset.id}
              className={`scr-preset-card${savingId === preset.id ? ' scr-preset-card--saving' : ''}`}
              onClick={() => handleCardClick(preset)}
            >
              <button
                className="scr-preset-card__del"
                onClick={e => handleDelete(preset.id, e)}
                title="Delete"
              ><XIcon size={10} /></button>
              <div className="scr-preset-card__preview">
                <ScreenDisplay
                  layout={cleanLayout(
                    preset.layout as unknown as ScreenLayoutData,
                    characters, creatures, items,
                  )}
                  characters={characters}
                  creatures={creatures}
                  items={items}
                />
              </div>
              <div className="scr-preset-card__name">
                {editingId === preset.id ? (
                  <input
                    className="scr-preset-card__name-input"
                    value={editingName}
                    autoFocus
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => commitEdit(preset.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitEdit(preset.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span onClick={e => startEdit(preset.id, preset.name, e)}>
                    {preset.name}
                  </span>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="scr-panel__empty">
              {presets.length === 0 && !search ? 'No saved screens yet' : 'No results'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main plugin ──────────────────────────────────────────────

export function ScreenPlugin({ viewMode = 'widget' }: { viewMode?: PluginViewMode }) {
  const { activeCampaignId, isDm, characters } = useCampaign();

  const [draft, setDraft] = useState<ScreenLayoutData>(makeDefaultLayout());
  const [liveLayout, setLiveLayout] = useState<ScreenLayoutData | null>(null);
  const [slotBank, setSlotBank] = useState<ScreenSlotContent[]>(
    () => Array.from({ length: 4 }, () => ({ type: 'empty' as const })),
  );
  const [busy, setBusy] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [stopping, setStopping] = useState(false);
  const [presets, setPresets] = useState<ScreenPresetData[]>([]);
  const [panelMode, setPanelMode] = useState<'save' | 'load' | null>(null);
  const navigate = useNavigate();

  // ESC: close save/load panel first; if already closed, go to dashboard
  useEffect(() => {
    if (viewMode !== 'fullscreen') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (panelMode !== null) {
        e.stopPropagation();
        setPanelMode(null);
      } else {
        navigate('/');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewMode, panelMode, navigate]);

  // Stable ref so the socket subscription never has a stale campaignId
  const activeCampaignIdRef = useRef(activeCampaignId);
  useEffect(() => { activeCampaignIdRef.current = activeCampaignId; }, [activeCampaignId]);
  // Capture viewMode at mount (never changes per-instance) for use inside stable effect
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    if (!activeCampaignId) return;
    getActiveScreen(activeCampaignId).then(screen => {
      if (screen?.layout) {
        const layout = screen.layout as unknown as ScreenLayoutData;
        setLiveLayout(layout);
        setDraft(layout);
        // Seed slot bank from the loaded layout so preset changes don't lose data
        setSlotBank(prev => {
          const bank = [...prev];
          layout.slots.forEach((s, i) => { bank[i] = s.content; });
          return bank;
        });
      }
    });
    creaturesApi.listCreatures(activeCampaignId).then(setCreatures).catch(() => {});
    itemsApi.listItems(activeCampaignId).then(setItems).catch(() => {});
    listScreenPresets(activeCampaignId).then(setPresets).catch(() => {});
  }, [activeCampaignId]);

  // Subscribe to screen layout updates once — uses ref to avoid stale campaignId
  useEffect(() => {
    return onScreenUpdated(({ campaignId, layout }) => {
      if (campaignId !== activeCampaignIdRef.current) return;
      if (layout) {
        const newLayout = layout as ScreenLayoutData;
        setLiveLayout(newLayout);
        // In popup mode there's no draft editor, so keep draft in sync so
        // the push button (if shown) always re-publishes the current live layout.
        if (viewModeRef.current === 'popup') setDraft(newLayout);
      } else {
        setLiveLayout(null);
      }
    });
  }, []); // intentionally empty — reads from stable refs

  // Keep creature HP live (characters already come from useCampaign which is live)
  useEffect(() => {
    return onCreatureUpdated(payload => {
      setCreatures(prev => prev.map(c => c.id === payload.id ? { ...c, ...payload } as typeof c : c));
    });
  }, []);

  const handlePush = useCallback(async () => {
    if (!activeCampaignId || busy) return;
    setBusy(true);
    try {
      await pushScreen(activeCampaignId, draft as unknown as Record<string, unknown>);
      setLiveLayout(draft);
    } finally { setBusy(false); }
  }, [activeCampaignId, busy, draft]);

  const handleStop = useCallback(async () => {
    if (!activeCampaignId || stopping) return;
    setStopping(true);
    try {
      await stopScreen(activeCampaignId);
      setLiveLayout(null);
    } finally { setStopping(false); }
  }, [activeCampaignId, stopping]);

  const changePreset = (preset: ScreenPreset) => {
    // Flush current draft slots into the bank by position before switching
    const updatedBank = [...slotBank];
    draft.slots.forEach((s, i) => { updatedBank[i] = s.content; });
    setSlotBank(updatedBank);
    // Restore from bank for the new preset
    setDraft(prev => ({
      ...prev,
      preset,
      slots: PRESET_SLOT_IDS[preset].map((id, i) => ({
        id,
        content: updatedBank[i] ?? { type: 'empty' },
      })),
    }));
    setSelectedSlotId(null);
  };

  const updateSlot = (slotId: string, content: ScreenSlotContent) => {
    setDraft(prev => ({
      ...prev,
      slots: prev.slots.map(s => s.id === slotId ? { ...s, content } : s),
    }));
  };

  const selectedSlot = draft.slots.find(s => s.id === selectedSlotId) ?? null;
  const pushDisabled = busy || !activeCampaignId || !isDm;
  const screenPageUrl = activeCampaignId ? `/screen/${activeCampaignId}` : null;

  /* ── Popup: read-only display + DM controls ── */
  if (viewMode === 'popup') {
    return (
      <PluginShell slug="screen" viewMode="popup">
        <div className="scr scr--display plugin-view">
          {liveLayout
            ? <ScreenDisplay layout={liveLayout} characters={characters} creatures={creatures} items={items} />
            : <div className="scr__no-screen">No active screen</div>
          }
        </div>
      </PluginShell>
    );
  }

  /* ── Widget: player view — centered open button ── */
  if (viewMode === 'widget' && !isDm) {
    return (
      <PluginShell slug="screen" viewMode="widget">
        <div className="scr scr--widget plugin-view scr--widget-player">
          {screenPageUrl ? (
            <a href={screenPageUrl} target="_blank" rel="noopener noreferrer" className="scr-player-open-btn">
              <ExternalLink size={18} />
              Open Screen
            </a>
          ) : (
            <span className="scr__no-screen">No active campaign</span>
          )}
        </div>
      </PluginShell>
    );
  }

  /* ── Widget: compact controller ── */
  if (viewMode === 'widget') {
    return (
      <PluginShell slug="screen" viewMode="widget">
        <div className="scr scr--widget plugin-view">
          <div className="scr-mini-preview">
            <ScreenDisplay
              layout={draft} characters={characters} creatures={creatures} items={items}
              interactive={isDm} selectedSlotId={selectedSlotId}
              onSlotClick={id => setSelectedSlotId(prev => prev === id ? null : id)}
            />
          </div>

          {isDm && selectedSlot && (
            <SlotEditor
              slot={selectedSlot} characters={characters} creatures={creatures} items={items}
              onUpdate={content => updateSlot(selectedSlot.id, content)} portalZ={1000}
            />
          )}

          <div className="scr-widget-footer">
            <span className={`scr-status${liveLayout ? ' scr-status--live' : ''}`}>
              {liveLayout ? '● Live' : '○ No screen'}
            </span>
            <div className="scr-widget-footer__actions">
              {screenPageUrl && (
                <a href={screenPageUrl} target="_blank" rel="noopener noreferrer" className="scr-open-btn" title="Open screen in new window">
                  <ExternalLink size={14} /> Open
                </a>
              )}
              {isDm && liveLayout && (
                <button className="scr-stop-btn" onClick={handleStop} disabled={stopping} title="Stop screen">
                  {stopping ? <Loader2 size={14} className="scr-spin" /> : <Square size={14} />}
                </button>
              )}
              {isDm && <PushButton busy={busy} disabled={pushDisabled} onClick={handlePush} />}
            </div>
          </div>
        </div>
      </PluginShell>
    );
  }

  /* ── Fullscreen: player — live screen display ── */
  if (viewMode === 'fullscreen' && !isDm) {
    return (
      <PluginShell slug="screen" viewMode="fullscreen">
        <div className="scr scr--display plugin-view">
          {liveLayout
            ? <ScreenDisplay layout={liveLayout} characters={characters} creatures={creatures} items={items} />
            : <div className="scr__no-screen">No active screen</div>
          }
        </div>
      </PluginShell>
    );
  }

  /* ── Fullscreen: full controller ── */
  return (
    <PluginShell slug="screen" viewMode="fullscreen">
      <div className="scr scr--ctrl plugin-view">

        <div className="scr-ctrl-left">
          <section className="scr-section">
            <div className="scr-section__label">Layout</div>
            <div className="scr-preset-bar">
              {(Object.keys(PRESET_SLOT_IDS) as ScreenPreset[]).map(p => (
                <button key={p} className={`scr-preset-btn${draft.preset === p ? ' scr-preset-btn--active' : ''}`}
                  onClick={() => changePreset(p)} title={PRESET_LABELS[p]}>
                  <PresetIcon preset={p} /> <span>{PRESET_LABELS[p]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="scr-section">
            <div className="scr-section__label">Aspect Ratio</div>
            <div className="scr-aspect-row">
              {ASPECT_VALUES.map(a => (
                <button key={a} className={`scr-aspect-btn${draft.aspect === a ? ' scr-aspect-btn--active' : ''}`}
                  onClick={() => setDraft(prev => ({ ...prev, aspect: a }))}>
                  {a}
                </button>
              ))}
            </div>
          </section>

          <section className="scr-section">
            <div className="scr-section__label">Background Image URL</div>
            <input className="scr-bg-input" placeholder="https://…"
              value={draft.bg_image ?? ''}
              onChange={e => setDraft(prev => ({ ...prev, bg_image: e.target.value || undefined }))} />
          </section>

          <section className="scr-section">
            <Switch
              label="Background tint behind text"
              checked={draft.show_text_bg ?? false}
              onChange={v => setDraft(prev => ({ ...prev, show_text_bg: v }))}
            />
          </section>

          {selectedSlot ? (
            <section className="scr-section scr-section--slot-editor">
              <div className="scr-section__label">Slot: <code>{selectedSlot.id}</code></div>
              <SlotEditor
                slot={selectedSlot} characters={characters} creatures={creatures} items={items}
                onUpdate={content => updateSlot(selectedSlot.id, content)} portalZ={5000}
              />
            </section>
          ) : (
            <div className="scr-slot-hint">Click a slot in the preview to edit it</div>
          )}

          {isDm && (
            <div className="scr-preset-btns">
              <button className="scr-preset-btns__btn" onClick={() => setPanelMode('load')}>
                <FolderOpen size={13} /> Load
              </button>
              <button className="scr-preset-btns__btn" onClick={() => setPanelMode('save')}>
                <SaveIcon size={13} /> Save
              </button>
            </div>
          )}
        </div>

        <div className="scr-ctrl-right">
          <div className="scr-section__label scr-section__label--preview">
            Draft Preview — click a slot to edit
          </div>

          <ScreenDisplay
            layout={draft} characters={characters} creatures={creatures} items={items}
            interactive selectedSlotId={selectedSlotId}
            onSlotClick={id => setSelectedSlotId(prev => prev === id ? null : id)}
          />

          {isDm && (
            <div className="scr-ctrl-push-row">
              <span className={`scr-status${liveLayout ? ' scr-status--live' : ''}`}>
                {liveLayout ? '● Screen active' : '○ No screen pushed yet'}
              </span>
              <div className="scr-ctrl-push-row__actions">
                {screenPageUrl && (
                  <a href={screenPageUrl} target="_blank" rel="noopener noreferrer"
                    className="scr-open-btn" title="Open screen page in a new window">
                    <ExternalLink size={14} /> Open Screen
                  </a>
                )}
                {liveLayout && (
                  <button className="scr-stop-btn" onClick={handleStop} disabled={stopping} title="Stop screen">
                    {stopping ? <Loader2 size={14} className="scr-spin" /> : <Square size={14} />}
                    Stop
                  </button>
                )}
                <PushButton busy={busy} disabled={pushDisabled} onClick={handlePush} />
              </div>
            </div>
          )}
        </div>

      </div>

      {panelMode && activeCampaignId && (
        <ScreenPresetPanel
          mode={panelMode}
          presets={presets}
          currentLayout={draft}
          characters={characters}
          creatures={creatures}
          items={items}
          campaignId={activeCampaignId}
          onClose={() => setPanelMode(null)}
          onLoad={layout => { setDraft(layout); setSelectedSlotId(null); }}
          onPresetsChange={setPresets}
        />
      )}
    </PluginShell>
  );
}
