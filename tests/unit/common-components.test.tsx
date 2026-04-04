import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StatusBadge from '@/components/common/StatusBadge'
import ErrorState from '@/components/common/ErrorState'
import EmptyState from '@/components/common/EmptyState'
import Pagination from '@/components/common/Pagination'

describe('StatusBadge', () => {
  it('renders with default label from status', () => {
    render(<StatusBadge status="healthy" />)
    expect(screen.getByText('healthy')).toBeInTheDocument()
  })

  it('renders custom label', () => {
    render(<StatusBadge status="error" label="Failed" />)
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('applies green styling for healthy status', () => {
    const { container } = render(<StatusBadge status="healthy" />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('bg-green-100')
    expect(badge.className).toContain('text-green-700')
  })

  it('applies red styling for error status', () => {
    const { container } = render(<StatusBadge status="error" />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('bg-red-100')
    expect(badge.className).toContain('text-red-700')
  })

  it('applies yellow styling for warning status', () => {
    const { container } = render(<StatusBadge status="warning" />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.className).toContain('bg-yellow-100')
  })

  it('renders the colored dot indicator', () => {
    const { container } = render(<StatusBadge status="active" />)
    const dot = container.querySelector('span > span') as HTMLElement
    expect(dot.className).toContain('rounded-full')
    expect(dot.className).toContain('bg-green-500')
  })
})

describe('ErrorState', () => {
  it('displays error message', () => {
    render(<ErrorState message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="Error" onRetry={onRetry} />)
    const button = screen.getByText('Retry')
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides retry button when onRetry is not provided', () => {
    render(<ErrorState message="Error" />)
    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders with default text', () => {
    render(<EmptyState />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Nothing to show here yet.')).toBeInTheDocument()
  })

  it('renders with custom title and message', () => {
    render(<EmptyState title="No results" message="Try a different search" />)
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.getByText('Try a different search')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <EmptyState>
        <button>Create one</button>
      </EmptyState>
    )
    expect(screen.getByText('Create one')).toBeInTheDocument()
  })
})

describe('Pagination', () => {
  it('renders nothing when totalPages is 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows current page and total', () => {
    render(<Pagination page={3} totalPages={10} onPageChange={() => {}} />)
    expect(screen.getByText('3 of 10')).toBeInTheDocument()
  })

  it('calls onPageChange with previous page', () => {
    const onChange = vi.fn()
    render(<Pagination page={3} totalPages={10} onPageChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0]!) // prev
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange with next page', () => {
    const onChange = vi.fn()
    render(<Pagination page={3} totalPages={10} onPageChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1]!) // next
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('disables prev button on first page', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />)
    const prevBtn = screen.getAllByRole('button')[0]
    expect(prevBtn).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pagination page={5} totalPages={5} onPageChange={() => {}} />)
    const nextBtn = screen.getAllByRole('button')[1]
    expect(nextBtn).toBeDisabled()
  })

  it('clamps page to valid range', () => {
    const onChange = vi.fn()
    render(<Pagination page={1} totalPages={5} onPageChange={onChange} />)
    // clicking prev on page 1 should clamp to 1
    const prevBtn = screen.getAllByRole('button')[0]!
    fireEvent.click(prevBtn)
    // button is disabled, so no call expected
    expect(onChange).not.toHaveBeenCalled()
  })
})
