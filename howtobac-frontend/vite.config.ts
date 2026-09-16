import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ mode }) => {
  // .env files aren't loaded into process.env here, so read them explicitly.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    resolve: { tsconfigPaths: true },

    server: {
      port: 3000,
      proxy: {
        // In development the browser only talks to this server, which forwards
        // /v1 onwards — same origin, so the refresh cookie works and CORS isn't
        // involved. In production the reverse proxy does the same job.
        // Set VITE_DEV_API_TARGET=http://192.168.3.109:3000 to skip Cloudflare,
        // or http://127.0.0.1:3000 for an API running on this machine.
        '/v1': {
          target: env.VITE_DEV_API_TARGET || 'https://howtobac.ro',
          changeOrigin: true,
          secure: true,
        },
      },
    },

    plugins: [
      devtools(),
      tailwindcss(),
      // SPA mode: the build prerenders a shell, and scripts/write-spa-paths.mjs
      // copies it to every static route so a plain static host serves them.
      tanstackStart({
        spa: { enabled: true, prerender: { outputPath: '/index' } },
      }),
      viteReact(),
    ],
  }
})

export default config
