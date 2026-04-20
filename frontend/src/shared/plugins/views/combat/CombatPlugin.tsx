import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, SkipForward, Plus, ShieldPlus, Sword, Heart, X as XIcon, StopCircle } from 'lucide-react';
import PluginShell from '../../PluginShell';
import { HpBar, Spinner, ComboSearch, ToggleList } from '../../../ui';
import type { ComboSearchItem } from '../../../ui';
import { CORE_COMBAT_EFFECTS } from '../../../constants/dnd';
import { useAuth } from '../../../../app/providers/useAuth';
import { useCampaign } from '../../../../app/providers/useCampaign';
import { onCombatUpdated, onCreatureUpdated } from '../../../../services/socket';
import * as combatApi from '../../../../services/api/combat';
import * as creaturesApi from '../../../../services/api/creatures';
import * as charApi from '../../../../services/api/campaigns';
import type { Character, Combat, CombatParticipant, Creature, PluginViewMode } from '../../../types';
import '../plugin-view.css';
import './combat-plugin.css';

type DraftEntry = { key: string; creature_id?: number; char_id?: number; initiative: string; name: string };

/** Map creatures to ComboSearch items */
function creaturesToItems(creatures: Creature[]): (ComboSearchItem & { _creature: Creature })[] {
  return creatures.map(c => ({
    id: c.id,
    label: c.name,
    badge: c.type,
    badgeVariant: c.type,
    _creature: c,
  }));
}

/** Map unassigned characters to ComboSearch items */
function unassignedCharsToItems(chars: Character[]): (ComboSearchItem & { _char: Character })[] {
  return chars.filter(c => !c.player_id).map(c => ({
    id: `char-${c.id}`,
    label: c.name,
    badge: 'character',
    badgeVariant: 'npc',
    _char: c,
  }));
}

/** Unified effect adder — search presets or type a custom name, press Enter or the button */
function UnifiedEffectSearch({
  effects,
  onApply,
}: {
  effects: { id: number; name: string }[];
  onApply: (r: { name: string; turns: number; sourceId: number | null; isCustom: boolean }) => void;
}) {
  const [query, setQuery] = useState('');
  const [turns, setTurns] = useState('');
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();

  const suggestions = useMemo(() => {
    const q = trimmed.toLowerCase();
    const presets = effects.filter(e => !q || e.name.toLowerCase().includes(q)).slice(0, 8);
    if (trimmed && !effects.some(e => e.name.toLowerCase() === q)) {
      return [...presets, { id: -1 as unknown as number, name: trimmed }];
    }
    return presets;
  }, [effects, trimmed]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function checkPosition() {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setDropUp(window.innerHeight - rect.bottom < 240);
  }

  function pick(item: { id: number; name: string }) {
    setQuery(item.name);
    setOpen(false);
  }

  function handleApply() {
    const name = query.trim();
    if (!name) return;
    const preset = effects.find(e => e.name.toLowerCase() === name.toLowerCase());
    onApply({ name: preset?.name ?? name, turns: parseInt(turns, 10) || 1, sourceId: preset ? preset.id : null, isCustom: !preset });
    setQuery('');
    setTurns('');
  }

  return (
    <div className="cmb__effect-add" ref={wrapRef}>
      <div className="cmb__effect-add-row">
        <div className="cmb__search-combo">
          <input
            className="pedit__input cmb__search-input"
            placeholder="Add effect…"
            value={query}
            autoComplete="off"
            onChange={e => { setQuery(e.target.value); setOpen(true); checkPosition(); }}
            onFocus={() => { setOpen(true); checkPosition(); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApply(); } }}
          />
          {open && suggestions.length > 0 && (
            <ul className={`cmb__suggestions${dropUp ? ' cmb__suggestions--above' : ''}`}>
              {suggestions.map(item => (
                <li
                  key={item.id}
                  className={`cmb__suggestion-item${item.id === -1 ? ' cmb__suggestion-item--custom' : ''}`}
                  onMouseDown={() => pick(item)}
                >
                  {item.id === -1
                    ? <><span className="cmb__suggestion-badge">Custom</span>{' '}{item.name}</>
                    : item.name
                  }
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="cmb__mini-field">
          Turns
          <input
            type="text"
            inputMode="numeric"
            className="pedit__input"
            style={{ width: 46 }}
            value={turns}
            placeholder="1"
            onChange={e => setTurns(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="cmb__icon-btn"
          title="Add effect"
          disabled={!query.trim()}
          onClick={handleApply}
        >
          <ShieldPlus size={12} />
        </button>
      </div>
    </div>
  );
}

export function CombatPlugin({ viewMode = 'widget' }: { viewMode?: PluginViewMode }) {
  const { user } = useAuth();
  const { activeCampaignId, characters, isDm, permissions, pluginConfig, patchCharacter } = useCampaign();
  const config = pluginConfig('combat') ?? {};
  const showDetails          = isDm || config.show_combat_details !== false;
  const showHpToPlayers      = showDetails && (isDm || permissions.players_see_monster_hp);
  const showEffectsToPlayers = showDetails && (isDm || config.show_effects_to_players !== false);
  const canSelfHeal          = !isDm && config.players_can_self_heal === true;

  /* â”€â”€ State â”€â”€ */
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [creatures, setCreatures]           = useState<Creature[]>([]);
  const [activeCombat, setActiveCombat]     = useState<Combat | null>(null);
  const [participants, setParticipants]     = useState<CombatParticipant[]>([]);

// Setup — characters are pre-selected by default
  const [startName, setStartName]           = useState('Encounter');
  const [charSelected, setCharSelected]     = useState<Set<number>>(() => new Set(characters.filter(c => c.player_id).map(c => c.id)));
  const [charInitiative, setCharInitiative] = useState<Record<number, string>>({});
  const [creatureDraft, setCreatureDraft]   = useState<DraftEntry[]>([]);

  // Active combat
  const [globalAmount, setGlobalAmount]   = useState('5');
  const [showAddForm, setShowAddForm]     = useState(false);
  const [addEntity, setAddEntity]         = useState<{ name: string; creature_id?: number; char_id?: number } | null>(null);
  const [addInitiative, setAddInitiative] = useState('');
  const [addCount, setAddCount]           = useState(1);

  // Inline initiative editing
  const [editingInitId,    setEditingInitId]    = useState<number | null>(null);
  const [editingInitValue, setEditingInitValue] = useState('');

  const effects = useMemo(
    () => CORE_COMBAT_EFFECTS.map((name, idx) => ({ id: idx + 1, name })),
    [],
  );

  const assignedChars = useMemo(() => characters.filter(c => c.player_id), [characters]);
  const unassignedCharItems = useMemo(() => unassignedCharsToItems(characters), [characters]);
  const creatureItems = useMemo(() => creaturesToItems(creatures), [creatures]);
  const comboItems = useMemo(
    () => ([...creatureItems, ...unassignedCharItems] as unknown as (ComboSearchItem & Record<string, unknown>)[]),
    [creatureItems, unassignedCharItems],
  );

  /* IDs to exclude from the active-combat "add entity" combo.
     Characters: exclude once already in combat (can't have the same char twice).
     Creatures: never excluded — you can add multiple of the same type. */
  const activeCombatCharExcludeIds = useMemo(
    () => new Set(participants.filter(p => p.char_id != null).map(p => `char-${p.char_id}` as string | number)),
    [participants],
  );

  const charToggleItems = useMemo(
    () => assignedChars.map(c => ({ id: c.id, label: c.name, secondary: c.race })),
    [assignedChars],
  );

  const sortedParticipants = useMemo(() => {
    const sorted = [...participants].sort((a, b) => b.initiative - a.initiative || a.id - b.id);
    if (!activeCombat?.current_participant_id) return sorted;
    const idx = sorted.findIndex(p => p.id === activeCombat.current_participant_id);
    if (idx <= 0) return sorted;
    return [...sorted.slice(idx), ...sorted.slice(0, idx)];
  }, [participants, activeCombat?.current_participant_id]);

  const draftCreatureIds = useMemo(
    () => new Set(creatureDraft.filter(d => d.creature_id).map(d => d.creature_id!)),
    [creatureDraft],
  );
  const draftCharIds = useMemo(
    () => new Set(creatureDraft.filter(d => d.char_id).map(d => `char-${d.char_id}`)),
    [creatureDraft],
  );


  /* â”€â”€ Load â”€â”€ */
  const loadCombatState = useCallback(async () => {
    if (!activeCampaignId) { setActiveCombat(null); setParticipants([]); return; }
    try {
      const combat = await combatApi.getActiveCombat(activeCampaignId);
      setActiveCombat(combat);
      if (!combat) { setParticipants([]); return; }
      const rows = await combatApi.getParticipants(combat.id);
      setParticipants(rows);
    } catch { /* ignore */ }
  }, [activeCampaignId]);

  const load = useCallback(async () => {
    if (!activeCampaignId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [crRows] = await Promise.all([creaturesApi.listCreatures(activeCampaignId)]);
      setCreatures(crRows);
      await loadCombatState();
    } finally {
      setLoading(false);
    }
  }, [activeCampaignId, loadCombatState]);

  useEffect(() => { load(); }, [load]);

  // Seed all characters selected once they arrive (covers async context load)
  useEffect(() => {
    if (characters.length > 0)
      setCharSelected(prev => prev.size === 0 ? new Set(characters.filter(c => c.player_id).map(c => c.id)) : prev);
  }, [characters]);

  useEffect(() => {
    if (!activeCampaignId) return;
    const unsub = onCombatUpdated(payload => {
      if (payload.campaignId === activeCampaignId) loadCombatState();
    });
    return () => unsub();
  }, [activeCampaignId, loadCombatState]);

  // Sync character HP from context (updated by CharactersPlugin / socket) into participants
  useEffect(() => {
    setParticipants(prev => prev.map(p => {
      if (p.char_id == null) return p;
      const ch = characters.find(c => c.id === p.char_id);
      if (!ch) return p;
      if (ch.hp_current === p.hp_current && (ch.hp_temp ?? 0) === (p.hp_temp ?? 0)) return p;
      return { ...p, hp_current: ch.hp_current, hp_temp: ch.hp_temp ?? 0 };
    }));
  }, [characters]);

  // Sync creature HP from socket (updated by CreaturesPlugin) into participants
  useEffect(() => {
    return onCreatureUpdated(payload => {
      setParticipants(prev => prev.map(p =>
        p.creature_id === payload.id
          ? { ...p, hp_current: payload.hp_current, hp_temp: payload.hp_temp ?? 0 }
          : p,
      ));
    });
  }, []);

  /* â”€â”€ Setup helpers â”€â”€ */
  function toggleCharacter(id: number | string) {
    setCharSelected(prev => {
      const next = new Set(prev);
      const numId = Number(id);
      if (next.has(numId)) next.delete(numId); else next.add(numId);
      return next;
    });
  }

  function addCreatureFromCombo(item: ComboSearchItem & Record<string, unknown>, qty: number) {
    if ('_char' in item) {
      const ch = item._char as Character;
      setCreatureDraft(prev => [...prev, {
        key: `char-${ch.id}-${Date.now()}`,
        char_id: ch.id,
        initiative: '',
        name: ch.name,
      }]);
    } else if ('_creature' in item) {
      addCreatureToDraft(item._creature as Creature, qty);
    }
  }

  function addCreatureToDraft(c: Creature, qty: number) {
    setCreatureDraft(prev => [
      ...prev,
      ...Array.from({ length: qty }, (_, i) => ({
        key: `${c.id}-${Date.now()}-${i}`,
        creature_id: c.id,
        initiative: '',
        name: qty > 1 ? `${c.name} (${i + 1})` : c.name,
      })),
    ]);
  }

  async function handleStartCombat() {
    if (!activeCampaignId || !isDm) return;
    const all = [
      ...[...charSelected].map(cid => ({ char_id: cid, initiative: parseInt(charInitiative[cid] ?? '0', 10) || 0 })),
      ...creatureDraft.map(d => d.char_id
        ? { char_id: d.char_id, initiative: parseInt(d.initiative, 10) || 0 }
        : { creature_id: d.creature_id!, initiative: parseInt(d.initiative, 10) || 0 },
      ),
    ];
    if (all.length === 0) return;
    setBusy(true);
    try {
      const res = await combatApi.startCombat(activeCampaignId, {
        name: startName.trim() || 'Encounter',
        participants: all,
      });
      setActiveCombat(res.combat);
      setParticipants(res.participants);
      setCharSelected(new Set(assignedChars.map(c => c.id)));
      setCharInitiative({});
      setCreatureDraft([]);
    } finally {
      setBusy(false);
    }
  }

  /* â”€â”€ Active combat helpers â”€â”€ */
  async function handleNextTurn() {
    if (!activeCombat || !isDm) return;
    setBusy(true);
    try {
      const res = await combatApi.nextTurn(activeCombat.id);
      setActiveCombat(res.combat);
      setParticipants(res.participants);
    } finally {
      setBusy(false);
    }
  }

  async function handleEndCombat() {
    if (!activeCombat || !isDm) return;
    setBusy(true);
    try {
      await combatApi.updateCombat(activeCombat.id, { status: 'completed' });
      setActiveCombat(null);
      setParticipants([]);
    } finally {
      setBusy(false);
    }
  }

  function canEditHp(p: CombatParticipant): boolean {
    if (isDm) return true;
    if (canSelfHeal && p.type === 'character' && p.char_id && user) {
      const ch = characters.find(c => c.id === p.char_id);
      return ch?.player_id === user.id;
    }
    return false;
  }

  async function applyHpDelta(p: CombatParticipant, sign: 1 | -1) {
    if (!activeCombat || !canEditHp(p)) return;
    const amount = Math.max(1, Math.floor(parseInt(globalAmount, 10) || 1));
    let nextHpCurrent = Number(p.hp_current ?? 0);
    let nextHpTemp    = Number(p.hp_temp ?? 0);

    if (sign === -1) {
      // Damage: drain temp HP first
      const absorbed = Math.min(nextHpTemp, amount);
      nextHpTemp    -= absorbed;
      nextHpCurrent  = Math.max(0, nextHpCurrent - (amount - absorbed));
    } else {
      // Heal: only real HP, capped at hp_max
      const maxHp = Math.max(1, Number(p.hp_max ?? p.hp_current ?? 1));
      nextHpCurrent  = Math.min(maxHp, nextHpCurrent + amount);
    }

    await combatApi.updateParticipant(activeCombat.id, p.id, { hp_current: nextHpCurrent, hp_temp: nextHpTemp });
    setParticipants(prev => prev.map(r => r.id === p.id ? { ...r, hp_current: nextHpCurrent, hp_temp: nextHpTemp } : r));

    // Sync character HP to the characters table
    if (p.char_id != null) {
      patchCharacter(p.char_id, { hp_current: nextHpCurrent, hp_temp: nextHpTemp });
      charApi.updateCharacter(p.char_id, { hp_current: nextHpCurrent, hp_temp: nextHpTemp }).catch(() => {});
    }
  }

  async function handleApplyEffect(
    p: CombatParticipant,
    r: { name: string; turns: number; sourceId: number | null; isCustom: boolean },
  ) {
    if (!activeCombat || !isDm) return;
    const updated = await combatApi.applyParticipantEffect(activeCombat.id, p.id, {
      name: r.name, turns_left: r.turns,
      source_effect_id: r.sourceId ?? undefined,
      is_custom: r.isCustom,
    });
    setParticipants(prev => prev.map(row => row.id === p.id ? updated : row));
  }

  async function updateEffectTurns(pid: number, fid: string, turns: number) {
    if (!activeCombat) return;
    const updated = await combatApi.updateParticipantEffectTurns(activeCombat.id, pid, fid, turns);
    setParticipants(prev => prev.map(r => r.id === pid ? updated : r));
  }

  async function removeEffect(pid: number, fid: string) {
    if (!activeCombat) return;
    const updated = await combatApi.removeParticipantEffect(activeCombat.id, pid, fid);
    setParticipants(prev => prev.map(r => r.id === pid ? updated : r));
  }

  async function handleAddEntity() {
    if (!activeCombat || !addEntity) return;
    setBusy(true);
    try {
      const count = Math.max(1, addCount);
      for (let i = 0; i < count; i++) {
        const input: Record<string, unknown> = { initiative: parseInt(addInitiative, 10) || 0 };
        if (addEntity.char_id) input.char_id = addEntity.char_id;
        else if (addEntity.creature_id) input.creature_id = addEntity.creature_id;
        await combatApi.addParticipant(activeCombat.id, input as Parameters<typeof combatApi.addParticipant>[1]);
      }
      /* Single state refresh after all inserts — avoids racing with per-insert socket events. */
      await loadCombatState();
      setAddEntity(null);
      setAddInitiative('');
      setAddCount(1);
      setShowAddForm(false);
    } finally {
      setBusy(false);
    }
  }

  async function commitInitEdit(participantId: number) {
    if (!activeCombat) return;
    const raw = parseInt(editingInitValue, 10);
    const value = isNaN(raw) ? 0 : raw;
    setEditingInitId(null);
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, initiative: value } : p));
    await combatApi.updateParticipant(activeCombat.id, participantId, { initiative: value });
  }

  async function handleRemoveParticipant(participantId: number) {
    if (!activeCombat || !isDm) return;
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    await combatApi.removeParticipant(activeCombat.id, participantId);
  }

  const isPopup = viewMode === 'popup';

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
       RENDER
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  return (
    <PluginShell slug="combat" viewMode={viewMode}>
      <div className="plugin-view cmb">
        {loading && <div className="plugin-view__loading"><Spinner size="sm" /></div>}

        {/* â”€â”€ Setup (no active combat) â”€â”€ */}
        {!loading && !activeCombat && (
          <div className="cmb__setup">
            {isDm ? (
              <>
                <input
                  className="pedit__input cmb__encounter-name"
                  value={startName}
                  onChange={e => setStartName(e.target.value)}
                  placeholder="Encounter name"
                />

                {/* Characters: toggle list */}
                {characters.length > 0 && (
                  <div className="cmb__setup-section">
                    <div className="cmb__setup-label">Characters</div>
                    <ToggleList
                      items={charToggleItems}
                      selectedIds={charSelected as Set<number | string>}
                      onToggle={toggleCharacter}
                      className='cmb__char-toggle'
                      renderExtra={item => (
                        <label className="cmb__mini-field">
                          
                          <input
                            type="text"
                            inputMode="numeric"
                            className="pedit__input"
                            style={{ width: 54 }}
                            value={charInitiative[Number(item.id)] ?? ''}
                            placeholder="0"
                            onChange={e => setCharInitiative(prev => ({
                              ...prev, [Number(item.id)]: e.target.value,
                            }))}
                          />
                        </label>
                      )}
                    />
                  </div>
                )}

                {/* Creatures: search + suggestions */}
                <div className="cmb__setup-section">
                  <div className="cmb__setup-label">Enemies / NPCs</div>
                  <ComboSearch
                    items={comboItems.filter(i => !draftCreatureIds.has(i.id as number) && !draftCharIds.has(i.id as string))}
                    onSelect={addCreatureFromCombo}
                    placeholder="Search NPC / enemy / unassigned character…"
                    showQty
                    portalZIndex={isPopup ? 100000 : 1000}
                  />
                  {creatureDraft.length > 0 && (
                    <div className="cmb__draft-list">
                      {creatureDraft.map((d, idx) => (
                        <div className="cmb__draft-row" key={d.key}>
                          <span className="cmb__draft-name">{d.name}</span>
                          <label className="cmb__mini-field">
                            Init
                            <input
                              type="text"
                              inputMode="numeric"
                              className="pedit__input"
                              style={{ width: 54 }}
                              value={d.initiative}
                              placeholder="0"
                              onChange={e => setCreatureDraft(prev =>
                                prev.map((r, i) => i === idx ? { ...r, initiative: e.target.value } : r),
                              )}
                            />
                          </label>
                          <button
                            type="button"
                            className="cmb__row-remove"
                            title="Remove"
                            onClick={() => setCreatureDraft(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <XIcon size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="cmb__setup-actions">
                  <button
                    type="button"
                    className="cmb__primary"
                    disabled={busy || (charSelected.size === 0 && creatureDraft.length === 0)}
                    onClick={handleStartCombat}
                  >
                    <Play size={12} /> Start Combat
                  </button>
                </div>
              </>
            ) : (
              <p className="plugin-view__empty">Waiting for the DM to start combat.</p>
            )}
          </div>
        )}

        {/* â”€â”€ Active combat â”€â”€ */}
        {!loading && activeCombat && (
          <>
            {/* Topbar â€” all views */}
            <div className="cmb__topbar">
              <div className="cmb__topbar-info">
                <span className="cmb__title">{activeCombat.name || 'Encounter'}</span>
                <span className="cmb__meta">Round {activeCombat.round}</span>
              </div>
              <div className="cmb__controls">
                {!isPopup && (isDm || canSelfHeal) && (
                  <label className="cmb__amount">
                    Dmg / Heal
                    <input
                      type="text"
                      inputMode="numeric"
                      className="pedit__input"
                      value={globalAmount}
                      placeholder="1"
                      onChange={e => setGlobalAmount(e.target.value)}
                    />
                  </label>
                )}
                {isDm && (
                  <>
                    <button type="button" className="cmb__primary" disabled={busy} onClick={handleNextTurn}>
                      <SkipForward size={12} /> Next
                    </button>
                    <button
                      type="button"
                      className="cmb__primary cmb__primary--danger"
                      disabled={busy}
                      onClick={handleEndCombat}
                    >
                      <StopCircle size={12} /> End
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Participant list â€” all views */}
            <div className="cmb__list">
              {sortedParticipants.map(p => {
                const isCurrent = p.id === activeCombat.current_participant_id;
                const showHp    = p.type !== 'creature' || showHpToPlayers;
                const pEffects  = p.effects ?? [];

                return (
                  <div key={p.id} className={`cmb__row${isCurrent ? ' cmb__row--current' : ''}`}>

                    {/* Name row */}
                    <div className="cmb__row-head">
                      <div className="cmb__name-wrap">
                        {isCurrent && <span className="cmb__turn-dot" title="Current turn" />}
                        <span className="cmb__name">{p.name || 'Unknown'}</span>
                      </div>
                      <div className="cmb__row-head-right">
                        {showDetails && (
                          isDm && !isPopup && !isCurrent ? (
                            editingInitId === p.id ? (
                              <input
                                className="pedit__input cmb__init-input"
                                type="text"
                                inputMode="numeric"
                                value={editingInitValue}
                                autoFocus
                                onChange={e => setEditingInitValue(e.target.value)}
                                onBlur={() => commitInitEdit(p.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitInitEdit(p.id); }
                                  if (e.key === 'Escape') setEditingInitId(null);
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="cmb__init cmb__init--editable"
                                title="Click to edit initiative"
                                onClick={() => { setEditingInitId(p.id); setEditingInitValue(String(p.initiative)); }}
                              >
                                {p.initiative}
                              </span>
                            )
                          ) : (
                            <span className="cmb__init">{p.initiative}</span>
                          )
                        )}
                        {isDm && !isPopup && (
                          <button
                            type="button"
                            className="cmb__row-remove"
                            title="Remove from combat"
                            onClick={() => handleRemoveParticipant(p.id)}
                          >
                            <XIcon size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Effects pills â€” all views */}
                    {showEffectsToPlayers && (
                      <div className="cmb__effects">
                        {pEffects.length === 0
                          ? isDm && <span className="cmb__effects-empty">No effects</span>
                          : pEffects.filter(fx => fx.turns_left >= 0).map(fx => (
                            <div key={fx.id} className={`cmb__effect-pill${fx.turns_left === 0 ? ' cmb__effect-pill--expiring' : ''}`}>
                              <span className="cmb__effect-name">{fx.name}</span>
                              {isDm && !isPopup ? (
                                <input
                                  type="number"
                                  min={-1}
                                  className="cmb__turns-input"
                                  value={fx.turns_left}
                                  title="Turns left (-1 to hide)"
                                  onChange={e => updateEffectTurns(p.id, fx.id, Number(e.target.value ?? 0))}
                                />
                              ) : (
                                <span className="cmb__turns-read">{fx.turns_left}t</span>
                              )}
                              {isDm && !isPopup && (
                                <button
                                  type="button"
                                  className="cmb__effect-remove"
                                  onClick={() => removeEffect(p.id, fx.id)}
                                >
                                  <XIcon size={9} />
                                </button>
                              )}
                            </div>
                          ))
                        }
                      </div>
                    )}

                    {/* HP bar + damage/heal â€” widget & fullscreen */}
                    {!isPopup && (
                      showHp ? (
                        <div className="cmb__hp-line">
                          <HpBar
                            current={p.hp_current}
                            max={Math.max(1, Number(p.hp_max ?? p.hp_current ?? 1))}
                            temp={p.hp_temp || undefined}
                            size="sm"
                            showLabel
                          />
                          {canEditHp(p) && (
                            <div className="cmb__hp-actions">
                              <button
                                type="button"
                                className="cmb__delta cmb__delta--dmg"
                                title={`Damage ${globalAmount}`}
                                onClick={() => applyHpDelta(p, -1)}
                              >
                                <Sword size={11} />
                              </button>
                              <button
                                type="button"
                                className="cmb__delta cmb__delta--heal"
                                title={`Heal ${globalAmount}`}
                                onClick={() => applyHpDelta(p, 1)}
                              >
                                <Heart size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="cmb__hp-hidden">HP hidden</div>
                      )
                    )}

                    {/* HP bar — popup */}
                    {isPopup && showHp && (
                      <div className="cmb__hp-line cmb__hp-line--popup">
                        <HpBar
                          current={p.hp_current}
                          max={Math.max(1, Number(p.hp_max ?? p.hp_current ?? 1))}
                          temp={p.hp_temp || undefined}
                          size="sm"
                          showLabel
                        />
                      </div>
                    )}

                    {/* Apply effect — DM, widget & fullscreen */}
                    {isDm && !isPopup && (
                      <UnifiedEffectSearch
                        effects={effects}
                        onApply={r => handleApplyEffect(p, r)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add entity â€” DM, widget & fullscreen */}
            {isDm && !isPopup && (
              <div className="cmb__add-entity">
                {!showAddForm ? (
                  <button type="button" className="cmb__add-entity-btn" onClick={() => setShowAddForm(true)}>
                    <Plus size={12} /> Add entity
                  </button>
                ) : (
                  <div className="cmb__add-entity-form">
                    <ComboSearch
                      items={comboItems}
                      excludeIds={activeCombatCharExcludeIds}
                      onSelect={(item) => {
                        if ('_char' in item) {
                          const ch = item._char as Character;
                          setAddEntity({ name: ch.name, char_id: ch.id });
                        } else if ('_creature' in item) {
                          const cr = item._creature as Creature;
                          setAddEntity({ name: cr.name, creature_id: cr.id });
                        }
                      }}
                      placeholder="Search creature / unassigned character…"
                      clearOnSelect
                    />
                    {addEntity && (
                      <div className="cmb__draft-row">
                        <span className="cmb__draft-name">{addEntity.name}</span>
                        <label className="cmb__mini-field">
                          Init
                          <input
                            type="text"
                            inputMode="numeric"
                            className="pedit__input"
                            style={{ width: 54 }}
                            value={addInitiative}
                            placeholder="0"
                            onChange={e => setAddInitiative(e.target.value)}
                          />
                        </label>
                        <label className="cmb__mini-field">
                          ×
                          <input
                            type="number"
                            className="pedit__input"
                            style={{ width: 44 }}
                            min={1}
                            max={20}
                            value={addCount}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v >= 1) setAddCount(Math.min(20, v));
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="cmb__primary"
                          disabled={busy}
                          onClick={handleAddEntity}
                        >
                          <Plus size={11} /> Add
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="cmb__cancel-btn"
                      onClick={() => { setAddEntity(null); setShowAddForm(false); }}
                    >
                      <XIcon size={11} /> Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PluginShell>
  );
}
