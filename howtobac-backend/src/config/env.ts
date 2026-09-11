import { z } from 'zod';

// Blank lines in .env (`KEY=`) arrive as '' — treat them as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    /** Number of reverse-proxy hops in front of the API (0 = exposed directly). */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    DATABASE_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+(s|m|h|d)$/, 'use a duration like 15m or 1h')
      .default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),

    /** Empty in development = log email links instead of sending them. */
    RESEND_API_KEY: optional(z.string()),
    MAIL_FROM: z.string().min(1),
    APP_BASE_URL: z.url().transform((url) => url.replace(/\/+$/, '')),

    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((list) =>
        list
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    COOKIE_SECURE: optional(z.enum(['true', 'false'])),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

    /** Telemetry keys from https://observe.nestjs.com. Both empty = off. */
    OBSERVE_APP_KEY: optional(z.string()),
    OBSERVE_APP_SECRET: optional(z.string()),
  })
  .transform(({ COOKIE_SECURE, ...env }) => ({
    ...env,
    COOKIE_SECURE:
      COOKIE_SECURE === undefined
        ? env.NODE_ENV === 'production'
        : COOKIE_SECURE === 'true',
  }))
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'required in production',
      });
    }
    if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'browsers reject SameSite=None cookies without Secure',
      });
    }
    if (Boolean(env.OBSERVE_APP_KEY) !== Boolean(env.OBSERVE_APP_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['OBSERVE_APP_SECRET'],
        message: 'set both OBSERVE_APP_KEY and OBSERVE_APP_SECRET, or neither',
      });
    }
  });

export type Env = z.output<typeof envSchema>;

/** Passed to ConfigModule.forRoot({ validate }) — the app refuses to boot on bad config. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
