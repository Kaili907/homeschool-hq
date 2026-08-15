import { defineConfig } from '@playwright/test'

const port = Number(process.env.FAMILY_CLOUD_E2E_APP_PORT ?? 4183)
const baseURL = process.env.FAMILY_PILOT_APP_URL ?? `http://127.0.0.1:${port}`
const local = !process.env.FAMILY_PILOT_APP_URL

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'family-cloud-browser-composition-e2e.spec.ts',
  timeout: 600_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  ...(local ? {
    webServer: {
      command: `VITE_FAMILY_PILOT_ENABLED=true VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED=true VITE_SUPABASE_URL=https://fqzcxrkvpaivpnzdbuol.supabase.co VITE_SUPABASE_ANON_KEY=sb_publishable_family_cloud_e2e npm run build && npm run preview -- --host 127.0.0.1 --port ${port}`,
      url: `${baseURL}/family-pilot`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  } : {}),
})
