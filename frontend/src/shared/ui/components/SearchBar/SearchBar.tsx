import type { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import './SearchBar.css';

interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export default function SearchBar({
  onClear,
  className = '',
  value,
  ...rest
}: SearchBarProps) {
  return (
    <div className={`searchbar ${className}`}>
      <Search size={14} className="searchbar__icon" />
      <input className="searchbar__input" type="text" value={value} {...rest} />
      {value && onClear && (
        <button
          className="searchbar__clear"
          onClick={onClear}
          type="button"
          aria-label="Clear"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
