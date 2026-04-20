import { Minus, Plus } from 'lucide-react';
import './NumberStepper.css';

export interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  /** Show numeric input in the middle (allows direct typing) */
  editable?: boolean;
  className?: string;
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  editable = false,
  className = '',
}: NumberStepperProps) {
  function clamp(n: number) { return Math.min(max, Math.max(min, n)); }

  return (
    <div className={`num-stepper ${className}`.trim()}>
      {label && <span className="num-stepper__label">{label}</span>}
      <div className="num-stepper__controls">
        <button
          type="button"
          className="num-stepper__btn"
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label="Decrease"
        >
          <Minus size={12} />
        </button>

        {editable ? (
          <input
            className="num-stepper__input"
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={e => onChange(clamp(Number(e.target.value)))}
          />
        ) : (
          <span className="num-stepper__value">{value}</span>
        )}

        <button
          type="button"
          className="num-stepper__btn"
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label="Increase"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
