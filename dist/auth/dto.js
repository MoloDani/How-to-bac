import { z } from 'zod';
export const emailField = z.string().email().max(255);
export const passwordField = z.string().min(8).max(200);
export const registerBodyDto = z.object({
    email: emailField,
    password: passwordField,
    displayName: z.string().min(1).max(96).optional(),
});
export const loginBodyDto = z.object({
    email: emailField,
    password: z.string().min(1).max(200),
});
export const refreshBodyDto = z.object({ refresh: z.string().min(1) });
export const tokenBodyDto = z.object({ token: z.string().min(1) });
export const forgotBodyDto = z.object({ email: emailField });
export const resetBodyDto = z.object({ token: z.string().min(1), password: passwordField });
