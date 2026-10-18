import { defineConfig } from '@playwright/test'
import { E2E } from './tests/e2e/support/env'

// End-to-end tests against a running WIP install (default: wip-local through
// its router). Run with `npm run test:e2e`. Serial on purpose: the specs share
// one disposable namespace, and later specs read what earlier ones created.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results/e2e/artifacts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/e2e/report' }]],
  use: {
    baseURL: E2E.baseURL,
    channel: 'chrome',
    ignoreHTTPSErrors: true,
    storageState: E2E.stateFile,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1400, height: 900 },
    actionTimeout: 15_000,
  },
})
