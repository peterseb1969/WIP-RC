import { MANAGED_BY_DEPLOYER, WipError, type APIKeyInfo } from '@wip/client'

// Records wip-deploy owns. The Registry imports the install's key file and
// reservations file as API keys, grants and reservations marked
// `managed_by: 'wip-deploy'`, and refuses every API write to them (HTTP 409,
// `error_code: managed_by_deployer`). They are changed with wip-deploy, so
// the console shows them read-only and names the command instead.

export const WIP_DEPLOY = 'wip-deploy'

export function isManaged(record: { managed_by?: string | null }): boolean {
  return record.managed_by === WIP_DEPLOY
}

/**
 * Whether the console may change this key. A key wip-deploy owns is
 * read-only. So is a config key the Registry has not imported (a Registry
 * run by hand with a key file, or one that predates the import), since
 * config keys never could be changed through the API.
 */
export function isKeyReadOnly(key: Pick<APIKeyInfo, 'managed_by' | 'source'>): boolean {
  return isManaged(key) || key.source === 'config'
}

/**
 * Whether the key file owns this key's grants. A managed key whose file
 * entry declares grants (`grants` set, even to `{}`) has every grant to it
 * managed, and the Registry refuses a new one too. A managed key that
 * declares none keeps grants the console may give and revoke.
 */
export function keyGrantsManaged(key: Pick<APIKeyInfo, 'managed_by' | 'grants'>): boolean {
  return isManaged(key) && key.grants != null
}

/** Whether an error is the Registry refusing a write to a record wip-deploy owns. */
export function isManagedRefusal(err: unknown): boolean {
  if (!(err instanceof WipError)) return false
  const body = err.detail
  return !!body && typeof body === 'object' && (body as { error_code?: unknown }).error_code === MANAGED_BY_DEPLOYER
}

/** What to run instead, for a key wip-deploy owns. `app-<name>` keys belong to app `<name>`. */
export function managedKeyHint(keyName: string): string {
  const app = keyName.startsWith('app-') ? keyName.slice(4) : null
  return app
    ? `Managed by wip-deploy from app ${app}'s manifest. Change its namespaces with ` +
      `wip-deploy app-namespace add|remove ${app} <namespace>, and rotate it with ` +
      `wip-deploy rotate-key ${keyName}.`
    : `Managed by wip-deploy from the install's key file. Change it with wip-deploy; ` +
      `rotate it with wip-deploy rotate-key ${keyName}.`
}
