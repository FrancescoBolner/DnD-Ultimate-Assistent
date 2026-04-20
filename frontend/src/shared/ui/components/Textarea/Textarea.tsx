import type { TextareaHTMLAttributes } from 'react';
import './Textarea.css';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export default function Textarea({
  label,
  error,
  className = '',
  id,
  ...rest
}: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`textarea-group ${error ? 'textarea-group--error' : ''} ${className}`}>
      {label && (
        <label className="textarea-group__label" htmlFor={textareaId}>
          {label}{rest.required && <span className="field-required">*</span>}
        </label>
      )}
      <textarea className="textarea-group__textarea" id={textareaId} {...rest} />
      {error && <span className="textarea-group__error">{error}</span>}
    </div>
  );
}
