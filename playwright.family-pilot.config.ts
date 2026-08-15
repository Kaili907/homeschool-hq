import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'final-family-pilot-launch.spec.ts',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4181', headless: true, actionTimeout: 15_000, trace: 'retain-on-failure' },
  webServer: {
    command: 'VITE_FAMILY_PILOT_ENABLED=true npm run build && npm run preview -- --host 127.0.0.1 --port 4181',
    url: 'http://127.0.0.1:4181/family-pilot',
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
