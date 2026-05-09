import { useState } from 'react'
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface JsonViewerProps {
  data: unknown
  maxHeight?: string
  className?: string
  collapsed?: boolean
}

export default function JsonViewer({ data, maxHeight = '400px', className, collapsed = false }: JsonViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn('relative rounded-lg border border-gray-200 bg-gray-950', className)}>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 z-10"
        title="Copy JSON"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <div className="overflow-auto p-4 font-mono text-xs" style={{ maxHeight }}>
        <JsonNode value={data} defaultCollapsed={collapsed} />
      </div>
    </div>
  )
}

function JsonNode({ value, defaultCollapsed, depth = 0 }: {
  value: unknown
  defaultCollapsed?: boolean
  depth?: number
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed && depth > 0)

  if (value === null) return <span className="text-gray-500">null</span>
  if (value === undefined) return <span className="text-gray-500">undefined</span>
  if (typeof value === 'boolean') return <span className="text-yellow-400">{String(value)}</span>
  if (typeof value === 'number') return <span className="text-primary-light">{value}</span>
  if (typeof value === 'string') {
    // Truncate very long strings
    if (value.length > 200) {
      return <span className="text-success/60">"{value.slice(0, 200)}..."</span>
    }
    return <span className="text-success/60">"{value}"</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">[]</span>

    return (
      <span>
        <button onClick={() => setIsCollapsed(c => !c)} className="inline text-gray-500 hover:text-gray-300">
          {isCollapsed ? <ChevronRight size={12} className="inline" /> : <ChevronDown size={12} className="inline" />}
        </button>
        <span className="text-gray-400">[</span>
        {isCollapsed ? (
          <span className="text-gray-500 cursor-pointer" onClick={() => setIsCollapsed(false)}>
            {' '}{value.length} items{' '}
          </span>
        ) : (
          <div className="ml-4">
            {value.map((item, i) => (
              <div key={i}>
                <JsonNode value={item} defaultCollapsed={depth > 1} depth={depth + 1} />
                {i < value.length - 1 && <span className="text-gray-500">,</span>}
              </div>
            ))}
          </div>
        )}
        <span className="text-gray-400">]</span>
      </span>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-gray-400">{'{}'}</span>

    return (
      <span>
        <button onClick={() => setIsCollapsed(c => !c)} className="inline text-gray-500 hover:text-gray-300">
          {isCollapsed ? <ChevronRight size={12} className="inline" /> : <ChevronDown size={12} className="inline" />}
        </button>
        <span className="text-gray-400">{'{'}</span>
        {isCollapsed ? (
          <span className="text-gray-500 cursor-pointer" onClick={() => setIsCollapsed(false)}>
            {' '}{entries.length} keys{' '}
          </span>
        ) : (
          <div className="ml-4">
            {entries.map(([key, val], i) => (
              <div key={key}>
                <span className="text-purple-400">"{key}"</span>
                <span className="text-gray-500">: </span>
                <JsonNode value={val} defaultCollapsed={depth > 1} depth={depth + 1} />
                {i < entries.length - 1 && <span className="text-gray-500">,</span>}
              </div>
            ))}
          </div>
        )}
        <span className="text-gray-400">{'}'}</span>
      </span>
    )
  }

  return <span className="text-gray-400">{String(value)}</span>
}
