import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WipConflictError } from '@wip/client'
import { archiveFileName, parseArchive, restoreErrorMessage } from '@/lib/system-restore'

// The system restore is a dry run first; Apply applies exactly the reviewed
// plan (any change of file or option drops the dry run), a mirror needs the
// typed confirmation and sends the dry run's plan digest, and a plan with
// refusals can't be applied. The client is mocked.

const systemRestore = vi.hoisted(() => vi.fn())
const systemBackup = vi.hoisted(() => vi.fn())
vi.mock('@wip/react', () => ({ useWipClient: () => ({ registry: { systemRestore, systemBackup } }) }))

import SystemBackupTab from '@/components/backup/SystemBackupTab'

const archive = {
  format: 'wip-system-backup', version: 1, created_at: '2026-11-04T20:00:00.123Z',
  source: { oidc_issuer: 'https://localhost:8443/dex', salt_fingerprint: 'ab' },
  api_keys: [{ name: 'k1' }], grants: [], reservations: [], attachments: [],
}
const section = (over = {}) => ({ created: [], replaced: [], unchanged: [], skipped: [], orphaned: [], unresolved: [], ...over })
const report = (over = {}) => ({
  dry_run: true, mode: 'upsert', salt_adopted: false, warnings: [], refused: [], plan_digest: null,
  api_keys: section({ created: ['k1'] }), grants: section(), reservations: section(), attachments: section(), ...over,
})

async function upload(json: unknown) {
  const file = new File([JSON.stringify(json)], 'sys.json', { type: 'application/json' })
  await userEvent.upload(screen.getByLabelText('System backup file'), file)
}

beforeEach(() => { systemRestore.mockReset(); systemBackup.mockReset() })

describe('parseArchive', () => {
  it('accepts a system backup and fills a missing attachments list', () => {
    const r = parseArchive(JSON.stringify({ ...archive, attachments: undefined }))
    expect('archive' in r && r.archive.attachments).toEqual([])
  })

  it('says why a file is not one', () => {
    expect(parseArchive('{nope')).toEqual({ error: expect.stringMatching(/not JSON/) })
    expect(parseArchive(JSON.stringify({ format: 'wip-backup' }))).toEqual({ error: expect.stringMatching(/Restore tab/) })
    expect(parseArchive(JSON.stringify({ ...archive, version: 2 }))).toEqual({ error: expect.stringMatching(/version 2/) })
    expect(parseArchive(JSON.stringify({ ...archive, grants: null }))).toEqual({ error: 'The archive has no grants list.' })
  })
})

describe('archiveFileName', () => {
  it('is safe for a file system', () => {
    expect(archiveFileName('localhost', '2026-11-04T20:00:00.123Z')).toBe('wip-system-backup-localhost-2026-11-04T20-00-00Z.json')
  })
})

describe('restoreErrorMessage', () => {
  it('explains the coded refusals', () => {
    const err = (code: string) => new WipConflictError('nope', { detail: 'nope', error_code: code })
    expect(restoreErrorMessage(err('salt_mismatch'))).toMatch(/Retrying does not help/)
    expect(restoreErrorMessage(err('restore_refused'))).toMatch(/key this console authenticates with/)
    expect(restoreErrorMessage(err('plan_changed'))).toMatch(/Run the dry run again/)
    expect(restoreErrorMessage(new Error('plain'))).toBe('plain')
  })
})

describe('SystemBackupTab restore', () => {
  it('dry-runs, shows the report, then applies the reviewed options', async () => {
    systemRestore.mockResolvedValueOnce(report({ warnings: ['This stack holds auth state of its own.'] }))
      .mockResolvedValueOnce(report({ dry_run: false }))
    render(<SystemBackupTab />)
    await upload(archive)
    expect(screen.getByTestId('archive-summary')).toHaveTextContent('1 keys')
    await userEvent.click(screen.getByRole('button', { name: /Dry run/ }))
    expect(await screen.findByText('This stack holds auth state of its own.')).toBeInTheDocument()
    expect(within(screen.getByTestId('report-api_keys')).getAllByRole('cell')[1]).toHaveTextContent('1')
    expect(systemRestore).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'wip-system-backup' }),
      { dryRun: true, mode: 'upsert', includeUserGrants: false })

    await userEvent.click(screen.getByRole('button', { name: 'Apply upsert' }))
    await waitFor(() => expect(systemRestore).toHaveBeenLastCalledWith(expect.anything(),
      { dryRun: false, mode: 'upsert', includeUserGrants: false }))
    expect(await screen.findByText(/Applied/)).toBeInTheDocument()
  })

  it('drops the dry run when an option changes', async () => {
    systemRestore.mockResolvedValue(report())
    render(<SystemBackupTab />)
    await upload(archive)
    await userEvent.click(screen.getByRole('button', { name: /Dry run/ }))
    await screen.findByTestId('restore-report')
    await userEvent.click(screen.getByRole('radio', { name: /overwrite/ }))
    expect(screen.queryByTestId('restore-report')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Apply/ })).not.toBeInTheDocument()
  })

  it('a mirror needs the typed confirmation and sends the plan digest', async () => {
    systemRestore.mockResolvedValueOnce(report({ mode: 'mirror', plan_digest: 'd1', api_keys: section({ deleted: ['old'] }) }))
      .mockResolvedValueOnce(report({ mode: 'mirror', dry_run: false }))
    render(<SystemBackupTab />)
    await upload(archive)
    await userEvent.click(screen.getByRole('radio', { name: /mirror/ }))
    await userEvent.click(screen.getByRole('button', { name: /Dry run/ }))
    const apply = await screen.findByRole('button', { name: 'Apply mirror' })
    expect(apply).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Type mirror to confirm'), 'mirror')
    expect(apply).toBeEnabled()
    await userEvent.click(apply)
    await waitFor(() => expect(systemRestore).toHaveBeenLastCalledWith(expect.anything(),
      { dryRun: false, mode: 'mirror', includeUserGrants: false, expect: 'd1' }))
  })

  it('a plan with refusals cannot be applied', async () => {
    systemRestore.mockResolvedValue(report({ mode: 'overwrite',
      refused: [{ id: 'console-key', reason: 'would replace the calling key', reason_code: 'caller_key' }] }))
    render(<SystemBackupTab />)
    await upload(archive)
    await userEvent.click(screen.getByRole('radio', { name: /overwrite/ }))
    await userEvent.click(screen.getByRole('button', { name: /Dry run/ }))
    expect(await screen.findByText(/would replace the calling key/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply overwrite' })).toBeDisabled()
  })

  it('refuses a file that is not a system backup', async () => {
    render(<SystemBackupTab />)
    await upload({ format: 'wip-backup' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a WIP system backup/)
    expect(screen.queryByRole('button', { name: /Dry run/ })).not.toBeInTheDocument()
  })
})
