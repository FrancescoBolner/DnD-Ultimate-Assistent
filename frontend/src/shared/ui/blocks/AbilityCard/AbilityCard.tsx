import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { StatChip } from '../../components/StatChip';
import { ProgressBar } from '../../components/ProgressBar';
import './AbilityCard.css';

export type AbilityActionType = 'action' | 'bonus' | 'reaction' | 'passive' | 'legendary';
export type AbilityTargetType = 'single' | 'aoe' | 'self' | 'touch';

export interface AbilityCardData {
  id:           number | string;
  name:         string;
  school?:      string;     // e.g. "Evocation"
  actionType?:  AbilityActionType;
  targetType?:  AbilityTargetType;
  range?:       string;     // e.g. "60 ft", "Touch"
  duration?:    string;     // e.g. "Concentration, 1 minute"
  description?: string;
  /** Current charges / max charges */
  charges?:     { current: number; max: number };
  /** Spell level — 0 = cantrip */
  level?:       number;
  prepared?:    boolean;
}

export interface AbilityCardProps {
  ability:    AbilityCardData;
  onClick?:   () => void;
  className?: string;
}

const ACTION_VARIANT = {
  action:    'accent',
  bonus:     'info',
  reaction:  'warning',
  passive:   'default',
  legendary: 'danger',
} as const;

export function AbilityCard({ ability, onClick, className = '' }: AbilityCardProps) {
  return (
    <Card
      onClick={onClick}
      className={`ability-card ${className}`.trim()}
    >
      <div className="ability-card__inner">
        <div className="ability-card__head">
          <div className="ability-card__title-group">
            <span className="ability-card__name">{ability.name}</span>
            {ability.school && (
              <span className="ability-card__school">{ability.school}</span>
            )}
          </div>

          <div className="ability-card__badges">
            {ability.level !== undefined && (
              <Badge variant="accent" size="xs">
                {ability.level === 0 ? 'Cantrip' : `Lv ${ability.level}`}
              </Badge>
            )}
            {ability.actionType && (
              <Badge variant={ACTION_VARIANT[ability.actionType]} size="xs">
                {ability.actionType}
              </Badge>
            )}
            {ability.prepared && <Badge variant="success" size="xs">Prepared</Badge>}
          </div>
        </div>

        {/* Chips: range + duration */}
        {(ability.range || ability.duration) && (
          <div className="ability-card__chips">
            {ability.range && (
              <StatChip label="Range" value={ability.range} layout="horizontal" size="sm" />
            )}
            {ability.duration && (
              <StatChip label="Duration" value={ability.duration} layout="horizontal" size="sm" />
            )}
          </div>
        )}

        {ability.description && (
          <p className="ability-card__desc">{ability.description}</p>
        )}

        {ability.charges && (
          <ProgressBar
            value={ability.charges.current}
            max={ability.charges.max}
            label="Charges"
            showLabel
            size="sm"
            variant="accent"
          />
        )}
      </div>
    </Card>
  );
}
