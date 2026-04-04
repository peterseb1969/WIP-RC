import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DataTableProps {
  columns: string[]
  rows: Record<string, unknown>[]
  maxHeight?: string
  onRowClick?: (row: Record<string, unknown>, index: number) => void
  className?: string
}

type SortDir = 'asc' | 'desc' | null

export default function DataTable({ columns, rows, maxHeight = '500px', onRowClick, className }: DataTableProps) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const sortedRows = useMemo(() => {
    if (!sortCol || !sortDir) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      if (av == null && bv == null) return 0
      if (av == null) return sortDir === 'asc' ? -1 : 1
      if (bv == null) return sortDir === 'asc' ? 1 : -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const as = String(av)
      const bs = String(bv)
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
  }, [rows, sortCol, sortDir])

  const handleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortCol(null)
      setSortDir(null)
    }
  }

  return (
    <div className={cn('overflow-auto border border-gray-200 rounded-lg', className)} style={{ maxHeight }}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {columns.map(col => (
              <th
                key={col}
                className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                onClick={() => handleSort(col)}
              >
                <span className="inline-flex items-center gap-1">
                  {col}
                  {sortCol === col ? (
                    sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} className="text-gray-300" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedRows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'hover:bg-blue-50/50',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(row, i)}
            >
              {columns.map(col => (
                <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">
                  {formatCellValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}
