import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Shared form primitives.
//
// Extracted from FieldSlideOut / TemplateBuilderPage so the document form
// (DocumentFormPage) can use exactly the same inputs and look identical to
// the Template Editor. No behavioural change.
// ---------------------------------------------------------------------------

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-600 mb-1">{children}</label>
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  mono,
  disabled,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  disabled?: boolean
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light',
        mono && 'font-mono',
        disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
      )}
    />
  )
}

export function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id?: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      id={id}
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light',
        disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
      )}
    />
  )
}

export function SelectInput<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder,
  allowEmpty,
  disabled,
}: {
  id?: string
  value: T | undefined
  options: readonly T[]
  onChange: (v: T | undefined) => void
  placeholder?: string
  allowEmpty?: boolean
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      disabled={disabled}
      className={cn(
        'w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light',
        disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
      )}
    >
      {(allowEmpty !== false) && <option value="">{placeholder ?? '(none)'}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function Toggle({
  id,
  checked,
  onChange,
  label,
  disabled,
}: {
  id?: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label htmlFor={id} className={cn('flex items-center gap-2', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="rounded border-gray-300 text-primary focus:ring-primary-light"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

/**
 * Collapsible section, "card" style — used by TemplateBuilderPage and
 * DocumentFormPage. Wraps children in a bordered rounded panel with a
 * click-to-toggle header. Use `inline` for the slimmer inline variant used
 * inside FieldSlideOut (just a divider + toggle, no card border).
 */
export function Section({
  title,
  defaultOpen,
  inline,
  children,
}: {
  title: string
  defaultOpen?: boolean
  inline?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  if (inline) {
    return (
      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 w-full text-left mb-2"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
        </button>
        {open && <div className="space-y-3">{children}</div>}
      </div>
    )
  }
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">{children}</div>}
    </div>
  )
}
