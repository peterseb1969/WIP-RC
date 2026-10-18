import { request, type APIRequestContext } from '@playwright/test'
import { E2E, readSecret } from './env'

/**
 * A request context for fixture setup and checks against the WIP API with the
 * deployment key. Tests use it to create and remove their own data, never to
 * drive what the UI is supposed to do.
 */
export async function wipApi(): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: E2E.wipURL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { 'X-API-Key': readSecret(E2E.apiKeyFile) },
  })
}

/** GET/POST JSON helpers that fail loudly with the response body. */
export async function getJson<T>(api: APIRequestContext, url: string): Promise<T> {
  const r = await api.get(url)
  if (!r.ok()) throw new Error(`GET ${url} → ${r.status()}: ${await r.text()}`)
  return (await r.json()) as T
}

export async function postJson<T>(api: APIRequestContext, url: string, body: unknown): Promise<T> {
  const r = await api.post(url, { data: body })
  if (!r.ok()) throw new Error(`POST ${url} → ${r.status()}: ${await r.text()}`)
  return (await r.json()) as T
}

/**
 * Poll until `check` returns a truthy value or the timeout passes. For
 * eventually consistent reads, such as reporting-sync catching up on events.
 */
export async function eventually<T>(check: () => Promise<T | null | undefined | false>, timeoutMs = 30_000, intervalMs = 1_000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let last: unknown
  while (Date.now() < deadline) {
    try {
      const v = await check()
      if (v) return v
    } catch (err) {
      last = err
    }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Timed out after ${timeoutMs} ms${last ? `: ${last instanceof Error ? last.message : String(last)}` : ''}`)
}

/** The canonical id of a namespace's template, by value. */
export async function templateId(api: APIRequestContext, namespace: string, value: string): Promise<string> {
  const list = await getJson<{ items: Array<{ template_id: string; value: string }> }>(
    api, `/api/template-store/templates?namespace=${encodeURIComponent(namespace)}&page_size=1000`)
  const t = list.items.find(x => x.value === value)
  if (!t) throw new Error(`no template ${value} in ${namespace}`)
  return t.template_id
}

/** Create documents of a namespace's template; fails on any per-item error. Returns document ids in order. */
export async function createDocuments(api: APIRequestContext, namespace: string, value: string, rows: Array<Record<string, unknown>>): Promise<string[]> {
  const tid = await templateId(api, namespace, value)
  const res = await postJson<{ results: Array<{ status: string; document_id?: string; id?: string; error?: string }> }>(
    api, '/api/document-store/documents', rows.map(data => ({ template_id: tid, namespace, data })))
  return res.results.map((r, i) => {
    if (r.status !== 'created' && r.status !== 'updated' && r.status !== 'unchanged') {
      throw new Error(`document ${i} of ${value}: ${r.status} ${r.error ?? ''}`)
    }
    const id = r.document_id ?? r.id
    if (!id) throw new Error(`document ${i} of ${value}: no id in ${JSON.stringify(r)}`)
    return id
  })
}

/** Create (upsert) one template; fails on a per-item error, which the bulk endpoint reports with HTTP 200. */
export async function createTemplate(api: APIRequestContext, template: Record<string, unknown>): Promise<void> {
  const res = await postJson<{ results: Array<{ status: string; error?: string }> }>(api, '/api/template-store/templates', [template])
  const r = res.results[0]
  if (!r || r.status === 'error') throw new Error(`template ${String(template.value)}: ${r?.error ?? 'no result'}`)
}
