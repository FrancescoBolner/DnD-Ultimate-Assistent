import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Sword, Heart, ShieldCheck, Wind, Skull, Plus, Pencil, Trash2, Check, X, BookOpen } from 'lucide-react';
import PluginShell from '../../PluginShell';
import { Avatar, HpBar, Spinner, StatRow } from '../../../ui';
import { FilterBar } from '../../../ui/blocks/FilterBar';
import { useCampaign } from '../../../../app/providers/useCampaign';
import * as api from '../../../../services/api/creatures';
import { onCreatureUpdated } from '../../../../services/socket';
import type { Creature } from '../../../types';
import type { PluginViewMode } from '../../../types';
import { SheetViewer } from '../sheet/SheetViewer';
import '../plugin-view.css';
import '../characters/characters-plugin.css';
import './creatures-plugin.css';

/* â”€â”€ Types â”€â”€ */
type CreatureType = Creature['type'];
type CreatureSize = Creature['size'];
interface CreatureDraft {
  name: string; type: CreatureType; cr: string; size: CreatureSize;
  hp_max: number; hp_current: number; hp_temp: number;
  ac: number; speed: number;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  notes: string;
  image: string;
  sheet_image: string;
}

const EMPTY: CreatureDraft = {
  name: '', type: 'npc', cr: '', size: 'medium',
  hp_max: 10, hp_current: 10, hp_temp: 0,
  ac: 10, speed: 30,
  str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
  notes: '',
  image: '',
  sheet_image: '',
};

function toDraft(c: Creature): CreatureDraft {
  return {
    name: c.name, type: c.type, cr: c.cr ?? '', size: c.size,
    hp_max: c.hp_max, hp_current: c.hp_current, hp_temp: c.hp_temp ?? 0,
    ac: c.ac, speed: c.speed,
    str: c.stats?.str ?? 10, dex: c.stats?.dex ?? 10, con: c.stats?.con ?? 10,
    int: c.stats?.int ?? 10, wis: c.stats?.wis ?? 10, cha: c.stats?.cha ?? 10,
    notes: c.notes ?? '',
    image: c.image ?? '',
    sheet_image: c.sheet_image ?? '',
  };
}

const TYPES: CreatureType[] = ['npc', 'enemy', 'ally', 'beast'];
const TYPE_LABELS: Record<CreatureType, string> = { npc: 'NPC', enemy: 'Enemy', ally: 'Ally', beast: 'Beast' };
const SIZES: CreatureSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/* ── Damage / Heal form ─────────────────────────────────────── */
function DmgForm({
  id, current, max, temp = 0, compact = false, onApply,
}: {
  id: number; current: number; max: number; temp?: number; compact?: boolean;
  onApply: (id: number, next: { hp_current: number; hp_temp: number }) => void;
}) {
  const [val, setVal] = useState('');
  function apply(sign: 1 | -1) {
    const n = Math.abs(parseInt(val, 10));
    if (!n) return;
    let nextCurrent = current;
    let nextTemp    = temp;
    if (sign === -1) {
      const absorbed = Math.min(nextTemp, n);
      nextTemp    -= absorbed;
      nextCurrent  = Math.max(0, nextCurrent - (n - absorbed));
    } else {
      nextCurrent = Math.min(max, nextCurrent + n);
    }
    onApply(id, { hp_current: nextCurrent, hp_temp: nextTemp });
    setVal('');
  }
  return (
    <div className={`chr-dmg${compact ? ' chr-dmg--compact' : ''}`}>
      <button className="chr-dmg__btn chr-dmg__btn--dmg" type="button" onClick={() => apply(-1)}>
        <Sword size={11} />{!compact && <span>Dmg</span>}
      </button>
      <input
        className="chr-dmg__input" type="number" min={0} placeholder="0"
        value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') apply(-1); }}
      />
      <button className="chr-dmg__btn chr-dmg__btn--heal" type="button" onClick={() => apply(1)}>
        <Heart size={11} />{!compact && <span>Heal</span>}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export function CreaturesPlugin({ viewMode = 'widget' }: { viewMode?: PluginViewMode }) {
  const { activeCampaignId, isDm } = useCampaign();
  const [items, setItems]           = useState<Creature[]>([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState<CreatureType | 'all'>('all');
  const [editId, setEditId]         = useState<number | 'new' | null>(null);
  const [draft, setDraft]           = useState<CreatureDraft>({ ...EMPTY });
  const [saving, setSaving]         = useState(false);
  const [sheetUrl, setSheetUrl]     = useState<string | null>(null);
  const debounceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const load = useCallback(async () => {
    if (!activeCampaignId) return;
    setLoading(true);
    try { setItems(await api.listCreatures(activeCampaignId)); }
    finally { setLoading(false); }
  }, [activeCampaignId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return onCreatureUpdated(payload => {
      setItems(prev => prev.map(c =>
        c.id === payload.id
          ? { ...c, ...payload } as Creature
          : c,
      ));
    });
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'all') list = list.filter(c => c.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, typeFilter, search]);

  /* Optimistic HP update with debounced save */
  const handleHpChange = useCallback((id: number, next: { hp_current: number; hp_temp: number }) => {
    setItems(prev => prev.map(c => c.id === id ? { ...c, hp_current: next.hp_current, hp_temp: next.hp_temp } : c));
    const timers = debounceTimers.current;
    if (timers.has(id)) clearTimeout(timers.get(id)!);
    timers.set(id, setTimeout(async () => {
      timers.delete(id);
      try { await api.updateCreature(id, { hp_current: next.hp_current, hp_temp: next.hp_temp }); }
      catch { load(); }
    }, 600));
  }, [load]);

  async function handleSave() {
    if (!activeCampaignId) return;
    setSaving(true);
    try {
      const body: Partial<Creature> = {
        name: draft.name.trim(), type: draft.type,
        cr: draft.cr || undefined, size: draft.size,
        hp_max: draft.hp_max, hp_current: draft.hp_current, hp_temp: draft.hp_temp,
        ac: draft.ac, speed: draft.speed,
        stats: { str: draft.str, dex: draft.dex, con: draft.con, int: draft.int, wis: draft.wis, cha: draft.cha },
        notes: draft.notes || undefined,
        image: draft.image || undefined,
        sheet_image: draft.sheet_image || null,
      };
      if (editId === 'new') { await api.createCreature(activeCampaignId, body); }
      else if (typeof editId === 'number') { await api.updateCreature(editId, body); }
      await load();
      setEditId(null);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    await api.deleteCreature(id);
    setItems(prev => prev.filter(c => c.id !== id));
  }

  /* ── Popup ─────────────────────────────────────────────────── */
  if (viewMode === 'popup') {
    return (
      <PluginShell slug="creatures" viewMode="popup">
        <div className="chr-popup">
          {loading && <div className="plugin-view__loading"><Spinner size="sm" /></div>}
          {filtered.map(c => {
            return (
              <div key={c.id} className="chr-popup__row">
                <Avatar src={c.image} name={c.name} size="xs" shape="rounded" />
                <div className="chr-popup__info">
                  <div className="chr-popup__name-line">
                    <span className="chr-popup__name">{c.name}</span>
                    <span className={`cre-badge cre-badge--${c.type}`}>{TYPE_LABELS[c.type]}</span>
                    <span className="chr-popup__hp-text">{c.hp_current}/{c.hp_max}</span>
                  </div>
                  <HpBar current={c.hp_current} max={c.hp_max} temp={c.hp_temp || undefined} size="sm" showLabel={false} />
                </div>
                {isDm && <DmgForm id={c.id} current={c.hp_current} max={c.hp_max} temp={c.hp_temp || 0} compact onApply={handleHpChange} />}
              </div>
            );
          })}
          {!loading && filtered.length === 0 && <p className="plugin-view__empty">No creatures.</p>}
        </div>
      </PluginShell>
    );
  }

  /* ── Widget & Fullscreen ───────────────────────────────────── */
  const isFullscreen = viewMode === 'fullscreen';

  return (
    <PluginShell slug="creatures" viewMode={viewMode}>
      <div className="plugin-view">

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          onSearchClear={() => setSearch('')}
          searchPlaceholder="Search creatures…"
        />

        {/* Type filter tabs */}
        <div className="cre-type-tabs">
          {(['all', ...TYPES] as const).map(t => (
            <button
              key={t}
              className={`cre-type-tab${typeFilter === t ? ' cre-type-tab--active' : ''}${t !== 'all' ? ` cre-type-tab--${t}` : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t as CreatureType]}
            </button>
          ))}
          {isDm && (
            <button
              className="cre-type-tab cre-add-btn"
              onClick={() => { setEditId('new'); setDraft({ ...EMPTY }); }}
              title="Add creature"
            >
              <Plus size={12} /> Add
            </button>
          )}
        </div>

        {loading && <div className="plugin-view__loading"><Spinner size="sm" /></div>}

        <div className="chr-list">
          {isDm && editId === 'new' && (
            <CreatureEditForm
              draft={draft} onChange={p => setDraft(prev => ({ ...prev, ...p }))}
              onSave={handleSave} onCancel={() => setEditId(null)} saving={saving}
            />
          )}

          {filtered.map(c => {

            if (isDm && editId === c.id) {
              return (
                <CreatureEditForm
                  key={c.id}
                  draft={draft} onChange={p => setDraft(prev => ({ ...prev, ...p }))}
                  onSave={handleSave} onCancel={() => setEditId(null)} saving={saving}
                />
              );
            }

            if (isFullscreen) {
              return (
                <div key={c.id} className="chr-row chr-row--full">
                  <div className="chr-row__head">
                    <Avatar src={c.image} name={c.name} size="md" shape="rounded" className="chr-row__avatar" />
                    <div className="chr-row__title-line" style={{ flex: 1 }}>
                      <span className="chr-row__name">{c.name}</span>
                      <span className={`cre-badge cre-badge--${c.type}`}>{TYPE_LABELS[c.type]}</span>
                      {c.size && c.size !== 'medium' && <span className="chr-row__chip">{c.size.charAt(0).toUpperCase() + c.size.slice(1)}</span>}
                      {isDm && (
                        <label className="chr-row__tmp-label" title="Temporary HP">
                          <span className="chr-row__tmp-tag">Tmp</span>
                          <input
                            className="chr-row__tmp-input"
                            type="number" min={0}
                            value={c.hp_temp ?? 0}
                            onChange={e => handleHpChange(c.id, { hp_current: c.hp_current, hp_temp: Math.max(0, Number(e.target.value) || 0) })}
                          />
                        </label>
                      )}
                    </div>
                    {(c.sheet_image || isDm) && (
                      <div className="cre-row__actions">
                        {c.sheet_image && (
                          <button title="View Sheet" onClick={() => setSheetUrl(c.sheet_image!)}>
                            <BookOpen size={11} />
                          </button>
                        )}
                        {isDm && (
                          <>
                            <button title="Edit" onClick={() => { setEditId(c.id); setDraft(toDraft(c)); }}>
                              <Pencil size={11} />
                            </button>
                            <button title="Delete" onClick={() => handleDelete(c.id)}>
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="plugin-section">
                    <div className="plugin-section__head">Combat</div>
                    <div className="plugin-combat-row">
                      <div className="plugin-combat-block">
                        <Heart size={13} className="plugin-combat-icon" />
                        <span className="plugin-combat-lbl">HP</span>
                        <HpBar current={c.hp_current} max={c.hp_max} temp={c.hp_temp || undefined} size="sm" showLabel />
                      </div>
                      {c.ac > 0 && (
                        <div className="plugin-combat-stat"><ShieldCheck size={13} /><span>{c.ac}</span><label>AC</label></div>
                      )}
                      {c.speed > 0 && (
                        <div className="plugin-combat-stat"><Wind size={13} /><span>{c.speed}</span><label>Spd</label></div>
                      )}
                      {c.cr && (
                        <div className="plugin-combat-stat"><Skull size={13} /><span>{c.cr}</span><label>CR</label></div>
                      )}
                      {isDm && <DmgForm id={c.id} current={c.hp_current} max={c.hp_max} temp={c.hp_temp || 0} onApply={handleHpChange} />}
                    </div>
                  </div>

                  {c.stats && (
                    <div className="plugin-section">
                      <div className="plugin-section__head">Ability Scores</div>
                      <div className="plugin-stats-grid">
                        <StatRow stats={c.stats} />
                      </div>
                    </div>
                  )}

                  {c.notes && (
                    <div className="plugin-section">
                      <div className="plugin-section__head">Notes</div>
                      <p className="plugin-details-notes">{c.notes}</p>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={c.id} className="chr-row">
                <Avatar src={c.image} name={c.name} size="sm" shape="rounded" className="chr-row__avatar" />
                <div className="chr-row__body">
                  <div className="chr-row__title-line">
                    <span className="chr-row__name">{c.name}</span>
                    <span className={`cre-badge cre-badge--${c.type}`}>{TYPE_LABELS[c.type]}</span>
                    {isDm && (
                      <label className="chr-row__tmp-label" title="Temporary HP">
                        <span className="chr-row__tmp-tag">Tmp</span>
                        <input
                          className="chr-row__tmp-input"
                          type="number" min={0}
                          value={c.hp_temp ?? 0}
                          onChange={e => handleHpChange(c.id, { hp_current: c.hp_current, hp_temp: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </label>
                    )}
                    {c.cr && <span className="chr-row__chip">CR {c.cr}</span>}
                    {c.ac > 0 && <span className="chr-row__chip">AC {c.ac}</span>}
                  </div>
                  <div className="chr-row__hp-line">
                    <div className="chr-row__hpbar-wrap">
                      <HpBar current={c.hp_current} max={c.hp_max} temp={c.hp_temp || undefined} size="sm" showLabel />
                    </div>
                    {isDm && <DmgForm id={c.id} current={c.hp_current} max={c.hp_max} temp={c.hp_temp || 0} compact onApply={handleHpChange} />}
                  </div>
                </div>
                {(c.sheet_image || isDm) && (
                  <div className="cre-row__actions cre-row__actions--widget">
                    {c.sheet_image && (
                      <button title="View Sheet" onClick={() => setSheetUrl(c.sheet_image!)}>
                        <BookOpen size={11} />
                      </button>
                    )}
                    {isDm && (
                      <>
                        <button title="Edit" onClick={() => { setEditId(c.id); setDraft(toDraft(c)); }}>
                          <Pencil size={11} />
                        </button>
                        <button title="Delete" onClick={() => handleDelete(c.id)}>
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && filtered.length === 0 && editId !== 'new' && (
            <p className="plugin-view__empty">No creatures found.</p>
          )}
        </div>
      </div>
      {sheetUrl && <SheetViewer url={sheetUrl} onClose={() => setSheetUrl(null)} />}
    </PluginShell>
  );
}

/* ── Inline edit form ────────────────────────────────────────── */
function CreatureEditForm({
  draft, onChange, onSave, onCancel, saving,
}: {
  draft: CreatureDraft;
  onChange: (p: Partial<CreatureDraft>) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const txt = (key: keyof CreatureDraft, ph = '') => (
    <input type="text" className="pedit__input" value={draft[key] as string} placeholder={ph}
      onChange={e => onChange({ [key]: e.target.value } as Partial<CreatureDraft>)} />
  );
  const num = (key: keyof CreatureDraft, min = 0, max = 999) => (
    <input type="number" className="pedit__input" value={draft[key] as number} min={min} max={max}
      onChange={e => onChange({ [key]: +e.target.value } as Partial<CreatureDraft>)} />
  );

  return (
    <div className="pedit">
      <div className="pedit__row">
        <div className="pedit__field" style={{ flex: 2 }}>
          <span className="pedit__label">Name *</span>
          {txt('name', 'Creature name')}
        </div>
        <div className="pedit__field">
          <span className="pedit__label">Type</span>
          <select className="pedit__select" value={draft.type}
            onChange={e => onChange({ type: e.target.value as CreatureType })}>
            {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div className="pedit__field">
          <span className="pedit__label">Size</span>
          <select className="pedit__select" value={draft.size}
            onChange={e => onChange({ size: e.target.value as CreatureSize })}>
            {SIZES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="pedit__field" style={{ maxWidth: 64 }}>
          <span className="pedit__label">CR</span>
          {txt('cr', '1/4')}
        </div>
      </div>

      <div className="pedit__section">Combat</div>
      <div className="pedit__row">
        <div className="pedit__field"><span className="pedit__label">HP Max</span>{num('hp_max', 1)}</div>
        <div className="pedit__field"><span className="pedit__label">HP Now</span>{num('hp_current', 0)}</div>
        <div className="pedit__field"><span className="pedit__label">Temp HP</span>{num('hp_temp', 0)}</div>
        <div className="pedit__field"><span className="pedit__label">AC</span>{num('ac', 0, 30)}</div>
        <div className="pedit__field"><span className="pedit__label">Speed</span>{num('speed', 0, 120)}</div>
      </div>

      <div className="pedit__section">Ability Scores</div>
      <div className="pedit__stat-grid">
        {STATS.map(s => (
          <div key={s}>
            <div className="pedit__stat-label">{s.toUpperCase()}</div>
            {num(s as keyof CreatureDraft, 1, 30)}
          </div>
        ))}
      </div>

      <div className="pedit__field">
        <span className="pedit__label">Notes</span>
        <textarea className="pedit__textarea" value={draft.notes} rows={2}
          onChange={e => onChange({ notes: e.target.value })} />
      </div>

      <div className="pedit__section">Media</div>
      <div className="pedit__field">
        <span className="pedit__label">Image URL</span>
        {txt('image', 'https://…')}
      </div>
      <div className="pedit__field">
        <span className="pedit__label">Sheet Image URL</span>
        {txt('sheet_image', 'https://…')}
      </div>

      <div className="pedit__actions">
        <button className="pedit__cancel-btn" type="button" onClick={onCancel}>
          <X size={12} /> Cancel
        </button>
        <button className="pedit__save-btn" type="button"
          disabled={saving || !draft.name.trim()} onClick={onSave}>
          <Check size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
