import { cn } from '@/lib/cn'

type Status = 'healthy' | 'unhealthy' | 'unknown' | 'warning' | 'error' | 'active' | 'inactive'

const statusStyles: Record<Status, string> = {
  healthy: 'bg-success/10 text-success',
  active: 'bg-success/10 text-success',
  unhealthy: 'bg-danger/10 text-danger',
  error: 'bg-danger/10 text-danger',
  inactive: 'bg-gray-100 text-gray-500',
  unknown: 'bg-yellow-100 text-yellow-700',
  warning: 'bg-yellow-100 text-yellow-700',
}

interface StatusBadgeProps {
  status: Status
  label?: string
  className?: string
}

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        statusStyles[status] ?? 'bg-gray-100 text-gray-500',
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'healthy' || status === 'active' ? 'bg-success' :
          status === 'unhealthy' || status === 'error' ? 'bg-danger' :
          status === 'warning' || status === 'unknown' ? 'bg-yellow-500' :
          'bg-gray-400'
        )}
      />
      {label ?? status}
    </span>
  )
}
