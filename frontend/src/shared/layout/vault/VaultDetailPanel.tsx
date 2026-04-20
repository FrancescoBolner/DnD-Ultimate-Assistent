/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import {
  X, Pencil, Trash2, Heart, ShieldCheck, Wind,
  Eye, Skull, BookOpen, Save,
} from 'lucide-react';
import { TabIcon, CREATURE_RACES, RELIGIONS } from './vault.constants';
import { Button, Checkbox, Input, Select, Textarea } from '../../ui';
import { HpBar } from '../../ui';
import { DND_CLASSES, DND_RACES } from '../../constants/dnd';
import type { VaultTab, AnyEntry, Stats, Character, Creature, Effect, Ability, Item } from './vault.types';
import { SheetViewer } from '../../plugins/views/sheet/SheetViewer';

/* ── Helpers ── */

function StatPill({ label, score }: { label: string; score: number }) {
  const MOD_LABEL: Record<string, string> = {
    str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA',
  };
  const mod = Math.floor((score - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  return (
    <div className="vdetail__stat-pill">
      <span className="vdetail__stat-label">{MOD_LABEL[label] ?? label.toUpperCase()}</span>
      <span className="vdetail__stat-score">{score}</span>
      <span className="vdetail__stat-mod">{modStr}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="vdetail__section">
      <div className="vdetail__section-head">{title}</div>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="vdetail__datarow">
      <span className="vdetail__datarow-label">{label}</span>
      <span className="vdetail__datarow-value">{value}</span>
    </div>
  );
}

function StatInput({ abbr, val, set }: { abbr: string; val: string; set: (v: string) => void }) {
  const score = parseInt(val) || 10;
  const mod = Math.floor((score - 10) / 2);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  return (
    <div className="vdetail__stat-pill vdetail__stat-pill--edit">
      <span className="vdetail__stat-label">{abbr}</span>
      <input
        className="vdetail__stat-input"
        type="number" min={1} max={30}
        value={val}
        onChange={ev => set(ev.target.value)}
      />
      <span className="vdetail__stat-mod">{modStr}</span>
    </div>
  );
}

/* ── Props ── */

interface DetailPanelProps {
  tab: VaultTab;
  entry: AnyEntry | null;   // null = new entry
  mode: 'view' | 'edit';
  isDm: boolean;
  userId?: number;
  canEdit?: boolean;
  onClose: () => void;
  onSwitchToEdit: () => void;
  onSave: (entry: AnyEntry) => Promise<void>;
  onDelete?: () => void;
  existingTags?: string[];
}

export default function VaultDetailPanel({
  tab, entry, mode, isDm, userId, canEdit = true, onClose, onSwitchToEdit, onSave, onDelete, existingTags = [],
}: DetailPanelProps) {
  const e = entry as any ?? {};
  const isNew = !entry;
  const stats: Stats | undefined = e.stats;

  useEffect(() => {
    function onKey(ev: KeyboardEvent) { if (ev.key === 'Escape') { ev.stopPropagation(); onClose(); } }
    document.addEventListener('keydown', onKey); // bubble on document — fires before window (UIProvider)
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ── Form state ── */
  const [saving,     setSaving]     = useState(false);
  const [saveErr,    setSaveErr]    = useState('');
  const [sheetDlg,   setSheetDlg]   = useState(false);
  const [name,       setName]       = useState(e.name ?? '');
  const [portrait,   setPortrait]   = useState(e.image ?? '');
  const [sheetImg,   setSheetImg]   = useState(e.sheet_image ?? '');
  const [desc,       setDesc]       = useState(e.description ?? e.notes ?? e.backstory ?? '');
  const [level,      setLevel]      = useState(String(e.level ?? '1'));
  const [race,       setRace]       = useState(e.race ?? (tab === 'characters' ? 'Human' : ''));
  const [religion,   setReligion]   = useState(e.religion ?? '');
  const [charClass,  setCharClass]  = useState(e.class ?? 'Fighter');
  const [hpMax,      setHpMax]      = useState(String(e.hp_max ?? '10'));
  const [hpCurr,     setHpCurr]     = useState(String(e.hp_current ?? e.hp_max ?? '10'));
  const [hpTemp,     setHpTemp]     = useState(String(e.hp_temp ?? '0'));
  const [ac,         setAc]         = useState(String(e.ac ?? '10'));
  const [speed,      setSpeed]      = useState(String(e.speed ?? '30'));
  const [isActive,   setIsActive]   = useState(e.is_active ?? true);
  const [statStr,    setStatStr]    = useState(String(e.stats?.str ?? '10'));
  const [statDex,    setStatDex]    = useState(String(e.stats?.dex ?? '10'));
  const [statCon,    setStatCon]    = useState(String(e.stats?.con ?? '10'));
  const [statInt,    setStatInt]    = useState(String(e.stats?.int ?? '10'));
  const [statWis,    setStatWis]    = useState(String(e.stats?.wis ?? '10'));
  const [statCha,    setStatCha]    = useState(String(e.stats?.cha ?? '10'));
  const [cr,         setCr]         = useState(e.cr ?? '');
  const [size,       setSize]       = useState(e.size ?? 'medium');
  const [damage,     setDamage]     = useState(e.damage ?? '');
  const [damageType, setDamageType] = useState(e.damage_type ?? '');
  const [duration,   setDuration]   = useState(e.duration ?? '');
  const [trigMoment, setTrigMoment] = useState(e.trigger_moment ?? '');
  const [saveType,   setSaveType]   = useState(e.save_type ?? '');
  const [saveDc,     setSaveDc]     = useState(String(e.save_dc ?? ''));
  const [applyOnSave, setApplyOnSave] = useState(e.apply_on_save ?? 'none');
  const [conditions, setConditions] = useState((e.conditions ?? []).join(', '));
  const [modAc,      setModAc]      = useState(String(e.stat_modifiers?.ac ?? ''));
  const [modSpeed,   setModSpeed]   = useState(String(e.stat_modifiers?.speed ?? ''));
  const [isConc,     setIsConc]     = useState(e.is_concentration ?? false);
  const [hitBonus,   setHitBonus]   = useState(String(e.hit_bonus ?? ''));
  const [range,      setRange]      = useState(e.range ?? '');
  const [cooldown,   setCooldown]   = useState(e.cooldown ?? '');
  const [usesMax,    setUsesMax]    = useState(String(e.uses_max ?? ''));
  const [usesCur,    setUsesCur]    = useState(String(e.uses_current ?? ''));
  const [actionType, setActionType] = useState(e.action_type ?? 'action');
  const [itemType,   setItemType]   = useState(e.type ?? 'other');
  const [rarity,     setRarity]     = useState(e.rarity ?? 'common');
  const [quantity,   setQuantity]   = useState(String(e.quantity ?? '1'));
  const [weight,     setWeight]     = useState(String(e.weight ?? ''));
  const [value,      setValue]      = useState(e.value ?? '');
  const [equipped,   setEquipped]   = useState(e.is_equipped ?? false);
  const [attuned,    setAttuned]    = useState(e.is_attuned ?? false);
  const [tags,       setTags]       = useState<string[]>(e.tags ?? []);
  const [tagInput,   setTagInput]   = useState('');

  /* ── Save handler ── */
  async function handleSave() {
    if (!name.trim() || saving) return;
    const baseId = e?.id ?? 0;
    let saved: AnyEntry;

    if (tab === 'characters') {
      saved = {
        id: baseId, name: name.trim(), race: race || undefined, class: charClass || undefined,
        level: parseInt(level) || 1,
        stats: { str: parseInt(statStr)||10, dex: parseInt(statDex)||10, con: parseInt(statCon)||10,
                 int: parseInt(statInt)||10, wis: parseInt(statWis)||10, cha: parseInt(statCha)||10 },
        hp_max: parseInt(hpMax)||10, hp_current: parseInt(hpCurr)||parseInt(hpMax)||10,
        hp_temp: parseInt(hpTemp)||0,
        ac: parseInt(ac)||10, speed: parseInt(speed)||30,
        image: portrait || null, backstory: desc || undefined, is_active: isActive,
      } as Character;
    } else if (tab === 'npc' || tab === 'enemy') {
      const pendingTag = tagInput.trim().toLowerCase();
      const finalTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags;
      saved = {
        id: baseId, name: name.trim(), type: tab === 'npc' ? 'npc' : 'enemy',
        cr: cr || undefined, size: size as Creature['size'],
        stats: { str: parseInt(statStr)||10, dex: parseInt(statDex)||10, con: parseInt(statCon)||10,
                 int: parseInt(statInt)||10, wis: parseInt(statWis)||10, cha: parseInt(statCha)||10 },
        hp_max: parseInt(hpMax)||10, hp_current: parseInt(hpCurr)||parseInt(hpMax)||10,
        hp_temp: parseInt(hpTemp)||0,
        ac: parseInt(ac)||10, speed: parseInt(speed)||30,
        race: race || undefined, religion: religion || undefined,
        image: portrait || null, sheet_image: sheetImg || null, notes: desc || undefined,
        tags: finalTags.length > 0 ? finalTags : undefined, is_active: isActive,
      } as Creature;
    } else if (tab === 'effects') {
      saved = {
        id: baseId, name: name.trim(), description: desc || undefined,
        duration: duration || undefined, trigger_moment: trigMoment || undefined,
        damage: damage || undefined, damage_type: damageType || undefined,
        save_type: saveType || undefined, save_dc: saveDc ? parseInt(saveDc) : undefined,
        apply_on_save: applyOnSave,
        conditions: conditions ? conditions.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        stat_modifiers: (modAc || modSpeed)
          ? { ...(modAc ? { ac: parseInt(modAc) } : {}), ...(modSpeed ? { speed: parseInt(modSpeed) } : {}) }
          : undefined,
        is_concentration: isConc,
      } as Effect;
    } else if (tab === 'abilities') {
      saved = {
        id: baseId, name: name.trim(), description: desc || undefined,
        action_type: actionType,
        damage: damage || undefined, damage_type: damageType || undefined,
        hit_bonus: hitBonus ? parseInt(hitBonus) : undefined,
        range: range || undefined, cooldown: cooldown || undefined,
        uses_max: usesMax ? parseInt(usesMax) : undefined,
        uses_current: usesCur ? parseInt(usesCur) : undefined,
      } as Ability;
    } else {
      saved = {
        id: baseId, name: name.trim(), type: itemType, rarity,
        quantity: parseInt(quantity) || 1,
        weight: weight ? parseFloat(weight) : undefined,
        value: value || undefined, is_equipped: equipped, is_attuned: attuned,
        description: desc || undefined,
      } as Item;
    }

    setSaving(true);
    setSaveErr('');
    try {
      await onSave(saved);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  /* ── Render ── */
  const displayImage = mode === 'edit' ? portrait : e.image;
  const displayName  = mode === 'edit' ? name    : e.name;

  return (
    <>
      <div className="vdetail__backdrop" onClick={onClose} />

      <div className="vdetail__panel">
        {/* ── Header ── */}
        <div className="vdetail__header">
          {displayImage
            ? <img className="vdetail__portrait" src={displayImage} alt={displayName} />
            : <div className="vdetail__portrait vdetail__portrait--placeholder">
                <TabIcon tab={tab} size={28} />
              </div>
          }
          <div className="vdetail__header-info">
            {mode === 'edit'
              ? <input
                  className="vdetail__name-input"
                  value={name}
                  onChange={ev => setName(ev.target.value)}
                  placeholder="Name…"
                  autoFocus
                />
              : <h2 className="vdetail__name">{e.name}</h2>
            }
            {mode === 'view' && (
              <p className="vdetail__subtitle">
                {tab === 'characters' && `${e.race ?? ''} · ${e.class ?? ''} · Level ${e.level}`}
                {(tab === 'npc' || tab === 'enemy') && [e.cr ? `CR ${e.cr}` : null, e.size, e.race, e.religion].filter(Boolean).join(' · ')}
                {tab === 'effects'   && (e.duration ?? '—')}
                {tab === 'abilities' && e.action_type}
                {tab === 'items'     && `${e.type ?? ''} · ${(e.rarity ?? '').replace('_',' ')}`}
              </p>
            )}
            {mode === 'view' && (
              <div className="vdetail__badges">
                {tab === 'characters' && !e.is_active && <span className="vdetail__badge vdetail__badge--inactive">Inactive</span>}
                {(tab === 'npc' || tab === 'enemy') && (e.tags ?? []).map((t: string) => (
                  <span key={t} className="vdetail__badge vdetail__badge--tag">{t}</span>
                ))}
                {tab === 'effects' && e.is_concentration && (
                  <span className="vdetail__badge vdetail__badge--conc">Concentration</span>
                )}
                {tab === 'items' && e.is_equipped && <span className="vdetail__badge vdetail__badge--equipped">Equipped</span>}
                {tab === 'items' && e.is_attuned  && <span className="vdetail__badge vdetail__badge--attuned">Attuned</span>}
              </div>
            )}
          </div>
          <div className="vdetail__header-actions">
            <button className="vdetail__action-btn vdetail__action-btn--close" onClick={onClose} title="Close"><X size={16}/></button>
            {mode === 'view' && (tab === 'npc' || tab === 'enemy') && e.sheet_image && (
              <button className="vdetail__action-btn vdetail__action-btn--sheet" onClick={() => setSheetDlg(true)} title="View Sheet"><BookOpen size={15}/></button>
            )}
            {mode === 'view' && canEdit && <button className="vdetail__action-btn vdetail__action-btn--edit" onClick={onSwitchToEdit} title="Edit"><Pencil size={15}/></button>}
            {onDelete && <button className="vdetail__action-btn vdetail__action-btn--delete" onClick={onDelete} title="Delete"><Trash2 size={15}/></button>}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="vdetail__body">

          {/* ═══ VIEW MODE ═══ */}
          {mode === 'view' && <>

          {(tab === 'characters' || tab === 'npc' || tab === 'enemy') && (
            <DetailSection title="Combat">
              <div className="vdetail__combat-row">
                <div className="vdetail__combat-block">
                  <Heart size={13} className="vdetail__combat-icon" />
                  <span className="vdetail__combat-lbl">HP</span>
                  <HpBar current={e.hp_current ?? 0} max={e.hp_max ?? 0} temp={e.hp_temp || undefined} size="sm" showLabel />
                </div>
                <div className="vdetail__combat-stat"><ShieldCheck size={13}/><span>{e.ac}</span><label>AC</label></div>
                <div className="vdetail__combat-stat"><Wind size={13}/><span>{e.speed}</span><label>Spd</label></div>
                {tab === 'characters' && <div className="vdetail__combat-stat"><Eye size={13}/><span>{e.level}</span><label>Lv</label></div>}
                {(tab === 'npc' || tab === 'enemy') && e.cr && <div className="vdetail__combat-stat"><Skull size={13}/><span>{e.cr}</span><label>CR</label></div>}
              </div>
            </DetailSection>
          )}

          {stats && (tab === 'characters' || tab === 'npc' || tab === 'enemy') && (
            <DetailSection title="Ability Scores">
              <div className="vdetail__stats-grid">
                {(['str','dex','con','int','wis','cha'] as const).map(k => (
                  <StatPill key={k} label={k} score={stats[k] ?? 10} />
                ))}
              </div>
            </DetailSection>
          )}

          {tab === 'characters' && (
            <DetailSection title="Details">
              <DataRow label="Race"  value={e.race} />
              <DataRow label="Class" value={e.class} />
              <DataRow label="Level" value={e.level} />
              {e.backstory && (isDm || userId === e.player_id) && (
                <div className="vdetail__text-block">
                  <BookOpen size={12} className="vdetail__text-icon" />
                  <p>{e.backstory}</p>
                </div>
              )}
            </DetailSection>
          )}

          {(tab === 'npc' || tab === 'enemy') && (
            <DetailSection title="Details">
              <DataRow label="Size"     value={e.size} />
              <DataRow label="Type"     value={e.type} />
              <DataRow label="CR"       value={e.cr} />
              <DataRow label="Race"     value={e.race} />
              <DataRow label="Religion" value={e.religion} />
              <DataRow label="Active"   value={e.is_active ? 'Yes' : 'No'} />
              {e.notes && (
                <div className="vdetail__text-block">
                  <BookOpen size={12} className="vdetail__text-icon" />
                  <p>{e.notes}</p>
                </div>
              )}
            </DetailSection>
          )}

          {tab === 'effects' && (
            <>
              <DetailSection title="Timing">
                <DataRow label="Duration" value={e.duration} />
                <DataRow label="Trigger"  value={e.trigger_moment} />
              </DetailSection>
              <DetailSection title="Damage">
                <DataRow label="Dice"       value={e.damage} />
                <DataRow label="Type"       value={e.damage_type} />
                <DataRow label="Save"       value={e.save_type ? `${e.save_type} DC ${e.save_dc}` : null} />
                <DataRow label="On Save"    value={e.apply_on_save !== 'none' ? e.apply_on_save : null} />
              </DetailSection>
              {(e.conditions?.length > 0 || e.stat_modifiers) && (
                <DetailSection title="Modifiers">
                  {e.conditions?.length > 0 && (
                    <div className="vdetail__tag-set">
                      {e.conditions.map((c: string) => <span key={c} className="vdetail__badge vdetail__badge--cond">{c}</span>)}
                    </div>
                  )}
                  {e.stat_modifiers && Object.entries(e.stat_modifiers as Record<string,number>).map(([k,v]) => (
                    <DataRow key={k} label={k.toUpperCase()} value={`${v >= 0 ? '+' : ''}${v}`} />
                  ))}
                </DetailSection>
              )}
              {e.description && (
                <DetailSection title="Description">
                  <div className="vdetail__text-block"><p>{e.description}</p></div>
                </DetailSection>
              )}
            </>
          )}

          {tab === 'abilities' && (
            <>
              <DetailSection title="Action">
                <DataRow label="Type"      value={e.action_type} />
                <DataRow label="Damage"    value={e.damage ? `${e.damage}${e.damage_type ? ` ${e.damage_type}` : ''}` : null} />
                <DataRow label="Hit Bonus" value={e.hit_bonus != null ? (e.hit_bonus >= 0 ? `+${e.hit_bonus}` : `${e.hit_bonus}`) : null} />
                <DataRow label="Range"     value={e.range} />
                <DataRow label="Cooldown"  value={e.cooldown} />
              </DetailSection>
              {(e.uses_max != null) && (
                <DetailSection title="Uses">
                  <div className="vdetail__uses-track">
                    {Array.from({ length: e.uses_max }).map((_,i) => (
                      <div key={i} className={`vdetail__use-pip ${i < (e.uses_current ?? e.uses_max) ? 'vdetail__use-pip--full' : ''}`} />
                    ))}
                    <span className="vdetail__uses-label">{e.uses_current ?? e.uses_max} / {e.uses_max}</span>
                  </div>
                </DetailSection>
              )}
              {e.description && (
                <DetailSection title="Description">
                  <div className="vdetail__text-block"><p>{e.description}</p></div>
                </DetailSection>
              )}
            </>
          )}

          {tab === 'items' && (
            <>
              <DetailSection title="Properties">
                <DataRow label="Type"     value={e.type} />
                <DataRow label="Rarity"   value={(e.rarity ?? '').replace('_',' ')} />
                <DataRow label="Quantity" value={e.quantity} />
                <DataRow label="Weight"   value={e.weight != null ? `${e.weight} lb` : null} />
                <DataRow label="Value"    value={e.value} />
              </DetailSection>
              {e.properties && Object.keys(e.properties).length > 0 && (
                <DetailSection title="Special Properties">
                  {Object.entries(e.properties as Record<string,unknown>).map(([k,v]) => (
                    <DataRow key={k} label={k} value={String(v)} />
                  ))}
                </DetailSection>
              )}
              {(e.description || e.notes) && (
                <DetailSection title="Description">
                  <div className="vdetail__text-block"><p>{e.description ?? e.notes}</p></div>
                </DetailSection>
              )}
            </>
          )}

          </>} {/* end view mode */}

          {/* ═══ EDIT MODE ═══ */}
          {mode === 'edit' && <>

            <DetailSection title="Portrait">
              <div className="vdetail__edit-padded">
                <Input label="Image URL" value={portrait} onChange={ev => setPortrait(ev.target.value)} placeholder="https://…" />
                {(tab === 'npc' || tab === 'enemy') && (
                  <Input label="Sheet Image URL" value={sheetImg} onChange={ev => setSheetImg(ev.target.value)} placeholder="https://…" />
                )}
              </div>
            </DetailSection>

            {(tab === 'characters' || tab === 'npc' || tab === 'enemy') && (
              <DetailSection title="Combat">
                <div className="vdetail__edit-padded">
                  <div className="vdetail__edit-row">
                    <Input label="HP Max"     type="number" min={1} value={hpMax}  onChange={ev => setHpMax(ev.target.value)} />
                    <Input label="HP Current" type="number" min={0} value={hpCurr} onChange={ev => setHpCurr(ev.target.value)} />
                    <Input label="HP Temp"    type="number" min={0} value={hpTemp} onChange={ev => setHpTemp(ev.target.value)} />
                    <Input label="AC"         type="number" min={1} value={ac}     onChange={ev => setAc(ev.target.value)} />
                    <Input label="Speed"      type="number" min={0} value={speed}  onChange={ev => setSpeed(ev.target.value)} />
                    {tab === 'characters' && <Input label="Level" type="number" min={1} max={20} value={level} onChange={ev => setLevel(ev.target.value)} />}
                    {(tab === 'npc' || tab === 'enemy') && <Input label="CR" value={cr} onChange={ev => setCr(ev.target.value)} placeholder="1/4" />}
                  </div>
                </div>
              </DetailSection>
            )}

            {(tab === 'characters' || tab === 'npc' || tab === 'enemy') && (
              <DetailSection title="Ability Scores">
                <div className="vdetail__stats-grid vdetail__stats-grid--edit">
                  <StatInput abbr="STR" val={statStr} set={setStatStr} />
                  <StatInput abbr="DEX" val={statDex} set={setStatDex} />
                  <StatInput abbr="CON" val={statCon} set={setStatCon} />
                  <StatInput abbr="INT" val={statInt} set={setStatInt} />
                  <StatInput abbr="WIS" val={statWis} set={setStatWis} />
                  <StatInput abbr="CHA" val={statCha} set={setStatCha} />
                </div>
              </DetailSection>
            )}

            {tab === 'characters' && (
              <DetailSection title="Details">
                <div className="vdetail__edit-padded">
                  <div className="vdetail__edit-row">
                    <div className="vdetail__combo-wrap">
                      <label className="vdetail__combo-label">RACE</label>
                      <datalist id="vdetail-races">{DND_RACES.map(r => <option key={r} value={r} />)}</datalist>
                      <input className="input-group__input" list="vdetail-races" value={race} onChange={ev => setRace(ev.target.value)} placeholder="Human" />
                    </div>
                    <Select label="Class" value={charClass} onChange={ev => setCharClass(ev.target.value)}
                      options={DND_CLASSES.map(c => ({ value: c, label: c }))} />
                  </div>
                  <Textarea label="Backstory" value={desc} onChange={ev => setDesc(ev.target.value)} placeholder="Character backstory…" />
                  <Checkbox checked={isActive} onChange={setIsActive} label="Active character" />
                </div>
              </DetailSection>
            )}

            {(tab === 'npc' || tab === 'enemy') && (
              <DetailSection title="Details">
                <div className="vdetail__edit-padded">
                  <div className="vdetail__edit-row">
                    <Select label="Size" value={size} onChange={ev => setSize(ev.target.value as Creature['size'])}
                      options={['tiny','small','medium','large','huge','gargantuan'].map(s => ({ value: s, label: s.charAt(0).toUpperCase()+s.slice(1) }))} />
                    <div className="vdetail__combo-wrap">
                      <label className="vdetail__combo-label">RACE</label>
                      <datalist id="vdetail-creature-races">{CREATURE_RACES.map(r => <option key={r} value={r} />)}</datalist>
                      <input className="input-group__input" list="vdetail-creature-races" value={race} onChange={ev => setRace(ev.target.value)} placeholder="Humanoid…" />
                    </div>
                    <div className="vdetail__combo-wrap">
                      <label className="vdetail__combo-label">RELIGION</label>
                      <datalist id="vdetail-religions">{RELIGIONS.map(r => <option key={r} value={r} />)}</datalist>
                      <input className="input-group__input" list="vdetail-religions" value={religion} onChange={ev => setReligion(ev.target.value)} placeholder="La Fede…" />
                    </div>
                  </div>
                  <Textarea label="Notes / Lore" value={desc} onChange={ev => setDesc(ev.target.value)} placeholder="Special abilities, lore…" />
                  <p className="vdetail__section-sub">Tags</p>
                  <datalist id="vdetail-tags">{existingTags.map(t => <option key={t} value={t} />)}</datalist>
                  <div className="vdetail__tag-input-row">
                    <input
                      className="input-group__input"
                      list="vdetail-tags"
                      placeholder="Tag… (Enter to add)"
                      value={tagInput}
                      onChange={ev => setTagInput(ev.target.value)}
                      onKeyDown={ev => {
                        if ((ev.key === 'Enter' || ev.key === ',') && tagInput.trim()) {
                          ev.preventDefault();
                          const t = tagInput.trim().toLowerCase();
                          if (!tags.includes(t)) setTags(prev => [...prev, t]);
                          setTagInput('');
                        }
                      }}
                    />
                  </div>
                  {tags.length > 0 && (
                    <div className="vdetail__tag-list">
                      {tags.map(t => (
                        <span key={t} className="vtag vtag--active">
                          {t}
                          <button type="button" className="vtag__remove" onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <Checkbox checked={isActive} onChange={setIsActive} label="Still active" />
                </div>
              </DetailSection>
            )}

            {tab === 'effects' && (
              <>
                <DetailSection title="Timing">
                  <div className="vdetail__edit-padded">
                    <div className="vdetail__edit-row">
                      <Input label="Duration" value={duration}   onChange={ev => setDuration(ev.target.value)}   placeholder="1 minute" />
                      <Input label="Trigger"  value={trigMoment} onChange={ev => setTrigMoment(ev.target.value)} placeholder="on hit" />
                    </div>
                  </div>
                </DetailSection>
                <DetailSection title="Damage">
                  <div className="vdetail__edit-padded">
                    <div className="vdetail__edit-row">
                      <Input label="Damage"      value={damage}     onChange={ev => setDamage(ev.target.value)}     placeholder="2d6" />
                      <Input label="Damage Type" value={damageType} onChange={ev => setDamageType(ev.target.value)} placeholder="fire" />
                    </div>
                    <div className="vdetail__edit-row">
                      <Select label="Save" value={saveType} onChange={ev => setSaveType(ev.target.value)} placeholder="—"
                        options={['STR','DEX','CON','INT','WIS','CHA'].map(s => ({ value: s, label: s }))} />
                      <Input label="DC" type="number" min={1} value={saveDc} onChange={ev => setSaveDc(ev.target.value)} placeholder="13" />
                      <Select label="On Save" value={applyOnSave} onChange={ev => setApplyOnSave(ev.target.value as Effect['apply_on_save'])}
                        options={[{value:'none',label:'Full'},{value:'half',label:'Half'},{value:'negate',label:'Negate'}]} />
                    </div>
                  </div>
                </DetailSection>
                <DetailSection title="Modifiers">
                  <div className="vdetail__edit-padded">
                    <Input label="Conditions (comma-separated)" value={conditions} onChange={ev => setConditions(ev.target.value)} placeholder="stunned, frightened" />
                    <div className="vdetail__edit-row">
                      <Input label="AC mod"    type="number" value={modAc}    onChange={ev => setModAc(ev.target.value)}    placeholder="±0" />
                      <Input label="Speed mod" type="number" value={modSpeed} onChange={ev => setModSpeed(ev.target.value)} placeholder="±0" />
                    </div>
                    <Checkbox checked={isConc} onChange={setIsConc} label="Requires Concentration" />
                  </div>
                </DetailSection>
                <DetailSection title="Description">
                  <div className="vdetail__edit-padded">
                    <Textarea value={desc} onChange={ev => setDesc(ev.target.value)} placeholder="What the effect does…" />
                  </div>
                </DetailSection>
              </>
            )}

            {tab === 'abilities' && (
              <>
                <DetailSection title="Action">
                  <div className="vdetail__edit-padded">
                    <Select label="Action Type" value={actionType} onChange={ev => setActionType(ev.target.value as Ability['action_type'])}
                      options={['action','bonus','reaction','passive','legendary','free'].map(t => ({ value: t, label: t.charAt(0).toUpperCase()+t.slice(1) }))} />
                    <div className="vdetail__edit-row">
                      <Input label="Damage"    value={damage}     onChange={ev => setDamage(ev.target.value)}     placeholder="1d8+3" />
                      <Input label="Type"      value={damageType} onChange={ev => setDamageType(ev.target.value)} placeholder="slashing" />
                      <Input label="Hit Bonus" type="number"      value={hitBonus} onChange={ev => setHitBonus(ev.target.value)} placeholder="+5" />
                    </div>
                    <div className="vdetail__edit-row">
                      <Input label="Range"    value={range}    onChange={ev => setRange(ev.target.value)}    placeholder="30 ft" />
                      <Input label="Cooldown" value={cooldown} onChange={ev => setCooldown(ev.target.value)} placeholder="Short Rest" />
                    </div>
                  </div>
                </DetailSection>
                <DetailSection title="Uses">
                  <div className="vdetail__edit-padded">
                    <div className="vdetail__edit-row">
                      <Input label="Uses Max"  type="number" min={0} value={usesMax} onChange={ev => setUsesMax(ev.target.value)} placeholder="—" />
                      <Input label="Uses Left" type="number" min={0} value={usesCur} onChange={ev => setUsesCur(ev.target.value)} placeholder="—" />
                    </div>
                  </div>
                </DetailSection>
                <DetailSection title="Description">
                  <div className="vdetail__edit-padded">
                    <Textarea value={desc} onChange={ev => setDesc(ev.target.value)} placeholder="Ability description…" />
                  </div>
                </DetailSection>
              </>
            )}

            {tab === 'items' && (
              <>
                <DetailSection title="Properties">
                  <div className="vdetail__edit-padded">
                    <div className="vdetail__edit-row">
                      <Select label="Type" value={itemType} onChange={ev => setItemType(ev.target.value as Item['type'])}
                        options={['weapon','armor','shield','potion','scroll','wondrous','gear','treasure','other'].map(t => ({ value: t, label: t.charAt(0).toUpperCase()+t.slice(1) }))} />
                      <Select label="Rarity" value={rarity} onChange={ev => setRarity(ev.target.value as Item['rarity'])}
                        options={['common','uncommon','rare','very_rare','legendary','artifact'].map(r => ({ value: r, label: r.replace('_',' ') }))} />
                    </div>
                    <div className="vdetail__edit-row">
                      <Input label="Quantity" type="number" min={0} value={quantity} onChange={ev => setQuantity(ev.target.value)} />
                      <Input label="Weight"   type="number" min={0} step={0.1} value={weight} onChange={ev => setWeight(ev.target.value)} placeholder="0.0" />
                      <Input label="Value"    value={value} onChange={ev => setValue(ev.target.value)} placeholder="50 gp" />
                    </div>
                    <div className="vdetail__edit-row">
                      <Checkbox checked={equipped} onChange={setEquipped} label="Equipped" />
                      <Checkbox checked={attuned} onChange={setAttuned} label="Attuned" />
                    </div>
                  </div>
                </DetailSection>
                <DetailSection title="Description">
                  <div className="vdetail__edit-padded">
                    <Textarea value={desc} onChange={ev => setDesc(ev.target.value)} placeholder="Item description…" />
                  </div>
                </DetailSection>
              </>
            )}

            {saveErr && <p className="vdetail__save-err">{saveErr}</p>}

          </>} {/* end edit mode */}

        </div>

        {/* ── Footer (edit mode only) ── */}
        {mode === 'edit' && (
          <div className="vdetail__footer">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" icon={<Save size={13}/>} onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </Button>
          </div>
        )}
      </div>
      {sheetDlg && e.sheet_image && (
        <SheetViewer url={e.sheet_image} onClose={() => setSheetDlg(false)} />
      )}
    </>
  );
}

