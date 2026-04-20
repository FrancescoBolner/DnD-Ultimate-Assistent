import type { ReactNode } from 'react';
import './Divider.css';

export interface DividerProps {
  /** Optional label in the centre of the divider */
  label?: ReactNode;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ label, orientation = 'horizontal', className = '' }: DividerProps) {
  const cls = [
    'divider',
    `divider--${orientation}`,
    label && 'divider--labeled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} role="separator">
      {label && orientation === 'horizontal' && (
        <span className="divider__label">{label}</span>
      )}
    </div>
  );
}
