import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.FAMILY_PILOT_BROWSER_TEST_PORT ?? 5190)

// FAMILY-PILOT-FINAL-BROWSER-ACCEPTANCE: runs against the Vite DEV server, not
// a production build. IntegratedPilotSurface (src/study/family-pilot/integration/
// IntegratedPilotSurface.tsx) — the Student/Study/Tutor/Parent pilot surface —
// is gated behind `import.meta.env.DEV` on purpose (a production-bundle
// boundary enforced by src/study/production/providerBundleSecurity.test.ts), so
// a `vite build` + static-serve harness (see playwright.admin.config.ts) can
// only ever reach "Study is not available in this build." Matches the card's
// own framing: "Family Pilot enabled locally".
export default defineConfig({
  testDir: './tests/family-pilot/final-browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: 'test-results/family-pilot-browser',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // --host 127.0.0.1 is load-bearing here: with no --host, Vite binds only
    // to the 'localhost' DNS result, which on this machine resolves to ::1
    // (IPv6) and leaves 127.0.0.1 (IPv4) — what `url`/`baseURL` below probe —
    // connection-refused forever.
    command: `npm run dev -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_FAMILY_PILOT_ENABLED: 'true',
      VITE_FAMILY_PILOT_DIAGNOSTICS: 'true',
      FAMILY_PILOT_BROWSER_TEST_PORT: String(PORT),
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
  ],
})
