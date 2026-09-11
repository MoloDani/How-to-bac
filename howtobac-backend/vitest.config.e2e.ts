import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Wipes TEST_DATABASE_URL and applies migrations once per run.
    globalSetup: ['./test/global-setup.ts'],
    // Specs share one database.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      JWT_ACCESS_SECRET: 'e2e-only-secret-that-is-at-least-32-characters',
      RESEND_API_KEY: '',
      MAIL_FROM: 'How to Bac <test@example.com>',
      APP_BASE_URL: 'http://localhost:5173',
      CORS_ORIGINS: '',
      COOKIE_SECURE: 'false',
      COOKIE_SAMESITE: 'lax',
    },
  },
});
