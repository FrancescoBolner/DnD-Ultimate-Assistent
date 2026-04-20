/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pencil, ChevronUp, ChevronDown, BookOpen } from 'lucide-react';
import { TabIcon, RARITY_CLASS } from './vault.constants';
import type { VaultTab, AnyEntry } from './vault.types';

/* ══════════════════════════════════════════════════════
   List Header
   ══════════════════════════════════════════════════════ */

export function VaultListHeader({ tab, sortStack, onSort }: {
  tab: VaultTab;
  sortStack: { key: string; dir: 'asc' | 'desc' }[];
  onSort: (key: string) => void;
}) {
  const primary = sortStack[0];
  const col = (label: string, k: string) => {
    const isActive = primary?.key === k;
    return (
      <button
        key={k}
        className={`vault-col-header${isActive ? ' vault-col-header--active' : ''}`}
        onClick={() => onSort(k)}
        title={`Sort by ${label}`}
      >
        {label}
        {isActive
          ? (primary.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : null
        }
      </button>
    );
  };
  return (
    <div className={`vault-row-header vault-row-header--${tab}`}>
      <div />
      {col('Name', 'name')}
      {tab === 'characters' && <>
        {col('Race',  'race')}
        {col('Class', 'class')}
        {col('Lv',    'level')}
        {col('HP',    'hp')}
        {col('AC',    'ac')}
        {col('Spd',   'speed')}
      </>}
      {(tab === 'npc' || tab === 'enemy') && <>
        {col('Race', 'race')}
        {col('Size', 'size')}
        {col('CR',   'cr')}
        {col('HP',   'hp')}
        {col('AC',   'ac')}
        {col('Tags', 'tags')}
      </>}
      {tab === 'effects' && <>
        {col('Duration', 'duration')}
        {col('Damage',   'damage_type')}
        {col('Trigger',  'trigger_moment')}
        {col('Save',     'save_type')}
      </>}
      {tab === 'abilities' && <>
        {col('Action',   'action_type')}
        {col('Range',    'range')}
        {col('Damage',   'damage_type')}
        {col('Hit',      'hit_bonus')}
        {col('Cooldown', 'cooldown')}
      </>}
      {tab === 'items' && <>
        {col('Type',   'type')}
        {col('Rarity', 'rarity')}
        {col('Qty',    'quantity')}
        {col('Value',  'value')}
        {col('Status', 'is_equipped')}
      </>}
      <div />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   List Row
   ══════════════════════════════════════════════════════ */

export function VaultListRow({ tab, entry, onEdit, onView, onSheet }: {
  tab: VaultTab; entry: AnyEntry; onEdit?: () => void; onView: () => void; onSheet?: (url: string) => void;
}) {
  const e = entry as any;
  const cell = (val: React.ReactNode, cls = '') => (
    <div className={`vault-row__cell ${cls}`}>{val ?? <span className="vault-row__empty">—</span>}</div>
  );
  return (
    <div className={`vault-row vault-row--${tab}`} onClick={onView} style={{ cursor: 'pointer' }}>
      {e.image
        ? <img className="vault-row__img" src={e.image} alt={e.name} />
        : <div className="vault-row__img vault-row__img--placeholder"><TabIcon tab={tab} size={15} /></div>
      }
      <div className="vault-row__cell vault-row__cell--name">
        <span className="vault-row__name">{e.name}</span>
      </div>

      {tab === 'characters' && <>
        {cell(e.race, 'vault-row__cell--muted')}
        {cell(e.class)}
        {cell(e.level != null ? `${e.level}` : null, 'vault-row__cell--center')}
        {cell(<><span className="vault-row__hp-cur">{e.hp_current}</span><span className="vault-row__hp-sep">/</span><span className="vault-row__hp-max">{e.hp_max}</span></>, 'vault-row__cell--hp')}
        {cell(e.ac != null ? String(e.ac) : null, 'vault-row__cell--center')}
        {cell(e.speed != null ? String(e.speed) : null, 'vault-row__cell--center')}
      </>}

      {(tab === 'npc' || tab === 'enemy') && <>
        {cell(e.race, 'vault-row__cell--muted')}
        {cell(e.size, 'vault-row__cell--muted')}
        {cell(e.cr != null ? `CR ${e.cr}` : null, 'vault-row__cell--center vault-row__cell--muted')}
        {cell(<><span className="vault-row__hp-cur">{e.hp_current}</span><span className="vault-row__hp-sep">/</span><span className="vault-row__hp-max">{e.hp_max}</span></>, 'vault-row__cell--hp')}
        {cell(e.ac != null ? String(e.ac) : null, 'vault-row__cell--center')}
        <div className="vault-row__cell vault-row__cell--tags">
          {(e.tags ?? []).length > 0
            ? (e.tags ?? []).map((t: string) => <span key={t} className="vault-badge vault-badge--tag">{t}</span>)
            : <span className="vault-row__empty">—</span>}
        </div>
      </>}

      {tab === 'effects' && <>
        {cell(e.duration ?? null, 'vault-row__cell--muted')}
        {cell(e.damage ? `${e.damage}${e.damage_type ? ` ${e.damage_type}` : ''}` : null)}
        {cell(e.trigger_moment ?? null, 'vault-row__cell--muted')}
        <div className="vault-row__cell vault-row__cell--tags">
          {e.is_concentration && <span className="vault-badge vault-badge--conc">Conc.</span>}
          {e.save_type && <span className="vault-badge">{e.save_type} DC{e.save_dc}</span>}
          {!e.is_concentration && !e.save_type && <span className="vault-row__empty">—</span>}
        </div>
      </>}

      {tab === 'abilities' && <>
        {cell(e.action_type ?? null, 'vault-row__cell--muted')}
        {cell(e.range ?? null, 'vault-row__cell--muted')}
        {cell(e.damage ? `${e.damage}${e.damage_type ? ` ${e.damage_type}` : ''}` : null)}
        {cell(e.hit_bonus != null ? `+${e.hit_bonus}` : null, 'vault-row__cell--center')}
        {cell(e.cooldown ?? null, 'vault-row__cell--muted')}
      </>}

      {tab === 'items' && <>
        {cell(e.type ?? null, 'vault-row__cell--muted')}
        {cell(e.rarity ? e.rarity.replace('_',' ') : null, `vault-row__cell--rarity ${RARITY_CLASS[e.rarity] ?? ''}`)}
        {cell(e.quantity != null ? `×${e.quantity}` : null, 'vault-row__cell--center')}
        {cell(e.value ?? null, 'vault-row__cell--muted')}
        <div className="vault-row__cell vault-row__cell--tags">
          {e.is_equipped ? <span className="vault-badge vault-badge--equipped">Equipped</span> : <span className="vault-row__empty">—</span>}
        </div>
      </>}

      {onEdit && (
        <div className="vault-row__actions">
          {onSheet && (tab === 'npc' || tab === 'enemy') && (e as any).sheet_image && (
            <button className="vault-row__sheet" onClick={ev => { ev.stopPropagation(); onSheet((e as any).sheet_image); }} title="View Sheet">
              <BookOpen size={13} />
            </button>
          )}
          <button className="vault-row__edit" onClick={e2 => { e2.stopPropagation(); onEdit(); }} title="Edit"><Pencil size={13} /></button>
        </div>
      )}
      {!onEdit && onSheet && (tab === 'npc' || tab === 'enemy') && (e as any).sheet_image && (
        <div className="vault-row__actions">
          <button className="vault-row__sheet" onClick={ev => { ev.stopPropagation(); onSheet((e as any).sheet_image); }} title="View Sheet">
            <BookOpen size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Card
   ══════════════════════════════════════════════════════ */

export function VaultCard({ tab, entry, onEdit, onView, onSheet }: {
  tab: VaultTab; entry: AnyEntry; onEdit?: () => void; onView: () => void; onSheet?: (url: string) => void;
}) {
  const e = entry as any;
  return (
    <div className="vault-card" onClick={onView} style={{ cursor: 'pointer' }}>
      <div className="vault-card__img-wrap">
        {e.image
          ? <img className="vault-card__img" src={e.image} alt={e.name} />
          : <div className="vault-card__img vault-card__img--placeholder"><TabIcon tab={tab} size={28} /></div>
        }
        {onEdit && <button className="vault-card__edit" onClick={e2 => { e2.stopPropagation(); onEdit(); }} title="Edit">
          <Pencil size={12} />
        </button>}
        {onSheet && (tab === 'npc' || tab === 'enemy') && (e as any).sheet_image && (
          <button className="vault-card__sheet" onClick={ev => { ev.stopPropagation(); onSheet((e as any).sheet_image); }} title="View Sheet">
            <BookOpen size={12} />
          </button>
        )}
      </div>
      <div className="vault-card__info">
        <span className="vault-card__name">{e.name}</span>
        <span className="vault-card__sub">
          {tab === 'characters' && `${e.class ?? ''} Lv ${e.level}`}
          {tab === 'npc'        && [e.cr ? `CR ${e.cr}` : null, e.size, e.race].filter(Boolean).join(' · ')}
          {tab === 'enemy'      && [e.cr ? `CR ${e.cr}` : null, e.size, e.race].filter(Boolean).join(' · ')}
          {tab === 'effects'    && (e.duration ?? '—')}
          {tab === 'abilities'  && e.action_type}
          {tab === 'items'      && (e.rarity?.replace('_',' ') ?? e.type)}
        </span>
        <div className="vault-card__badges">
          {(tab==='characters'||tab==='npc'||tab==='enemy') && <>
            <span className="vault-badge">HP {e.hp_current}/{e.hp_max}</span>
            <span className="vault-badge">AC {e.ac}</span>
          </>}
        </div>
        {tab === 'abilities' && e.damage && <div className="vault-card__badges">
          <span className="vault-badge">{e.damage}</span>
        </div>}
        {tab === 'effects'   && e.is_concentration && <div className="vault-card__badges">
          <span className="vault-badge vault-badge--conc">Conc.</span>
        </div>}
        {tab === 'items' && <div className="vault-card__badges">
          <span className="vault-badge">×{e.quantity}</span>
        </div>}
        {(tab==='npc'||tab==='enemy') && <div className="vault-card__badges">
            {(e.tags ?? []).map((t: string) => (
              <span key={t} className="vault-badge vault-badge--tag">{t}</span>
            ))}
        </div>}
      </div>
    </div>
  );
}
