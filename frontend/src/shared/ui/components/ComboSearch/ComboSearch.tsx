import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ComboSearch.css';

/* ── Types ── */

export interface ComboSearchItem {
  id: number | string;
  label: string;
  /** Optional secondary text (e.g. type badge) shown to the right */
  badge?: string;
  /** Badge variant class suffix (appended as `combo__badge--${variant}`) */
  badgeVariant?: string;
}

export interface ComboSearchProps<T extends ComboSearchItem = ComboSearchItem> {
  /** Items to search through */
  items: T[];
  /** IDs to exclude from suggestions (already selected) */
  excludeIds?: Set<number | string>;
  /** Called when user picks a suggestion. qty is always passed (defaults to 1 when showQty is false). */
  onSelect: (item: T, qty: number) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Max suggestions to show (default: 8) */
  maxSuggestions?: number;
  /** Allow freeform text that doesn't match any item (calls onCustom) */
  allowCustom?: boolean;
  /** Called for freeform text when allowCustom=true and Enter is pressed */
  onCustom?: (text: string) => void;
  /** Label for the custom entry in suggestions */
  customLabel?: string;
  /** Extra field: quantity selector (shows Qty input) */
  showQty?: boolean;
  /** Allow custom entries from typed text with multiple options (each becomes a suggestion with label=query) */
  customOptions?: Array<{ id: string; badge: string; badgeVariant?: string }>;
  /** Extra field: inline mini-field label + input next to search */
  extraField?: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    width?: number;
  };
  /** Additional className */
  className?: string;
  /** Clear input after selection */
  clearOnSelect?: boolean;
  /** z-index for the portal dropdown. Use a value above the surrounding stacking context.
   *  Default 1000 (normal pages). Pass a higher value when inside a popup panel. */
  portalZIndex?: number;
}

export default function ComboSearch<T extends ComboSearchItem = ComboSearchItem>({
  items,
  excludeIds,
  onSelect,
  placeholder = 'Search…',
  maxSuggestions = 8,
  allowCustom = false,
  onCustom,
  customLabel = 'Custom',
  showQty = false,
  customOptions,
  extraField,
  className = '',
  clearOnSelect = true,
  portalZIndex = 1000,
}: ComboSearchProps<T>) {
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();

  const suggestions = useMemo(() => {
    const q = trimmed.toLowerCase();
    const filtered = items
      .filter(item => {
        if (excludeIds?.has(item.id)) return false;
        if (!q) return true;
        return item.label.toLowerCase().includes(q);
      })
      .slice(0, maxSuggestions);

    const hasExactMatch = items.some(i => i.label.toLowerCase() === q);
    if (trimmed && !hasExactMatch) {
      if (customOptions && customOptions.length > 0) {
        return [
          ...filtered,
          ...customOptions.map(opt => ({
            id: opt.id,
            label: trimmed,
            badge: opt.badge,
            badgeVariant: opt.badgeVariant ?? 'custom',
          } as unknown as T)),
        ];
      }
      if (allowCustom) {
        return [
          ...filtered,
          { id: '__custom__', label: trimmed, badge: customLabel, badgeVariant: 'custom' } as unknown as T,
        ];
      }
    }
    return filtered;
  }, [items, excludeIds, trimmed, maxSuggestions, allowCustom, customLabel, customOptions]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const updateDropPosition = useCallback(() => {
    if (!fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 240;
    setDropStyle(above
      ? { position: 'fixed', left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 2, zIndex: portalZIndex }
      : { position: 'fixed', left: rect.left, width: rect.width, top: rect.bottom + 2, zIndex: portalZIndex },
    );
  }, [portalZIndex]);

  function pick(item: T) {
    if ((item as ComboSearchItem).id === '__custom__' && onCustom) {
      onCustom(trimmed);
    } else {
      onSelect(item, showQty ? qty : 1);
    }
    if (clearOnSelect) {
      setQuery('');
      setQty(1);
    }
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && trimmed) {
      e.preventDefault();
      if (suggestions.length > 0) {
        pick(suggestions[0]);
      } else if (allowCustom && onCustom) {
        onCustom(trimmed);
        if (clearOnSelect) setQuery('');
        setOpen(false);
      }
    }
  }

  return (
    <div className={`combo ${className}`} ref={wrapRef}>
      <div className="combo__row">
        <div className="combo__field" ref={fieldRef}>
          <input
            className="combo__input"
            placeholder={placeholder}
            value={query}
            autoComplete="off"
            onChange={e => { setQuery(e.target.value); setOpen(true); updateDropPosition(); }}
            onFocus={() => { setOpen(true); updateDropPosition(); }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {open && suggestions.length > 0 && createPortal(
          <ul className="combo__dropdown combo__dropdown--portal" style={dropStyle}>
            {suggestions.map(item => (
              <li
                key={item.id}
                className={`combo__option${(item as ComboSearchItem).badgeVariant === 'custom' ? ' combo__option--custom' : ''}`}
                onMouseDown={() => pick(item)}
              >
                <span className="combo__option-label">{item.label}</span>
                {item.badge && (
                  <span className={`combo__badge${item.badgeVariant ? ` combo__badge--${item.badgeVariant}` : ''}`}>
                    {item.badge}
                  </span>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}

        {showQty && (
          <label className="combo__mini">
            Qty
            <input
              type="number"
              min={1}
              className="combo__mini-input"
              value={qty}
              onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        )}

        {extraField && (
          <label className="combo__mini">
            {extraField.label}
            <input
              type="number"
              min={extraField.min ?? 1}
              className="combo__mini-input"
              style={extraField.width ? { width: extraField.width } : undefined}
              value={extraField.value}
              onChange={e => extraField.onChange(Math.max(extraField.min ?? 1, Number(e.target.value) || 1))}
            />
          </label>
        )}
      </div>
    </div>
  );
}
