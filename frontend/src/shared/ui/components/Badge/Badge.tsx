import type { ReactNode } from 'react';
import './Badge.css';

export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'ghost';
export type BadgeSize    = 'xs' | 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  dot?: boolean;           // small status dot before text
  pill?: boolean;          // fully rounded (default: rounded)
  className?: string;
}

export default function Badge({
  children,
  variant = 'default',
  size    = 'sm',
  icon,
  dot     = false,
  pill    = true,
  className = '',
}: BadgeProps) {
  const cls = [
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    pill ? 'badge--pill' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={cls}>
      {dot && <span className="badge__dot" />}
      {icon && <span className="badge__icon">{icon}</span>}
      <span className="badge__text">{children}</span>
    </span>
  );
}
