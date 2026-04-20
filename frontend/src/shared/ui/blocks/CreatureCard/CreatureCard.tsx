import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { StatChip } from '../../components/StatChip';
import { Tag } from '../../components/Tag';
import { HpBar } from '../../components/HpBar';
import { Shield, Zap } from 'lucide-react';
import './CreatureCard.css';

export interface CreatureCardData {
  id:          number | string;
  name:        string;
  type?:       string;    // e.g. "Undead", "Beast"
  size?:       string;    // e.g. "Medium"
  cr?:         string;
  hp:          number;
  hpMax:       number;
  ac?:         number;
  speed?:      number;
  conditions?: string[];
  tags?:       string[];
}

export interface CreatureCardProps {
  creature:   CreatureCardData;
  onClick?:   () => void;
  className?: string;
}

export function CreatureCard({ creature, onClick, className = '' }: CreatureCardProps) {
  const subtitle = [creature.size, creature.type].filter(Boolean).join(' ');

  return (
    <Card
      onClick={onClick}
      className={`creature-card ${className}`.trim()}
    >
      <div className="creature-card__inner">
        {/* Header row */}
        <div className="creature-card__head">
          <div className="creature-card__title-group">
            <span className="creature-card__name">{creature.name}</span>
            {subtitle && <span className="creature-card__subtitle">{subtitle}</span>}
          </div>
          <div className="creature-card__badges">
            {creature.cr !== undefined && (
              <Badge variant="warning" size="xs">CR {creature.cr}</Badge>
            )}
            {creature.tags?.map(t => (
              <Badge key={t} variant="ghost" size="xs">{t}</Badge>
            ))}
          </div>
        </div>

        {/* HP bar */}
        <HpBar current={creature.hp} max={creature.hpMax} size="sm" showLabel />

        {/* Combat chips */}
        <div className="creature-card__chips">
          {creature.ac !== undefined && (
            <StatChip label="AC" value={creature.ac} icon={<Shield size={9} />} layout="horizontal" size="sm" variant="info" />
          )}
          {creature.speed !== undefined && (
            <StatChip label="Spd" value={`${creature.speed} ft`} icon={<Zap size={9} />} layout="horizontal" size="sm" />
          )}
        </div>

        {/* Conditions */}
        {creature.conditions && creature.conditions.length > 0 && (
          <div className="creature-card__conditions">
            {creature.conditions.map(c => (
              <Tag key={c} variant="danger">{c}</Tag>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
