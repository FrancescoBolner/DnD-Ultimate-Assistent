import type { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  onClick?: () => void;
}

export default function Card({ title, actions, children, className = '', compact, onClick }: CardProps) {
  return (
    <div
      className={`card ${compact ? 'card--compact' : ''} ${onClick ? 'card--clickable' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(title || actions) && (
        <div className="card__header">
          {title && <h3 className="card__title">{title}</h3>}
          {actions && <div className="card__actions">{actions}</div>}
        </div>
      )}
      <div className="card__body">{children}</div>
    </div>
  );
}
