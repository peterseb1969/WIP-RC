import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// DateTimeInput — thin wrapper around <input type="date"|"datetime-local">.
//
// Emits / accepts ISO strings:
//   - mode="date":     YYYY-MM-DD
//   - mode="datetime": full ISO with 'Z' (converted to/from the local
//     datetime-local format for display)
// ---------------------------------------------------------------------------

export interface DateTimeInputProps {
  mode: 'date' | 'datetime'
  value: string | undefined
  onChange: (v: string | undefined) => void
  disabled?: boolean
}

export default function DateTimeInput({ mode, value, onChange, disabled }: DateTimeInputProps) {
  const displayValue = mode === 'datetime' ? isoToLocalInput(value) : value ?? ''

  return (
    <input
      type={mode === 'date' ? 'date' : 'datetime-local'}
      value={displayValue}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value
        if (!raw) {
          onChange(undefined)
          return
        }
        if (mode === 'datetime') {
          // datetime-local has no timezone — interpret as local, emit ISO.
          const d = new Date(raw)
          onChange(isNaN(d.getTime()) ? raw : d.toISOString())
        } else {
          onChange(raw)
        }
      }}
      className={cn(
        'w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400',
        disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
      )}
    />
  )
}

function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  // Build YYYY-MM-DDTHH:MM in local time (datetime-local format)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
