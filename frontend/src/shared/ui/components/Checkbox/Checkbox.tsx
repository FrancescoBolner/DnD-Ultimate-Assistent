import { Check, Minus as MinusIcon } from 'lucide-react';
import './Checkbox.css';

export interface CheckboxProps {
  label?: string;
  checked: boolean;
  /** Indeterminate state (partial selection) */
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  label,
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  className = '',
}: CheckboxProps) {
  const cls = [
    'checkbox',
    checked && 'checkbox--checked',
    indeterminate && 'checkbox--indeterminate',
    disabled && 'checkbox--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label className={cls}>
      <span
        className="checkbox__box"
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) onChange(!checked); }}
        onClick={() => { if (!disabled) onChange(!checked); }}
      >
        {(checked || indeterminate) && (
          <span className="checkbox__icon" aria-hidden="true">
            {indeterminate ? <MinusIcon size={10} strokeWidth={3} /> : <Check size={10} strokeWidth={3} />}
          </span>
        )}
      </span>
      {label && <span className="checkbox__label">{label}</span>}
    </label>
  );
}
