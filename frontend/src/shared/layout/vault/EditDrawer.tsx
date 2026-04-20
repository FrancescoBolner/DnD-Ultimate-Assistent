/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button, Checkbox, Input, Select, Textarea } from '../../ui';
import { DND_CLASSES, DND_RACES, abilityModifier } from '../../constants/dnd';
import { CREATURE_RACES, RELIGIONS } from './vault.constants';
import type {
  VaultTab, AnyEntry, Character, Creature, Effect, Ability, Item,
} from './vault.types';

/* ── Stat block ── */
function StatBlock({ label, val, set }: { label: string; val: string; set: (v: string) => void }) {
  const score = parseInt(val) || 10;
  return (
    <div className="stat-block">
      <span className="stat-block__label">{label}</span>
      <input className="stat-block__input" type="number" min={1} max={30}
        value={val} onChange={e => set(e.target.value)} />
      <span className="stat-block__mod">{abilityModifier(score)}</span>
    </div>
  );
}

/* ── Props ── */
interface EditDrawerProps {
  tab: VaultTab;
  entry: AnyEntry | null;
  existingTags?: string[];
  onSave: (entry: AnyEntry) => Promise<void>;
  onClose: () => void;
}

export default function EditDrawer({ tab, entry, existingTags = [], onSave, onClose }: EditDrawerProps) {
  const isNew = !entry;
  const title = isNew
    ? `Add ${tab.charAt(0).toUpperCase() + tab.slice(1)}`
    : `Edit`;

  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [name,       setName]       = useState((entry as any)?.name            ?? '');
  const [desc, setDesc] = useState(
    (entry as any)?.description ?? (entry as any)?.notes ?? (entry as any)?.backstory ?? ''
  );
  const [level,      setLevel]      = useState(String((entry as Character)?.level       ?? '1'));
  const [race,       setRace]       = useState((entry as any)?.race                     ?? (tab === 'characters' ? 'Human' : ''));
  const [religion,   setReligion]   = useState((entry as any)?.religion                 ?? '');
  const [charClass,  setCharClass]  = useState((entry as Character)?.class              ?? 'Fighter');
  const [hpMax,      setHpMax]      = useState(String((entry as any)?.hp_max            ?? '10'));
  const [ac,         setAc]         = useState(String((entry as any)?.ac                ?? '10'));
  const [speed,      setSpeed]      = useState(String((entry as any)?.speed             ?? '30'));
  const [isActive,   setIsActive]   = useState((entry as any)?.is_active                ?? true);
  const [backstory,  setBackstory]  = useState((entry as Character)?.backstory          ?? '');
  const [portrait,   setPortrait]   = useState((entry as any)?.image                    ?? '');
  const [statStr,    setStatStr]    = useState(String((entry as any)?.stats?.str        ?? '10'));
  const [statDex,    setStatDex]    = useState(String((entry as any)?.stats?.dex        ?? '10'));
  const [statCon,    setStatCon]    = useState(String((entry as any)?.stats?.con        ?? '10'));
  const [statInt,    setStatInt]    = useState(String((entry as any)?.stats?.int        ?? '10'));
  const [statWis,    setStatWis]    = useState(String((entry as any)?.stats?.wis        ?? '10'));
  const [statCha,    setStatCha]    = useState(String((entry as any)?.stats?.cha        ?? '10'));
  const [cr,         setCr]         = useState((entry as Creature)?.cr                  ?? '');
  const [size,       setSize]       = useState((entry as Creature)?.size                ?? 'medium');
  const [damage,     setDamage]     = useState((entry as any)?.damage                   ?? '');
  const [damageType, setDamageType] = useState((entry as any)?.damage_type              ?? '');
  const [duration,   setDuration]   = useState((entry as Effect)?.duration              ?? '');
  const [triggerMoment, setTriggerMoment] = useState((entry as Effect)?.trigger_moment  ?? '');
  const [saveType,   setSaveType]   = useState((entry as Effect)?.save_type             ?? '');
  const [saveDc,     setSaveDc]     = useState(String((entry as Effect)?.save_dc        ?? ''));
  const [applyOnSave,setApplyOnSave]= useState((entry as Effect)?.apply_on_save         ?? 'none');
  const [conditions, setConditions] = useState((entry as Effect)?.conditions?.join(', ') ?? '');
  const [modAc,      setModAc]      = useState(String((entry as Effect)?.stat_modifiers?.ac    ?? ''));
  const [modSpeed,   setModSpeed]   = useState(String((entry as Effect)?.stat_modifiers?.speed ?? ''));
  const [isConc,     setIsConc]     = useState((entry as Effect)?.is_concentration      ?? false);
  const [hitBonus,   setHitBonus]   = useState(String((entry as Ability)?.hit_bonus     ?? ''));
  const [range,      setRange]      = useState((entry as Ability)?.range                ?? '');
  const [cooldown,   setCooldown]   = useState((entry as Ability)?.cooldown             ?? '');
  const [usesMax,    setUsesMax]    = useState(String((entry as Ability)?.uses_max      ?? ''));
  const [usesCur,    setUsesCur]    = useState(String((entry as Ability)?.uses_current  ?? ''));
  const [actionType, setActionType] = useState((entry as Ability)?.action_type          ?? 'action');
  const [itemType,   setItemType]   = useState((entry as Item)?.type                    ?? 'other');
  const [rarity,     setRarity]     = useState((entry as Item)?.rarity                  ?? 'common');
  const [quantity,   setQuantity]   = useState(String((entry as Item)?.quantity         ?? '1'));
  const [weight,     setWeight]     = useState(String((entry as Item)?.weight           ?? ''));
  const [value,      setValue]      = useState((entry as Item)?.value                   ?? '');
  const [equipped,   setEquipped]   = useState((entry as Item)?.is_equipped             ?? false);
  const [attuned,    setAttuned]    = useState((entry as Item)?.is_attuned              ?? false);
  const [tags,       setTags]       = useState<string[]>((entry as Creature)?.tags      ?? []);
  const [tagInput,   setTagInput]   = useState('');

  /* ── Resize handle ── */
  const [drawerWidth, setDrawerWidth] = useState(360);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  function startResize(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startW: drawerWidth };
    e.preventDefault();
  }
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - e.clientX;
      setDrawerWidth(Math.max(260, Math.min(700, dragRef.current.startW + delta)));
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* ── Save handler ── */
  async function handleSave() {
    if (!name.trim() || saving) return;
    const baseId = (entry as any)?.id ?? Date.now();
    let saved: AnyEntry;
    if (tab === 'characters') {
      saved = {
        id: baseId, name: name.trim(), race: race || undefined, class: charClass || undefined,
        level: parseInt(level) || 1,
        stats: { str: parseInt(statStr)||10, dex: parseInt(statDex)||10, con: parseInt(statCon)||10,
                 int: parseInt(statInt)||10, wis: parseInt(statWis)||10, cha: parseInt(statCha)||10 },
        hp_max: parseInt(hpMax)||10, hp_current: parseInt(hpMax)||10,
        ac: parseInt(ac)||10, speed: parseInt(speed)||30,
        image: portrait || null,
        backstory: backstory || undefined, is_active: isActive,
      } as Character;
    } else if (tab === 'npc' || tab === 'enemy') {
      const pendingTag = tagInput.trim().toLowerCase();
      const finalTags = pendingTag && !tags.includes(pendingTag)
        ? [...tags, pendingTag]
        : tags;
      saved = {
        id: baseId, name: name.trim(),
        type: tab === 'npc' ? 'npc' : 'enemy',
        cr: cr || undefined, size: size as Creature['size'],
        stats: { str: parseInt(statStr)||10, dex: parseInt(statDex)||10, con: parseInt(statCon)||10,
                 int: parseInt(statInt)||10, wis: parseInt(statWis)||10, cha: parseInt(statCha)||10 },
        hp_max: parseInt(hpMax)||10, hp_current: parseInt(hpMax)||10,
        ac: parseInt(ac)||10, speed: parseInt(speed)||30,
        race: race || undefined, religion: religion || undefined,
        image: portrait || null,
        notes: desc || undefined, tags: finalTags.length > 0 ? finalTags : undefined, is_active: isActive,
      } as Creature;
    } else if (tab === 'effects') {
      saved = {
        id: baseId, name: name.trim(), description: desc || undefined,
        duration: duration || undefined, trigger_moment: triggerMoment || undefined,
        damage: damage || undefined, damage_type: damageType || undefined,
        save_type: saveType || undefined, save_dc: saveDc ? parseInt(saveDc) : undefined,
        apply_on_save: applyOnSave,
        conditions: conditions ? conditions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
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
        value: value || undefined,
        is_equipped: equipped, is_attuned: attuned,
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

  return (
    <div className="vault__drawer" style={{ width: drawerWidth }}>
      <div className="vault__drawer-resizer" onMouseDown={startResize} />
      <div className="vault__drawer-header">
        <span className="vault__drawer-title">{title}</span>
        <button className="vault__drawer-close" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="vault__drawer-body">
        <Input label="Name" required value={name} onChange={e => setName(e.target.value)} placeholder="Name…" />

        <datalist id="vault-races">
          {DND_RACES.map(r => <option key={r} value={r} />)}
        </datalist>

        {tab === 'characters' && <>
          <div className="vdrawer__portrait">
            <Input label="Portrait URL" value={portrait} onChange={e => setPortrait(e.target.value)} placeholder="https://…" />
            {portrait && <img className="vdrawer__portrait-img" src={portrait} alt="portrait" />}
          </div>
          <div className="vdrawer__row">
            <div className="vdrawer__combo-wrap">
              <label className="vdrawer__combo-label">RACE<span className="field-required">*</span></label>
              <input className="input-group__input" list="vault-races" value={race}
                onChange={e => setRace(e.target.value)} placeholder="Human" />
            </div>
            <Select label="Class" required value={charClass} onChange={e => setCharClass(e.target.value)}
              options={DND_CLASSES.map(c => ({ value: c, label: c }))} />
            <Input label="Level" required type="number" min={1} max={20} value={level} onChange={e => setLevel(e.target.value)} />
          </div>
          <div className="vdrawer__row">
            <Input label="HP Max" required type="number" min={1} value={hpMax} onChange={e => setHpMax(e.target.value)} />
            <Input label="AC" required type="number" min={1} value={ac} onChange={e => setAc(e.target.value)} />
            <Input label="Speed" required type="number" min={0} value={speed} onChange={e => setSpeed(e.target.value)} />
          </div>
          <p className="vdrawer__section-title">Ability Scores<span className="field-required">*</span></p>
          <div className="stats-grid">
            <StatBlock label="STR" val={statStr} set={setStatStr} />
            <StatBlock label="DEX" val={statDex} set={setStatDex} />
            <StatBlock label="CON" val={statCon} set={setStatCon} />
            <StatBlock label="INT" val={statInt} set={setStatInt} />
            <StatBlock label="WIS" val={statWis} set={setStatWis} />
            <StatBlock label="CHA" val={statCha} set={setStatCha} />
          </div>
          <Textarea label="Backstory" value={backstory} onChange={e => setBackstory(e.target.value)} placeholder="Character backstory…" />
          <Checkbox checked={isActive} onChange={setIsActive} label="Active character" />
        </>}

        {(tab === 'npc' || tab === 'enemy') && <>
          <div className="vdrawer__portrait">
            <Input label="Portrait URL" value={portrait} onChange={e => setPortrait(e.target.value)} placeholder="https://…" />
            {portrait && <img className="vdrawer__portrait-img" src={portrait} alt="portrait" />}
          </div>
          <div className="vdrawer__row">
            <Input label="CR" value={cr} onChange={e => setCr(e.target.value)} placeholder="1/4" />
            <Select label="Size" required value={size} onChange={e => setSize(e.target.value as Creature['size'])}
              options={['tiny','small','medium','large','huge','gargantuan'].map(s => ({ value: s, label: s.charAt(0).toUpperCase()+s.slice(1) }))} />
          </div>
          <datalist id="vault-creature-races">
            {CREATURE_RACES.map(r => <option key={r} value={r} />)}
          </datalist>
          <datalist id="vault-religions">
            {RELIGIONS.map(r => <option key={r} value={r} />)}
          </datalist>
          <div className="vdrawer__row">
            <div className="vdrawer__combo-wrap">
              <label className="vdrawer__combo-label">RACE</label>
              <input className="input-group__input" list="vault-creature-races" value={race}
                onChange={e => setRace(e.target.value)} placeholder="umano…" />
            </div>
            <div className="vdrawer__combo-wrap">
              <label className="vdrawer__combo-label">RELIGION</label>
              <input className="input-group__input" list="vault-religions" value={religion}
                onChange={e => setReligion(e.target.value)} placeholder="La Fede…" />
            </div>
          </div>
          <div className="vdrawer__row">
            <Input label="HP Max" required type="number" min={1} value={hpMax} onChange={e => setHpMax(e.target.value)} />
            <Input label="AC" required type="number" min={1} value={ac} onChange={e => setAc(e.target.value)} />
            <Input label="Speed" required type="number" min={0} value={speed} onChange={e => setSpeed(e.target.value)} />
          </div>
          <p className="vdrawer__section-title">Ability Scores<span className="field-required">*</span></p>
          <div className="stats-grid">
            <StatBlock label="STR" val={statStr} set={setStatStr} />
            <StatBlock label="DEX" val={statDex} set={setStatDex} />
            <StatBlock label="CON" val={statCon} set={setStatCon} />
            <StatBlock label="INT" val={statInt} set={setStatInt} />
            <StatBlock label="WIS" val={statWis} set={setStatWis} />
            <StatBlock label="CHA" val={statCha} set={setStatCha} />
          </div>
          <Textarea label="Notes / Lore" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Special abilities, lore…" />
          <p className="vdrawer__section-title">Tags</p>
          <datalist id="vault-tags">
            {existingTags.map(t => <option key={t} value={t} />)}
          </datalist>
          <div className="vdrawer__tag-input-row">
            <input className="input-group__input" list="vault-tags" placeholder="New tag… (Enter to add)"
              value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                  e.preventDefault();
                  const t = tagInput.trim().toLowerCase();
                  if (!tags.includes(t)) setTags(prev => [...prev, t]);
                  setTagInput('');
                }
              }}
            />
          </div>
          {existingTags.filter(t => !tags.includes(t)).length > 0 && (
            <div className="vdrawer__tag-suggestions">
              {existingTags.filter(t => !tags.includes(t)).map(t => (
                <button key={t} type="button" className="vtag"
                  onClick={() => setTags(prev => [...prev, t])}>{t}</button>
              ))}
            </div>
          )}
          {tags.length > 0 && (
            <div className="vdrawer__tag-list">
              {tags.map(t => (
                <span key={t} className="vtag vtag--active">
                  {t}
                  <button type="button" className="vtag__remove"
                    onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                </span>
              ))}
            </div>
          )}
          <Checkbox checked={isActive} onChange={setIsActive} label="Still active" />
        </>}

        {tab === 'effects' && <>
          <Textarea label="Description" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What the effect does…" />
          <div className="vdrawer__row">
            <Input label="Duration" value={duration} onChange={e => setDuration(e.target.value)} placeholder="1 minute" />
            <Input label="Trigger" value={triggerMoment} onChange={e => setTriggerMoment(e.target.value)} placeholder="on hit" />
          </div>
          <div className="vdrawer__row">
            <Input label="Damage" value={damage} onChange={e => setDamage(e.target.value)} placeholder="2d6" />
            <Input label="Damage Type" value={damageType} onChange={e => setDamageType(e.target.value)} placeholder="fire" />
          </div>
          <div className="vdrawer__row">
            <Select label="Save" value={saveType} onChange={e => setSaveType(e.target.value)} placeholder="—"
              options={['STR','DEX','CON','INT','WIS','CHA'].map(s => ({ value: s, label: s }))} />
            <Input label="DC" type="number" min={1} value={saveDc} onChange={e => setSaveDc(e.target.value)} placeholder="13" />
            <Select label="On Save" value={applyOnSave} onChange={e => setApplyOnSave(e.target.value as Effect['apply_on_save'])}
              options={[{value:'none',label:'Full'},{value:'half',label:'Half'},{value:'negate',label:'Negate'}]} />
          </div>
          <Input label="Conditions (comma-separated)" value={conditions} onChange={e => setConditions(e.target.value)} placeholder="stunned, frightened" />
          <p className="vdrawer__section-title">Stat Modifiers</p>
          <div className="vdrawer__row">
            <Input label="AC mod" type="number" value={modAc} onChange={e => setModAc(e.target.value)} placeholder="+2" />
            <Input label="Speed mod" type="number" value={modSpeed} onChange={e => setModSpeed(e.target.value)} placeholder="+10" />
          </div>
          <Checkbox checked={isConc} onChange={setIsConc} label="Requires Concentration" />
        </>}

        {tab === 'abilities' && <>
          <Select label="Action Type" required value={actionType} onChange={e => setActionType(e.target.value as Ability['action_type'])}
            options={['action','bonus','reaction','passive','legendary','free'].map(t => ({ value: t, label: t.charAt(0).toUpperCase()+t.slice(1) }))} />
          <div className="vdrawer__row">
            <Input label="Damage" value={damage} onChange={e => setDamage(e.target.value)} placeholder="1d8+3" />
            <Input label="Type" value={damageType} onChange={e => setDamageType(e.target.value)} placeholder="slashing" />
            <Input label="Hit Bonus" type="number" value={hitBonus} onChange={e => setHitBonus(e.target.value)} placeholder="+5" />
          </div>
          <div className="vdrawer__row">
            <Input label="Range" value={range} onChange={e => setRange(e.target.value)} placeholder="30" />
            <Input label="Cooldown" value={cooldown} onChange={e => setCooldown(e.target.value)} placeholder="Short Rest" />
          </div>
          <div className="vdrawer__row">
            <Input label="Uses Max" type="number" min={0} value={usesMax} onChange={e => setUsesMax(e.target.value)} placeholder="—" />
            <Input label="Uses Left" type="number" min={0} value={usesCur} onChange={e => setUsesCur(e.target.value)} placeholder="—" />
          </div>
          <Textarea label="Description / Notes" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ability description…" />
        </>}

        {tab === 'items' && <>
          <div className="vdrawer__row">
            <Select label="Type" required value={itemType} onChange={e => setItemType(e.target.value as Item['type'])}
              options={['weapon','armor','shield','potion','scroll','wondrous','gear','treasure','other'].map(t => ({ value: t, label: t.charAt(0).toUpperCase()+t.slice(1) }))} />
            <Select label="Rarity" required value={rarity} onChange={e => setRarity(e.target.value as Item['rarity'])}
              options={['common','uncommon','rare','very_rare','legendary','artifact'].map(r => ({ value: r, label: r.replace('_',' ') }))} />
          </div>
          <div className="vdrawer__row">
            <Input label="Quantity" type="number" min={0} value={quantity} onChange={e => setQuantity(e.target.value)} />
            <Input label="Weight" type="number" min={0} step={0.1} value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.0" />
            <Input label="Value" value={value} onChange={e => setValue(e.target.value)} placeholder="50 gp" />
          </div>
          <div className="vdrawer__row">
            <Checkbox checked={equipped} onChange={setEquipped} label="Equipped" />
            <Checkbox checked={attuned} onChange={setAttuned} label="Attuned" />
          </div>
          <Textarea label="Description / Notes" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Item description…" />
        </>}

        {saveErr && <p className="vdrawer__save-err">{saveErr}</p>}
        <div className="vdrawer__actions">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
