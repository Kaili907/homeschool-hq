import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../../tests/student-runtime/e2e",
  globalSetup: "./playwright.global-setup.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 7_500
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "../../docs/student-runtime/playwright-report",
        open: "never"
      }
    ]
  ],
  outputDir: "../../docs/student-runtime/test-artifacts",
  use: {
    baseURL: "http://127.0.0.1:4327",
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    {
      name: "desktop-chromium",
      testIgnore: /mobile\..*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 }
      }
    },
    {
      name: "mobile-chromium",
      testMatch: /mobile\..*\.spec\.ts/,
      use: {
        ...devices["Pixel 7"]
      }
    }
  ]
});
