import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'family-pilot-flag-default.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4182', headless: true },
  webServer: {
    command: 'VITE_FAMILY_PILOT_ENABLED=false npm run build && npm run preview -- --host 127.0.0.1 --port 4182',
    url: 'http://127.0.0.1:4182/family-pilot',
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
