import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  clearStoredKey,
  normalizeKey,
  readProjectId,
  readStoredKey,
  storeKey,
  verifyAccessKey,
} from '../lib/accessKey'

type AccessGatePhase = 'checking' | 'gated' | 'granted'
type AccessGateReason =
  | 'none'
  | 'expired'
  | 'invalid'
  | 'unavailable'
  | 'rate-limited'
  | 'misconfigured'

type Candidate = {
  key: string
  origin: 'stored' | 'typed'
}

type AccessGateState = {
  phase: AccessGatePhase
  reason: AccessGateReason
  retryAfterSeconds: number
  isVerifying: boolean
}

export type AccessGateContextValue = AccessGateState & {
  submitKey: (raw: string) => void
  retry: () => void
}

const AccessGateContext = createContext<AccessGateContextValue | undefined>(
  undefined,
)

const initialState: AccessGateState = {
  phase: 'checking',
  reason: 'none',
  retryAfterSeconds: 0,
  isVerifying: false,
}

export function AccessGateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessGateState>(initialState)
  const initializedRef = useRef(false)
  const generationRef = useRef(0)
  const candidateRef = useRef<Candidate | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const verify = useCallback(async (candidate: Candidate) => {
    candidateRef.current = candidate
    const generation = ++generationRef.current
    setState(current => ({ ...current, isVerifying: true }))

    try {
      const result = await verifyAccessKey(candidate.key)

      if (generation !== generationRef.current) {
        return
      }

      if (result.status === 'valid') {
        storeKey(candidate.key)
        setState(current => ({
          ...current,
          phase: 'granted',
          reason: 'none',
          retryAfterSeconds: 0,
        }))
      } else if (result.status === 'invalid') {
        if (candidate.origin === 'stored') {
          clearStoredKey()
        }
        setState(current => ({
          ...current,
          phase: 'gated',
          reason: candidate.origin === 'stored' ? 'expired' : 'invalid',
          retryAfterSeconds: 0,
        }))
      } else if (result.status === 'rate-limited') {
        setState(current => ({
          ...current,
          phase: 'gated',
          reason: 'rate-limited',
          retryAfterSeconds: result.retryAfterSeconds,
        }))
      } else {
        setState(current => ({
          ...current,
          phase: 'gated',
          reason: 'unavailable',
          retryAfterSeconds: 0,
        }))
      }
    } catch (error) {
      if (generation !== generationRef.current) {
        return
      }
      console.error('Access gate is misconfigured', error)
      setState(current => ({
        ...current,
        phase: 'gated',
        reason: 'misconfigured',
        retryAfterSeconds: 0,
      }))
    } finally {
      if (generation === generationRef.current) {
        setState(current => ({ ...current, isVerifying: false }))
      }
    }
  }, [])

  useEffect(() => {
    if (initializedRef.current) {
      return
    }
    initializedRef.current = true

    try {
      readProjectId()
    } catch (error) {
      console.error('Access gate is misconfigured', error)
      setState({
        phase: 'gated',
        reason: 'misconfigured',
        retryAfterSeconds: 0,
        isVerifying: false,
      })
      return
    }

    const storedKey = readStoredKey()
    if (storedKey === null) {
      setState({
        phase: 'gated',
        reason: 'none',
        retryAfterSeconds: 0,
        isVerifying: false,
      })
      return
    }

    void verify({ key: storedKey, origin: 'stored' })
  }, [verify])

  useEffect(() => {
    if (state.reason !== 'rate-limited') {
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      return
    }

    if (state.retryAfterSeconds === 0) {
      setState(current => ({ ...current, reason: 'none' }))
      return
    }

    if (countdownRef.current !== null) {
      return
    }

    countdownRef.current = setInterval(() => {
      setState(current => {
        if (current.reason !== 'rate-limited') {
          return current
        }

        const retryAfterSeconds = Math.max(
          0,
          current.retryAfterSeconds - 1,
        )
        return {
          ...current,
          reason: retryAfterSeconds === 0 ? 'none' : 'rate-limited',
          retryAfterSeconds,
        }
      })
    }, 1000)

    return () => {
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [state.reason])

  const submitKey = useCallback(
    (raw: string) => {
      if (
        state.isVerifying ||
        state.reason === 'misconfigured' ||
        (state.reason === 'rate-limited' && state.retryAfterSeconds > 0)
      ) {
        return
      }

      const key = normalizeKey(raw)
      if (!key) {
        setState(current => ({
          ...current,
          phase: 'gated',
          reason: 'invalid',
          retryAfterSeconds: 0,
        }))
        return
      }

      void verify({ key, origin: 'typed' })
    },
    [state.isVerifying, state.reason, state.retryAfterSeconds, verify],
  )

  const retry = useCallback(() => {
    if (
      state.isVerifying ||
      state.reason === 'misconfigured' ||
      (state.reason === 'rate-limited' && state.retryAfterSeconds > 0)
    ) {
      return
    }

    if (candidateRef.current) {
      void verify(candidateRef.current)
      return
    }

    setState({
      phase: 'gated',
      reason: 'none',
      retryAfterSeconds: 0,
      isVerifying: false,
    })
  }, [state.isVerifying, state.reason, state.retryAfterSeconds, verify])

  const value = useMemo<AccessGateContextValue>(
    () => ({ ...state, submitKey, retry }),
    [retry, state, submitKey],
  )

  return (
    <AccessGateContext.Provider value={value}>
      {children}
    </AccessGateContext.Provider>
  )
}

export function useAccessGate(): AccessGateContextValue {
  const context = useContext(AccessGateContext)

  if (!context) {
    throw new Error('useAccessGate must be used within an AccessGateProvider')
  }

  return context
}
