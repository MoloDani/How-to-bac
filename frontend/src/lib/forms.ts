import { z } from 'zod'

/**
 * Shared field rules, matching the backend's zod schemas. Messages are
 * translation keys, rendered with `t(error.message)`.
 */
export const emailField = z.email('errors.emailInvalid').max(255)
export const passwordField = z
  .string()
  .min(8, 'errors.passwordTooShort')
  .max(200)
export const currentPasswordField = z.string().min(1, 'errors.required')
export const userNameField = z
  .string()
  .trim()
  .min(1, 'errors.required')
  .max(64, 'errors.nameTooLong')
