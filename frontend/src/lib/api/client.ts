// Relative by default, so the app calls whichever host it was opened on
// (apex or www) and never trips over CORS. `||` not `??`: an empty
// VITE_API_URL should fall back too.
const BASE_URL = import.meta.env.VITE_API_URL || '/v1'

/**
 * Kept in memory only. In localStorage any script on the page could read it;
 * the long-lived refresh token stays in an httpOnly cookie the app never sees.
 */
let accessToken: string | null = null

export const setAccessToken = (token: string | null) => {
  accessToken = token
}
export const getAccessToken = () => accessToken

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** The backend's machine-readable code, e.g. `invalid_credentials`. */
    readonly code: string,
    /** Field messages, when the code is `validation_failed`. */
    readonly fields: Array<string> = [],
  ) {
    super(`${status} ${code}`)
    this.name = 'ApiError'
  }
}

type Body = Record<string, unknown> | undefined

function rawFetch(path: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    // Sends and stores the refresh cookie, including across our subdomains.
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
}

let refreshing: Promise<boolean> | null = null

/** One refresh at a time: parallel callers all wait for the same request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= rawFetch('/auth/refresh', { method: 'POST' })
    .then(async (res) => {
      if (!res.ok) {
        accessToken = null
        return false
      }
      const data = (await res.json()) as { accessToken: string }
      accessToken = data.accessToken
      return true
    })
    .catch(() => {
      accessToken = null
      return false
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string | Array<string>
  }
  if (Array.isArray(body.message)) {
    return new ApiError(res.status, 'validation_failed', body.message)
  }
  return new ApiError(res.status, body.message ?? `http_${res.status}`)
}

async function request<T>(
  method: string,
  path: string,
  body?: Body,
  retry = true,
): Promise<T> {
  const res = await rawFetch(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  // Access tokens last 15 minutes: refresh once, then try the request again.
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return request<T>(method, path, body, false)
  }

  if (!res.ok) throw await toApiError(res)
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: Body) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: Body) => request<T>('PUT', path, body),
  remove: <T>(path: string) => request<T>('DELETE', path),
}
