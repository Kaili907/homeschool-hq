import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser/learner-release',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'docs/learner-browser-e2e/playwright-results.json' }],
  ],
  outputDir: 'test-results/learner-release',
  use: {
    baseURL: 'http://127.0.0.1:4187',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'VITE_FAMILY_PILOT_ENABLED=true npm run build && npm run preview -- --host 127.0.0.1 --port 4187',
    url: 'http://127.0.0.1:4187/family-pilot',
    reuseExistingServer: false,
    timeout: 600_000,
  },
})
