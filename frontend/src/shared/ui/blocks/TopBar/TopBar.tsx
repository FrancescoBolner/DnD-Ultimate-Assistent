import type { ReactNode } from 'react';
import './TopBar.css';

export interface TopBarProps {
  /** Page title */
  title: string;
  /** Subtitle / breadcrumb */
  subtitle?: string;
  /** Slot for content aligned to the right (buttons, badges…) */
  actions?: ReactNode;
  /** Slot for content aligned to the left after the title */
  meta?: ReactNode;
  /** Show a bottom border */
  bordered?: boolean;
  className?: string;
}

export function TopBar({
  title,
  subtitle,
  actions,
  meta,
  bordered = true,
  className = '',
}: TopBarProps) {
  const cls = [
    'topbar',
    bordered && 'topbar--bordered',
    className,
  ].filter(Boolean).join(' ');

  return (
    <header className={cls}>
      <div className="topbar__left">
        <div className="topbar__title-group">
          <h1 className="topbar__title">{title}</h1>
          {subtitle && <span className="topbar__subtitle">{subtitle}</span>}
        </div>
        {meta && <div className="topbar__meta">{meta}</div>}
      </div>

      {actions && <div className="topbar__actions">{actions}</div>}
    </header>
  );
}
