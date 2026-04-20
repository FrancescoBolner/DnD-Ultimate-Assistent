import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import './Tag.css';

export type TagVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'ghost';

export interface TagProps {
  children: ReactNode;
  variant?:   TagVariant;
  /** Show a remove (×) button */
  removable?: boolean;
  onRemove?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function Tag({
  children,
  variant   = 'default',
  removable = false,
  onRemove,
  icon,
  className = '',
}: TagProps) {
  const cls = [
    'tag',
    `tag--${variant}`,
    removable && 'tag--removable',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={cls}>
      {icon && <span className="tag__icon">{icon}</span>}
      <span className="tag__text">{children}</span>
      {removable && (
        <button
          type="button"
          className="tag__remove"
          onClick={onRemove}
          aria-label="Remove"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}
