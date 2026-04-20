import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import './List.css';

interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string | number;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterFn?: (item: T, query: string) => boolean;
  emptyMessage?: string;
  header?: ReactNode;
  viewMode?: 'list' | 'card';
}

export default function List<T>({
  items,
  renderItem,
  keyExtractor,
  searchable = false,
  searchPlaceholder = 'Search…',
  filterFn,
  emptyMessage = 'No items found',
  header,
  viewMode = 'list',
}: ListProps<T>) {
  const [query, setQuery] = useState('');

  const filtered = searchable && query && filterFn
    ? items.filter(item => filterFn(item, query))
    : items;

  return (
    <div className="list-container">
      {(searchable || header) && (
        <div className="list-container__toolbar">
          {searchable && (
            <div className="list-container__search">
              <Search size={14} />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          )}
          {header}
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="list-container__empty">{emptyMessage}</div>
      ) : (
        <div className={`list-container__items list-container__items--${viewMode}`}>
          {filtered.map((item, i) => (
            <div key={keyExtractor(item)} className="list-container__item">
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
