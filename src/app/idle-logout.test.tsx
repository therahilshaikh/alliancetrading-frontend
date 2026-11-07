import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logout = vi.fn(() => Promise.resolve())
vi.mock('./auth', () => ({ useAuth: () => ({ logout }) }))

const MIN = 60_000

describe('IdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    logout.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('"Stay signed in" resets the timer instead of only closing the warning', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // Imported after fake timers start: the library captures timer functions on load.
    const { IdleLogout } = await import('./idle-logout')
    render(<IdleLogout />)

    await act(() => vi.advanceTimersByTimeAsync(28 * MIN + 1000))
    await user.click(await screen.findByRole('button', { name: 'Stay signed in' }))

    // Past the original 30-minute mark: must still be signed in.
    await act(() => vi.advanceTimersByTimeAsync(5 * MIN))
    expect(logout).not.toHaveBeenCalled()

    // A full idle period after staying signed in still ends the session.
    await act(() => vi.advanceTimersByTimeAsync(26 * MIN))
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
