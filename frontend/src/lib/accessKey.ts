export const ACCESS_KEY_STORAGE_KEY = 'dailyplate.accessKey'

export const VERIFY_URL =
  'https://bwjxapgpjhlxpkvvysxf.supabase.co/functions/v1/verify-access-key'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let cachedProjectId: string | undefined

export type VerifyResult =
  | { status: 'valid' }
  | { status: 'invalid' }
  | { status: 'rate-limited'; retryAfterSeconds: number }
  | { status: 'unavailable' }

export function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase()
}

export function readProjectId(): string {
  if (cachedProjectId) {
    return cachedProjectId
  }

  const projectId = import.meta.env.VITE_ACCESS_PROJECT_ID

  if (!projectId || !UUID_PATTERN.test(projectId)) {
    throw new Error(
      'VITE_ACCESS_PROJECT_ID must be set to a valid UUID; posting undefined as project would reject every key.',
    )
  }

  cachedProjectId = projectId
  return projectId
}

export function __resetProjectIdCache(): void {
  cachedProjectId = undefined
}

export function readStoredKey(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY_STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeKey(key: string): boolean {
  try {
    localStorage.setItem(ACCESS_KEY_STORAGE_KEY, key)
    return true
  } catch {
    return false
  }
}

export function clearStoredKey(): boolean {
  try {
    localStorage.removeItem(ACCESS_KEY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function parseRetryAfter(header: string | null): number {
  if (!header?.trim()) {
    return 60
  }

  const value = header.trim()

  if (/^[+-]?\d+$/.test(value)) {
    const seconds = Number(value)
    return Number.isFinite(seconds) ? Math.max(0, seconds) : 60
  }

  const retryAt = Date.parse(value)
  if (Number.isNaN(retryAt)) {
    return 60
  }

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
}

export async function verifyAccessKey(key: string): Promise<VerifyResult> {
  const projectId = readProjectId()
  let response: Response

  try {
    response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: normalizeKey(key), project: projectId }),
      credentials: 'omit',
    })
  } catch {
    return { status: 'unavailable' }
  }

  if (response.status === 429) {
    return {
      status: 'rate-limited',
      retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
    }
  }

  if (response.status === 400 || response.status === 405) {
    console.error('Access-key verifier client/protocol error')
    return { status: 'unavailable' }
  }

  if (response.status !== 200) {
    return { status: 'unavailable' }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { status: 'unavailable' }
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { status: 'unavailable' }
  }

  const valid = (body as { valid?: unknown }).valid
  if (valid === true) {
    return { status: 'valid' }
  }
  if (valid === false) {
    return { status: 'invalid' }
  }

  return { status: 'unavailable' }
}
