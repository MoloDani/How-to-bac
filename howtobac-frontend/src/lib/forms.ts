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

/**
 * What people type into a tag box, turned into a tag: "@Andrei_M " -> "andrei_m".
 * Applied as they type, so the field always shows what would be sent.
 */
export const normalizeTag = (value: string) =>
  value.trim().replace(/^@+/, '').toLowerCase()

/** Mirrors tagSchema in the backend's src/users/user-tag.ts. */
export const tagField = z
  .string()
  .min(3, 'errors.tagTooShort')
  .max(32, 'errors.tagTooLong')
  .regex(/^[a-z0-9](?:[._]?[a-z0-9]+)*$/, 'errors.tagInvalid')

/** True for a tag worth asking the API about. */
export const isTagShaped = (value: string) => tagField.safeParse(value).success
