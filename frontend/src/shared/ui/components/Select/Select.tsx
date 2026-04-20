import type { SelectHTMLAttributes, ReactNode } from 'react';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Visual variant: default (form field with label) or compact (toolbar inline) */
  variant?: 'default' | 'compact';
  label?: string;
  error?: string;
  /** Prefix icon shown inside the select wrapper */
  icon?: ReactNode;
  options?: SelectOption[];
  placeholder?: string;
  children?: ReactNode;
}

export default function Select({
  variant = 'default',
  label,
  error,
  icon,
  options,
  placeholder,
  className = '',
  id,
  children,
  ...rest
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const rootCls = [
    'select-group',
    `select-group--${variant}`,
    error ? 'select-group--error' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={rootCls}>
      {label && (
        <label className="select-group__label" htmlFor={selectId}>
          {label}{rest.required && <span className="field-required">*</span>}
        </label>
      )}
      <div className="select-group__wrapper">
        {icon && <span className="select-group__icon">{icon}</span>}
        <select className="select-group__select" id={selectId} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options && (() => {
            const hasGroups = options.some(o => o.group);
            if (!hasGroups) {
              return options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ));
            }
            // Build ordered map of groups preserving insertion order
            const groupMap = new Map<string, SelectOption[]>();
            options.forEach(o => {
              const g = o.group ?? '';
              if (!groupMap.has(g)) groupMap.set(g, []);
              groupMap.get(g)!.push(o);
            });
            return Array.from(groupMap.entries()).map(([grp, items]) =>
              grp ? (
                <optgroup key={grp} label={grp}>
                  {items.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ) : (
                items.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
              )
            );
          })()}
          {children}
        </select>
      </div>
      {error && <span className="select-group__error">{error}</span>}
    </div>
  );
}
