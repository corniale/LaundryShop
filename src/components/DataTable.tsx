/**
 * DataTable — the app's one table. Orders and Customers set the pattern
 * (hairline borders, tracked-out caps headers, click-to-sort with a
 * direction toggle, dense rows, phone rows stacked instead of squeezed);
 * this component makes that pattern structural so every other table
 * inherits the same look and behaviour rather than re-implementing it.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { EmptyState } from './ui'

/** The table's live sort, for columns whose controls only make sense under one ordering. */
export interface SortContext {
  sortKey?: string
  sortDesc: boolean
}

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  /** Omit to make the column unsortable (action columns). */
  sortValue?: (row: T) => string | number
  render: (row: T, sort: SortContext) => ReactNode
  cellClass?: string
  /** First click on this header sorts descending. Default true. */
  defaultDesc?: boolean
  headerClass?: string
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  initialSortKey,
  initialSortDesc = true,
  onRowClick,
  renderCard,
  emptyText,
}: {
  rows: T[]
  columns: Array<Column<T>>
  getRowKey: (row: T) => string
  initialSortKey?: string
  initialSortDesc?: boolean
  onRowClick?: (row: T) => void
  /** Phone layout. Without it, the table scrolls horizontally instead. */
  renderCard?: (row: T) => ReactNode
  emptyText: string
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey)
  const [sortDesc, setSortDesc] = useState(initialSortDesc)

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortValue) return rows
    const dir = sortDesc ? -1 : 1
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir
    })
  }, [rows, columns, sortKey, sortDesc])

  function toggle(col: Column<T>) {
    if (!col.sortValue) return
    if (sortKey === col.key) setSortDesc((d) => !d)
    else {
      setSortKey(col.key)
      setSortDesc(col.defaultDesc ?? true)
    }
  }

  const sort: SortContext = { sortKey, sortDesc }

  if (rows.length === 0) return <EmptyState>{emptyText}</EmptyState>

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-wash-deep">
              {columns.map((col) => {
                const active = sortKey === col.key
                const right = col.align === 'right'
                return (
                  <th key={col.key} className={`${right ? 'text-right' : 'text-left'} ${col.headerClass ?? ''}`}>
                    {col.sortValue ? (
                      <button
                        onClick={() => toggle(col)}
                        className={`min-h-touch w-full px-3 text-[0.6875rem] font-semibold uppercase tracking-wider ${
                          right ? 'text-right' : 'text-left'
                        } ${active ? 'text-primary-600' : 'text-ink-muted'}`}
                      >
                        {col.header}
                        {active ? (sortDesc ? ' ↓' : ' ↑') : ''}
                      </button>
                    ) : (
                      <span
                        className={`block px-3 py-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted ${
                          right ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.header}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-line last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-wash' : ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''} ${col.cellClass ?? ''}`}
                  >
                    {col.render(row, sort)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {renderCard ? (
        <div className="flex flex-col gap-2 md:hidden">
          {sorted.map((row) => (
            <div
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`rounded-card border border-line bg-surface px-3 py-2.5 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {renderCard(row)}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface md:hidden">
          <table className="w-full text-sm">
            <tbody>
              {sorted.map((row) => (
                <tr key={getRowKey(row)} className="border-b border-line last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''}`}>
                      {col.render(row, sort)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
