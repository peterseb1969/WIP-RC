import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DbSettingsData } from '@/hooks/use-db-settings'
import type { PgSetting } from '@/lib/db-settings'

// The hook (two read-only queries) is mocked: what is under test is what the
// operator sees, and that the tab offers nothing that changes the database.

const state = vi.hoisted(() => ({
  current: {} as { data?: DbSettingsData; isLoading: boolean; error: Error | null; isFetching: boolean },
  refetch: vi.fn(),
}))

vi.mock('@/hooks/use-db-settings', () => ({
  useDbSettings: () => ({ ...state.current, refetch: state.refetch }),
}))

import DatabaseSettingsPanel from '@/components/reporting/DatabaseSettingsPanel'

function setting(over: Partial<PgSetting>): PgSetting {
  return {
    name: 'work_mem', setting: '4096', unit: 'kB', category: 'Resource Usage / Memory',
    short_desc: 'Sets the maximum memory to be used for query workspaces.', context: 'user',
    vartype: 'integer', source: 'default', boot_val: '4096', reset_val: '4096', pending_restart: false,
    min_val: '64', max_val: '2147483647', enumvals: null, ...over,
  }
}

const DATA: DbSettingsData = {
  settings: [
    setting({}),
    setting({
      name: 'jit', setting: 'off', unit: null, category: 'Query Tuning / Other Planner Options',
      short_desc: 'Allow JIT compilation.', source: 'database', boot_val: 'on', reset_val: 'off', vartype: 'bool',
    }),
    setting({
      name: 'jit_above_cost', setting: '100000', unit: null, category: 'Query Tuning / Other Planner Options',
      short_desc: 'Perform JIT compilation if query is more expensive.', boot_val: '100000',
    }),
    setting({
      name: 'shared_buffers', setting: '16384', unit: '8kB', category: 'Resource Usage / Memory',
      short_desc: 'Sets the number of shared memory buffers.', context: 'postmaster', source: 'configuration file',
      boot_val: '16384', pending_restart: true,
    }),
  ],
  overrides: [
    { role: '(all roles)', database: 'wip_reporting', setting: 'jit=off' },
    { role: 'wip_sync_owner', database: '(all databases)', setting: 'search_path=public' },
  ],
  session: {
    role: 'wip_reporting_read', database: 'wip_reporting',
    version: 'PostgreSQL 16.13 (Debian 16.13-1.pgdg13+1) on aarch64-unknown-linux-gnu, compiled by gcc',
    session_started: '2026-10-29T12:59:33.826238+00:00',
  },
}

beforeEach(() => {
  state.refetch.mockReset()
  state.current = { data: DATA, isLoading: false, error: null, isFetching: false }
})

describe('DatabaseSettingsPanel', () => {
  it('says what it read, as whom, and that it is read-only', () => {
    render(<DatabaseSettingsPanel />)
    expect(screen.getByText(/Read-only/)).toBeInTheDocument()
    expect(screen.getByText(/wip_reporting_read/, { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText(/PostgreSQL 16\.13 \(Debian 16\.13-1\.pgdg13\+1\)/)).toBeInTheDocument()
    // The platform and compiler tail of version() is not shown.
    expect(screen.queryByText(/aarch64|compiled by/)).toBeNull()
  })

  it('lists the role and database defaults and whether each covers the session read', () => {
    render(<DatabaseSettingsPanel />)
    const table = screen.getByRole('region', { name: /defaults set on a role or database/i })
    const jitRow = within(table).getByText('jit = off').closest('tr')!
    expect(within(jitRow).getByText('Yes')).toBeInTheDocument()
    const pathRow = within(table).getByText('search_path = public').closest('tr')!
    expect(within(pathRow).getByText('No')).toBeInTheDocument()
  })

  it('shows each setting with value, source and what changing it takes', () => {
    render(<DatabaseSettingsPanel />)
    const jit = screen.getByRole('row', { name: /^jit Allow JIT compilation\./ })
    expect(within(jit).getByText('off')).toBeInTheDocument()
    expect(within(jit).getByText('default on')).toBeInTheDocument()
    expect(within(jit).getByText('database')).toBeInTheDocument()
    expect(within(jit).getByText('Session, role or database')).toBeInTheDocument()

    const buffers = screen.getByRole('row', { name: /^shared_buffers/ })
    expect(within(buffers).getByText('16384 8kB')).toBeInTheDocument()
    expect(within(buffers).getByText('Server restart')).toBeInTheDocument()
    expect(within(buffers).getByText('restart pending')).toBeInTheDocument()
  })

  it('filters by name or description, and counts what is shown', async () => {
    const user = userEvent.setup()
    render(<DatabaseSettingsPanel />)
    expect(screen.getByText('4 of 4 settings')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/filter by name/i), 'jit')
    await waitFor(() => expect(screen.getByText('2 of 4 settings')).toBeInTheDocument())
    expect(screen.getByRole('row', { name: /^jit_above_cost/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /^work_mem/ })).toBeNull()
  })

  it('shows only settings not at default', async () => {
    const user = userEvent.setup()
    render(<DatabaseSettingsPanel />)
    await user.click(screen.getByRole('checkbox', { name: /not at default \(2\)/i }))
    expect(screen.getByText('2 of 4 settings')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /^jit Allow/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /^shared_buffers/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /^work_mem/ })).toBeNull()
  })

  it('limits to one category', async () => {
    const user = userEvent.setup()
    render(<DatabaseSettingsPanel />)
    await user.selectOptions(screen.getByLabelText('Category'), 'Resource Usage / Memory')
    expect(screen.getByText('2 of 4 settings')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /^jit/ })).toBeNull()
  })

  it('says so when nothing matches', async () => {
    const user = userEvent.setup()
    render(<DatabaseSettingsPanel />)
    await user.type(screen.getByPlaceholderText(/filter by name/i), 'zzz-no-such-setting')
    expect(await screen.findByText(/no setting matches the filter/i)).toBeInTheDocument()
  })

  it('offers nothing that changes the database', () => {
    render(<DatabaseSettingsPanel />)
    const names = screen.getAllByRole('button').map(b => b.textContent?.trim())
    expect(names).toEqual(['Refresh'])
    expect(screen.queryByRole('textbox', { name: /value/i })).toBeNull()
  })

  it('refreshes on request', async () => {
    const user = userEvent.setup()
    render(<DatabaseSettingsPanel />)
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(state.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows a loading state, and an error with a retry', async () => {
    state.current = { isLoading: true, error: null, isFetching: true }
    const { unmount } = render(<DatabaseSettingsPanel />)
    expect(screen.getByText(/reading database settings/i)).toBeInTheDocument()
    unmount()

    const user = userEvent.setup()
    state.current = { isLoading: false, error: new Error('reporting-sync unreachable'), isFetching: false }
    render(<DatabaseSettingsPanel />)
    expect(screen.getByText('reporting-sync unreachable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(state.refetch).toHaveBeenCalledTimes(1)
  })

  it('handles no defaults on any role or database, and an unidentified session', () => {
    state.current = { data: { ...DATA, overrides: [], session: null }, isLoading: false, error: null, isFetching: false }
    render(<DatabaseSettingsPanel />)
    expect(screen.getByText(/no role or database carries its own defaults/i)).toBeInTheDocument()
    expect(screen.getByText(/could not be identified/i)).toBeInTheDocument()
  })
})
