// src/env.ts
import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1),
  MAIL_FROM: z.string().min(1),      // e.g. "How to Bac <noreply@moloserver.ro>"
  APP_BASE_URL: z.string().url(),    // frontend origin, used in email links
  PORT: z.coerce.number().default(7500),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
