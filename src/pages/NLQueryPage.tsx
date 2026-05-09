import { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Wrench,
  Sparkles,
  Zap,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNLQuery, type ChatMessage } from '@/hooks/use-nl-query'
import { cn } from '@/lib/cn'

const EXAMPLE_QUERIES = [
  { label: 'Data overview', query: 'What data is available in WIP? Summarize all templates and their document counts.' },
  { label: 'Template details', query: 'Show me all active templates with their fields.' },
  { label: 'Document count', query: 'How many documents exist per template? Show as a table.' },
  { label: 'Terminology list', query: 'List all terminologies and how many terms each has.' },
  { label: 'Namespace summary', query: 'What namespaces exist and what is in each one?' },
  { label: 'SQL analytics', query: 'What tables exist in the reporting database and how many rows does each have?' },
]

export default function NLQueryPage() {
  const {
    messages,
    isQuerying,
    sendQuery,
    clearHistory,
    status,
    checkStatus,
  } = useNLQuery()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check NL query availability on mount
  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [isQuerying])

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || isQuerying) return
    setInput('')
    sendQuery(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleExampleClick = (query: string) => {
    if (isQuerying) return
    setInput('')
    sendQuery(query)
  }

  const unavailable = status && !status.available

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-violet-500" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800">NL Query</h1>
            <p className="text-xs text-gray-400">
              Ask questions about your data in plain English
              {status && !unavailable && (
                <span className="ml-2 text-gray-300">
                  Model: {status.model}
                </span>
              )}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-danger hover:bg-danger/5 rounded-md transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Unavailable notice */}
      {unavailable && (
        <div className="flex items-center gap-2 px-4 py-3 my-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <div>
            <span className="font-medium text-amber-800">NL Query unavailable.</span>
            <span className="text-amber-600 ml-1">
              {status.hint || 'Set ANTHROPIC_API_KEY in .env to enable.'}
            </span>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {messages.length === 0 && !unavailable ? (
          <EmptyState onExampleClick={handleExampleClick} />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {isQuerying && (
          <div className="flex items-center gap-2 px-4 py-3">
            <Loader2 size={16} className="text-violet-500 animate-spin" />
            <span className="text-sm text-gray-400">Querying WIP...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 pt-3 pb-1">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              unavailable
                ? 'NL Query is unavailable (no API key)'
                : 'Ask a question about your data...'
            }
            disabled={isQuerying || !!unavailable}
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm',
              'text-gray-700 placeholder-gray-400',
              'focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200',
              'disabled:bg-gray-50 disabled:text-gray-400',
              'max-h-32 overflow-y-auto'
            )}
            style={{ minHeight: '2.5rem' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 128)}px`
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isQuerying || !!unavailable}
            className={cn(
              'shrink-0 p-2.5 rounded-lg transition-colors',
              input.trim() && !isQuerying && !unavailable
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-gray-100 text-gray-300'
            )}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-gray-300 mt-1.5 text-center">
          Enter to send, Shift+Enter for newline. Responses are generated by AI and may contain inaccuracies.
        </p>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────

function EmptyState({ onExampleClick }: { onExampleClick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <MessageSquare size={36} className="text-gray-200 mb-3" />
      <h2 className="text-lg font-medium text-gray-600 mb-1">
        Ask anything about your WIP data
      </h2>
      <p className="text-sm text-gray-400 mb-6 max-w-md">
        The query assistant uses Claude to search, filter, and analyze your
        documents, terminologies, and templates. It can run SQL for analytics.
      </p>

      <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
        {EXAMPLE_QUERIES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => onExampleClick(ex.query)}
            className="text-left px-3 py-2 rounded-lg border border-gray-150 hover:border-violet-300 hover:bg-violet-50/50 transition-colors group"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Zap size={11} className="text-violet-400 group-hover:text-violet-500" />
              <span className="text-xs font-medium text-gray-600 group-hover:text-violet-700">
                {ex.label}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 line-clamp-2">
              {ex.query}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-2.5',
          isUser
            ? 'bg-violet-600 text-white'
            : message.error
              ? 'bg-danger/5 border border-danger/20'
              : 'bg-white border border-gray-200'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : message.error ? (
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-danger/60 mt-0.5 shrink-0" />
            <p className="text-sm text-danger">{message.content}</p>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none prose-gray prose-headings:text-gray-800 prose-p:text-gray-700 prose-td:text-gray-600 prose-th:text-gray-700 prose-code:text-violet-700 prose-code:bg-violet-50 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool calls accordion */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallsAccordion toolCalls={message.toolCalls} />
        )}

        {/* Usage stats */}
        {message.usage && (
          <div className="mt-2 pt-1.5 border-t border-gray-100 text-[10px] text-gray-300 flex items-center gap-3">
            <span>In: {message.usage.input_tokens.toLocaleString()} tokens</span>
            <span>Out: {message.usage.output_tokens.toLocaleString()} tokens</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallsAccordion({
  toolCalls,
}: {
  toolCalls: NonNullable<ChatMessage['toolCalls']>
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={10} />
        {toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5">
          {toolCalls.map((tc, i) => (
            <ToolCallDetail key={i} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolCallDetail({
  toolCall,
}: {
  toolCall: {
    tool: string
    input: Record<string, unknown>
    output: unknown
  }
}) {
  const [expanded, setExpanded] = useState(false)

  // Summarize the output size
  const outputStr = JSON.stringify(toolCall.output)
  const outputSize =
    outputStr.length > 1000
      ? `${(outputStr.length / 1024).toFixed(1)}KB`
      : `${outputStr.length}B`

  return (
    <div className="bg-gray-50 rounded text-[11px] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 transition-colors"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="font-mono font-medium text-violet-600">{toolCall.tool}</span>
        <span className="text-gray-400">
          ({Object.entries(toolCall.input)
            .map(([k, v]) => {
              const val = typeof v === 'string' ? v : JSON.stringify(v)
              return `${k}=${val.length > 30 ? val.slice(0, 30) + '...' : val}`
            })
            .join(', ')})
        </span>
        <span className="ml-auto text-gray-300">{outputSize}</span>
      </button>

      {expanded && (
        <pre className="px-2 py-1.5 overflow-x-auto max-h-48 text-[10px] text-gray-600 border-t border-gray-200 bg-white">
          {JSON.stringify(toolCall.output, null, 2).slice(0, 5000)}
        </pre>
      )}
    </div>
  )
}
