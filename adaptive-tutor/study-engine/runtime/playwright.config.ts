import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../tests/final-assembly/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./scripts/playwright-global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:4319",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
