import './Hpbar.css';

interface HpBarProps {
  current: number;
  max: number;
  temp?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function HpBar({ current, max, temp = 0, showLabel = true, size = 'md' }: HpBarProps) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const tempPct = Math.max(0, Math.min(100 - pct, (temp / max) * 100));

  let level: string;
  if (pct > 60) level = 'high';
  else if (pct > 30) level = 'mid';
  else level = 'low';

  return (
    <div className={`hpbar hpbar--${size}`} role="progressbar"
      aria-valuenow={current} aria-valuemin={0} aria-valuemax={max}
      aria-label={`HP ${current} of ${max}`}>
      <div className="hpbar__track">
        <div className={`hpbar__fill hpbar__fill--${level}`} style={{ width: `${pct}%` }} />
        {temp > 0 && (
          <div className="hpbar__fill hpbar__fill--temp" style={{ width: `${tempPct}%`, left: `${pct}%` }} />
        )}
      </div>
      {showLabel && (
        <span className="hpbar__label">
          {current}{temp > 0 && <span className="hpbar__temp">+{temp}</span>} / {max}
        </span>
      )}
    </div>
  );
}
