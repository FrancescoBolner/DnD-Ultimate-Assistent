import { EntityHeader } from '../EntityHeader';
import { CombatStats } from '../CombatStats';
import { Tag } from '../../components/Tag';
import { Card } from '../../components/Card';
import './CharacterCard.css';

export interface CharacterCardData {
  id:         number | string;
  name:       string;
  race?:      string;
  class?:     string;
  level?:     number;
  avatarSrc?: string;
  hp:         number;
  hpMax:      number;
  hpTemp?:    number;
  ac?:        number;
  speed?:     number;
  initiative?: number;
  conditions?: string[];
}

export interface CharacterCardProps {
  character:  CharacterCardData;
  onClick?:   () => void;
  /** Show the six ability scores row */
  compact?:   boolean;
  className?: string;
}

export function CharacterCard({ character, onClick, compact = true, className = '' }: CharacterCardProps) {
  const subtitle = [character.race, character.class].filter(Boolean).join(' · ');

  return (
    <Card
      onClick={onClick}
      className={`character-card ${className}`.trim()}
    >
      <div className="character-card__inner">
        <EntityHeader
          name={character.name}
          subtitle={subtitle || undefined}
          avatarSrc={character.avatarSrc}
          type="character"
          level={character.level}
        />

        {!compact && (
          <CombatStats
            hp={character.hp}
            hpMax={character.hpMax}
            hpTemp={character.hpTemp}
            ac={character.ac}
            speed={character.speed}
            initiative={character.initiative}
            level={character.level}
          />
        )}

        {compact && (
          <div className="character-card__compact-hp">
            <span className="character-card__hp-label">HP</span>
            <span className="character-card__hp-value">
              {character.hpTemp
                ? `${character.hp}+${character.hpTemp} / ${character.hpMax}`
                : `${character.hp} / ${character.hpMax}`}
            </span>
          </div>
        )}

        {character.conditions && character.conditions.length > 0 && (
          <div className="character-card__conditions">
            {character.conditions.map(c => (
              <Tag key={c} variant="danger">{c}</Tag>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
