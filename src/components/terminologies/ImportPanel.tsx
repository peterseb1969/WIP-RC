// ---------------------------------------------------------------------------
// ImportPanel — file-based terminology import (CASE-672/673/674).
//
// Two modes:
//   'into-existing' — imports terms/relations into the terminology being
//     viewed (terminology detail page).
//   'create-new'    — creates a terminology FROM the file (terminology list
//     page): the user names the vocabulary (prefilled from the filename);
//     JSON bundles carry their own terminology object, which wins.
//
// Formats: CSV/TSV, JSON (term array or {terminology, terms, relations}
// bundle), OBO Graph JSON, plain-text OBO. Ontology edges are imported as
// term relations server-side; re-imports skip existing terms.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useWipClient } from '@wip/react'
import type { CreateTermRequest } from '@wip/client'
import {
  parseOboText,
  csvRowsToTerms,
  looksLikeOboGraph,
  summarizeBulkTerms,
  emptySummary,
  type ImportSummary,
} from '@/lib/terminology-import'

type ImportPanelProps =
  | {
      mode: 'into-existing'
      terminologyId: string
      terminologyValue: string
      namespace: string
      onClose: () => void
      onCreated?: never
      namespaces?: never
    }
  | {
      mode: 'create-new'
      terminologyId?: never
      terminologyValue?: never
      /** Preselected namespace (the list page's current filter; may be ''). */
      namespace: string
      /** Options for the namespace select. */
      namespaces: string[]
      onClose: () => void
      /** Called with the created/target terminology_id (e.g. to navigate). */
      onCreated: (terminologyId: string) => void
    }

function valueFromFilename(name: string): string {
  const v = name
    .replace(/\.[^.]*$/, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^[^A-Z]+/, '')
    .replace(/_+/g, '_')
    .replace(/_$/, '')
  return v || 'IMPORTED_TERMINOLOGY'
}

function labelFromFilename(name: string): string {
  return name.replace(/\.[^.]*$/, '').replace(/[_-]+/g, ' ').trim()
}

export default function ImportPanel(props: ImportPanelProps) {
  const { mode, namespace: defaultNamespace, onClose } = props
  const client = useWipClient()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [detectedFormat, setDetectedFormat] = useState<'json' | 'csv' | 'obo' | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportSummary | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // create-new naming step
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newNamespace, setNewNamespace] = useState(defaultNamespace)

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file)
    setError(null)
    setResult(null)
    setCreatedId(null)
    if (!file) { setDetectedFormat(null); return }
    const name = file.name.toLowerCase()
    if (name.endsWith('.csv') || name.endsWith('.tsv')) setDetectedFormat('csv')
    else if (name.endsWith('.obo') || name.endsWith('.obo.json')) setDetectedFormat('obo')
    else setDetectedFormat('json')
    if (mode === 'create-new') {
      setNewValue(valueFromFilename(file.name))
      setNewLabel(labelFromFilename(file.name))
    }
  }

  // The namespace every import call runs against.
  const targetNamespace = mode === 'into-existing' ? props.namespace : newNamespace

  // --- Bulk term creation for CSV / JSON-array into an EXISTING terminology
  // (CASE-674). createTerms chunks server-side and returns per-item results.
  const bulkCreateTerms = async (terms: CreateTermRequest[], skippedRows = 0): Promise<ImportSummary> => {
    if (mode !== 'into-existing') throw new Error('bulkCreateTerms requires an existing terminology')
    if (terms.length === 0) {
      const s = emptySummary()
      s.termsErrored = skippedRows
      if (skippedRows > 0) s.failures.push({ value: '(rows without a value column)', error: `${skippedRows} row(s) had no usable term value` })
      return s
    }
    const res = await client.defStore.createTerms(props.terminologyId, terms, { namespace: targetNamespace, batch_size: 250 })
    const s = summarizeBulkTerms(res.results, terms)
    s.termsErrored += skippedRows
    if (skippedRows > 0) s.failures.push({ value: '(rows without a value column)', error: `${skippedRows} row(s) had no usable term value` })
    return s
  }

  // --- Bundle import: creates the terminology when missing, then loads terms
  // (+ relations if present). The create-new CSV / JSON-array paths and both
  // modes' JSON-bundle path go through here.
  const bundleImport = async (
    terminology: Record<string, unknown>,
    terms: CreateTermRequest[],
    relations?: Array<{ source_term_value: string; target_term_value: string; relation_type: string; target_terminology_value?: string }>
  ): Promise<ImportSummary> => {
    const res = await client.defStore.importTerminology({
      terminology: { ...terminology, namespace: targetNamespace } as Parameters<typeof client.defStore.importTerminology>[0]['terminology'],
      terms,
      relations,
      options: { skip_duplicates: true },
    })
    setCreatedId(res.terminology?.terminology_id ?? null)
    const s = summarizeBulkTerms(res.terms_result?.results ?? [], terms)
    s.relationsCreated = res.relationships_result?.created ?? 0
    s.relationsSkipped = res.relationships_result?.skipped ?? 0
    s.relationsErrored = res.relationships_result?.errors ?? 0
    return s
  }

  // --- Ontology import: OBO Graph JSON or parsed plain-text OBO (CASE-672).
  // The server creates the terminology when missing, then terms AND
  // relations, batched, idempotent on re-import.
  const importOntology = async (graph: Record<string, unknown>): Promise<ImportSummary> => {
    const res = await client.defStore.importOntology(graph, {
      namespace: targetNamespace,
      terminology_value: mode === 'into-existing' ? props.terminologyValue : newValue,
      ...(mode === 'create-new' && newLabel ? { terminology_label: newLabel } : {}),
      skip_duplicates: true,
    })
    setCreatedId(res.terminology?.terminology_id ?? null)
    // The wire key is `relations` (post-2eeb872 naming); @wip/client 0.31.0's
    // return type still says `relationships` — accept both (CASE-677).
    const relations = ((res as unknown as Record<string, unknown>).relations ??
      res.relationships) as typeof res.relationships | undefined
    const s = emptySummary()
    s.termsCreated = res.terms.created
    s.termsSkipped = res.terms.skipped
    s.termsErrored = res.terms.errors
    s.relationsCreated = relations?.created ?? 0
    s.relationsSkipped = relations?.skipped ?? 0
    s.relationsErrored = relations?.errors ?? 0
    for (const sample of relations?.error_samples ?? []) {
      if (s.failures.length < 50) s.failures.push({ value: '(relation)', error: sample })
    }
    return s
  }

  // --- CSV import: value, label, description, aliases (pipe-separated) ---
  const importCsv = async (text: string) => {
    const Papa = (await import('papaparse')).default
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
    if (parsed.errors.length > 0 && parsed.data.length === 0) throw new Error(parsed.errors[0]?.message ?? 'CSV parse failed')
    const { terms, skippedRows } = csvRowsToTerms(parsed.data)
    if (mode === 'create-new') {
      const s = await bundleImport({ value: newValue, label: newLabel || newValue, created_by: 'rc-console' }, terms)
      s.termsErrored += skippedRows
      if (skippedRows > 0) s.failures.push({ value: '(rows without a value column)', error: `${skippedRows} row(s) had no usable term value` })
      return s
    }
    return bulkCreateTerms(terms, skippedRows)
  }

  // --- OBO import: OBO Graph JSON, or plain-text OBO via the stanza parser ---
  const importObo = async (text: string) => {
    let graph: Record<string, unknown>
    const trimmed = text.trimStart()
    if (trimmed.startsWith('{')) {
      graph = JSON.parse(text)
    } else {
      graph = parseOboText(text) as unknown as Record<string, unknown>
    }
    return importOntology(graph)
  }

  // --- JSON import ---
  const importJson = async (text: string) => {
    const data = JSON.parse(text)
    if (Array.isArray(data)) {
      const terms: CreateTermRequest[] = data.map((term: Record<string, unknown>) => ({
        value: term.value as string,
        label: term.label as string | undefined,
        description: term.description as string | undefined,
        aliases: term.aliases as string[] | undefined,
        sort_order: term.sort_order as number | undefined,
        parent_term_id: term.parent_term_id as string | undefined,
        translations: term.translations as CreateTermRequest['translations'],
        metadata: term.metadata as Record<string, unknown> | undefined,
        created_by: 'rc-console',
      }))
      if (mode === 'create-new') {
        return bundleImport({ value: newValue, label: newLabel || newValue, created_by: 'rc-console' }, terms)
      }
      return bulkCreateTerms(terms)
    } else if (data.terminology && data.terms) {
      // Accept either the post-rename `relations` key (with `relation_type`
      // inside each item) or the pre-rename `relationships` key (with
      // `relationship_type`) so existing user JSON exports keep working.
      // The renamed @wip/client (CASE-67) only accepts `relations`.
      type RawRelation = {
        source_term_value: string
        target_term_value: string
        relation_type?: string
        relationship_type?: string
        target_terminology_value?: string
      }
      const rawRelations = (data.relations ?? data.relationships) as RawRelation[] | undefined
      const relations = Array.isArray(rawRelations)
        ? rawRelations.map(r => ({
            source_term_value: r.source_term_value,
            target_term_value: r.target_term_value,
            relation_type: r.relation_type ?? r.relationship_type ?? '',
            target_terminology_value: r.target_terminology_value,
          }))
        : undefined
      // The bundle names its own terminology — it wins over the naming fields.
      return bundleImport(data.terminology, data.terms, relations)
    } else if (looksLikeOboGraph(data)) {
      return importObo(text)
    } else {
      throw new Error('Unrecognized JSON format. Expected: array of terms, {terminology, terms}, or OBO Graph JSON.')
    }
  }

  const needsNaming = mode === 'create-new'
  const namingValid = !needsNaming || (!!newValue.trim() && /^[A-Z][A-Z0-9_]*$/.test(newValue.trim()) && !!newNamespace)

  const handleImport = async () => {
    if (!selectedFile) return
    if (!namingValid) {
      setError('Terminology value (UPPER_SNAKE_CASE) and namespace are required')
      return
    }
    setImporting(true)
    setError(null)
    try {
      const text = await selectedFile.text()
      let res: ImportSummary
      if (detectedFormat === 'csv') {
        res = await importCsv(text)
      } else if (detectedFormat === 'obo') {
        res = await importObo(text)
      } else {
        res = await importJson(text)
      }
      setResult(res)
      queryClient.invalidateQueries({ queryKey: ['wip', 'terms'] })
      queryClient.invalidateQueries({ queryKey: ['wip', 'terminologies'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const formatLabel = detectedFormat === 'csv' ? 'CSV' : detectedFormat === 'obo' ? 'OBO' : 'JSON'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">
        {mode === 'create-new' ? 'Import Terminology' : 'Import Terms'}
      </h3>
      <p className="text-xs text-gray-400">
        {mode === 'create-new'
          ? 'Create a terminology from a file. '
          : 'Upload a file to import terms and ontology relations. '}
        Supported formats: JSON (array or full export), CSV (headers: value, label, description, aliases), OBO Graph JSON, plain-text OBO. Ontology edges (is_a, part_of, …) are imported as term relations; re-imports skip existing terms.
      </p>
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.tsv,.obo"
          className="hidden"
          onChange={e => handleFileSelect(e.target.files?.[0] ?? null)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-lg py-4 text-sm text-gray-400 hover:border-primary/30 hover:text-primary transition-colors flex flex-col items-center gap-1"
        >
          <Upload size={18} />
          {selectedFile ? (
            <span>{selectedFile.name} <span className="text-xs text-gray-300">({formatLabel})</span></span>
          ) : (
            'Click to select a file'
          )}
        </button>
      </div>

      {needsNaming && selectedFile && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Value * (UPPER_SNAKE_CASE)</label>
            <input
              type="text"
              value={newValue}
              onChange={e => { setNewValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')); setError(null) }}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary-light"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Namespace *</label>
            <select
              value={newNamespace}
              onChange={e => setNewNamespace(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary-light"
            >
              <option value="">Select...</option>
              {props.namespaces.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {detectedFormat === 'json' && (
            <p className="col-span-3 text-xs text-gray-400">
              If the file is a full export bundle, its own terminology name wins over these fields.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
      {result && (
        <div className="text-sm text-gray-700 bg-success/5 border border-success/20 rounded-lg px-4 py-2 space-y-1">
          <div>
            Terms: {result.termsCreated} created
            {result.termsSkipped > 0 && `, ${result.termsSkipped} skipped (already present)`}
            {result.termsErrored > 0 && <span className="text-danger">, {result.termsErrored} failed</span>}
            {(result.relationsCreated > 0 || result.relationsSkipped > 0 || result.relationsErrored > 0) && (
              <>
                {' · '}Relations: {result.relationsCreated} created
                {result.relationsSkipped > 0 && `, ${result.relationsSkipped} skipped`}
                {result.relationsErrored > 0 && <span className="text-danger">, {result.relationsErrored} failed</span>}
              </>
            )}
          </div>
          {result.failures.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-t border-success/20 pt-1">
              {result.failures.map((f, i) => (
                <div key={i} className="text-xs font-mono text-danger/80">
                  {f.value}: {f.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleImport}
          disabled={importing || !selectedFile}
          className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import'}
        </button>
        {mode === 'create-new' && result && createdId && (
          <button
            onClick={() => props.onCreated(createdId)}
            className="px-3 py-1.5 border border-primary/30 text-sm rounded-md text-primary hover:bg-primary/5"
          >
            Open terminology →
          </button>
        )}
        <button
          onClick={onClose}
          className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50"
        >
          {result ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
