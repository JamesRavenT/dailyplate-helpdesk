import { authClient } from './auth-client'
import { queryClient } from './queryClient'

let signOutPromise: Promise<void> | null = null

/**
 * Ends the browser session exactly once. The first caller owns the redirect,
 * which prevents a manual sign-out and a failing status update from racing.
 */
export function endSession(redirectTo: string): Promise<void> {
  if (!signOutPromise) {
    signOutPromise = (async () => {
      try {
        await authClient.signOut()
      } catch {
        // A dead server session must not prevent local cleanup and redirection.
      }
      queryClient.clear()
      window.location.replace(redirectTo)
    })()
  }

  return signOutPromise
}

export function forceSignOut(): Promise<void> {
  return endSession('/login?expired=1')
}
