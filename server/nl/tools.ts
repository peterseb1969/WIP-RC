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
import { resolveWipApiKey } from '../wip-key.js'

const WIP_BASE = process.env.WIP_BASE_URL || 'https://localhost:8443'

/** Standard headers for WIP API calls */
function wipHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': resolveWipApiKey(),
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
  {
    name: 'search',
    description:
      'Full-text search across all WIP data (documents, terminologies, templates). Returns matching entities with snippets. Uses PostgreSQL full-text search.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The search query text',
        },
        types: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional array of entity types to search: "document", "terminology", "template". If omitted, searches all types.',
        },
        namespace: {
          type: 'string',
          description: 'Optional namespace prefix to filter results',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 20, max 100)',
        },
      },
      required: ['query'],
    },
  },
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
            'Optional field-value filters (exact match, AND). Keys are data field names, values are the filter values. Term fields must be UPPERCASE.',
          additionalProperties: true,
        },
        namespace: {
          type: 'string',
          description:
            'Namespace the template lives in (from describe_data_model). Required: template values are only unique within a namespace.',
        },
        limit: {
          type: 'number',
          description: 'Max documents per page (default 20, max 100)',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination, starting at 1 (default 1)',
        },
      },
      required: ['template_value', 'namespace'],
    },
  },
  {
    name: 'run_report_query',
    description:
      'Execute a SELECT-only SQL query against the PostgreSQL reporting database. Use for aggregations, counts, JOINs, and analytics. Tables live in one PG schema per namespace: either pass the namespace parameter so unqualified doc_{template_value} names resolve there, or schema-qualify every table as "namespace"."doc_{template_value}" (required for cross-namespace JOINs). Use list_report_tables to discover available tables — it returns each table\'s namespace and ready-to-use qualified_name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description:
            'A SELECT SQL query. Only SELECT is allowed — INSERT/UPDATE/DELETE will be rejected.',
        },
        namespace: {
          type: 'string',
          description:
            'Namespace whose schema unqualified table names resolve in. Omit only when every table in the SQL is schema-qualified.',
        },
      },
      required: ['sql'],
    },
  },
  {
    name: 'list_report_tables',
    description:
      'List all tables and their columns in the PostgreSQL reporting database. Use this to discover what data is available for SQL queries. Registered views are NOT included — use list_registered_views for those.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_registered_views',
    description:
      'List registered views: named, read-only SQL views a namespace keeps in its reporting schema (curated joins, roll-ups, hierarchy walks). Each comes with its defining SQL and a qualified_name to use in run_report_query. Prefer an existing view over re-deriving the same query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        namespace: {
          type: 'string',
          description: 'Only this namespace\'s views. Omit to list views in every namespace.',
        },
      },
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
    case 'search': {
      const body: Record<string, unknown> = { query: String(input.query ?? '') }
      if (input.namespace) body.namespace = String(input.namespace)
      body.limit = input.limit ?? 20
      if (input.types && Array.isArray(input.types)) body.types = input.types
      return wipPost('/api/reporting-sync/search', body)
    }

    case 'query_by_template': {
      // The query endpoint takes the template value in template_id (resolved
      // within ?namespace=), paginates by page/page_size, and wants filters as
      // a list of {field, operator, value} on data.* paths.
      const filters =
        input.filters && typeof input.filters === 'object'
          ? Object.entries(input.filters as Record<string, unknown>).map(([field, value]) => ({
              field: field.startsWith('data.') ? field : `data.${field}`,
              operator: 'eq',
              value,
            }))
          : []
      const body = {
        template_id: String(input.template_value ?? ''),
        filters,
        page: Math.max(1, Number(input.page) || 1),
        page_size: Math.min(100, Math.max(1, Number(input.limit) || 20)),
      }
      const params = new URLSearchParams({ namespace: String(input.namespace ?? '') })
      return wipPost(`/api/document-store/documents/query?${params}`, body)
    }

    case 'run_report_query': {
      const sql = String(input.sql ?? '')
      // Server-side safety: reject non-SELECT queries
      const trimmed = sql.trim().toUpperCase()
      if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        return { error: 'Only SELECT queries are allowed.' }
      }
      const body: Record<string, unknown> = { sql }
      if (input.namespace) body.namespace = String(input.namespace)
      return wipPost('/api/reporting-sync/query', body)
    }

    case 'list_report_tables': {
      return wipGet('/api/reporting-sync/tables')
    }

    case 'list_registered_views': {
      // Views are listed per namespace only; without one, ask every namespace.
      const one = async (ns: string) => {
        const r = (await wipGet(
          `/api/reporting-sync/namespace/${encodeURIComponent(ns)}/views`,
        )) as { views?: Array<{ name: string; sql: string; registered_by?: string | null }> }
        return (r.views ?? []).map(v => ({
          namespace: ns,
          name: v.name,
          qualified_name: `"${ns.replace(/"/g, '""')}"."${v.name.replace(/"/g, '""')}"`,
          sql: v.sql,
          registered_by: v.registered_by ?? null,
        }))
      }
      if (input.namespace) return { views: await one(String(input.namespace)) }
      const namespaces = (await wipGet('/api/registry/namespaces')) as Array<{ prefix: string; status?: string }>
      const prefixes = namespaces.filter(n => n.status !== 'deleted').map(n => n.prefix)
      const settled = await Promise.allSettled(prefixes.map(one))
      const views = settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
      const failures = settled.flatMap((r, i) =>
        r.status === 'rejected' ? [{ namespace: prefixes[i], error: String(r.reason) }] : [],
      )
      return failures.length ? { views, failures } : { views }
    }

    case 'get_document': {
      return wipGet(`/api/document-store/documents/${input.document_id}`)
    }

    case 'list_terms': {
      if (input.terminology_id) {
        return wipGet(
          `/api/def-store/terminologies/${input.terminology_id}/terms?page_size=1000`
        )
      }
      if (input.terminology_value) {
        // Look up terminology by value first
        const params = new URLSearchParams()
        params.set('value', String(input.terminology_value))
        if (input.namespace) params.set('namespace', String(input.namespace))
        const terminologies = (await wipGet(
          `/api/def-store/terminologies?${params}`
        )) as { items?: Array<{ terminology_id: string }> }
        const first = terminologies.items?.[0]
        if (!first) return { error: `Terminology "${input.terminology_value}" not found` }
        return wipGet(`/api/def-store/terminologies/${first.terminology_id}/terms?page_size=1000`)
      }
      return { error: 'Provide either terminology_id or terminology_value' }
    }

    case 'describe_data_model': {
      const [templates, terminologies] = await Promise.all([
        wipGet('/api/template-store/templates?status=active&latest_only=true&page_size=1000') as Promise<{
          items?: Array<Record<string, unknown>>
        }>,
        wipGet('/api/def-store/terminologies?status=active&page_size=1000') as Promise<{
          items?: Array<Record<string, unknown>>
        }>,
      ])
      return {
        templates: (templates.items ?? []).map((t) => ({
          id: t.template_id,
          value: t.value,
          label: t.label,
          namespace: t.namespace,
          version: t.version,
          field_count: Array.isArray(t.fields) ? t.fields.length : 0,
          identity_fields: t.identity_fields,
        })),
        terminologies: (terminologies.items ?? []).map((t) => ({
          id: t.terminology_id,
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
