import { describe, it, expect, vi } from 'vitest'
import type { BackupJobSnapshot } from '@wip/client'
import { awaitImportJob, importReport, isTerminal } from '@/lib/import-job'

// A document import runs as a job: the page polls it to a terminal status and
// reads the row report from its result (partial when the job failed).

const snap = (over: Partial<BackupJobSnapshot> = {}): BackupJobSnapshot => ({
  job_id: 'imp-1', kind: 'import', namespace: 'ns', namespaces: ['ns'], status: 'running',
  phase: null, percent: null, message: null, error: null, created_at: '', started_at: null,
  completed_at: null, archive_size: null, archive_backend: 'local', options: {}, ...over,
} as BackupJobSnapshot)

const report = { result_kind: 'import_report', total_rows: 3, succeeded: 2, failed: 1, skipped: 0, results: [], results_truncated: false, errors: [], errors_truncated: false }

describe('awaitImportJob', () => {
  it('polls until the job is terminal and reports each snapshot', async () => {
    const getJob = vi.fn()
      .mockResolvedValueOnce(snap({ status: 'running', percent: 50 }))
      .mockResolvedValueOnce(snap({ status: 'complete', result: report as never }))
    const seen: string[] = []
    const done = await awaitImportJob(getJob, snap({ status: 'pending' }), { onProgress: j => seen.push(j.status), sleep: async () => {} })
    expect(done?.status).toBe('complete')
    expect(seen).toEqual(['pending', 'running', 'complete'])
    expect(getJob).toHaveBeenCalledWith('imp-1')
  })

  it('returns a job already terminal without polling', async () => {
    const getJob = vi.fn()
    expect((await awaitImportJob(getJob, snap({ status: 'failed' }), { sleep: async () => {} }))?.status).toBe('failed')
    expect(getJob).not.toHaveBeenCalled()
  })

  it('stops when cancelled', async () => {
    const getJob = vi.fn()
    expect(await awaitImportJob(getJob, snap(), { cancelled: () => true, sleep: async () => {} })).toBeNull()
    expect(getJob).not.toHaveBeenCalled()
  })

  it('throws when a read fails', async () => {
    const getJob = vi.fn().mockRejectedValue(new Error('gone'))
    await expect(awaitImportJob(getJob, snap(), { sleep: async () => {} })).rejects.toThrow('gone')
  })
})

describe('importReport and isTerminal', () => {
  it('reads the report only from an import result', () => {
    expect(importReport(snap({ result: report as never }))?.succeeded).toBe(2)
    expect(importReport(snap({ result: null }))).toBeNull()
    expect(importReport(snap({ result: { result_kind: 'integrity' } as never }))).toBeNull()
  })

  it('treats complete and failed as terminal', () => {
    expect(isTerminal({ status: 'complete' })).toBe(true)
    expect(isTerminal({ status: 'failed' })).toBe(true)
    expect(isTerminal({ status: 'running' })).toBe(false)
    expect(isTerminal({ status: 'pending' })).toBe(false)
  })
})
