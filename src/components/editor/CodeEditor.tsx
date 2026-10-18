import { useEffect, useRef } from 'react'
import { EditorState, Compartment, Prec, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  placeholder as placeholderExt,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionSource,
} from '@codemirror/autocomplete'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { sql, PostgreSQL, type SQLNamespace } from '@codemirror/lang-sql'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { tags as t } from '@lezer/highlight'
import { formatCode, type CodeLanguage } from '@/lib/format-code'

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: CodeLanguage
  /** Called on Ctrl/Cmd+Enter. */
  onRun?: () => void
  /** SQL only: tables (and namespaces of tables) offered by autocomplete. */
  sqlSchema?: SQLNamespace
  /** JSON only: an extra completion source (e.g. field names and operators). */
  completions?: CompletionSource
  placeholder?: string
  /** Accessible name of the editing surface. */
  ariaLabel: string
  minHeight?: number
  maxHeight?: number
  autoFocus?: boolean
}

// Dark theme matching the console's existing query surfaces (gray-900 panel).
const theme = EditorView.theme(
  {
    '&': { backgroundColor: '#111827', color: '#e5e7eb', fontSize: '13px', borderRadius: '0.5rem' },
    '&.cm-focused': { outline: '1px solid #2B579A' },
    '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', caretColor: '#f9fafb', padding: '10px 0' },
    '.cm-gutters': { backgroundColor: '#111827', color: '#4b5563', border: 'none', borderRadius: '0.5rem 0 0 0.5rem' },
    '.cm-activeLine': { backgroundColor: '#1f293780' },
    '.cm-activeLineGutter': { backgroundColor: '#1f2937', color: '#9ca3af' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#2B579A66' },
    '.cm-cursor': { borderLeftColor: '#f9fafb' },
    '.cm-matchingBracket': { backgroundColor: '#5B9BD533', outline: '1px solid #5B9BD5' },
    '.cm-placeholder': { color: '#6b7280' },
    '.cm-tooltip': { backgroundColor: '#1f2937', color: '#e5e7eb', border: '1px solid #374151' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#2B579A', color: '#fff' },
    '.cm-scroller': { overflow: 'auto' },
  },
  { dark: true },
)

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: '#7fb4e8', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#86c99a' },
  { tag: [t.number, t.bool, t.null], color: '#f0a56b' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6b7280', fontStyle: 'italic' },
  { tag: [t.typeName, t.standard(t.name)], color: '#c4a7f0' },
  { tag: [t.propertyName], color: '#7fd4e0' },
  { tag: [t.special(t.name), t.variableName], color: '#e5e7eb' },
  { tag: [t.punctuation, t.bracket, t.operator], color: '#9ca3af' },
])

/** JSON parse errors as lint markers; an empty document is not an error (it means `{}`). */
const jsonLint = (() => {
  const parse = jsonParseLinter()
  return (view: EditorView): Diagnostic[] => (view.state.doc.toString().trim() ? parse(view) : [])
})()

function languageExtension(language: CodeLanguage, sqlSchema?: SQLNamespace, completions?: CompletionSource): Extension {
  if (language === 'sql') {
    return sql({ dialect: PostgreSQL, schema: sqlSchema, upperCaseKeywords: true })
  }
  return [
    json(),
    linter(jsonLint, { delay: 300 }),
    lintGutter(),
    completions ? EditorState.languageData.of(() => [{ autocomplete: completions }]) : [],
  ]
}

/**
 * Code editor for query surfaces (SQL, JSON): highlighting, bracket matching,
 * autocomplete, Ctrl/Cmd+Enter to run, Shift+Alt+F to format. Controlled:
 * `value` is the source of truth, and external changes (history, presets)
 * replace the document. Load it through `LazyCodeEditor`, which keeps
 * CodeMirror out of the main bundle.
 */
export default function CodeEditor({
  value,
  onChange,
  language,
  onRun,
  sqlSchema,
  completions,
  placeholder,
  ariaLabel,
  minHeight = 120,
  maxHeight = 360,
  autoFocus,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const langCompartment = useRef(new Compartment())
  const placeholderCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onRunRef = useRef(onRun)
  const languageRef = useRef(language)
  onChangeRef.current = onChange
  onRunRef.current = onRun
  languageRef.current = language

  useEffect(() => {
    const replaceDoc = (view: EditorView, text: string) =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    const format = (view: EditorView) => {
      formatCode(languageRef.current, view.state.doc.toString())
        .then(text => replaceDoc(view, text))
        .catch(() => { /* unformattable input (e.g. invalid JSON) stays as typed */ })
      return true
    }
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          Prec.highest(keymap.of([
            { key: 'Mod-Enter', run: () => { onRunRef.current?.(); return true } },
            { key: 'Shift-Alt-f', run: format },
          ])),
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
          syntaxHighlighting(highlight),
          theme,
          EditorView.theme({ '&': { minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` } }),
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel, spellcheck: 'false' }),
          placeholderCompartment.current.of(placeholder ? placeholderExt(placeholder) : []),
          langCompartment.current.of(languageExtension(language, sqlSchema, completions)),
          EditorView.updateListener.of(update => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    if (autoFocus) view.focus()
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // The editor is built once, so undo history and focus survive re-renders;
    // value, language, schema, completions and placeholder sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: langCompartment.current.reconfigure(languageExtension(language, sqlSchema, completions)),
    })
  }, [language, sqlSchema, completions])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: placeholderCompartment.current.reconfigure(placeholder ? placeholderExt(placeholder) : []),
    })
  }, [placeholder])

  return <div ref={hostRef} className="rounded-lg border border-gray-700 overflow-hidden" />
}
