import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Deliberately without the Start/React plugins: these are plain unit tests.
export default defineConfig({
  resolve: {
    alias: { '#': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
