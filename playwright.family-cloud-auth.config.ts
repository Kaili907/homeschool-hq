import { defineConfig } from '@playwright/test'

const port = 4184

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'family-cloud-auth-recovery.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run curriculum:build && VITE_FAMILY_PILOT_ENABLED=true VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED=true VITE_SUPABASE_URL=https://fqzcxrkvpaivpnzdbuol.supabase.co VITE_SUPABASE_ANON_KEY=sb_publishable_family_cloud_auth_e2e node node_modules/vite/bin/vite.js build && node scripts/audit-browser-answer-authority.mjs && node scripts/stamp-sw.mjs && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/family-pilot`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
