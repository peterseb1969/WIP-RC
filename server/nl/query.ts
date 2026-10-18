/**
 * NL Query endpoint — POST /api/nl/query
 *
 * Receives a natural language question, calls Claude API with the
 * query-assistant system prompt, executes tool calls against WIP's
 * REST APIs, and returns the formatted answer.
 *
 * Supports multi-turn conversation via the `history` field.
 * All conversation state lives in the frontend session (not persisted
 * server-side) — sensitive data never hits localStorage.
 */
import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { toolDefinitions, executeTool } from './tools.js'
import {
  NL_QUERY_MODEL,
  resolveAnthropicKey,
  keyStatus,
  setKeyOverride,
  clearKeyOverride,
  validateKey,
} from './anthropic-key.js'
import { requireAdmin } from '../auth.js'

const router = Router()

const MODEL = NL_QUERY_MODEL
const MAX_TOOL_ROUNDS = 10 // safety limit on agentic loops
// Thinking is on by default on current models and counts toward max_tokens,
// so leave room for it as well as the answer.
const MAX_TOKENS = 16000

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
/**
 * Thinking depth. `low` suits an interactive lookup assistant: it skips
 * thinking on simple questions and keeps answers quick. NL_QUERY_EFFORT
 * overrides it (e.g. `medium` for heavier analytical use).
 */
const EFFORT: Effort = EFFORTS.includes(process.env.NL_QUERY_EFFORT as Effort)
  ? (process.env.NL_QUERY_EFFORT as Effort)
  : 'low'

// Models that accept the server-side refusal fallback in its "default" form:
// a request a safety classifier declines is re-run on a fallback model chosen
// by the refusal category, inside the same call. Other models get no
// fallback, since the parameter is rejected there.
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'])
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

// System prompt — loaded from the query-assistant-prompt MCP resource at build time.
// For runtime, we inline it here. It instructs Claude to use WIP tools for data queries.
const SYSTEM_PROMPT = `You are a WIP query assistant embedded in the RC-Console admin interface. You help users find and explore data stored in a WIP (World In a Pie) document store through natural language.

## Your Capabilities

You have access to **read-only** tools connected to a WIP instance. You can:
- Search across all documents (free text and structured queries)
- List, filter, and retrieve documents by template
- Look up terminologies and their terms
- Run SQL queries against the reporting database for aggregations and analytics, including registered views
- Describe the data model to understand what's available

You **cannot** create, modify, or delete anything. All tools are read-only.

## How to Answer Questions

1. **Always use tools.** Never guess or fabricate data — query WIP for accurate answers, and if the data isn't there, say so.
2. **Call describe_data_model first** if you don't know what templates and fields are available.
3. **Be concise.** Give the answer, not an essay.
4. **Format nicely.** Use markdown: tables for comparisons, bold for key stats, headers for sections.
5. **Cite specifics.** Include exact values from the data.

## Query Strategy

- Use search for broad text searches across all entity types.
- Use query_by_template to list/filter documents of a specific template type.
- Term field values are UPPERCASE (e.g., "BEAST", "EVOCATION").
- Reference fields store entity IDs — use get_document to resolve them to full details.
- For aggregations, cross-template JOINs, or analytics, use run_report_query with SQL.
  - Tables live in one PostgreSQL schema per namespace. For single-namespace queries,
    pass namespace=<ns> and use unqualified doc_{template_value} names (lowercase,
    e.g., doc_patient). For cross-namespace JOINs, schema-qualify every table:
    "namespace"."doc_{template_value}".
  - Use list_report_tables to discover available tables and columns — it returns
    each table's namespace and a ready-to-use qualified_name.
  - Namespaces may also have registered views — named queries someone curated
    (joins, roll-ups, hierarchy walks). list_registered_views returns each view's
    SQL and qualified_name. Check it before writing a complex query: if a view
    already answers the question, query the view.
- Only return latest versions of documents unless the user asks about version history.

## Response Style

- For a single entity lookup: show its full details.
- For comparisons: use a table.
- For "what can do X" questions: list matching entities with key details.
- For counts or statistics: use run_report_query with SQL.
- Keep answers to the length the question needs.
- Refer to entities by their names or values; include internal IDs (template_id, document_id) only when the user asks for them.`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface QueryRequest {
  question: string
  history?: ChatMessage[]
}

interface QueryResponse {
  answer: string
  toolCalls?: Array<{
    tool: string
    input: Record<string, unknown>
    output: unknown
  }>
  model: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

let anthropic: Anthropic | null = null
let cachedKey = ''

function getClient(): Anthropic {
  const apiKey = resolveAnthropicKey()
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env, or provide a key in API Keys, to enable NL queries.'
    )
  }
  // Rebuild the cached client whenever the resolved key changes (e.g. an
  // admin set or cleared the runtime override), so a new key takes effect
  // without a server restart.
  if (!anthropic || cachedKey !== apiKey) {
    anthropic = new Anthropic({ apiKey })
    cachedKey = apiKey
  }
  return anthropic
}

/**
 * Convert chat history to Anthropic message format.
 * Each message is a simple text content block.
 */
function buildMessages(
  history: ChatMessage[],
  question: string
): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = []

  for (const msg of history) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  messages.push({
    role: 'user',
    content: question,
  })

  return messages
}

/** The parts of a final (non-tool-use) response that shape the answer. */
type FinalResponse = Pick<Anthropic.Beta.BetaMessage, 'content' | 'stop_reason'> & {
  stop_details?: { category?: string | null } | null
}

/**
 * The user-facing answer from a response that called no tools: its text
 * blocks, with a note when the model declined or ran out of room. A refusal
 * is a normal response (HTTP 200) whose content may be empty, so it is
 * checked before the text is used.
 */
export function finalAnswerFrom(response: FinalResponse): string {
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
  switch (response.stop_reason) {
    case 'refusal': {
      const category = response.stop_details?.category
      return `The model declined to answer this question${category ? ` (safety category: ${category})` : ''}. Try rephrasing it.`
    }
    case 'max_tokens':
      return `${text}\n\n_The answer was cut off because it reached the length limit. Ask for a narrower answer._`
    case 'model_context_window_exceeded':
      return `${text}\n\n_The conversation is too long for the model. Start a new conversation._`
    default:
      return text
  }
}

// POST /api/nl/query
router.post('/query', async (req, res) => {
  const { question, history = [] } = req.body as QueryRequest

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    res.status(400).json({ error: 'Question is required.' })
    return
  }

  try {
    const client = getClient()
    const messages = buildMessages(history, question.trim())
    const toolCallLog: QueryResponse['toolCalls'] = []

    // Agentic loop: Claude may call tools, we execute them and feed results back
    let currentMessages = messages
    let finalAnswer = ''
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let servedModel = MODEL
    let finished = false

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const useFallback = FALLBACK_MODELS.has(MODEL)
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: EFFORT },
        ...(useFallback ? { betas: [FALLBACK_BETA] } : {}),
        // CASE-311 step 1 — prompt caching on the static blocks. The system
        // prompt and tool definitions don't change across rounds within a
        // session; marking them as cache breakpoints lets round 2+ within
        // the 5-minute TTL hit cache instead of re-reading the same tokens.
        // The cache_control on the LAST tool definition extends caching
        // across the whole tools array.
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        tools: toolDefinitions.map((t, idx, arr) =>
          idx === arr.length - 1
            ? { ...t, cache_control: { type: 'ephemeral' } }
            : t
        ),
        messages: currentMessages,
        ...(useFallback ? { fallbacks: 'default' as const } : {}),
      })
      servedModel = response.model

      totalInputTokens += response.usage?.input_tokens ?? 0
      totalOutputTokens += response.usage?.output_tokens ?? 0

      // Check if Claude wants to use tools
      if (response.stop_reason === 'tool_use') {
        // Build the assistant message with all content blocks
        const assistantContent = response.content

        // Execute each tool call
        const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []
        for (const block of assistantContent) {
          if (block.type === 'tool_use') {
            let result: unknown
            let failed = false
            try {
              result = await executeTool(
                block.name,
                block.input as Record<string, unknown>
              )
            } catch (err) {
              failed = true
              result = {
                error: err instanceof Error ? err.message : 'Tool execution failed',
              }
            }

            toolCallLog!.push({
              tool: block.name,
              input: block.input as Record<string, unknown>,
              output: result,
            })

            // Truncate large results to avoid token bloat
            let resultStr = JSON.stringify(result)
            if (resultStr.length > 30000) {
              resultStr = resultStr.slice(0, 30000) + '\n... [truncated, result too large]'
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: resultStr,
              ...(failed ? { is_error: true } : {}),
            })
          }
        }

        // Feed tool results back to Claude
        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: assistantContent },
          { role: 'user' as const, content: toolResults },
        ]

        continue // next round
      }

      // No more tool calls — extract the text answer (blocks are read by
      // type: a response can also carry thinking blocks).
      finalAnswer = finalAnswerFrom(response)
      finished = true
      break // done
    }

    if (!finished) {
      finalAnswer = `I stopped after ${MAX_TOOL_ROUNDS} rounds of tool calls without reaching an answer. Try a narrower question.`
    }

    const result: QueryResponse = {
      answer: finalAnswer,
      model: servedModel,
      usage: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      },
    }

    if (toolCallLog!.length > 0) {
      result.toolCalls = toolCallLog
    }

    res.json(result)
  } catch (err) {
    console.error('[nl-query] Error:', err)

    if (err instanceof Error && err.message.includes('ANTHROPIC_API_KEY')) {
      res.status(503).json({
        error: err.message,
        hint: 'Set ANTHROPIC_API_KEY in your .env file',
      })
      return
    }

    const message = err instanceof Error ? err.message : 'Query failed'
    res.status(500).json({ error: message })
  }
})

// GET /api/nl/status — check if NL query is available + which key source
router.get('/status', (_req, res) => {
  const st = keyStatus()
  res.json({
    available: st.configured,
    model: MODEL,
    source: st.source,
    last4: st.last4,
    hint: st.configured ? undefined : 'Set ANTHROPIC_API_KEY in .env, or provide a key in API Keys, to enable NL queries',
  })
})

// POST /api/nl/anthropic-key — set the in-memory key override (admin only).
// The key is validated with a live probe before it is accepted, held in
// process memory only, and never echoed back (response carries masked status).
router.post('/anthropic-key', requireAdmin(), async (req, res) => {
  const key = typeof req.body?.key === 'string' ? req.body.key.trim() : ''
  if (!key) {
    res.status(400).json({ error: 'key is required' })
    return
  }
  const v = await validateKey(key)
  if (!v.ok) {
    res.status(400).json({ error: `Key rejected: ${v.error}` })
    return
  }
  setKeyOverride(key)
  res.json(keyStatus())
})

// DELETE /api/nl/anthropic-key — clear the override; falls back to env (admin only).
router.delete('/anthropic-key', requireAdmin(), (_req, res) => {
  clearKeyOverride()
  res.json(keyStatus())
})

export default router
