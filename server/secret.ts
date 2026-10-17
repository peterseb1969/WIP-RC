import { readFileSync } from 'fs'

/**
 * Resolve a secret from a file named by `fileVar`, falling back to the literal
 * value in `valueVar`. The file wins when it is readable and non-empty: on the
 * host it is the live wip-deploy secrets file, so a rotation is picked up on
 * the next read. In a container the deployer injects the literal value and the
 * host-only file path does not exist, so the fallback applies. Returns '' when
 * neither yields a value. Never logs or returns anything but the secret itself.
 */
export function resolveSecret(fileVar: string, valueVar: string): string {
  const file = process.env[fileVar]
  if (file) {
    try {
      const value = readFileSync(file, 'utf-8').trim()
      if (value) return value
    } catch { /* fall back to the literal value */ }
  }
  return process.env[valueVar] || ''
}
