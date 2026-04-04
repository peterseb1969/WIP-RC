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

const router = Router()

const MODEL = process.env.NL_QUERY_MODEL || 'claude-sonnet-4-6'
const MAX_TOOL_ROUNDS = 10 // safety limit on agentic loops
const MAX_TOKENS = 4096

// System prompt — loaded from the query-assistant-prompt MCP resource at build time.
// For runtime, we inline it here. It instructs Claude to use WIP tools for data queries.
const SYSTEM_PROMPT = `You are a WIP query assistant embedded in the RC-Console admin interface. You help users find and explore data stored in a WIP (World In a Pie) document store through natural language.

## Your Capabilities

You have access to **read-only** tools connected to a WIP instance. You can:
- Search across all documents (free text and structured queries)
- List, filter, and retrieve documents by template
- Look up terminologies and their terms
- Run SQL queries against the reporting database for aggregations and analytics
- Describe the data model to understand what's available

You **cannot** create, modify, or delete anything. All tools are read-only.

## How to Answer Questions

1. **Always use tools.** Never guess or fabricate data — query WIP for accurate answers.
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
  - Table names: doc_{template_value} in lowercase (e.g., doc_patient, doc_bank_transaction).
  - Use list_report_tables to discover available tables and columns.
- Only return latest versions of documents unless the user asks about version history.

## Response Style

- For a single entity lookup: show its full details.
- For comparisons: use a table.
- For "what can do X" questions: list matching entities with key details.
- For counts or statistics: use run_report_query with SQL.
- Keep answers under 500 words unless the user asks for detailed analysis.

## What NOT to Do

- Don't guess. If the data isn't there, say so.
- Don't invent entities, fields, or values that don't exist in the data model.
- Don't attempt to modify data — you are read-only.
- Don't expose internal IDs (template_id, document_id) unless the user asks for them.`

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

function getClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to .env to enable NL queries.'
      )
    }
    anthropic = new Anthropic({ apiKey })
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
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

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

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages: currentMessages,
      })

      totalInputTokens += response.usage?.input_tokens ?? 0
      totalOutputTokens += response.usage?.output_tokens ?? 0

      // Check if Claude wants to use tools
      if (response.stop_reason === 'tool_use') {
        // Build the assistant message with all content blocks
        const assistantContent = response.content

        // Execute each tool call
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of assistantContent) {
          if (block.type === 'tool_use') {
            let result: unknown
            try {
              result = await executeTool(
                block.name,
                block.input as Record<string, unknown>
              )
            } catch (err) {
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

      // No more tool calls — extract the text answer
      for (const block of response.content) {
        if (block.type === 'text') {
          finalAnswer += block.text
        }
      }

      break // done
    }

    const result: QueryResponse = {
      answer: finalAnswer,
      model: MODEL,
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

// GET /api/nl/status — check if NL query is available
router.get('/status', (_req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY
  res.json({
    available: hasKey,
    model: MODEL,
    hint: hasKey ? undefined : 'Set ANTHROPIC_API_KEY in .env to enable NL queries',
  })
})

export default router
