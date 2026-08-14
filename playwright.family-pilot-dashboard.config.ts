import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'family-pilot-dashboard-visual.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4182',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4182',
    url: 'http://127.0.0.1:4182/tests/browser/family-pilot-dashboard-harness.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
