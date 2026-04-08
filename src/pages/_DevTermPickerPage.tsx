import { useState } from 'react'
import TermSearchPicker, { type PickedTerm } from '@/components/ontology/TermSearchPicker'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'

/**
 * Temporary harness for the TermSearchPicker. Lets Peter try the picker in
 * isolation before it gets wired into the Term Detail page. Delete once the
 * Term Detail page is in place.
 */
export default function DevTermPickerPage() {
  const { namespace } = useNamespaceFilter()
  const [picked, setPicked] = useState<PickedTerm[]>([])

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Term Search Picker — dev harness</h1>
      <p className="text-sm text-gray-500 mb-4">
        Searching in:{' '}
        {namespace ? (
          <span className="font-mono">{namespace}</span>
        ) : (
          <span className="italic">all namespaces (privileged key required)</span>
        )}
      </p>

      <TermSearchPicker
        namespace={namespace || undefined}
        onSelect={t => setPicked(p => [t, ...p])}
        autoFocus
      />

      <h2 className="text-sm font-semibold text-gray-700 mt-6 mb-2">Picked</h2>
      {picked.length === 0 ? (
        <div className="text-xs text-gray-500">Nothing picked yet.</div>
      ) : (
        <ul className="space-y-1">
          {picked.map((t, i) => (
            <li key={`${t.term_id}-${i}`} className="text-sm border border-gray-100 rounded px-2 py-1">
              <span className="text-gray-900">{t.label || t.value}</span>{' '}
              <span className="font-mono text-xs text-gray-500">[{t.value}]</span>{' '}
              <span className="text-xs text-gray-500">in {t.terminology_value ?? t.terminology_id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
