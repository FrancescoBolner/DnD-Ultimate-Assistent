import type { ReactNode } from 'react';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import './EntityHeader.css';

export type EntityType = 'character' | 'creature' | 'npc';

export interface EntityHeaderProps {
  name: string;
  /** Subtitle line: race, class, creature type, etc. */
  subtitle?: string;
  avatarSrc?: string;
  /** Entity type badge */
  type?: EntityType;
  /** Character level */
  level?: number;
  /** Creature CR */
  cr?: string;
  /** Extra badges slot */
  tags?: ReactNode;
  className?: string;
}

const TYPE_LABEL: Record<EntityType, string> = {
  character: 'PC',
  creature:  'Creature',
  npc:       'NPC',
};

const TYPE_VARIANT = {
  character: 'accent',
  creature:  'danger',
  npc:       'warning',
} as const;

export function EntityHeader({
  name,
  subtitle,
  avatarSrc,
  type,
  level,
  cr,
  tags,
  className = '',
}: EntityHeaderProps) {
  return (
    <div className={`entity-header ${className}`.trim()}>
      <Avatar src={avatarSrc} name={name} size="md" />

      <div className="entity-header__info">
        <div className="entity-header__top">
          <span className="entity-header__name">{name}</span>
          <div className="entity-header__badges">
            {type && (
              <Badge variant={TYPE_VARIANT[type]} size="xs">{TYPE_LABEL[type]}</Badge>
            )}
            {level !== undefined && (
              <Badge variant="accent" size="xs">Lv {level}</Badge>
            )}
            {cr !== undefined && (
              <Badge variant="warning" size="xs">CR {cr}</Badge>
            )}
            {tags}
          </div>
        </div>
        {subtitle && <span className="entity-header__subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}
