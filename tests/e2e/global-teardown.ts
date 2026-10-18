import { run } from './support/env'
import { wipApi } from './support/wip'

/** After the run: delete this run's namespace and everything in it. */
export default async function globalTeardown(): Promise<void> {
  const { namespace } = run()
  const api = await wipApi()
  const r = await api.delete(`/api/registry/namespaces/${encodeURIComponent(namespace)}`)
  if (!r.ok()) console.warn(`[e2e] could not delete ${namespace}: ${r.status()} ${await r.text()}`)
  await api.dispose()
}
