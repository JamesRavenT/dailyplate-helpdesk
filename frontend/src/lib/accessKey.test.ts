import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ACCESS_KEY_STORAGE_KEY,
  VERIFY_URL,
  __resetProjectIdCache,
  clearStoredKey,
  normalizeKey,
  readProjectId,
  readStoredKey,
  storeKey,
  verifyAccessKey,
} from './accessKey'

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000'

function stubResponse(status: number, body?: unknown, retryAfter?: string) {
  const responseBody = body === undefined ? null : JSON.stringify(body)
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(responseBody, {
        status,
        headers: retryAfter ? { 'Retry-After': retryAfter } : undefined,
      }),
    ),
  )
}

describe('access-key utility', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ACCESS_PROJECT_ID', PROJECT_ID)
    __resetProjectIdCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    __resetProjectIdCache()
  })

  it('trims and uppercases a key', () => {
    expect(normalizeKey('  aBc-123-xYz\t')).toBe('ABC-123-XYZ')
  })

  describe('readProjectId', () => {
    it('accepts a valid UUID', () => {
      expect(readProjectId()).toBe(PROJECT_ID)
    })

    it.each([
      ['unset', undefined],
      ['empty', ''],
      ['not a UUID', 'project-one'],
    ])('throws when the value is %s', (_description, value) => {
      vi.stubEnv('VITE_ACCESS_PROJECT_ID', value)

      expect(() => readProjectId()).toThrow(/VITE_ACCESS_PROJECT_ID/)
    })
  })

  it('sends the normalized key and project using the required request shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ valid: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await verifyAccessKey('  mixed-Case-key  ')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(options.headers)
    expect(url).toBe(VERIFY_URL)
    expect(options.method).toBe('POST')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.has('Authorization')).toBe(false)
    expect(options.body).toBe(
      JSON.stringify({ key: 'MIXED-CASE-KEY', project: PROJECT_ID }),
    )
    expect(options.credentials).toBe('omit')
  })

  describe('response mapping', () => {
    it.each([
      ['a true boolean', { valid: true }, { status: 'valid' }],
      ['a false boolean', { valid: false }, { status: 'invalid' }],
      ['a missing valid property', {}, { status: 'unavailable' }],
      ['a string valid property', { valid: 'true' }, { status: 'unavailable' }],
      ['a numeric valid property', { valid: 1 }, { status: 'unavailable' }],
      ['a null body', null, { status: 'unavailable' }],
      ['an array body', [{ valid: true }], { status: 'unavailable' }],
    ])('maps 200 with %s', async (_description, body, expected) => {
      stubResponse(200, body)

      await expect(verifyAccessKey('KEY')).resolves.toEqual(expected)
    })

    it('maps invalid JSON on 200 to unavailable', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{invalid', { status: 200 })),
      )

      await expect(verifyAccessKey('KEY')).resolves.toEqual({
        status: 'unavailable',
      })
    })

    it('maps status 400 to invalid without logging an error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      stubResponse(400)

      await expect(verifyAccessKey('KEY')).resolves.toEqual({
        status: 'invalid',
      })
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it.each([405, 500, 503])(
      'maps status %s to unavailable',
      async status => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined)
        stubResponse(status)

        await expect(verifyAccessKey('KEY')).resolves.toEqual({
          status: 'unavailable',
        })
      },
    )

    it('maps a fetch rejection to unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      await expect(verifyAccessKey('KEY')).resolves.toEqual({
        status: 'unavailable',
      })
    })
  })

  describe('rate limiting', () => {
    it.each([
      ['integer seconds', '30', 30],
      ['a missing header', undefined, 60],
      ['a past HTTP-date', new Date(Date.now() - 60_000).toUTCString(), 0],
      ['an unparseable header', 'eventually', 60],
    ])('parses %s', async (_description, header, expected) => {
      stubResponse(429, undefined, header)

      await expect(verifyAccessKey('KEY')).resolves.toEqual({
        status: 'rate-limited',
        retryAfterSeconds: expected,
      })
    })

    it('rounds a future HTTP-date delta up to about two minutes', async () => {
      const retryAt = new Date(Date.now() + 120_000).toUTCString()
      stubResponse(429, undefined, retryAt)

      const result = await verifyAccessKey('KEY')
      expect(result.status).toBe('rate-limited')
      if (result.status === 'rate-limited') {
        expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(119)
        expect(result.retryAfterSeconds).toBeLessThanOrEqual(120)
      }
    })
  })

  describe('storage helpers', () => {
    it('stores, reads, and clears a key', () => {
      expect(storeKey('SAVED-KEY')).toBe(true)
      expect(readStoredKey()).toBe('SAVED-KEY')
      expect(clearStoredKey()).toBe(true)
      expect(readStoredKey()).toBeNull()
    })

    it('returns null when reading throws', () => {
      expect(storeKey('SAVED-KEY')).toBe(true)
      expect(readStoredKey()).toBe('SAVED-KEY')
      const getItem = vi.fn(() => {
        throw new Error('storage disabled')
      })
      vi.stubGlobal('localStorage', {
        clear: vi.fn(),
        getItem,
        key: vi.fn(() => null),
        length: 1,
        removeItem: vi.fn(),
        setItem: vi.fn(),
      })

      expect(readStoredKey()).toBeNull()
      expect(getItem).toHaveBeenCalledWith(ACCESS_KEY_STORAGE_KEY)
    })

    it('returns false when storing throws', () => {
      const setItem = vi.fn(() => {
        throw new Error('storage disabled')
      })
      vi.stubGlobal('localStorage', {
        clear: vi.fn(),
        getItem: vi.fn(() => null),
        key: vi.fn(() => null),
        length: 0,
        removeItem: vi.fn(),
        setItem,
      })

      expect(storeKey('SAVED-KEY')).toBe(false)
      expect(setItem).toHaveBeenCalledWith(ACCESS_KEY_STORAGE_KEY, 'SAVED-KEY')
    })

    it('returns false when clearing throws', () => {
      expect(storeKey('SAVED-KEY')).toBe(true)
      expect(readStoredKey()).toBe('SAVED-KEY')
      const removeItem = vi.fn(() => {
        throw new Error('storage disabled')
      })
      vi.stubGlobal('localStorage', {
        clear: vi.fn(),
        getItem: vi.fn(() => 'SAVED-KEY'),
        key: vi.fn(() => ACCESS_KEY_STORAGE_KEY),
        length: 1,
        removeItem,
        setItem: vi.fn(),
      })

      expect(clearStoredKey()).toBe(false)
      expect(removeItem).toHaveBeenCalledWith(ACCESS_KEY_STORAGE_KEY)
    })

    it('uses the documented storage key', () => {
      storeKey('SAVED-KEY')

      expect(localStorage.getItem(ACCESS_KEY_STORAGE_KEY)).toBe('SAVED-KEY')
    })
  })

  it('never logs key material for invalid-key and protocol-error responses', async () => {
    const key = 'NEVER-LOG-THIS-KEY'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    stubResponse(200, { valid: false })
    await verifyAccessKey(key)
    stubResponse(400)
    await verifyAccessKey(key)

    for (const spy of [errorSpy, warnSpy, logSpy]) {
      for (const call of spy.mock.calls) {
        expect(call.some(argument => String(argument).includes(key))).toBe(false)
      }
    }
  })
})
