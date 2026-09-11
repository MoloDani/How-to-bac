import { z } from 'zod';
import { userSubjectListSchema } from '../common/subjects.js';

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
  subjects: userSubjectListSchema.default([]),
});
export type RegisterDto = z.output<typeof registerSchema>;

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
