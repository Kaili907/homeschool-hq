import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../../..')

// Self-contained so this suite can run without any package.json changes:
//   npx playwright test --config tests/family-pilot/browser/playwright.config.ts
const PORT = Number(process.env.PILOT_BROWSER_TEST_PORT ?? 4180)

export default defineConfig({
  testDir: './',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: '../../../test-results/family-pilot-browser',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && node tests/family-pilot/browser/pilot-browser-test-server.mjs',
    cwd: repoRoot,
    url: `http://127.0.0.1:${PORT}/__pilot_test__/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'browser-test-public-anon-key',
      PILOT_BROWSER_TEST_PORT: String(PORT),
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
  ],
})
