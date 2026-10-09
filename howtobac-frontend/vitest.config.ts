import { fileURLToPath } from 'node:url'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Deliberately without the Start plugin: these are unit and component tests,
// not a running app. React is needed for the component ones.
export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: { '#': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // jsdom for the component tests; the plain unit tests don't mind it.
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    globals: true,
    restoreMocks: true,
  },
})
