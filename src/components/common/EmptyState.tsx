import { Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  title?: string
  message?: string
  className?: string
  children?: React.ReactNode
}

export default function EmptyState({
  title = 'No data',
  message = 'Nothing to show here yet.',
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-gray-400', className)}>
      <Inbox size={32} />
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs text-gray-400">{message}</p>
      {children}
    </div>
  )
}
