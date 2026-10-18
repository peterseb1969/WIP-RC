import { run } from './support/env'
import { wipApi } from './support/wip'

/** After the run: delete this run's namespaces and everything in them. */
export default async function globalTeardown(): Promise<void> {
  const { namespace, twin } = run()
  const api = await wipApi()
  for (const ns of [namespace, twin]) {
    const r = await api.delete(`/api/registry/namespaces/${encodeURIComponent(ns)}`)
    if (!r.ok()) console.warn(`[e2e] could not delete ${ns}: ${r.status()} ${await r.text()}`)
  }
  await api.dispose()
}
