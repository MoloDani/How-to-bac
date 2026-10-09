import { api, setAccessToken } from '#/lib/api/client'

/**
 * Ends every other session. The reply carries a fresh access token for this
 * tab, so changing the password doesn't sign you out of the page you're on.
 */
export const changePassword = async (body: {
  currentPassword: string
  newPassword: string
}) => {
  const { accessToken } = await api.post<{ accessToken: string }>(
    '/me/password',
    body,
  )
  setAccessToken(accessToken)
}

/** Nothing moves until the new address confirms, so this only sends the email. */
export const requestEmailChange = (body: {
  currentPassword: string
  newEmail: string
}) => api.post<{ ok: true }>('/me/email', body)

export const confirmEmailChange = (token: string) =>
  api.post<{ ok: true }>('/auth/confirm-email-change', { token })

export const deleteAccount = (currentPassword: string) =>
  api.remove<void>('/me', { currentPassword })
