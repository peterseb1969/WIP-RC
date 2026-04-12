/**
 * WIP tool definitions for Claude API tool_use.
 *
 * Each tool maps to a WIP REST API call. The Express backend executes
 * the tool call against WIP's Caddy gateway, then returns the result
 * to Claude for interpretation.
 *
 * All tools are READ-ONLY. The NL query agent cannot modify data.
 */
import type Anthropic from '@anthropic-ai/sdk'

const WIP_BASE = process.env.WIP_BASE_URL || 'https://localhost:8443'
const WIP_KEY = process.env.WIP_API_KEY || ''

/** Standard headers for WIP API calls */
function wipHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': WIP_KEY,
  }
}

/** Make a GET request to WIP */
async function wipGet(path: string): Promise<unknown> {
  const url = `${WIP_BASE}${path}`
  const res = await fetch(url, { headers: wipHeaders() })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WIP GET ${path} returned ${res.status}: ${text}`)
  }
  return res.json()
}

/** Make a POST request to WIP */
async function wipPost(path: string, body: unknown): Promise<unknown> {
  const url = `${WIP_BASE}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: wipHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WIP POST ${path} returned ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── Tool Definitions ───────────────────────────────────────────────

export const toolDefinitions: Anthropic.Tool[] = [
  // search tool removed — CASE-45: reporting-sync has no /search endpoint.
  // Claude compensates via run_report_query (SQL) and query_by_template.
  {
    name: 'query_by_template',
    description:
      'List or filter documents belonging to a specific template. Use this when you know which template type you want (e.g., CT_TRIAL, PERSON, PRODUCT). Supports field-level filtering.',
    input_schema: {
      type: 'object' as const,
      properties: {
        template_value: {
          type: 'string',
          description:
            'The template value code (e.g., "CT_TRIAL", "PERSON"). Use describe_data_model to discover available templates.',
        },
        filters: {
          type: 'object',
          description:
            'Optional field-value filters. Keys are field names, values are the filter values. Term fields must be UPPERCASE.',
          additionalProperties: true,
        },
        namespace: {
          type: 'string',
          description: 'Optional namespace to scope the query',
        },
        limit: {
          type: 'number',
          description: 'Max documents to return (default 20, max 100)',
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination (default 0)',
        },
      },
      required: ['template_value'],
    },
  },
  {
    name: 'run_report_query',
    description:
      'Execute a SELECT-only SQL query against the PostgreSQL reporting database. Use for aggregations, counts, JOINs, and analytics. Table names follow the pattern doc_{template_value} in lowercase (e.g., doc_ct_trial, doc_person). Use list_report_tables to discover available tables and columns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description:
            'A SELECT SQL query. Only SELECT is allowed — INSERT/UPDATE/DELETE will be rejected.',
        },
      },
      required: ['sql'],
    },
  },
  {
    name: 'list_report_tables',
    description:
      'List all tables and their columns in the PostgreSQL reporting database. Use this to discover what data is available for SQL queries.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_document',
    description:
      'Retrieve a single document by its ID. Use this to resolve references or get full details of a specific entity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        document_id: {
          type: 'string',
          description: 'The document ID (e.g., "DOC-xxxxxxxx")',
        },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'list_terms',
    description:
      'List all terms in a terminology. Useful for understanding what values a term field can take.',
    input_schema: {
      type: 'object' as const,
      properties: {
        terminology_id: {
          type: 'string',
          description: 'The terminology ID (UUID)',
        },
        terminology_value: {
          type: 'string',
          description:
            'Alternative: the terminology value code (e.g., "CT_STATUS"). Use this if you do not have the ID.',
        },
        namespace: {
          type: 'string',
          description:
            'Namespace for the terminology (needed when using terminology_value if the same value exists in multiple namespaces)',
        },
      },
      required: [],
    },
  },
  {
    name: 'describe_data_model',
    description:
      'Get a summary of all templates and terminologies in the WIP instance. Call this first if you are unsure what data is available.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

// ─── Tool Execution ─────────────────────────────────────────────────

/**
 * Execute a tool call against WIP's REST API.
 * Returns the result as a JSON-serializable object.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    // 'search' case removed — CASE-45

    case 'query_by_template': {
      const body: Record<string, unknown> = {
        template_value: input.template_value,
      }
      if (input.filters) body.filters = input.filters
      if (input.namespace) body.namespace = input.namespace
      body.limit = input.limit ?? 20
      body.offset = input.offset ?? 0
      return wipPost('/api/document-store/documents/query', body)
    }

    case 'run_report_query': {
      const sql = String(input.sql ?? '')
      // Server-side safety: reject non-SELECT queries
      const trimmed = sql.trim().toUpperCase()
      if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        return { error: 'Only SELECT queries are allowed.' }
      }
      return wipPost('/api/reporting-sync/query', { sql })
    }

    case 'list_report_tables': {
      return wipGet('/api/reporting-sync/tables')
    }

    case 'get_document': {
      return wipGet(`/api/document-store/documents/${input.document_id}`)
    }

    case 'list_terms': {
      if (input.terminology_id) {
        return wipGet(
          `/api/def-store/terminologies/${input.terminology_id}/terms?limit=500`
        )
      }
      if (input.terminology_value) {
        // Look up terminology by value first
        const params = new URLSearchParams()
        params.set('value', String(input.terminology_value))
        if (input.namespace) params.set('namespace', String(input.namespace))
        const terminologies = (await wipGet(
          `/api/def-store/terminologies?${params}`
        )) as { terminologies?: Array<{ id: string }> }
        const tList = terminologies.terminologies ?? []
        if (tList.length === 0) {
          return { error: `Terminology "${input.terminology_value}" not found` }
        }
        const first = tList[0]
        if (!first) return { error: `Terminology "${input.terminology_value}" not found` }
        const tid = first.id
        return wipGet(`/api/def-store/terminologies/${tid}/terms?limit=500`)
      }
      return { error: 'Provide either terminology_id or terminology_value' }
    }

    case 'describe_data_model': {
      const [templates, terminologies] = await Promise.all([
        wipGet('/api/template-store/templates?status=active&limit=100') as Promise<{
          templates?: Array<Record<string, unknown>>
        }>,
        wipGet('/api/def-store/terminologies?status=active&limit=200') as Promise<{
          terminologies?: Array<Record<string, unknown>>
        }>,
      ])
      return {
        templates: (templates.templates ?? []).map((t) => ({
          id: t.id,
          value: t.value,
          label: t.label,
          namespace: t.namespace,
          version: t.version,
          field_count: Array.isArray(t.fields) ? t.fields.length : 0,
          identity_fields: t.identity_fields,
        })),
        terminologies: (terminologies.terminologies ?? []).map((t) => ({
          id: t.id,
          value: t.value,
          label: t.label,
          namespace: t.namespace,
          term_count: t.term_count,
        })),
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
