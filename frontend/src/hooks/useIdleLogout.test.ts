import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useIdleLogout } from './useIdleLogout'
import { authClient } from '@/lib/auth-client'
import { forceSignOut } from '@/lib/session'

vi.mock('@/lib/auth-client', () => ({
  authClient: { getSession: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  forceSignOut: vi.fn(),
}))

const MINUTE = 60 * 1000

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-31T00:00:00Z'))
    vi.mocked(authClient.getSession).mockResolvedValue({} as never)
    vi.mocked(forceSignOut).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the warning after 55 minutes', () => {
    const { result } = renderHook(() => useIdleLogout())

    act(() => vi.advanceTimersByTime(55 * MINUTE))

    expect(result.current.showWarning).toBe(true)
    expect(result.current.remainingSeconds).toBe(5 * 60)
  })

  it('forces logout after 60 minutes', () => {
    renderHook(() => useIdleLogout())

    act(() => vi.advanceTimersByTime(60 * MINUTE))

    expect(forceSignOut).toHaveBeenCalledTimes(1)
  })

  it('resets the idle clock when the user is active', () => {
    const { result } = renderHook(() => useIdleLogout())
    act(() => vi.advanceTimersByTime(54 * MINUTE))

    act(() => window.dispatchEvent(new Event('pointerdown')))
    act(() => vi.advanceTimersByTime(6 * MINUTE))

    expect(result.current.showWarning).toBe(false)
    expect(forceSignOut).not.toHaveBeenCalled()
  })

  it('throttles session refreshes from genuine activity', () => {
    renderHook(() => useIdleLogout())

    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
      window.dispatchEvent(new Event('keydown'))
      window.dispatchEvent(new Event('scroll'))
    })
    expect(authClient.getSession).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(5 * MINUTE))
    expect(authClient.getSession).toHaveBeenCalledTimes(1)

    act(() => window.dispatchEvent(new Event('pointerdown')))
    expect(authClient.getSession).toHaveBeenCalledTimes(2)
  })
})
