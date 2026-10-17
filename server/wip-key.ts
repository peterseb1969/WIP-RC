import { resolveSecret } from './secret.js'

// WIP_API_KEY_FILE is the live wip-deploy secrets file (CASE-495); the literal
// WIP_API_KEY is the fallback — deployer-injected in containers, where the
// file path is host-only (CASE-714's failure shape). Mirrors wipProxy 0.4.3.
// Shared by every direct (non-proxy) WIP caller so they agree on the source.
export function resolveWipApiKey(): string {
  return resolveSecret('WIP_API_KEY_FILE', 'WIP_API_KEY')
}
