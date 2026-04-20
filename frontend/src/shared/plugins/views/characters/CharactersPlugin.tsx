import { useState, useCallback, useRef, useMemo } from 'react';
import { Sword, Heart, ShieldCheck, Wind, Eye } from 'lucide-react';
import PluginShell from '../../PluginShell';
import { Avatar, HpBar, Spinner, StatRow } from '../../../ui';
import { FilterBar } from '../../../ui/blocks/FilterBar';
import { useCampaign } from '../../../../app/providers/useCampaign';
import * as charApi from '../../../../services/api/campaigns';
import type { PluginViewMode } from '../../../types';
import '../plugin-view.css';
import './characters-plugin.css';

/* ── Damage / Heal form ─────────────────────────────────────── */
function DmgForm({
  id, current, max, temp = 0, compact = false,
  onApply,
}: {
  id:      number;
  current: number;
  max:     number;
  temp?:   number;
  compact?: boolean;
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
  }

  return (
    <div className={`chr-dmg${compact ? ' chr-dmg--compact' : ''}`}>
      <button
        className="chr-dmg__btn chr-dmg__btn--dmg"
        title="Apply damage (Enter)" type="button"
        onClick={() => apply(-1)}
      >
        <Sword size={11} />
        {!compact && <span>Dmg</span>}
      </button>
      <input
        className="chr-dmg__input"
        type="number" min={0} placeholder="0"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') apply(-1); }}
      />
      <button
        className="chr-dmg__btn chr-dmg__btn--heal"
        title="Apply healing" type="button"
        onClick={() => apply(1)}
      >
        <Heart size={11} />
        {!compact && <span>Heal</span>}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export function CharactersPlugin({ viewMode = 'widget' }: { viewMode?: PluginViewMode }) {
  const { isDm, pluginConfig, characters, campaignPlayers, charactersLoading, patchCharacter, refreshCharacters } = useCampaign();
  const cfg               = pluginConfig('characters') ?? {};
  const showUnassigned    = cfg.show_unassigned    !== false;
  const showFilterBar     = cfg.show_filter_bar     !== false;
  const hideStatsForPlayers = cfg.hide_stats_for_players === true;
  const canModify         = isDm;

  const [search, setSearch] = useState('');

  /* Debounced HP saves: optimistic patch via context, persist after 600 ms idle */
  const debounceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  /* user_id → username lookup */
  const playerMap = useMemo(
    () => new Map(campaignPlayers.map(p => [p.user_id, p.username])),
    [campaignPlayers],
  );

  /* Filter + search */
  const filtered = useMemo(() => {
    let list = characters;
    if (!showUnassigned) list = list.filter(c => c.player_id !== null);
    if (viewMode !== 'popup' && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [characters, showUnassigned, search, viewMode]);

  /* Optimistic HP update → patch context immediately, debounced API save */
  const handleHpChange = useCallback((id: number, next: { hp_current: number; hp_temp: number }) => {
    patchCharacter(id, { hp_current: next.hp_current, hp_temp: next.hp_temp });
    const timers = debounceTimers.current;
    if (timers.has(id)) clearTimeout(timers.get(id)!);
    timers.set(id, setTimeout(async () => {
      timers.delete(id);
      try {
        await charApi.updateCharacter(id, { hp_current: next.hp_current, hp_temp: next.hp_temp });
      } catch {
        refreshCharacters(); // re-sync on error
      }
    }, 600));
  }, [patchCharacter, refreshCharacters]);

  /* ── Popup ─────────────────────────────────────────────────── */
  if (viewMode === 'popup') {
    return (
      <PluginShell slug="characters" viewMode="popup">
        <div className="chr-popup">
          {charactersLoading && <div className="plugin-view__loading"><Spinner size="sm" /></div>}
          {filtered.map(c => {
            return (
              <div key={c.id} className="chr-popup__row">
                <Avatar src={c.image} name={c.name} size="xs" shape="rounded" />
                <div className="chr-popup__info">
                  <div className="chr-popup__name-line">
                    <span className="chr-popup__name">{c.name}</span>
                    <span className="chr-popup__hp-text">{c.hp_current}/{c.hp_max}</span>
                  </div>
                  <HpBar
                    current={c.hp_current} max={c.hp_max}
                    temp={c.hp_temp || undefined}
                    size="sm" showLabel={false}
                  />
                </div>
                {canModify && (
                  <DmgForm
                    id={c.id} current={c.hp_current} max={c.hp_max} temp={c.hp_temp || 0}
                    compact onApply={handleHpChange}
                  />
                )}
              </div>
            );
          })}
          {!charactersLoading && filtered.length === 0 && (
            <p className="plugin-view__empty">No characters.</p>
          )}
        </div>
      </PluginShell>
    );
  }

  /* ── Widget & Fullscreen ───────────────────────────────────── */
  const isFullscreen = viewMode === 'fullscreen';
  return (
    <PluginShell slug="characters" viewMode={viewMode}>
      <div className="plugin-view">
        {showFilterBar && (
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            onSearchClear={() => setSearch('')}
            searchPlaceholder="Search characters…"
          />
        )}
        {charactersLoading && <div className="plugin-view__loading"><Spinner size="sm" /></div>}

        <div className="chr-list">
          {filtered.map(c => {
            const player = c.player_id != null ? playerMap.get(c.player_id) : undefined;

            /* ── Fullscreen card ─────────────────────────────────── */
            if (isFullscreen) {
              return (
                <div key={c.id} className="chr-row chr-row--full">
                  {/* Header: avatar + name + player */}
                  <div className="chr-row__head">
                    <Avatar src={c.image} name={c.name} size="md" shape="rounded" className="chr-row__avatar" />
                    <div className="chr-row__title-line">
                      <span className="chr-row__name">{c.name}</span>
                      {player && <span className="chr-row__player">@{player}</span>}
                      {canModify && (
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
                    {canModify && (
                      <DmgForm id={c.id} current={c.hp_current} max={c.hp_max} temp={c.hp_temp || 0} onApply={handleHpChange} />
                    )}
                  </div>

                  {/* Combat section */}
                  <div className="plugin-section">
                    <div className="plugin-section__head">Combat</div>
                    <div className="plugin-combat-row">
                      <div className="plugin-combat-block">
                        <Heart size={13} className="plugin-combat-icon" />
                        <span className="plugin-combat-lbl">HP</span>
                        <HpBar
                          current={c.hp_current} max={c.hp_max}
                          temp={c.hp_temp || undefined}
                          size="sm" showLabel
                        />
                      </div>
                      {(!hideStatsForPlayers || isDm) && c.ac > 0 && (
                        <div className="plugin-combat-stat">
                          <ShieldCheck size={13} /><span>{c.ac}</span><label>AC</label>
                        </div>
                      )}
                      {(!hideStatsForPlayers || isDm) && c.speed > 0 && (
                        <div className="plugin-combat-stat">
                          <Wind size={13} /><span>{c.speed}</span><label>Spd</label>
                        </div>
                      )}
                      {c.level > 0 && (
                        <div className="plugin-combat-stat">
                          <Eye size={13} /><span>{c.level}</span><label>Lv</label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ability scores section */}
                  {(!hideStatsForPlayers || isDm) && c.stats && (
                    <div className="plugin-section">
                      <div className="plugin-section__head">Ability Scores</div>
                      <div className="plugin-stats-grid">
                        <StatRow stats={c.stats} />
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            /* ── Widget row ──────────────────────────────────────── */
            return (
              <div key={c.id} className="chr-row">
                <Avatar src={c.image} name={c.name} size="sm" shape="rounded" className="chr-row__avatar" />
                <div className="chr-row__body">
                  <div className="chr-row__title-line">
                    <span className="chr-row__name">{c.name}</span>
                    {player && <span className="chr-row__player">@{player}</span>}
                    {canModify && (
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
                    {c.level > 0 && <span className="chr-row__chip">Lv {c.level}</span>}
                    {(!hideStatsForPlayers || isDm) && c.ac    > 0 && <span className="chr-row__chip">AC {c.ac}</span>}
                    {(!hideStatsForPlayers || isDm) && c.speed > 0 && <span className="chr-row__chip">{c.speed}m</span>}
                  </div>
                  <div className="chr-row__hp-line">
                    <div className="chr-row__hpbar-wrap">
                      <HpBar
                        current={c.hp_current} max={c.hp_max}
                        temp={c.hp_temp || undefined}
                        size="sm" showLabel
                      />
                    </div>
                    {canModify && (
                      <DmgForm id={c.id} current={c.hp_current} max={c.hp_max} temp={c.hp_temp || 0} compact onApply={handleHpChange} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!charactersLoading && filtered.length === 0 && (
            <p className="plugin-view__empty">No characters found.</p>
          )}
        </div>
      </div>
    </PluginShell>
  );
}
