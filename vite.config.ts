import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Base path for the deployed app (e.g. /apps/rc/) when behind a router
// that doesn't strip the prefix (CASE-38 Option 2). Used for Vite's
// public `base` and for API proxy prefix matching.
//
// Resolution order:
//   1. VITE_BASE_PATH — explicit, used by prod build (Dockerfile ARG).
//   2. APP_BASE_PATH — the server-side base. Fallback for wip-deploy's
//      dev target, which sets APP_BASE_PATH but not VITE_BASE_PATH.
//   3. '/' — local dev default.
const RESOLVED_BASE = process.env.VITE_BASE_PATH || process.env.APP_BASE_PATH || '/'
const BASE_WITH_SLASH = RESOLVED_BASE.endsWith('/') ? RESOLVED_BASE : `${RESOLVED_BASE}/`
const BASE_PATH = RESOLVED_BASE.replace(/\/$/, '')

export default defineConfig({
  base: BASE_WITH_SLASH,
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
