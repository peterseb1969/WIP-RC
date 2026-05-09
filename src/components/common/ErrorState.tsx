import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
  className?: string
}

export default function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}>
      <AlertTriangle size={24} className="text-danger/60" />
      <p className="text-sm text-danger text-center max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}
