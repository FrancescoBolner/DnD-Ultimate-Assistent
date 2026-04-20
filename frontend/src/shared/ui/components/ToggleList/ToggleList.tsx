import { type ReactNode } from 'react';
import './ToggleList.css';

/* ── Types ── */

export interface ToggleListItem {
  id: number | string;
  label: string;
  /** Optional secondary text (e.g. race, class) */
  secondary?: string;
  /** Optional tag shown on the right side of the toggle (e.g. "Init 12") */
  tag?: string;
}

export interface ToggleListProps<T extends ToggleListItem = ToggleListItem> {
  items: T[];
  selectedIds: Set<number | string>;
  onToggle: (id: number | string) => void;
  /** Render extra inline controls when an item is selected (e.g. Init input) */
  renderExtra?: (item: T) => ReactNode;
  /** Additional className */
  className?: string;
}

export default function ToggleList<T extends ToggleListItem = ToggleListItem>({
  items,
  selectedIds,
  onToggle,
  renderExtra,
  className = '',
}: ToggleListProps<T>) {
  return (
    <div className={`tlist ${className}`}>
      {items.map(item => {
        const selected = selectedIds.has(item.id);
        return (
          <div key={item.id} className={`tlist__row${selected ? ' tlist__row--sel' : ''}`}>
            <button
              type="button"
              className={`tlist__toggle${selected ? ' tlist__toggle--on' : ''}`}
              onClick={() => onToggle(item.id)}
            >
              <span className="tlist__label">{item.label}</span>
              {item.secondary && <span className="tlist__secondary">{item.secondary}</span>}
              {item.tag && <span className="tlist__tag">{item.tag}</span>}
            </button>
            {selected && renderExtra && (
              <div className="tlist__extra">
                {renderExtra(item)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
