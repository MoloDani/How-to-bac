import { useSyncExternalStore } from 'react'
import { session } from './session'

/** The signed-in user, or null. Re-renders when the session changes. */
export const useSession = () =>
  useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot)
