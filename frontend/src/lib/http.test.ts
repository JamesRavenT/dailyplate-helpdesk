import type { AxiosError, AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rejected: undefined as ((error: AxiosError<{ error: string }>) => Promise<never>) | undefined,
  signOut: vi.fn(),
  clear: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    interceptors: {
      response: {
        use: vi.fn((_: (response: AxiosResponse) => AxiosResponse, rejected: typeof mocks.rejected) => {
          mocks.rejected = rejected
        }),
      },
    },
  },
}))

vi.mock('./auth-client', () => ({
  authClient: { signOut: mocks.signOut },
}))

vi.mock('./queryClient', () => ({
  queryClient: { clear: mocks.clear },
}))

function axiosError(status: number, error: string, url = '/api/tickets') {
  return {
    config: { url },
    response: { status, data: { error } },
  } as AxiosError<{ error: string }>
}

describe('global HTTP session handling', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.rejected = undefined
    mocks.signOut.mockResolvedValue(undefined)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, replace: mocks.replace },
    })
    await import('./http')
  })

  it('signs out and redirects for an Unauthorized 401', async () => {
    const error = axiosError(401, 'Unauthorized')

    await expect(mocks.rejected!(error)).rejects.toBe(error)

    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(mocks.replace).toHaveBeenCalledWith('/login?expired=1')
  })

  it('leaves an Incorrect password 401 untouched', async () => {
    const error = axiosError(401, 'Incorrect password', '/api/users/user-1')

    await expect(mocks.rejected!(error)).rejects.toBe(error)

    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('signs out and redirects when the account is locked', async () => {
    const error = axiosError(403, 'Account is locked')

    await expect(mocks.rejected!(error)).rejects.toBe(error)

    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(mocks.replace).toHaveBeenCalledWith('/login?expired=1')
  })
})
