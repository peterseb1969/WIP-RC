import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// RC is served at the root of its own origin (https://rc.<host>/), so
// Vite keeps its default base '/'.

export default defineConfig({
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
    // Regex keys anchored to a whole path segment: a plain string key is a
    // prefix match, so `/api` would also proxy the SPA route
    // /api-keys to Express (which has no such route) instead of serving it.
    proxy: Object.fromEntries(
      ['wip', 'api', 'health', 'auth'].map(seg => [
        `^/${seg}(?:/|\\?|$)`,
        'http://localhost:3011',
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Playwright end-to-end specs run separately (npm run test:e2e).
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    css: true,
  },
})
