import { api, refreshSession, setAccessToken } from '#/lib/api/client'
import type { PublicUser } from '#/lib/api/types'

let user: PublicUser | null = null
let loaded = false
let inFlight: Promise<PublicUser | null> | null = null
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())

/**
 * Who is signed in. Lives outside React so route guards (`beforeLoad`) can use
 * it, with `useSession()` for components.
 */
export const session = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  snapshot: () => user,

  set(next: PublicUser | null) {
    user = next
    loaded = true
    emit()
  },

  /** Restores the session from the refresh cookie once, then reuses the result. */
  ensureLoaded(): Promise<PublicUser | null> {
    if (loaded) return Promise.resolve(user)
    inFlight ??= restore().finally(() => {
      inFlight = null
    })
    return inFlight
  },

  async signOut() {
    await api.post('/auth/logout').catch(() => undefined)
    setAccessToken(null)
    session.set(null)
  },
}

async function restore(): Promise<PublicUser | null> {
  const refreshed = await refreshSession()
  const next = refreshed
    ? await api.get<PublicUser>('/me').catch(() => null)
    : null
  session.set(next)
  return next
}
