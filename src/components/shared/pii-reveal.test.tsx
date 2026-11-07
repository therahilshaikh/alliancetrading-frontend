import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PII_VISIBLE_MS, PiiReveal } from './pii-reveal'

function setup(fetchValue = vi.fn().mockResolvedValue('ABCDE1234F')) {
  render(
    <TooltipProvider>
      <PiiReveal masked="XXXXX1234X" label="PAN" fetchValue={fetchValue} />
    </TooltipProvider>,
  )
  return fetchValue
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

describe('PiiReveal', () => {
  it('is masked by default and never fetches before a click', () => {
    const fetchValue = setup()
    expect(screen.getByText('XXXXX1234X')).toBeInTheDocument()
    expect(fetchValue).not.toHaveBeenCalled()
  })

  it('shows only the eye icon (no "Reveal" text)', () => {
    setup()
    const button = screen.getByRole('button', { name: 'Reveal PAN' })
    expect(button).toHaveTextContent('')
  })

  it('fetches on click without a confirmation and re-masks after 30 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const fetchValue = setup()

    await user.click(screen.getByRole('button', { name: 'Reveal PAN' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await screen.findByText('ABCDE1234F')).toBeInTheDocument()
    expect(fetchValue).toHaveBeenCalledOnce()

    await act(async () => {
      vi.advanceTimersByTime(PII_VISIBLE_MS + 500)
    })
    expect(screen.queryByText('ABCDE1234F')).not.toBeInTheDocument()
    expect(screen.getByText('XXXXX1234X')).toBeInTheDocument()
  })

  it('can be hidden early', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setup()
    await user.click(screen.getByRole('button', { name: 'Reveal PAN' }))
    await screen.findByText('ABCDE1234F')
    await user.click(screen.getByRole('button', { name: 'Hide PAN' }))
    expect(screen.queryByText('ABCDE1234F')).not.toBeInTheDocument()
  })
})
