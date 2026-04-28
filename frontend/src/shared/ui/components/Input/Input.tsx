import type { InputHTMLAttributes, ReactNode } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  suffix?: ReactNode;
}

export default function Input({ label, error, suffix, className = '', id, required, ...rest }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`input-group ${error ? 'input-group--error' : ''} ${className}`}>
      {label && (
        <label className="input-group__label" htmlFor={inputId}>
          {label}{required && <span className="field-required">*</span>}
        </label>
      )}
      <div className={`input-group__wrap${suffix ? ' input-group__wrap--suffix' : ''}`}>
        <input className="input-group__input" id={inputId} required={required} {...rest} />
        {suffix && <span className="input-group__suffix">{suffix}</span>}
      </div>
      {error && <span className="input-group__error">{error}</span>}
    </div>
  );
}
