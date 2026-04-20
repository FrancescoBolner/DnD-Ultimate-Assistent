import type { InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = '', id, required, ...rest }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`input-group ${error ? 'input-group--error' : ''} ${className}`}>
      {label && (
        <label className="input-group__label" htmlFor={inputId}>
          {label}{required && <span className="field-required">*</span>}
        </label>
      )}
      <input className="input-group__input" id={inputId} required={required} {...rest} />
      {error && <span className="input-group__error">{error}</span>}
    </div>
  );
}
