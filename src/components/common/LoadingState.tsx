import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

interface LoadingStateProps {
  label?: string
  className?: string
}

export default function LoadingState({ label = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-gray-400', className)}>
      <Loader2 size={20} className="animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
