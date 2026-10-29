import { useQuery } from '@tanstack/react-query'
import { useWipClient } from '@wip/react'
import {
  DB_OVERRIDES_SQL,
  DB_SESSION_SQL,
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
  /** The pooled session that answered; null if it could not be read. */
  session: DbSession | null
}

/**
 * The reporting database's configuration as the reporting role sees it:
 * every setting listed to it, the role and database defaults, and the session
 * that answered. Read-only, through the reporting query endpoint. The values
 * are the answering pooled session's own, so a default set on the database or
 * role after that session opened is not reflected until it recycles.
 */
export function useDbSettings() {
  const client = useWipClient()
  return useQuery({
    queryKey: ['rc-console', 'db-settings'],
    queryFn: async (): Promise<DbSettingsData> => {
      const [settings, overrides, session] = await Promise.all([
        client.reporting.runQuery(DB_SETTINGS_SQL, [], { max_rows: 5000 }),
        client.reporting.runQuery(DB_OVERRIDES_SQL, [], { max_rows: 5000 }),
        client.reporting.runQuery(DB_SESSION_SQL, []),
      ])
      return {
        settings: settings.rows.map(toSetting),
        overrides: overrides.rows.map(toOverride),
        session: toSession(session.rows[0]),
      }
    },
    staleTime: 60_000,
  })
}
