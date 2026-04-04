import { useState } from 'react'
import {
  HardDrive,
  Database,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  Hash,
  Layers,
  FileJson,
} from 'lucide-react'
import {
  useMongoDatabases,
  useMongoCollections,
  useMongoIndexes,
  useMongoDocuments,
} from '@/hooks/use-mongo'
import JsonViewer from '@/components/common/JsonViewer'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Database List
// ---------------------------------------------------------------------------

function DatabaseList({
  selectedDb,
  onSelectDb,
}: {
  selectedDb: string | null
  onSelectDb: (name: string) => void
}) {
  const { data: databases, isLoading, error, refetch } = useMongoDatabases()

  if (isLoading) return <LoadingState label="Connecting to MongoDB..." />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />

  return (
    <div className="divide-y divide-gray-100">
      {databases?.map(db => (
        <button
          key={db.name}
          onClick={() => onSelectDb(db.name)}
          className={cn(
            'w-full text-left px-3 py-3 flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors',
            selectedDb === db.name && 'bg-blue-50 text-blue-700'
          )}
        >
          <Database size={14} className={db.status === 'ok' ? 'text-green-500' : 'text-red-400'} />
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{db.name}</div>
            <div className="text-xs text-gray-400">
              {db.collections} collection{db.collections !== 1 ? 's' : ''}
              {db.sizeOnDisk !== null && ` · ${formatBytes(db.sizeOnDisk)}`}
            </div>
          </div>
          <ChevronRight size={14} className="text-gray-300 shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collection List
// ---------------------------------------------------------------------------

function CollectionList({
  database,
  selectedColl,
  onSelectColl,
}: {
  database: string
  selectedColl: string | null
  onSelectColl: (name: string) => void
}) {
  const { data: collections, isLoading, error } = useMongoCollections(database)

  if (isLoading) return <LoadingState label="Loading collections..." />
  if (error) return <ErrorState message={error.message} />

  if (!collections || collections.length === 0) {
    return <p className="text-sm text-gray-400 p-4">No collections in {database}.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {collections.map(col => (
        <button
          key={col.name}
          onClick={() => onSelectColl(col.name)}
          className={cn(
            'w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors',
            selectedColl === col.name && 'bg-blue-50 text-blue-700'
          )}
        >
          <FolderOpen size={14} className="text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{col.name}</div>
            <div className="text-xs text-gray-400">
              {col.documentCount !== null ? `${col.documentCount.toLocaleString()} docs` : '—'}
              {col.indexCount !== null && ` · ${col.indexCount} indexes`}
            </div>
          </div>
          <ChevronRight size={14} className="text-gray-300 shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collection Detail (indexes + documents)
// ---------------------------------------------------------------------------

function CollectionDetail({ database, collection }: { database: string; collection: string }) {
  const [page, setPage] = useState(1)
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null)
  const { data: indexes } = useMongoIndexes(database, collection)
  const { data: docBrowse, isLoading, error } = useMongoDocuments(database, collection, page)

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <Database size={12} />
        <span>{database}</span>
        <ChevronRight size={12} />
        <span className="font-medium text-gray-700">{collection}</span>
      </div>

      {/* Indexes */}
      {indexes && indexes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Layers size={14} />
            Indexes ({indexes.length})
          </h3>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-1 pr-4">Name</th>
                  <th className="pb-1 pr-4">Keys</th>
                  <th className="pb-1">Unique</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {indexes.map(idx => (
                  <tr key={idx.name}>
                    <td className="py-1.5 pr-4 font-mono text-gray-700">{idx.name}</td>
                    <td className="py-1.5 pr-4 font-mono text-gray-500">
                      {Object.entries(idx.key).map(([k, v]) => `${k}:${v}`).join(', ')}
                    </td>
                    <td className="py-1.5">
                      {idx.unique ? <span className="text-blue-600">yes</span> : <span className="text-gray-300">no</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
          <FileJson size={14} />
          Documents
          {docBrowse && (
            <span className="font-normal text-gray-400">
              ({docBrowse.total.toLocaleString()} total, page {docBrowse.page} of {docBrowse.pages})
            </span>
          )}
        </h3>

        {isLoading && <LoadingState label="Loading documents..." />}
        {error && <ErrorState message={error.message} />}

        {docBrowse && (
          <>
            {/* Document list */}
            <div className="space-y-2">
              {docBrowse.documents.map((doc, i) => {
                const id = (doc._id as string) ?? `row-${i}`
                const isSelected = selectedDocIndex === i

                return (
                  <div key={id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setSelectedDocIndex(isSelected ? null : i)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-sm"
                    >
                      <Hash size={12} className="text-gray-300" />
                      <span className="font-mono text-xs text-gray-500 truncate flex-1">{id}</span>
                      {isSelected ? <ChevronLeft size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    </button>
                    {isSelected && (
                      <div className="border-t border-gray-200">
                        <JsonViewer data={doc} maxHeight="400px" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {docBrowse.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  {page} / {docBrowse.pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(docBrowse.pages, p + 1))}
                  disabled={page >= docBrowse.pages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MongoDB Page
// ---------------------------------------------------------------------------

export default function MongoPage() {
  const [selectedDb, setSelectedDb] = useState<string | null>(null)
  const [selectedColl, setSelectedColl] = useState<string | null>(null)

  const handleSelectDb = (name: string) => {
    setSelectedDb(name)
    setSelectedColl(null)
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <HardDrive size={24} className="text-green-600" />
          MongoDB
        </h1>
        <p className="text-sm text-gray-400 mt-1">Direct database inspection (read-only)</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: database + collection tree */}
        <div className="col-span-3 space-y-3">
          {/* Databases */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Databases</span>
            </div>
            <DatabaseList selectedDb={selectedDb} onSelectDb={handleSelectDb} />
          </div>

          {/* Collections (when a DB is selected) */}
          {selectedDb && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {selectedDb} collections
                </span>
              </div>
              <CollectionList
                database={selectedDb}
                selectedColl={selectedColl}
                onSelectColl={setSelectedColl}
              />
            </div>
          )}
        </div>

        {/* Right: detail */}
        <div className="col-span-9">
          {selectedDb && selectedColl ? (
            <CollectionDetail database={selectedDb} collection={selectedColl} />
          ) : selectedDb ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              Select a collection to browse documents and indexes
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              Select a database to explore its collections
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
