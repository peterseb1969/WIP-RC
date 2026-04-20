import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// VITE_BASE_PATH sets the public base path (e.g. /apps/rc/ when deployed
// behind a router that doesn't strip the prefix — see CASE-38 Option 2).
// When set, API proxy prefixes must also include it, since Caddy forwards
// the full path.
const BASE_PATH = (process.env.VITE_BASE_PATH || '/').replace(/\/$/, '')

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // 0.0.0.0 lets Vite accept connections from outside the container
    // (wip-deploy --target dev with --app-source). Harmless on host.
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      [`${BASE_PATH}/wip`]: 'http://localhost:3011',
      [`${BASE_PATH}/api`]: 'http://localhost:3011',
      [`${BASE_PATH}/health`]: 'http://localhost:3011',
      [`${BASE_PATH}/auth`]: 'http://localhost:3011',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: true,
  },
})
