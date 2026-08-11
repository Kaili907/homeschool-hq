import { defineConfig } from '@playwright/test'

const PORT = 4179

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'admin-browser-cache.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: 'test-results/admin-browser-cache',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && node tests/browser/admin-browser-test-server.mjs',
    url: `http://127.0.0.1:${PORT}/__admin_test__/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'browser-test-public-anon-key',
      ADMIN_BROWSER_TEST_PORT: String(PORT),
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 960 } },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit', viewport: { width: 1440, height: 960 } },
    },
    {
      name: 'chromium-mobile-390',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
})
