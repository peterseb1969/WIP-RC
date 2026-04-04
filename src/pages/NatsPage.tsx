import { useState } from 'react'
import {
  Radio,
  Wifi,
  WifiOff,
  Server,
  Users,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  HardDrive,
  Clock,
  Settings2,
} from 'lucide-react'
import {
  useNatsStatus,
  useNatsStreams,
  useNatsConsumers,
  type NatsStream,
  type NatsConsumer,
} from '@/hooks/use-nats'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Connection Status Bar
// ---------------------------------------------------------------------------

function NatsStatusBar() {
  const { data, isLoading } = useNatsStatus()

  if (isLoading) return null

  const connected = data?.connected ?? false

  return (
    <div className={cn(
      'flex items-center gap-4 px-4 py-2.5 border rounded-lg text-sm',
      connected
        ? 'bg-green-50/50 border-green-200'
        : 'bg-red-50/50 border-red-200'
    )}>
      {connected ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-red-400" />}
      <StatusBadge status={connected ? 'healthy' : 'unhealthy'} label={connected ? 'Connected' : 'Disconnected'} />
      {data?.server && <span className="text-gray-500 text-xs">Server: {data.server}</span>}
      {data?.version && <span className="text-gray-500 text-xs">v{data.version}</span>}
      {data?.jetstream && <span className="text-xs text-blue-500 font-medium">JetStream</span>}
      {data?.error && <span className="text-xs text-red-500">{data.error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stream Card
// ---------------------------------------------------------------------------

function StreamCard({ stream, isExpanded, onToggle }: {
  stream: NatsStream
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        <Radio size={16} className="text-purple-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-800">{stream.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {stream.subjects.join(', ')}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
          <span className="flex items-center gap-1" title="Messages">
            <MessageSquare size={12} />
            {stream.messages.toLocaleString()}
          </span>
          <span className="flex items-center gap-1" title="Storage">
            <HardDrive size={12} />
            {formatBytes(stream.bytes)}
          </span>
          <span className="flex items-center gap-1" title="Consumers">
            <Users size={12} />
            {stream.consumers}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-4">
          {/* Config */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Settings2 size={12} />
              Configuration
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {Object.entries(stream.config).map(([key, val]) => (
                <div key={key} className="bg-gray-50 rounded px-2 py-1.5">
                  <div className="text-gray-400">{key}</div>
                  <div className="text-gray-700 font-mono">{formatConfigValue(val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Created */}
          {stream.created && (
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={10} />
              Created: {new Date(stream.created).toLocaleString()}
            </div>
          )}

          {/* Consumers */}
          <StreamConsumers streamName={stream.name} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Consumer List (loaded when stream is expanded)
// ---------------------------------------------------------------------------

function StreamConsumers({ streamName }: { streamName: string }) {
  const { data: consumers, isLoading, error } = useNatsConsumers(streamName)

  if (isLoading) return <LoadingState label="Loading consumers..." className="py-4" />
  if (error) return <ErrorState message={error.message} />

  if (!consumers || consumers.length === 0) {
    return <p className="text-xs text-gray-400">No consumers for this stream.</p>
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
        <Users size={12} />
        Consumers ({consumers.length})
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-1.5 pr-4">Name</th>
              <th className="pb-1.5 pr-4">Deliver</th>
              <th className="pb-1.5 pr-4">Ack</th>
              <th className="pb-1.5 pr-4 text-right">Pending</th>
              <th className="pb-1.5 pr-4 text-right">Ack Pending</th>
              <th className="pb-1.5 text-right">Delivered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {consumers.map(consumer => (
              <ConsumerRow key={consumer.name} consumer={consumer} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ConsumerRow({ consumer }: { consumer: NatsConsumer }) {
  const hasLag = consumer.numPending > 0 || consumer.ackPending > 0

  return (
    <tr className={hasLag ? 'bg-yellow-50/30' : ''}>
      <td className="py-1.5 pr-4 font-mono text-gray-700">{consumer.name}</td>
      <td className="py-1.5 pr-4 text-gray-500">{consumer.deliverPolicy}</td>
      <td className="py-1.5 pr-4 text-gray-500">{consumer.ackPolicy}</td>
      <td className={cn('py-1.5 pr-4 text-right font-mono', consumer.numPending > 0 ? 'text-yellow-600' : 'text-gray-400')}>
        {consumer.numPending.toLocaleString()}
      </td>
      <td className={cn('py-1.5 pr-4 text-right font-mono', consumer.ackPending > 0 ? 'text-orange-600' : 'text-gray-400')}>
        {consumer.ackPending.toLocaleString()}
      </td>
      <td className="py-1.5 text-right font-mono text-gray-500">
        {consumer.delivered.toLocaleString()}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// NATS Page
// ---------------------------------------------------------------------------

export default function NatsPage() {
  const [expandedStream, setExpandedStream] = useState<string | null>(null)
  const { data: streams, isLoading, error, refetch } = useNatsStreams()

  const toggleStream = (name: string) => {
    setExpandedStream(prev => prev === name ? null : name)
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Radio size={24} className="text-purple-500" />
          NATS
        </h1>
        <p className="text-sm text-gray-400 mt-1">Event stream monitoring</p>
      </div>

      <NatsStatusBar />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            JetStream Streams
          </h2>
          {streams && (
            <span className="text-xs text-gray-400">{streams.length} stream{streams.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {isLoading && <LoadingState label="Connecting to NATS..." />}
        {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

        {streams && (
          <div className="space-y-3">
            {streams.length === 0 ? (
              <p className="text-sm text-gray-400">No JetStream streams configured.</p>
            ) : (
              streams.map(stream => (
                <StreamCard
                  key={stream.name}
                  stream={stream}
                  isExpanded={expandedStream === stream.name}
                  onToggle={() => toggleStream(stream.name)}
                />
              ))
            )}
          </div>
        )}
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

function formatConfigValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') {
    if (val === 0) return '0'
    if (val === -1) return 'unlimited'
    // Nanoseconds to human-readable for max_age
    if (val > 1_000_000_000) {
      const secs = val / 1_000_000_000
      if (secs < 60) return `${secs}s`
      if (secs < 3600) return `${Math.round(secs / 60)}m`
      if (secs < 86400) return `${Math.round(secs / 3600)}h`
      return `${Math.round(secs / 86400)}d`
    }
    return val.toLocaleString()
  }
  return String(val)
}
