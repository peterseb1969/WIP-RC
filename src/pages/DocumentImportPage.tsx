import { useState, useRef, useCallback, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  ChevronRight,
  Check,
  AlertTriangle,
  Loader2,
  Layers,
} from 'lucide-react'
import Papa from 'papaparse'
import { useTemplates, useTemplateByValue, useWipClient } from '@wip/react'
import type { FieldDefinition, ImportDocumentsResponse } from '@wip/client'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import LoadingState from '@/components/common/LoadingState'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'template' | 'upload' | 'mapping' | 'importing' | 'results'

interface ParsedCSV {
  headers: string[]
  preview: Record<string, string>[]
  file: File
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS: { key: Step; label: string }[] = [
  { key: 'template', label: 'Template' },
  { key: 'upload', label: 'Upload' },
  { key: 'mapping', label: 'Map Columns' },
  { key: 'importing', label: 'Import' },
  { key: 'results', label: 'Results' },
]

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.key === current)
  return (
    <div className="flex items-center gap-1 text-xs">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={10} className="text-gray-300" />}
          <span className={cn(
            'px-2 py-0.5 rounded-full',
            i === idx ? 'bg-primary/10 text-primary-dark font-medium' :
            i < idx ? 'bg-success/10 text-success' : 'text-gray-400'
          )}>
            {i < idx ? <Check size={10} className="inline -mt-0.5" /> : null}
            {' '}{s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Template selection
// ---------------------------------------------------------------------------

function TemplateStep({
  selectedValue,
  onSelect,
  onNext,
}: {
  selectedValue: string | null
  onSelect: (value: string) => void
  onNext: () => void
}) {
  const { namespace } = useNamespaceFilter()
  const { data, isLoading } = useTemplates({ status: 'active', latest_only: true, namespace: namespace || undefined, page_size: 100 })
  const templates = data?.items ?? []

  if (isLoading) return <LoadingState label="Loading templates..." />
  if (templates.length === 0) return <p className="text-sm text-gray-400">No active templates available.</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Select the template that defines the document structure for your CSV.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {templates.map(t => (
          <button
            key={t.template_id}
            onClick={() => onSelect(t.value)}
            className={cn(
              'text-left p-3 rounded-lg border transition-all',
              selectedValue === t.value
                ? 'border-primary/30 bg-primary/5 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Layers size={12} className="text-indigo-400" />
              <span className="text-xs font-mono text-gray-400">v{t.version ?? 1}</span>
            </div>
            <div className="text-sm font-medium text-gray-800 truncate">{t.label || t.value}</div>
            <div className="text-xs text-gray-400 mt-0.5 truncate">{t.value}</div>
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!selectedValue}
          className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Upload CSV
// ---------------------------------------------------------------------------

function UploadStep({
  parsed,
  onParsed,
  onNext,
  onBack,
}: {
  parsed: ParsedCSV | null
  onParsed: (p: ParsedCSV) => void
  onNext: () => void
  onBack: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    setParseError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      preview: 5,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0 && result.data.length === 0) {
          setParseError(result.errors[0]?.message ?? 'Failed to parse CSV')
          return
        }
        const headers = result.meta.fields ?? []
        if (headers.length === 0) {
          setParseError('No columns found in CSV. Ensure the first row contains headers.')
          return
        }
        onParsed({ headers, preview: result.data, file })
      },
      error: (err) => setParseError(err.message),
    })
  }, [onParsed])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          dragOver ? 'border-primary-light bg-primary/5' : 'border-gray-200 hover:border-gray-300'
        )}
      >
        <Upload size={32} className="mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">Drop a CSV file here or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">CSV files only. First row must be column headers.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      {parseError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-danger/5 border border-danger/20 rounded-lg text-sm text-danger">
          <AlertTriangle size={14} className="shrink-0" />
          {parseError}
        </div>
      )}

      {/* Preview */}
      {parsed && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-success">
            <FileSpreadsheet size={14} />
            <span className="font-medium">{parsed.file.name}</span>
            <span className="text-gray-400">({parsed.headers.length} columns, preview of first {parsed.preview.length} rows)</span>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {parsed.headers.map(h => (
                    <th key={h} className="px-3 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsed.preview.map((row, ri) => (
                  <tr key={ri}>
                    {parsed.headers.map(h => (
                      <td key={h} className="px-3 py-1.5 text-gray-700 whitespace-nowrap truncate max-w-[200px]">{row[h] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!parsed}
          className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Column mapping
// ---------------------------------------------------------------------------

function MappingStep({
  headers,
  fields,
  mapping,
  onChangeMapping,
  onNext,
  onBack,
}: {
  headers: string[]
  fields: FieldDefinition[]
  mapping: Record<string, string>
  onChangeMapping: (m: Record<string, string>) => void
  onNext: () => void
  onBack: () => void
}) {
  const mandatoryFields = fields.filter(f => f.mandatory).map(f => f.name)
  const mappedFieldNames = new Set(Object.values(mapping).filter(v => v !== ''))
  const unmappedMandatory = mandatoryFields.filter(n => !mappedFieldNames.has(n))
  const hasMappings = Object.values(mapping).some(v => v !== '')

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Map each CSV column to a template field. Unmapped columns will be skipped.</p>

      {unmappedMandatory.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Unmapped mandatory fields:</span>{' '}
            {unmappedMandatory.join(', ')}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {headers.map(h => (
          <div key={h} className="flex items-center gap-4 px-4 py-2.5">
            <span className="text-sm font-mono text-gray-700 w-48 truncate shrink-0" title={h}>{h}</span>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
            <select
              value={mapping[h] ?? ''}
              onChange={e => onChangeMapping({ ...mapping, [h]: e.target.value })}
              className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light"
            >
              <option value="">— Skip —</option>
              {fields.map(f => (
                <option key={f.name} value={f.name}>
                  {f.name}{f.label && f.label !== f.name ? ` (${f.label})` : ''}{f.mandatory ? ' *' : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!hasMappings}
          className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary disabled:opacity-50"
        >
          Start Import
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Importing
// ---------------------------------------------------------------------------

function ImportingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 size={32} className="text-primary animate-spin mb-4" />
      <p className="text-sm text-gray-600">Importing documents...</p>
      <p className="text-xs text-gray-400 mt-1">This may take a moment for large files.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 5: Results
// ---------------------------------------------------------------------------

function ResultsStep({
  result,
  templateValue,
  onImportMore,
}: {
  result: ImportDocumentsResponse
  templateValue: string
  onImportMore: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-gray-800">{result.total_rows}</div>
          <div className="text-xs text-gray-500">Total Rows</div>
        </div>
        <div className="bg-success/5 rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-success">{result.succeeded}</div>
          <div className="text-xs text-success">Succeeded</div>
        </div>
        <div className={cn('rounded-lg p-4 text-center', result.failed > 0 ? 'bg-danger/5' : 'bg-gray-50')}>
          <div className={cn('text-2xl font-semibold', result.failed > 0 ? 'text-danger' : 'text-gray-400')}>{result.failed}</div>
          <div className={cn('text-xs', result.failed > 0 ? 'text-danger' : 'text-gray-500')}>Failed</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-gray-400">{result.skipped}</div>
          <div className="text-xs text-gray-500">Skipped</div>
        </div>
      </div>

      {/* Success results */}
      {result.results.length > 0 && (
        <details open={result.results.length <= 20}>
          <summary className="text-sm font-medium text-gray-600 cursor-pointer">
            Imported documents ({result.results.length})
          </summary>
          <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Row</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Document ID</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Version</th>
                  <th className="px-3 py-1.5 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.results.slice(0, 100).map(r => (
                  <tr key={r.row}>
                    <td className="px-3 py-1.5 text-gray-500">{r.row}</td>
                    <td className="px-3 py-1.5">
                      <Link to={`/documents/${templateValue}/${r.document_id}`} className="text-primary hover:text-primary-dark font-mono">
                        {r.document_id}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-gray-700">v{r.version}</td>
                    <td className="px-3 py-1.5">
                      <StatusBadge status={r.is_new ? 'active' : 'warning'} label={r.is_new ? 'new' : 'updated'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.results.length > 100 && (
              <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-100">
                Showing first 100 of {result.results.length} results.
              </p>
            )}
          </div>
        </details>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <details open>
          <summary className="text-sm font-medium text-danger cursor-pointer">
            Errors ({result.errors.length})
          </summary>
          <div className="mt-2 bg-white border border-danger/20 rounded-lg overflow-hidden">
            <table className="text-xs w-full">
              <thead>
                <tr className="bg-danger/5 border-b border-danger/20">
                  <th className="px-3 py-1.5 text-left font-medium text-danger">Row</th>
                  <th className="px-3 py-1.5 text-left font-medium text-danger">Error</th>
                  <th className="px-3 py-1.5 text-left font-medium text-danger">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {result.errors.slice(0, 50).map((err, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-gray-500">{err.row}</td>
                    <td className="px-3 py-1.5 text-danger">{err.error}</td>
                    <td className="px-3 py-1.5 text-gray-500 font-mono truncate max-w-[300px]" title={JSON.stringify(err.data)}>
                      {JSON.stringify(err.data).slice(0, 80)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={onImportMore} className="px-4 py-2 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
          Import More
        </button>
        <Link
          to={`/documents?template=${templateValue}`}
          className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary"
        >
          View Documents
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auto-mapping helper
// ---------------------------------------------------------------------------

function autoMap(headers: string[], fields: FieldDefinition[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const fieldNames = new Set(fields.map(f => f.name))
  const fieldLabels = new Map(fields.map(f => [f.label?.toLowerCase() ?? '', f.name]))
  const used = new Set<string>()

  for (const h of headers) {
    const normalized = h.toLowerCase().replace(/[\s-]/g, '_')
    if (fieldNames.has(normalized) && !used.has(normalized)) {
      mapping[h] = normalized
      used.add(normalized)
    } else if (fieldLabels.has(h.toLowerCase()) && !used.has(fieldLabels.get(h.toLowerCase())!)) {
      const name = fieldLabels.get(h.toLowerCase())!
      mapping[h] = name
      used.add(name)
    } else {
      mapping[h] = ''
    }
  }
  return mapping
}

// ---------------------------------------------------------------------------
// Document Import Page
// ---------------------------------------------------------------------------

export default function DocumentImportPage() {
  const [searchParams] = useSearchParams()
  const { namespace } = useNamespaceFilter()
  const client = useWipClient()

  const templateParam = searchParams.get('template') || ''
  const [step, setStep] = useState<Step>(templateParam ? 'upload' : 'template')
  const [selectedTemplateValue, setSelectedTemplateValue] = useState<string | null>(templateParam || null)
  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<ImportDocumentsResponse | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const { data: template } = useTemplateByValue(selectedTemplateValue ?? '')
  const fields = template?.fields ?? []

  const handleTemplateSelect = useCallback((value: string) => {
    setSelectedTemplateValue(value)
  }, [])

  const handleParsed = useCallback((p: ParsedCSV) => {
    setParsed(p)
    if (fields.length > 0) {
      setMapping(autoMap(p.headers, fields))
    }
  }, [fields])

  // Re-run auto-mapping when template loads after file was already parsed
  useEffect(() => {
    if (parsed && fields.length > 0 && Object.keys(mapping).length === 0) {
      setMapping(autoMap(parsed.headers, fields))
    }
  }, [fields, parsed, mapping])

  const handleImport = useCallback(async () => {
    if (!template || !parsed || !namespace) return
    setStep('importing')
    setImportError(null)
    try {
      const columnMapping: Record<string, string> = {}
      for (const [csvCol, fieldName] of Object.entries(mapping)) {
        if (fieldName) columnMapping[csvCol] = fieldName
      }
      const result = await client.documents.importDocuments(parsed.file, parsed.file.name, {
        template_id: template.template_id,
        column_mapping: columnMapping,
        namespace,
        skip_errors: true,
      })
      setImportResult(result)
      setStep('results')
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : String(err))
      setStep('mapping')
    }
  }, [template, parsed, mapping, namespace, client])

  const handleReset = useCallback(() => {
    setStep(templateParam ? 'upload' : 'template')
    setParsed(null)
    setMapping({})
    setImportResult(null)
    setImportError(null)
  }, [templateParam])

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div>
        <Link to="/documents" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary mb-2">
          <ArrowLeft size={12} />
          Back to Documents
        </Link>
        <h1 className="text-2xl font-semibold text-gray-800">Import Documents</h1>
        <p className="text-sm text-gray-400 mt-1">Upload a CSV file to create documents from a template.</p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Namespace warning */}
      {!namespace && step !== 'results' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle size={14} className="shrink-0" />
          Select a namespace in the top bar before importing. Documents require a namespace.
        </div>
      )}

      {/* Template summary (visible after selection) */}
      {selectedTemplateValue && template && step !== 'template' && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
          <Layers size={14} className="text-indigo-500" />
          <span className="font-medium text-gray-700">{template.label || template.value}</span>
          <span className="text-xs text-gray-400 font-mono">{template.value}</span>
          <span className="text-xs text-gray-400">{fields.length} fields</span>
          {step === 'upload' && (
            <button onClick={() => { setStep('template'); setParsed(null); setMapping({}) }} className="ml-auto text-xs text-gray-400 hover:text-gray-600">
              Change
            </button>
          )}
        </div>
      )}

      {/* Import error */}
      {importError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-danger/5 border border-danger/20 rounded-lg text-sm text-danger">
          <AlertTriangle size={14} className="shrink-0" />
          {importError}
        </div>
      )}

      {/* Steps */}
      {step === 'template' && (
        <TemplateStep
          selectedValue={selectedTemplateValue}
          onSelect={handleTemplateSelect}
          onNext={() => setStep('upload')}
        />
      )}

      {step === 'upload' && (
        <UploadStep
          parsed={parsed}
          onParsed={handleParsed}
          onNext={() => setStep('mapping')}
          onBack={() => setStep('template')}
        />
      )}

      {step === 'mapping' && parsed && (
        <MappingStep
          headers={parsed.headers}
          fields={fields}
          mapping={mapping}
          onChangeMapping={setMapping}
          onNext={handleImport}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'importing' && <ImportingStep />}

      {step === 'results' && importResult && selectedTemplateValue && (
        <ResultsStep
          result={importResult}
          templateValue={selectedTemplateValue}
          onImportMore={handleReset}
        />
      )}
    </div>
  )
}
