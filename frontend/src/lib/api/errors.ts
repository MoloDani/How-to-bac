import { ApiError } from './client'

/** Backend error codes -> translation keys (see src/lib/i18n/locales). */
const KEYS: Record<string, string> = {
  invalid_credentials: 'errors.invalidCredentials',
  email_not_verified: 'errors.emailNotVerified',
  invalid_or_expired_token: 'errors.invalidToken',
  invalid_refresh_token: 'errors.sessionExpired',
  token_expired: 'errors.sessionExpired',
  invalid_token: 'errors.sessionExpired',
  missing_token: 'errors.sessionExpired',
  validation_failed: 'errors.validation',
  subjects_managed_by_admin: 'errors.subjectsManagedByAdmin',
  insufficient_role: 'errors.insufficientRole',
  user_not_found: 'errors.userNotFound',
  // Friends (used once those screens land)
  friend_code_not_found: 'errors.friendCodeNotFound',
  cannot_friend_self: 'errors.cannotFriendSelf',
  already_friends: 'errors.alreadyFriends',
  request_already_sent: 'errors.requestAlreadySent',
  user_blocked: 'errors.userBlocked',
}

/** A translation key for any thrown error, so screens never show a raw code. */
export function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.network'
  if (error.status === 429) return 'errors.tooManyRequests'
  return KEYS[error.code] ?? 'errors.unexpected'
}
