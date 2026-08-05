import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearStoredKey,
  readProjectId,
  readStoredKey,
  storeKey,
  type VerifyResult,
  verifyAccessKey,
} from '../lib/accessKey'
import {
  AccessGateProvider,
  type AccessGateContextValue,
  useAccessGate,
} from './AccessGateContext'

vi.mock('../lib/accessKey', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/accessKey')>('../lib/accessKey')

  return {
    ...actual,
    clearStoredKey: vi.fn(),
    readProjectId: vi.fn(),
    readStoredKey: vi.fn(),
    storeKey: vi.fn(),
    verifyAccessKey: vi.fn(),
  }
})

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000'
const STORED_KEY = 'STORED-KEY'

let latestContext: AccessGateContextValue | null = null
let phaseHistory: string[] = []

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function Probe({ submitValue = '  typed-key  ' }: { submitValue?: string }) {
  const context = useAccessGate()
  latestContext = context
  phaseHistory.push(context.phase)

  return (
    <div>
      <span data-testid="phase">{context.phase}</span>
      <span data-testid="reason">{context.reason}</span>
      <span data-testid="retry-after">{context.retryAfterSeconds}</span>
      <span data-testid="is-verifying">{String(context.isVerifying)}</span>
      <button type="button" onClick={() => context.submitKey(submitValue)}>
        Submit
      </button>
      <button type="button" onClick={context.retry}>
        Retry
      </button>
    </div>
  )
}

function renderGate(options?: { strict?: boolean; submitValue?: string }) {
  const provider = (
    <AccessGateProvider>
      <Probe submitValue={options?.submitValue} />
    </AccessGateProvider>
  )

  return render(
    options?.strict ? <StrictMode>{provider}</StrictMode> : provider,
  )
}

describe('AccessGateProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    latestContext = null
    phaseHistory = []
    vi.mocked(readProjectId).mockReturnValue(PROJECT_ID)
    vi.mocked(readStoredKey).mockReturnValue(null)
    vi.mocked(storeKey).mockReturnValue(true)
    vi.mocked(clearStoredKey).mockReturnValue(true)
    vi.mocked(verifyAccessKey).mockResolvedValue({ status: 'valid' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('gates without verifying when no key is stored', () => {
    renderGate()

    expect(screen.getByTestId('phase')).toHaveTextContent('gated')
    expect(screen.getByTestId('reason')).toHaveTextContent('none')
    expect(verifyAccessKey).not.toHaveBeenCalled()
  })

  it('checks a stored key before granting access and stores it again', async () => {
    const verification = deferred<VerifyResult>()
    vi.mocked(readStoredKey).mockReturnValue(STORED_KEY)
    vi.mocked(verifyAccessKey).mockReturnValue(verification.promise)

    renderGate()
    expect(screen.getByTestId('phase')).toHaveTextContent('checking')

    await act(async () => {
      verification.resolve({ status: 'valid' })
      await verification.promise
    })

    expect(screen.getByTestId('phase')).toHaveTextContent('granted')
    expect(screen.getByTestId('reason')).toHaveTextContent('none')
    expect(storeKey).toHaveBeenCalledWith(STORED_KEY)
  })

  it('clears an invalid stored key and reports it as expired', async () => {
    vi.mocked(readStoredKey).mockReturnValue(STORED_KEY)
    vi.mocked(verifyAccessKey).mockResolvedValue({ status: 'invalid' })

    renderGate()

    await waitFor(() =>
      expect(screen.getByTestId('reason')).toHaveTextContent('expired'),
    )
    expect(screen.getByTestId('phase')).toHaveTextContent('gated')
    expect(clearStoredKey).toHaveBeenCalledOnce()
  })

  it('keeps an unavailable stored key and never grants access', async () => {
    vi.mocked(readStoredKey).mockReturnValue(STORED_KEY)
    vi.mocked(verifyAccessKey).mockResolvedValue({ status: 'unavailable' })

    renderGate()

    await waitFor(() =>
      expect(screen.getByTestId('reason')).toHaveTextContent('unavailable'),
    )
    expect(screen.getByTestId('phase')).toHaveTextContent('gated')
    expect(clearStoredKey).not.toHaveBeenCalled()
    expect(phaseHistory).not.toContain('granted')
  })

  it('counts down a rate limit and ignores submissions until it expires', async () => {
    vi.useFakeTimers()
    const verification = deferred<VerifyResult>()
    vi.mocked(readStoredKey).mockReturnValue(STORED_KEY)
    vi.mocked(verifyAccessKey).mockReturnValue(verification.promise)

    renderGate()
    await act(async () => {
      verification.resolve({
        status: 'rate-limited',
        retryAfterSeconds: 30,
      })
      await verification.promise
    })

    expect(screen.getByTestId('reason')).toHaveTextContent('rate-limited')
    expect(screen.getByTestId('retry-after')).toHaveTextContent('30')
    expect(clearStoredKey).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(verifyAccessKey).toHaveBeenCalledOnce()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByTestId('retry-after')).toHaveTextContent('0')
    expect(screen.getByTestId('reason')).toHaveTextContent('none')
  })

  it('ignores retry during a rate limit and allows it after countdown', async () => {
    vi.useFakeTimers()
    const verification = deferred<VerifyResult>()
    vi.mocked(readStoredKey).mockReturnValue(STORED_KEY)
    vi.mocked(verifyAccessKey).mockReturnValue(verification.promise)

    renderGate()
    await act(async () => {
      verification.resolve({
        status: 'rate-limited',
        retryAfterSeconds: 30,
      })
      await verification.promise
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(verifyAccessKey).toHaveBeenCalledOnce()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByTestId('reason')).toHaveTextContent('none')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(verifyAccessKey).toHaveBeenCalledTimes(2)
    expect(verifyAccessKey).toHaveBeenLastCalledWith(STORED_KEY)
  })

  it('reports a fresh invalid key without clearing storage', async () => {
    vi.mocked(verifyAccessKey).mockResolvedValue({ status: 'invalid' })
    renderGate({ submitValue: '  fresh-key  ' })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() =>
      expect(screen.getByTestId('reason')).toHaveTextContent('invalid'),
    )
    expect(verifyAccessKey).toHaveBeenCalledWith('FRESH-KEY')
    expect(clearStoredKey).not.toHaveBeenCalled()
  })

  it('retries the same fresh typed key after an unavailable response', async () => {
    vi.mocked(verifyAccessKey)
      .mockResolvedValueOnce({ status: 'unavailable' })
      .mockResolvedValueOnce({ status: 'valid' })
    renderGate({ submitValue: '  retry-this-key  ' })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(screen.getByTestId('reason')).toHaveTextContent('unavailable'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(verifyAccessKey).toHaveBeenCalledTimes(2))
    expect(verifyAccessKey).toHaveBeenNthCalledWith(1, 'RETRY-THIS-KEY')
    expect(verifyAccessKey).toHaveBeenNthCalledWith(2, 'RETRY-THIS-KEY')
  })

  it('reports a project configuration error without verifying or granting', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(readProjectId).mockImplementation(() => {
      throw new Error('VITE_ACCESS_PROJECT_ID is missing')
    })

    renderGate()

    expect(screen.getByTestId('phase')).toHaveTextContent('gated')
    expect(screen.getByTestId('reason')).toHaveTextContent('misconfigured')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(verifyAccessKey).not.toHaveBeenCalled()
    expect(phaseHistory).not.toContain('granted')
  })

  it('ignores retry while misconfigured and preserves the reason', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(readProjectId).mockImplementation(() => {
      throw new Error('VITE_ACCESS_PROJECT_ID is missing')
    })
    renderGate()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(verifyAccessKey).not.toHaveBeenCalled()
    expect(screen.getByTestId('reason')).toHaveTextContent('misconfigured')
  })

  it('verifies a stored key exactly once under StrictMode and settles', async () => {
    const verification = deferred<VerifyResult>()
    vi.mocked(readStoredKey).mockReturnValue(STORED_KEY)
    vi.mocked(verifyAccessKey).mockReturnValue(verification.promise)

    renderGate({ strict: true })
    expect(verifyAccessKey).toHaveBeenCalledOnce()
    expect(screen.getByTestId('phase')).toHaveTextContent('checking')

    await act(async () => {
      verification.resolve({ status: 'valid' })
      await verification.promise
    })

    expect(verifyAccessKey).toHaveBeenCalledOnce()
    expect(screen.getByTestId('phase')).toHaveTextContent('granted')
  })

  it('discards an older verification result that resolves last', async () => {
    const firstVerification = deferred<VerifyResult>()
    const secondVerification = deferred<VerifyResult>()
    vi.mocked(verifyAccessKey)
      .mockReturnValueOnce(firstVerification.promise)
      .mockReturnValueOnce(secondVerification.promise)
    renderGate()

    if (!latestContext) {
      throw new Error('Probe did not receive the access-gate context')
    }
    const context = latestContext
    act(() => {
      context.submitKey('first-key')
      context.submitKey('second-key')
    })
    expect(verifyAccessKey).toHaveBeenNthCalledWith(1, 'FIRST-KEY')
    expect(verifyAccessKey).toHaveBeenNthCalledWith(2, 'SECOND-KEY')

    await act(async () => {
      secondVerification.resolve({ status: 'invalid' })
      await secondVerification.promise
    })
    expect(screen.getByTestId('reason')).toHaveTextContent('invalid')

    await act(async () => {
      firstVerification.resolve({ status: 'valid' })
      await firstVerification.promise
    })
    expect(screen.getByTestId('phase')).toHaveTextContent('gated')
    expect(screen.getByTestId('reason')).toHaveTextContent('invalid')
    expect(storeKey).not.toHaveBeenCalled()
  })

  it('rejects an empty normalized submission without verifying', () => {
    renderGate({ submitValue: '  \t\n  ' })

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(screen.getByTestId('reason')).toHaveTextContent('invalid')
    expect(verifyAccessKey).not.toHaveBeenCalled()
  })

  it('throws a clear error when the hook is used outside its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => render(<Probe />)).toThrow(
      'useAccessGate must be used within an AccessGateProvider',
    )
  })
})
