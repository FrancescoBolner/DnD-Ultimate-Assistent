import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import './ItemCard.css';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact';

export interface ItemCardData {
  id:          number | string;
  name:        string;
  type?:       string;      // e.g. "Weapon", "Armor", "Potion"
  subtype?:    string;      // e.g. "Longsword", "Plate"
  rarity?:     ItemRarity;
  equipped?:   boolean;
  attunement?: boolean;
  quantity?:   number;
  description?: string;
}

export interface ItemCardProps {
  item:       ItemCardData;
  onClick?:   () => void;
  className?: string;
}

const RARITY_VARIANT: Record<ItemRarity, 'default' | 'success' | 'info' | 'accent' | 'danger' | 'warning'> = {
  common:    'default',
  uncommon:  'success',
  rare:      'info',
  'very rare': 'accent',
  legendary: 'warning',
  artifact:  'danger',
};

export function ItemCard({ item, onClick, className = '' }: ItemCardProps) {
  const subtitle = [item.type, item.subtype].filter(Boolean).join(' · ');

  return (
    <Card
      onClick={onClick}
      className={`item-card ${className}`.trim()}
    >
      <div className="item-card__inner">
        <div className="item-card__head">
          <div className="item-card__title-group">
            <span className="item-card__name">{item.name}</span>
            {subtitle && <span className="item-card__subtitle">{subtitle}</span>}
          </div>

          <div className="item-card__badges">
            {item.rarity && (
              <Badge variant={RARITY_VARIANT[item.rarity]} size="xs">{item.rarity}</Badge>
            )}
            {item.equipped && <Badge variant="success" size="xs">Equipped</Badge>}
            {item.attunement && <Badge variant="accent" size="xs">Attuned</Badge>}
            {item.quantity !== undefined && item.quantity > 1 && (
              <Badge variant="default" size="xs">×{item.quantity}</Badge>
            )}
          </div>
        </div>

        {item.description && (
          <p className="item-card__desc">{item.description}</p>
        )}
      </div>
    </Card>
  );
}
