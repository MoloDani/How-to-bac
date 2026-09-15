import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development the browser only talks to this server, which forwards /v1 to
// the API. Same origin, so the refresh cookie works and CORS isn't involved.
const apiTarget =
  process.env.VITE_DEV_API_TARGET ?? 'https://bac-api.moloserver.ro'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    port: 3000,
    proxy: {
      '/v1': { target: apiTarget, changeOrigin: true, secure: true },
    },
  },
  plugins: [
    devtools(),
    tailwindcss(),
    // SPA mode: the build prerenders a shell the static host serves for every
    // path, so deep links like /verify?token=… work without a Node server.
    tanstackStart({
      spa: { enabled: true, prerender: { outputPath: '/index' } },
    }),
    viteReact(),
  ],
})

export default config
