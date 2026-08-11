import { ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SortOption {
  value: string
  label: string
}

interface SortSelectProps {
  options: SortOption[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  className?: string
}

const STORAGE_PREFIX = 'rc-console:sort:'

export function loadSort(page: string, defaultBy: string, defaultOrder: 'asc' | 'desc' = 'desc') {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + page)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.sortBy && parsed.sortOrder) return parsed as { sortBy: string; sortOrder: 'asc' | 'desc' }
    }
  } catch { /* ignore */ }
  return { sortBy: defaultBy, sortOrder: defaultOrder }
}

export function saveSort(page: string, sortBy: string, sortOrder: 'asc' | 'desc') {
  try { localStorage.setItem(STORAGE_PREFIX + page, JSON.stringify({ sortBy, sortOrder })) }
  catch { /* ignore */ }
}

export default function SortSelect({ options, sortBy, sortOrder, onChange, className }: SortSelectProps) {
  const DirIcon = sortOrder === 'asc' ? ArrowUp : ArrowDown

  return (
    <div className={cn('inline-flex items-center border border-gray-200 rounded-md overflow-hidden', className)}>
      <select
        value={sortBy}
        onChange={e => onChange(e.target.value, sortOrder)}
        className="px-2 py-1.5 text-xs bg-white text-gray-600 border-none focus:outline-none focus:ring-0 cursor-pointer"
        title="Sort by"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
        className="px-1.5 py-1.5 border-l border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
        title={sortOrder === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
      >
        <DirIcon size={12} />
      </button>
    </div>
  )
}
