import { cn } from '@/lib/cn'

type Status = 'healthy' | 'unhealthy' | 'unknown' | 'warning' | 'error' | 'active' | 'inactive'

const statusStyles: Record<Status, string> = {
  healthy: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  unhealthy: 'bg-red-100 text-red-700',
  error: 'bg-red-100 text-red-700',
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
          status === 'healthy' || status === 'active' ? 'bg-green-500' :
          status === 'unhealthy' || status === 'error' ? 'bg-red-500' :
          status === 'warning' || status === 'unknown' ? 'bg-yellow-500' :
          'bg-gray-400'
        )}
      />
      {label ?? status}
    </span>
  )
}
