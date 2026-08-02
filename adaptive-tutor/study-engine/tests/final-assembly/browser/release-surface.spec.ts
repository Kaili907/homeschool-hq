import { createRequire } from "node:module";
import AxeBuilder from "../../../runtime/node_modules/@axe-core/playwright/dist/index.mjs";

const require = createRequire(import.meta.url);
const { expect, test } = require(
  "../../../runtime/node_modules/@playwright/test/index.js",
) as typeof import("../../../runtime/node_modules/@playwright/test/index.js");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the RC identity and all ten demonstrations", async ({ page }) => {
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Manuel Academy Adaptive Study Engine",
    }),
  ).toBeVisible();
  await expect(page.getByText("Version 1.0.0-rc.1")).toBeVisible();
  await expect(page.locator(".demo-card")).toHaveCount(10);
  await expect(page.getByText("Non-production", { exact: false })).toBeVisible();
});

test("has no automatically serious accessibility violations", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations).toEqual([]);
});

test("supports keyboard skip navigation", async ({ page }) => {
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to release details" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("honors reduced motion and contains no audio dependency", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page
    .locator(".demo-card")
    .first()
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(["0s", "0.001ms"]).toContain(duration);
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.locator("video[autoplay]")).toHaveCount(0);
});

test("keeps the release boundary readable at the active viewport", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { name: "Runtime flow" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "What RC1 deliberately does not claim",
    }),
  ).toBeVisible();
  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});
