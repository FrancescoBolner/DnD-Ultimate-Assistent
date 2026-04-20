import type { ReactNode } from 'react';
import './StatChip.css';

export type StatChipVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type StatChipLayout  = 'vertical' | 'horizontal';
export type StatChipSize    = 'sm' | 'md' | 'lg';

export interface StatChipProps {
  /** Short label shown above or before the value (e.g. "AC", "Spd", "CR", "Lv") */
  label: string;
  /** The main numeric or string value */
  value: ReactNode;
  variant?: StatChipVariant;
  /** Optional icon shown before the label */
  icon?: ReactNode;
  /** Layout: vertical = label on top, horizontal = label | value inline */
  layout?: StatChipLayout;
  size?: StatChipSize;
  className?: string;
}

export function StatChip({
  label,
  value,
  variant  = 'default',
  icon,
  layout   = 'vertical',
  size     = 'md',
  className = '',
}: StatChipProps) {
  const cls = [
    'stat-chip',
    `stat-chip--${variant}`,
    `stat-chip--${size}`,
    `stat-chip--${layout}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <span className="stat-chip__label">
        {icon && <span className="stat-chip__icon">{icon}</span>}
        {label}
      </span>
      <span className="stat-chip__value">{value}</span>
    </div>
  );
}
