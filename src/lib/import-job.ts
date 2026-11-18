import type { BackupJobSnapshot, ImportJobResult } from '@wip/client'

// A CSV/XLSX document import runs as a job: the request answers with the job
// record (202) and the rows are written in the background. The report is the
// job's `result` once its status is terminal; while it runs, `result` holds the
// counts written so far. A failed job's `error` names the row it stopped at,
// and its `result` is the partial report: the rows written before it stand.

export function isTerminal(job: Pick<BackupJobSnapshot, 'status'>): boolean {
  return job.status === 'complete' || job.status === 'failed'
}

/** The job's row report (final or so far), or null when it has none yet. */
export function importReport(job: Pick<BackupJobSnapshot, 'result'>): ImportJobResult | null {
  const r = job.result as unknown as ImportJobResult | null | undefined
  return r && r.result_kind === 'import_report' ? r : null
}

export interface AwaitImportOptions {
  /** Called with each snapshot read, the first one included. */
  onProgress?: (job: BackupJobSnapshot) => void
  /** Stops polling when it returns true (e.g. the page was left). */
  cancelled?: () => boolean
  intervalMs?: number
  sleep?: (ms: number) => Promise<void>
}

/**
 * Poll an import job until it reaches a terminal status and return that
 * snapshot, or null when cancelled. A read that fails throws: the job goes on
 * on the server either way.
 */
export async function awaitImportJob(
  getJob: (jobId: string) => Promise<BackupJobSnapshot>,
  started: BackupJobSnapshot,
  { onProgress, cancelled, intervalMs = 1500, sleep = ms => new Promise(r => setTimeout(r, ms)) }: AwaitImportOptions = {},
): Promise<BackupJobSnapshot | null> {
  let job = started
  onProgress?.(job)
  while (!isTerminal(job)) {
    await sleep(intervalMs)
    if (cancelled?.()) return null
    job = await getJob(started.job_id)
    onProgress?.(job)
  }
  return job
}
