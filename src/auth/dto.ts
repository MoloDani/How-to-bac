import { z } from 'zod'

export const emailField = z.string().email().max(255)
export const passwordField = z.string().min(8).max(200)

export const registerBodyDto = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().min(1).max(96).optional(),
})

export const loginBodyDto = z.object({
  email: emailField,
  password: z.string().min(1).max(200),
})

export const refreshBodyDto = z.object({ refresh: z.string().min(1) })
export const tokenBodyDto = z.object({ token: z.string().min(1) })
export const forgotBodyDto = z.object({ email: emailField })
export const resetBodyDto = z.object({ token: z.string().min(1), password: passwordField })

export type RegisterBodyDto = z.infer<typeof registerBodyDto>
export type LoginBodyDto = z.infer<typeof loginBodyDto>
export type RefreshBodyDto = z.infer<typeof refreshBodyDto>
export type TokenBodyDto = z.infer<typeof tokenBodyDto>
export type ForgotBodyDto = z.infer<typeof forgotBodyDto>
export type ResetBodyDto = z.infer<typeof resetBodyDto>
