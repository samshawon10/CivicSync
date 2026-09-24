import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { Button, EmptyState, ErrorState, Pagination } from './primitives.jsx';
import { SkeletonTable } from './Skeleton.jsx';
import { cx } from '../../utils/format.js';

/** Checkboxes must not inherit the global full-width input styling. */
function Checkbox({ checked, onChange, label, indeterminate = false }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(node) => { if (node) node.indeterminate = indeterminate && !checked; }}
      onChange={onChange}
      style={{ width: 16, height: 16, minWidth: 16, accentColor: 'var(--color-civic-600)' }}
    />
  );
}

/**
 * Enterprise data table used by every Super Admin collection:
 * sorting, column visibility, selection, sticky header, skeleton loading,
 * professional empty/error states and a mobile card fallback instead of
 * squeezing ten columns onto a phone.
 */
export default function DataTable({
  columns = [],
  rows = [],
  loading = false,
  error = '',
  onRetry,
  empty,
  onRowClick,
  selectable = false,
  selected = [],
  onSelectedChange,
  rowKey = (row) => row._id || row.id,
  pagination,
  onPage,
  caption,
  toolbar,
  mobilePrimary = (row) => row.name || row.title || row._id
}) {
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const [hidden, setHidden] = useState(() => new Set(columns.filter((column) => column.defaultHidden).map((column) => column.key)));
  const [showColumns, setShowColumns] = useState(false);

  const visibleColumns = useMemo(() => columns.filter((column) => !hidden.has(column.key)), [columns, hidden]);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const column = columns.find((item) => item.key === sort.key);
    const value = (row) => (column?.sortValue ? column.sortValue(row) : row[sort.key]);
    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [rows, sort, columns]);

  function toggleSort(column) {
    if (!column.sortable) return;
    setSort((current) => current.key === column.key
      ? { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key: column.key, direction: 'asc' });
  }

  if (loading) return <SkeletonTable rows={6} columns={Math.min(columns.length + 1, 6)} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      <div className="relative flex items-center gap-2">
        {selectable && selected.length > 0 && <span className="text-[13px] font-semibold text-fg-muted">{selected.length} selected</span>}
        <Button size="sm" icon="columns" onClick={() => setShowColumns((value) => !value)} aria-expanded={showColumns}>Columns</Button>
        {showColumns && (
          <div className="menu-panel absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
            {columns.map((column) => (
              <label key={column.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-fg hover:bg-surface-2">
                <Checkbox
                  label={`Show ${column.label} column`}
                  checked={!hidden.has(column.key)}
                  onChange={() => setHidden((current) => {
                    const next = new Set(current);
                    if (next.has(column.key)) next.delete(column.key);
                    else next.add(column.key);
                    return next;
                  })}
                />
                {column.label}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!sorted.length) {
    return (
      <div className="space-y-4">
        {header}
        {empty || <EmptyState title="Nothing to display yet." hint="Records appear here as soon as CivicSync has data for this view." />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <div className="civic-card overflow-hidden">
        <div className="hidden overflow-x-auto sm:block">
          <table className="data-table">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr>
                {selectable && (
                  <th style={{ width: 40 }}>
                    <Checkbox
                      label="Select all rows"
                      checked={selected.length === sorted.length && sorted.length > 0}
                      indeterminate
                      onChange={() => onSelectedChange?.(selected.length === sorted.length ? [] : sorted.map(rowKey))}
                    />
                  </th>
                )}
                {visibleColumns.map((column) => (
                  <th key={column.key} style={column.width ? { width: column.width } : undefined} aria-sort={sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {column.sortable ? (
                      <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-fg">
                        {column.label}
                        <Icon name={sort.key === column.key ? (sort.direction === 'asc' ? 'chevronUp' : 'chevronDown') : 'chevronDown'} size={12} className={sort.key === column.key ? 'opacity-100' : 'opacity-30'} />
                      </button>
                    ) : column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const key = rowKey(row);
                return (
                  <tr key={key} className={cx(onRowClick && 'cursor-pointer')} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                    {selectable && (
                      <td onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          label="Select row"
                          checked={selected.includes(key)}
                          onChange={() => onSelectedChange?.(selected.includes(key) ? selected.filter((value) => value !== key) : [...selected, key])}
                        />
                      </td>
                    )}
                    {visibleColumns.map((column) => (
                      <td key={column.key} className={cx(column.align === 'right' && 'text-right', column.className)}>
                        {column.render ? column.render(row) : (row[column.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards instead of a squeezed table. */}
        <div className="divide-y sm:hidden" style={{ borderColor: 'var(--line)' }}>
          {sorted.map((row) => (
            <div key={rowKey(row)} className="space-y-2 p-4">
              <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => onRowClick?.(row)}>
                <span className="min-w-0 text-sm font-semibold text-fg">{mobilePrimary(row)}</span>
                <Icon name="chevronRight" size={16} className="mt-0.5 text-fg-subtle" />
              </button>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {visibleColumns.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{column.label}</dt>
                    <dd className="truncate text-[13px] text-fg">{column.render ? column.render(row) : (row[column.key] ?? '—')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
      {pagination && <Pagination {...pagination} onPage={onPage} />}
    </div>
  );
}

