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
