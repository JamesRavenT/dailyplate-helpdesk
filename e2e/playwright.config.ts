import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { ADMIN_STATE } from './tests/fixtures/auth'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: [
    ['html'],
    ['allure-playwright', { resultsDir: 'allure-results', detail: true }],
  ],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /setup\/auth-setup\.ts/ },
    {
      name: 'chromium',
      testIgnore: /(smoke|screenshots)\//,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'screenshots',
      testMatch: /screenshots\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: ADMIN_STATE,
      },
    },
    {
      name: 'deploy-smoke',
      testMatch: /smoke\/.*\.spec\.ts/,
      use: {
        baseURL: process.env.DEPLOYED_BASE_URL || 'http://localhost:5173',
      },
    },
  ],
  webServer: [
    {
      command: 'bun run --env-file=.env.test src/index.ts',
      cwd: path.resolve(__dirname, '../backend'),
      url: 'http://localhost:3001/health',
      // Never reuse an existing backend — a dev server pointing at the dev DB
      // would silently pass tests for users that exist there and fail for
      // test-only users (e.g. admin@test.com).
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '../frontend'),
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
