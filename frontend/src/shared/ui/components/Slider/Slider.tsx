import './Slider.css';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  formatValue?: (value: number) => string;
}

export default function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  description,
  disabled = false,
  id,
  formatValue,
}: SliderProps) {
  const sliderId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <label className={`slider-field${disabled ? ' slider-field--disabled' : ''}`} htmlFor={sliderId}>
      <div className="slider-field__text">
        {label && <span className="slider-field__label">{label}</span>}
        {description && <span className="slider-field__desc">{description}</span>}
      </div>
      <div className="slider-field__control">
        <input
          id={sliderId}
          className="slider-field__input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="slider-field__value">{displayValue}</span>
      </div>
    </label>
  );
}
