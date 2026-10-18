import { lazy, Suspense } from 'react'
import type { CodeEditorProps } from './CodeEditor'

const CodeEditor = lazy(() => import('./CodeEditor'))

/**
 * The query-surface code editor, loaded on first use so CodeMirror stays out
 * of the main bundle. Until it loads, a plain textarea with the same value
 * keeps the surface usable.
 */
export default function LazyCodeEditor(props: CodeEditorProps) {
  return (
    <Suspense
      fallback={
        <textarea
          value={props.value}
          onChange={e => props.onChange(e.target.value)}
          aria-label={props.ariaLabel}
          placeholder={props.placeholder}
          spellCheck={false}
          style={{ minHeight: props.minHeight ?? 120 }}
          className="w-full font-mono text-sm bg-gray-900 text-gray-200 rounded-lg border border-gray-700 p-3 resize-none focus:outline-none focus:border-primary"
        />
      }
    >
      <CodeEditor {...props} />
    </Suspense>
  )
}
