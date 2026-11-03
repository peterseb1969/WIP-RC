import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'

// One Refresh button for every page. While a read is running (a click, or
// TanStack re-reading on its own, e.g. on window focus) the icon spins, the
// button says "Refreshing…" and ignores clicks. A second click used to
// cancel the running request and start it again (TanStack's refetch
// default), so on a slow endpoint impatient clicks only made the wait longer.

const VARIANTS = {
  /** Bordered square icon button, for page headers. */
  boxed: 'p-2 border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50',
  /** Bare icon, for toolbars and section headers. */
  plain: 'p-1.5 text-gray-400 hover:text-gray-600',
  /** Icon plus text (e.g. "updated 5s ago"). */
  text: 'inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600',
} as const

export default function RefreshButton({
  onRefresh,
  refreshing,
  label = 'Refresh',
  variant = 'plain',
  size = 14,
  children,
  className,
}: {
  onRefresh: () => unknown
  /** True while the data behind the button is being read. */
  refreshing: boolean
  /** What the button refreshes ("Refresh terms"); also its accessible name. */
  label?: string
  variant?: keyof typeof VARIANTS
  size?: number
  children?: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!refreshing) onRefresh() }}
      disabled={refreshing}
      aria-busy={refreshing}
      aria-label={refreshing ? 'Refreshing…' : label}
      title={refreshing ? 'Refreshing…' : label}
      className={cn(VARIANTS[variant], 'disabled:cursor-wait disabled:hover:bg-transparent', className)}
    >
      <RefreshCw size={size} className={cn(refreshing && 'animate-spin text-primary')} />
      {children}
    </button>
  )
}

/**
 * A value (usually a count) that is being re-read: still shown, dimmed and
 * pulsing, with "updating" announced, so it is clear the number may change.
 */
export function RefreshingValue({ refreshing, children, className }: {
  refreshing: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn('transition-opacity', refreshing && 'opacity-50 animate-pulse', className)}
      aria-busy={refreshing}
      data-refreshing={refreshing || undefined}
    >
      {children}
      {refreshing && <span className="sr-only"> (updating)</span>}
    </span>
  )
}

/** The visible "updating" tag next to a count that is being re-read. */
export function UpdatingTag({ refreshing }: { refreshing: boolean }) {
  if (!refreshing) return null
  return (
    <span className="ml-1.5 text-[10px] font-normal text-primary/70 normal-case tracking-normal" aria-hidden>
      updating…
    </span>
  )
}
