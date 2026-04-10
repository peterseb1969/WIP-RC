import { useState, useCallback } from 'react'
import { apiUrl } from '@/lib/wip'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolCalls?: Array<{
    tool: string
    input: Record<string, unknown>
    output: unknown
  }>
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  error?: boolean
}

interface NLStatus {
  available: boolean
  model: string
  hint?: string
}

interface QueryResponse {
  answer: string
  toolCalls?: ChatMessage['toolCalls']
  model: string
  usage?: ChatMessage['usage']
  error?: string
}

let msgCounter = 0
function nextId(): string {
  return `msg-${Date.now()}-${++msgCounter}`
}

export function useNLQuery() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isQuerying, setIsQuerying] = useState(false)
  const [status, setStatus] = useState<NLStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const checkStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await fetch(apiUrl('/api/nl/status'))
      const data = (await res.json()) as NLStatus
      setStatus(data)
    } catch {
      setStatus({ available: false, model: '', hint: 'Failed to check NL query status' })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const sendQuery = useCallback(async (question: string) => {
    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setIsQuerying(true)

    try {
      // Build history from previous messages (text only, no tool details)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch(apiUrl('/api/nl/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })

      const data = (await res.json()) as QueryResponse

      if (!res.ok || data.error) {
        const assistantMsg: ChatMessage = {
          id: nextId(),
          role: 'assistant',
          content: data.error || `Request failed (HTTP ${res.status})`,
          timestamp: Date.now(),
          error: true,
        }
        setMessages((prev) => [...prev, assistantMsg])
        return
      }

      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: data.answer,
        timestamp: Date.now(),
        toolCalls: data.toolCalls,
        usage: data.usage,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Network error',
        timestamp: Date.now(),
        error: true,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } finally {
      setIsQuerying(false)
    }
  }, [messages])

  const clearHistory = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    isQuerying,
    sendQuery,
    clearHistory,
    status,
    statusLoading,
    checkStatus,
  }
}
