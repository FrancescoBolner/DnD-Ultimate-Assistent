import './ProgressBar.css';

export type ProgressBarVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  /** Show "value / max" text */
  showLabel?: boolean;
  variant?: ProgressBarVariant;
  size?: 'sm' | 'md' | 'lg';
  /** Animate the fill when value changes */
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showLabel = false,
  variant  = 'default',
  size     = 'md',
  animated = true,
  className = '',
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  const cls = ['progress-bar', `progress-bar--${variant}`, `progress-bar--${size}`, className]
    .filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {(label || showLabel) && (
        <div className="progress-bar__header">
          {label && <span className="progress-bar__label">{label}</span>}
          {showLabel && (
            <span className="progress-bar__count">{value} / {max}</span>
          )}
        </div>
      )}
      <div
        className="progress-bar__track"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`progress-bar__fill ${animated ? 'progress-bar__fill--animated' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
