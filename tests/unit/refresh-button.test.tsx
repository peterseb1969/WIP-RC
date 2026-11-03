import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RefreshButton, { RefreshingValue, UpdatingTag } from '@/components/common/RefreshButton'

// While a read runs the button says so and takes no clicks: a second click
// used to cancel the running request and start over.

describe('RefreshButton', () => {
  it('refreshes on click when idle', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} refreshing={false} label="Refresh documents" />)
    const button = screen.getByRole('button', { name: 'Refresh documents' })
    expect(button).toBeEnabled()
    await userEvent.click(button)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('is disabled and says so while refreshing', async () => {
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} refreshing label="Refresh documents" />)
    const button = screen.getByRole('button', { name: 'Refreshing…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('svg')?.getAttribute('class')).toMatch(/animate-spin/)
    await userEvent.click(button)
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

describe('RefreshingValue', () => {
  it('keeps the value, dims it and announces the update', () => {
    const { rerender } = render(<RefreshingValue refreshing={false}>42 documents</RefreshingValue>)
    expect(screen.getByText('42 documents')).not.toHaveAttribute('data-refreshing')
    rerender(<><RefreshingValue refreshing>42 documents</RefreshingValue><UpdatingTag refreshing /></>)
    const value = screen.getByText('42 documents')
    expect(value).toHaveAttribute('data-refreshing', 'true')
    expect(value.className).toMatch(/opacity-50/)
    expect(screen.getByText('(updating)', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('updating…')).toBeInTheDocument()
  })
})
