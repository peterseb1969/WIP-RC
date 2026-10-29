import { useQuery } from '@tanstack/react-query'
import { useWipClient } from '@wip/react'
import {
  DB_OVERRIDES_SQL,
  DB_SETTINGS_SQL,
  toOverride,
  toSession,
  toSetting,
  type DbSession,
  type PgOverride,
  type PgSetting,
} from '@/lib/db-settings'

export interface DbSettingsData {
  settings: PgSetting[]
  overrides: PgOverride[]
  /** The pooled session that read the settings; null if there were no rows. */
  session: DbSession | null
}

/**
 * The reporting database's configuration as the reporting role sees it:
 * every setting listed to it, the role and database defaults, and the session
 * that read the settings. Read-only, through the reporting query endpoint. The
 * session is read in the same statement as the settings, because the endpoint
 * pools connections and a separate query could describe another one. The
 * values are that session's own, so a default set on the database or role after
 * it opened is not reflected until it recycles.
 */
export function useDbSettings() {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'db-settings'],
    queryFn: async (): Promise<DbSettingsData> => {
      const [settings, overrides] = await Promise.all([
        client.reporting.runQuery(DB_SETTINGS_SQL, [], { max_rows: 5000 }),
        client.reporting.runQuery(DB_OVERRIDES_SQL, [], { max_rows: 5000 }),
      ])
      return {
        settings: settings.rows.map(toSetting),
        overrides: overrides.rows.map(toOverride),
        session: toSession(settings.rows[0]),
      }
    },
    staleTime: 60_000,
  })
}
