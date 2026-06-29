/**
 * Anthropic API key resolution for the NL-query / askBar feature.
 *
 * Resolution order (mirrors APP-KB's CASE-508 runtime-override pattern):
 *   in-memory runtime override (set via the admin config endpoint)
 *   → ANTHROPIC_API_KEY env var.
 *
 * The override is held in PROCESS MEMORY ONLY — never written to disk or
 * env, and lost on restart (the app then falls back to the env key). Because
 * it lives in the server module, it is process-global: it applies to every
 * request this server instance handles until cleared or restarted.
 *
 * The key is a secret: it is never logged or returned to a caller. Status
 * carries only `configured` / `source` / `last4`.
 */
import Anthropic from '@anthropic-ai/sdk'

const PROBE_MODEL = process.env.NL_QUERY_MODEL || 'claude-sonnet-4-6'

let runtimeKeyOverride: string | null = null

export function resolveAnthropicKey(): string {
  return runtimeKeyOverride || process.env.ANTHROPIC_API_KEY || ''
}

export function keySource(): 'override' | 'env' | 'none' {
  if (runtimeKeyOverride) return 'override'
  if (process.env.ANTHROPIC_API_KEY) return 'env'
  return 'none'
}

/** Masked status — never includes the key itself. */
export function keyStatus(): { configured: boolean; source: 'override' | 'env' | 'none'; last4: string | null } {
  const key = resolveAnthropicKey()
  return {
    configured: !!key,
    source: keySource(),
    last4: key ? key.slice(-4) : null,
  }
}

export function setKeyOverride(key: string): void {
  runtimeKeyOverride = key
}

export function clearKeyOverride(): void {
  runtimeKeyOverride = null
}

/**
 * Liveness probe — one tiny (1-token) call so a bad/expired key is rejected
 * at set time instead of failing the user's first real NL query.
 */
export async function validateKey(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const probe = new Anthropic({ apiKey: key })
    await probe.messages.create({
      model: PROBE_MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'validation failed' }
  }
}
