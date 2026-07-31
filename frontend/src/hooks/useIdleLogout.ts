import { useCallback, useEffect, useRef, useState } from 'react'

import { authClient } from '@/lib/auth-client'
import { forceSignOut } from '@/lib/session'

const IDLE_LIMIT_MS = 60 * 60 * 1000
const WARNING_AT_MS = 55 * 60 * 1000
const TICK_MS = 30 * 1000
const ACTIVITY_WRITE_THROTTLE_MS = 30 * 1000
const SESSION_REFRESH_THROTTLE_MS = 5 * 60 * 1000

export const IDLE_ACTIVITY_KEY = 'helpdesk:last-activity'

function storedActivity(): number {
  const value = Number(localStorage.getItem(IDLE_ACTIVITY_KEY))
  return Number.isFinite(value) ? value : 0
}

function writeActivity(timestamp: number) {
  localStorage.setItem(IDLE_ACTIVITY_KEY, String(timestamp))
}

export function useIdleLogout() {
  const initialActivity = Math.max(Date.now(), storedActivity())
  const lastActivityRef = useRef(initialActivity)
  const lastStoredWriteRef = useRef(0)
  const lastSessionRefreshRef = useRef(0)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  const evaluateIdle = useCallback(() => {
    const lastActivity = Math.max(lastActivityRef.current, storedActivity())
    lastActivityRef.current = lastActivity
    const elapsed = Date.now() - lastActivity

    if (elapsed >= IDLE_LIMIT_MS) {
      setRemainingSeconds(null)
      void forceSignOut()
      return
    }

    setRemainingSeconds(
      elapsed >= WARNING_AT_MS
        ? Math.max(0, Math.ceil((IDLE_LIMIT_MS - elapsed) / 1000))
        : null,
    )
  }, [])

  const recordActivity = useCallback((refreshSession: boolean) => {
    const now = Date.now()
    lastActivityRef.current = now
    setRemainingSeconds(null)

    if (now - lastStoredWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
      writeActivity(now)
      lastStoredWriteRef.current = now
    }

    if (
      refreshSession &&
      now - lastSessionRefreshRef.current >= SESSION_REFRESH_THROTTLE_MS
    ) {
      lastSessionRefreshRef.current = now
      void authClient.getSession().catch(() => {})
    }
  }, [])

  const staySignedIn = useCallback(async () => {
    await authClient.getSession()
    const now = Date.now()
    lastSessionRefreshRef.current = now
    lastActivityRef.current = now
    writeActivity(now)
    lastStoredWriteRef.current = now
    setRemainingSeconds(null)
  }, [])

  useEffect(() => {
    const onActivity = () => recordActivity(true)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recordActivity(true)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== IDLE_ACTIVITY_KEY) return
      const timestamp = Number(event.newValue)
      if (Number.isFinite(timestamp)) {
        lastActivityRef.current = Math.max(lastActivityRef.current, timestamp)
        evaluateIdle()
      }
    }

    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('scroll', onActivity)
    window.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('storage', onStorage)

    // One 30s tick avoids per-event timers; warning/logout may therefore fire up to 30s late.
    const interval = window.setInterval(evaluateIdle, TICK_MS)

    return () => {
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('scroll', onActivity)
      window.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('storage', onStorage)
      window.clearInterval(interval)
      lastStoredWriteRef.current = 0
      lastSessionRefreshRef.current = 0
    }
  }, [evaluateIdle, recordActivity])

  return {
    showWarning: remainingSeconds !== null,
    remainingSeconds: remainingSeconds ?? 0,
    staySignedIn,
  }
}
