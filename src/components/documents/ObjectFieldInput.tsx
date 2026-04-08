import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// ObjectFieldInput — textarea with JSON.parse validation.
//
// Admin tool, not a general data-entry app: we lean on the JSON editor
// rather than building a nested form. Parse on blur; show an inline error
// if invalid. Upstream form state holds the parsed object.
// ---------------------------------------------------------------------------

export interface ObjectFieldInputProps {
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}

export default function ObjectFieldInput({ value, onChange, disabled }: ObjectFieldInputProps) {
  const [text, setText] = useState(() =>
    value == null ? '' : safeStringify(value),
  )
  const [parseError, setParseError] = useState<string | null>(null)

  // If the upstream value changes (e.g. edit-mode initial load), sync the
  // local text. We deliberately ignore subsequent upstream changes caused
  // by our own onChange to avoid fighting the cursor.
  useEffect(() => {
    setText(value == null ? '' : safeStringify(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBlur = () => {
    const t = text.trim()
    if (t === '') {
      setParseError(null)
      onChange(null)
      return
    }
    try {
      const parsed = JSON.parse(t)
      setParseError(null)
      onChange(parsed)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled}
        rows={6}
        spellCheck={false}
        placeholder='{"key": "value"}'
        className={cn(
          'w-full border rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1',
          parseError
            ? 'border-red-300 focus:ring-red-300 focus:border-red-300'
            : 'border-gray-200 focus:ring-blue-400 focus:border-blue-400',
          disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
        )}
      />
      {parseError && (
        <div className="text-xs text-red-500 mt-1">Invalid JSON: {parseError}</div>
      )}
      <div className="text-[10px] text-gray-400 mt-0.5">
        JSON parsed on blur. Object fields aren't validated against a schema in v1.
      </div>
    </div>
  )
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return ''
  }
}
