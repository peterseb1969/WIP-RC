import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // VITE_BASE_PATH sets the public base path for production builds.
  // E.g. VITE_BASE_PATH=/apps/rc/ → assets load from /apps/rc/assets/...
  // In dev mode (no VITE_BASE_PATH), defaults to '/' — no prefix.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/wip': 'http://localhost:3011',
      '/api': 'http://localhost:3011',
      '/health': 'http://localhost:3011',
      '/auth': 'http://localhost:3011',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: true,
  },
})
