import { z } from 'zod';
import { userSubjectListSchema } from '../common/subjects.js';
import { tagSchema } from '../users/user-tag.js';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(255));

export const passwordSchema = z.string().min(8).max(200);

export const userNameSchema = z.string().trim().min(1).max(64);

const tokenSchema = z.string().min(1).max(512);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  userName: userNameSchema,
  tag: tagSchema,
  subjects: userSubjectListSchema.default([]),
});
export type RegisterDto = z.output<typeof registerSchema>;

/** Query for the sign-up form's live "is this tag free?" check. */
export const tagAvailableQuerySchema = z.object({ tag: z.string().max(64) });
export type TagAvailableQuery = z.output<typeof tagAvailableQuerySchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginDto = z.output<typeof loginSchema>;

export const emailOnlySchema = z.object({ email: emailSchema });
export type EmailOnlyDto = z.output<typeof emailOnlySchema>;

export const tokenOnlySchema = z.object({ token: tokenSchema });
export type TokenOnlyDto = z.output<typeof tokenOnlySchema>;

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});
export type ResetPasswordDto = z.output<typeof resetPasswordSchema>;
