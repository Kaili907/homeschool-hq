import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../tests/ui/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "../docs/ui/playwright-report",
        open: "never",
      },
    ],
  ],
  outputDir: "../docs/ui/test-artifacts",
  use: {
    baseURL: "http://127.0.0.1:4317",
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev -- --port 4317",
    url: "http://127.0.0.1:4317",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      testIgnore: /mobile\..*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
      },
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile\..*\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
