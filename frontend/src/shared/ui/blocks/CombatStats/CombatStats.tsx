import { Shield, Zap, Star } from 'lucide-react';
import { HpBar } from '../../components/HpBar';
import { StatChip } from '../../components/StatChip';
import './CombatStats.css';

export interface CombatStatsProps {
  /** Current HP */
  hp: number;
  /** Max HP */
  hpMax: number;
  /** Temporary HP */
  hpTemp?: number;
  /** Armour Class */
  ac?: number;
  /** Movement speed in feet */
  speed?: number;
  /** Character level OR creature CR string */
  level?: number;
  cr?: string;
  /** Initiative bonus */
  initiative?: number;
  className?: string;
}

export function CombatStats({
  hp,
  hpMax,
  hpTemp,
  ac,
  speed,
  level,
  cr,
  initiative,
  className = '',
}: CombatStatsProps) {
  return (
    <div className={`combat-stats ${className}`.trim()}>
      <HpBar current={hp} max={hpMax} temp={hpTemp} size="sm" showLabel />

      <div className="combat-stats__chips">
        {ac !== undefined && (
          <StatChip
            label="AC"
            value={ac}
            icon={<Shield size={9} />}
            layout="horizontal"
            size="sm"
            variant="info"
          />
        )}
        {speed !== undefined && (
          <StatChip
            label="Spd"
            value={`${speed} ft`}
            icon={<Zap size={9} />}
            layout="horizontal"
            size="sm"
          />
        )}
        {initiative !== undefined && (
          <StatChip
            label="Init"
            value={initiative >= 0 ? `+${initiative}` : `${initiative}`}
            layout="horizontal"
            size="sm"
            variant={initiative >= 0 ? 'success' : 'warning'}
          />
        )}
        {level !== undefined && (
          <StatChip
            label="Lv"
            value={level}
            icon={<Star size={9} />}
            layout="horizontal"
            size="sm"
            variant="accent"
          />
        )}
        {cr !== undefined && (
          <StatChip
            label="CR"
            value={cr}
            layout="horizontal"
            size="sm"
            variant="warning"
          />
        )}
      </div>
    </div>
  );
}
