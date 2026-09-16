import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, getAccessToken, setAccessToken } from './client'
import { errorKey } from './errors'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('api client', () => {
  beforeEach(() => {
    setAccessToken(null)
    vi.restoreAllMocks()
  })

  it('refreshes once for several parallel 401s, then retries them', async () => {
    const calls: Array<string> = []
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input)
        calls.push(`${init?.method ?? 'GET'} ${path}`)
        if (path.endsWith('/auth/refresh')) {
          return json(200, { accessToken: 'fresh-token' })
        }
        return getAccessToken() === 'fresh-token'
          ? json(200, { ok: path })
          : json(401, { message: 'token_expired' })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all([
      api.get<{ ok: string }>('/me'),
      api.get<{ ok: string }>('/friends'),
    ])

    expect(
      results.map((r) => r.ok.endsWith('/me') || r.ok.endsWith('/friends')),
    ).toEqual([true, true])
    expect(calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1)
    expect(getAccessToken()).toBe('fresh-token')
  })

  it('gives up and clears the token when the refresh fails', async () => {
    setAccessToken('stale-token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/auth/refresh')
          ? json(401, { message: 'invalid_refresh_token' })
          : json(401, { message: 'token_expired' }),
      ),
    )

    await expect(api.get('/me')).rejects.toBeInstanceOf(ApiError)
    expect(getAccessToken()).toBeNull()
  })

  it('never retries the auth routes themselves', async () => {
    const fetchMock = vi.fn(async () =>
      json(401, { message: 'invalid_credentials' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      api.post('/auth/login', { email: 'a@b.co', password: 'nope' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('turns field errors into a validation code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(400, { message: ['email: Invalid email address'] }),
      ),
    )

    const error = await api.post('/auth/register', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('validation_failed')
    expect((error as ApiError).fields).toHaveLength(1)
  })

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )
    await expect(api.remove('/friends/someone')).resolves.toBeUndefined()
  })
})

describe('errorKey', () => {
  it.each([
    [new ApiError(401, 'invalid_credentials'), 'errors.invalidCredentials'],
    [new ApiError(403, 'email_not_verified'), 'errors.emailNotVerified'],
    [new ApiError(429, 'anything'), 'errors.tooManyRequests'],
    [new ApiError(500, 'boom'), 'errors.unexpected'],
    [new TypeError('offline'), 'errors.network'],
  ])('%s -> %s', (error, key) => {
    expect(errorKey(error)).toBe(key)
  })
})
