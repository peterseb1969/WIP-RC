import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Reservations come from two sources: wip-deploy's file and runtime keys.
// Only runtime ones can be released from the Console, and a conflict (both
// sources reserving one prefix) blocks the namespace's creation, so it is
// called out. Revoking a key reports what happened to its reservations.

const listReservations = vi.hoisted(() => vi.fn())
const releaseReservation = vi.hoisted(() => vi.fn())

vi.mock('@wip/react', () => ({
  useWipClient: () => ({ registry: { listReservations, releaseReservation } }),
}))

import { ReservationsPanel, RevokeResultBanner } from '@/components/api-keys/ReservationsPanel'

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  listReservations.mockReset()
  releaseReservation.mockReset()
})

describe('ReservationsPanel', () => {
  it('lists both sources and offers Release only on runtime ones', async () => {
    listReservations.mockResolvedValue([
      { prefix: 'kb', app: 'wip-kb', source: 'file', settings: {}, namespace_exists: true, conflict: null },
      { prefix: 'my-app', app: 'my-key', source: 'runtime', settings: { deletion_mode: 'full', id_config: {} }, namespace_exists: false, conflict: null },
    ])
    releaseReservation.mockResolvedValue({ status: 'released', prefix: 'my-app', app: 'my-key' })
    wrap(<ReservationsPanel />)

    const file = await screen.findByTestId('reservation-kb')
    expect(within(file).getByText('app wip-kb (wip-deploy)')).toBeInTheDocument()
    expect(within(file).getByText('managed by wip-deploy')).toBeInTheDocument()
    expect(within(file).getByText('defaults')).toBeInTheDocument()

    const runtime = screen.getByTestId('reservation-my-app')
    expect(within(runtime).getByText('key my-key')).toBeInTheDocument()
    expect(within(runtime).getByText('not created yet')).toBeInTheDocument()
    expect(within(runtime).getByText('deletion_mode: full')).toBeInTheDocument()
    await userEvent.click(within(runtime).getByRole('button', { name: 'Release the reservation of my-app' }))
    await waitFor(() => expect(releaseReservation).toHaveBeenCalledWith('my-app'))
  })

  it('calls out a conflict', async () => {
    listReservations.mockResolvedValue([
      { prefix: 'aa', app: 'k', source: 'runtime', settings: {}, namespace_exists: false, conflict: 'Also reserved by app wip-aa.' },
    ])
    wrap(<ReservationsPanel />)
    expect(await screen.findByText(/can't be created until one reservation is removed/)).toBeInTheDocument()
  })
})

describe('RevokeResultBanner', () => {
  it('reports grants and reservations, and releases a kept one', async () => {
    releaseReservation.mockResolvedValue({ status: 'released', prefix: 'live', app: 'k' })
    wrap(
      <RevokeResultBanner
        result={{ status: 'revoked', name: 'k', revoked_grants: ['live', 'never'], released_reservations: ['never'], kept_reservations: ['live'] }}
        onDismiss={() => {}}
      />,
    )
    expect(screen.getByText('live, never')).toBeInTheDocument()
    expect(screen.getByText(/Reservations kept/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Release the reservation of live' }))
    await waitFor(() => expect(releaseReservation).toHaveBeenCalledWith('live'))
    expect(await screen.findByText('never, live')).toBeInTheDocument()
    expect(screen.queryByText(/Reservations kept/)).not.toBeInTheDocument()
  })
})
