import { queryOptions } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '#/lib/api/client'
import { isTagShaped } from '#/lib/forms'

/** Public: answers `false` for tags that are taken, reserved or malformed. */
export const tagAvailableQuery = (tag: string) =>
  queryOptions({
    queryKey: ['tag-available', tag],
    queryFn: () =>
      api.get<{ available: boolean }>(
        `/auth/tag-available?tag=${encodeURIComponent(tag)}`,
      ),
    enabled: isTagShaped(tag),
    staleTime: 60_000,
    retry: false,
  })

/** Waits for a pause in typing, so one check per tag rather than per keystroke. */
export function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])

  return debounced
}
