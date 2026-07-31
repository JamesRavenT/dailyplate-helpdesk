import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { ADMIN_STATE } from './tests/fixtures/auth'

const runRealOpenAi = process.env.RUN_REAL_OPENAI === '1'

if (runRealOpenAi && !process.env.OPENAI_API_KEY) {
  throw new Error('RUN_REAL_OPENAI=1 requires OPENAI_API_KEY (this opt-in project incurs API cost)')
}

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
      testIgnore: /(smoke|screenshots|real-ai)\//,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    ...(runRealOpenAi ? [{
      name: 'real-openai',
      testMatch: /real-ai\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: ADMIN_STATE,
      },
    }] : []),
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
      command: 'bun run --env-file=.env.test.example src/index.ts',
      cwd: path.resolve(__dirname, '../backend'),
      url: 'http://localhost:3001/health',
      // Playwright's explicit env overrides the parent shell. The default suite both
      // selects the network-free stub and blanks any key inherited from a maintainer.
      env: {
        AI_PROVIDER: runRealOpenAi ? 'openai' : 'stub',
        OPENAI_API_KEY: runRealOpenAi ? (process.env.OPENAI_API_KEY ?? '') : '',
      },
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
