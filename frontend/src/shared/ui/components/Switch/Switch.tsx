import './Switch.css';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export default function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: SwitchProps) {
  const switchId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <label className={`switch-field${disabled ? ' switch-field--disabled' : ''}`} htmlFor={switchId}>
      <div className="switch-field__text">
        {label && <span className="switch-field__label">{label}</span>}
        {description && <span className="switch-field__desc">{description}</span>}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch-track${checked ? ' switch-track--on' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <span className="switch-thumb" />
      </button>
    </label>
  );
}
