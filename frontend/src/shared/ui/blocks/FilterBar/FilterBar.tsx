import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, SlidersHorizontal, Layers } from 'lucide-react';
import { SearchBar } from '../../components/SearchBar';
import { Select } from '../../components/Select';
import { Tag } from '../../components/Tag';
import './FilterBar.css';

export interface FilterOption {
  value: string;
  label: string;
}

/** Config for the OrderBy section — includes sort-direction toggle */
export interface OrderByConfig {
  value:        string;
  options:      FilterOption[];
  onChange:     (v: string) => void;
  dir?:         'asc' | 'desc';
  onDirToggle?: () => void;
  placeholder?: string;
}

/** Config for FilterBy or GroupBy sections */
export interface SelectConfig {
  value:        string;
  options:      FilterOption[];
  onChange:     (v: string) => void;
  placeholder?: string;
}

export interface FilterBarProps {
  /** Controlled search string */
  search?:           string;
  onSearchChange?:   (val: string) => void;
  onSearchClear?:    () => void;
  searchPlaceholder?: string;
  /** Explicit sort section */
  orderBy?:  OrderByConfig;
  /** Explicit filter-by section */
  filterBy?: SelectConfig;
  /** Explicit group-by section */
  groupBy?:  SelectConfig;
  /** Active tag chips */
  activeTags?:  { label: string; key: string }[];
  onTagRemove?: (key: string) => void;
  /** Extra button slot (layouts, add, etc.) */
  actions?:  ReactNode;
  className?: string;
}

export function FilterBar({
  search            = '',
  onSearchChange,
  onSearchClear,
  searchPlaceholder = 'Search…',
  orderBy,
  filterBy,
  groupBy,
  activeTags   = [],
  onTagRemove,
  actions,
  className = '',
}: FilterBarProps) {
  return (
    <div className={`filter-bar ${className}`.trim()}>
      <div className="filter-bar__row">

        {/* ── Search ── */}
        {onSearchChange !== undefined && (
          <SearchBar
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onClear={onSearchClear}
            placeholder={searchPlaceholder}
            className="filter-bar__search"
          />
        )}

        {/* ── Order By ── */}
        {orderBy && (
          <div className="filter-bar__sort-group">
            <Select
              variant="compact"
              icon={<ArrowUpDown size={13} />}
              value={orderBy.value}
              onChange={e => orderBy.onChange(e.target.value)}
              options={orderBy.options}
              placeholder={orderBy.placeholder ?? 'Order by'}
              className="filter-bar__select"
            />
            {orderBy.onDirToggle && (
              <button
                className="filter-bar__dir-btn"
                onClick={orderBy.onDirToggle}
                title={orderBy.dir === 'desc' ? 'Descending — click to ascend' : 'Ascending — click to descend'}
                type="button"
              >
                {orderBy.dir === 'desc'
                  ? <ChevronDown size={13} />
                  : <ChevronUp   size={13} />}
              </button>
            )}
          </div>
        )}

        {/* ── Filter By ── */}
        {filterBy && (
          <Select
            variant="compact"
            icon={<SlidersHorizontal size={13} />}
            value={filterBy.value}
            onChange={e => filterBy.onChange(e.target.value)}
            options={filterBy.options}
            placeholder={filterBy.placeholder ?? 'Filter by'}
            className="filter-bar__select"
          />
        )}

        {/* ── Group By ── */}
        {groupBy && (
          <Select
            variant="compact"
            icon={<Layers size={13} />}
            value={groupBy.value}
            onChange={e => groupBy.onChange(e.target.value)}
            options={groupBy.options}
            placeholder={groupBy.placeholder ?? 'Group by'}
            className="filter-bar__select"
          />
        )}

        {/* ── Extra actions ── */}
        {actions && <div className="filter-bar__actions">{actions}</div>}
      </div>

      {activeTags.length > 0 && (
        <div className="filter-bar__tags">
          {activeTags.map(t => (
            <Tag
              key={t.key}
              variant="accent"
              removable
              onRemove={() => onTagRemove?.(t.key)}
            >
              {t.label}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}
