import { readFileSync } from 'fs'

// WIP_API_KEY_FILE is the live wip-deploy secrets file (CASE-495); the literal
// WIP_API_KEY is the fallback — deployer-injected in containers, where the
// file path is host-only (CASE-714's failure shape). Mirrors wipProxy 0.4.3.
// Shared by every direct (non-proxy) WIP caller so they agree on the source.
export function resolveWipApiKey(): string {
  const file = process.env.WIP_API_KEY_FILE
  if (file) {
    try {
      const key = readFileSync(file, 'utf-8').trim()
      if (key) return key
    } catch { /* fall back to the inline key */ }
  }
  return process.env.WIP_API_KEY || ''
}
