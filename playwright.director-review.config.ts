import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'director-lesson-sample-review-hub.spec.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4183',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4183',
    url: 'http://127.0.0.1:4183/__review/lesson-samples',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
