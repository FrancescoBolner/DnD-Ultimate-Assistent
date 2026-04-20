import { Tag } from '../../components/Tag';
import { Tooltip } from '../../components/Tooltip';
import './EffectRow.css';

export type EffectVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export interface ActiveEffect {
  id:          number | string;
  name:        string;
  variant?:    EffectVariant;
  /** Remaining duration (e.g. "3 rounds", "Until dispelled") */
  duration?:   string;
  description?: string;
}

export interface EffectRowProps {
  effects:     ActiveEffect[];
  /** Allow removing effects */
  removable?:  boolean;
  onRemove?:   (id: number | string) => void;
  /** Compact one-line layout vs wrapped grid */
  wrap?:       boolean;
  className?:  string;
}

export function EffectRow({
  effects,
  removable = false,
  onRemove,
  wrap = true,
  className = '',
}: EffectRowProps) {
  if (effects.length === 0) {
    return <span className="effect-row__empty">No active effects</span>;
  }

  const cls = ['effect-row', wrap && 'effect-row--wrap', className].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {effects.map(eff => {
        const tag = (
          <Tag
            key={eff.id}
            variant={eff.variant ?? 'default'}
            removable={removable}
            onRemove={() => onRemove?.(eff.id)}
          >
            {eff.name}
            {eff.duration && (
              <span className="effect-row__duration">{eff.duration}</span>
            )}
          </Tag>
        );

        if (eff.description) {
          return (
            <Tooltip key={eff.id} content={eff.description} placement="top">
              {tag}
            </Tooltip>
          );
        }
        return tag;
      })}
    </div>
  );
}
