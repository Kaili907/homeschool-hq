import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "../../../integration-labs/student-runtime/node_modules/@axe-core/playwright/dist/index.mjs";
import playwrightTestModule, {
  type Locator,
  type Page,
} from "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js";

const { expect, test } = playwrightTestModule as unknown as typeof import(
  "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js"
);

const SCREENSHOT_DIR = fileURLToPath(
  new URL("../../../docs/student-runtime/screenshots/", import.meta.url),
);

async function captureDocumentationScreenshot(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name),
    fullPage: true,
  });
}

async function resetBrowserState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function expectNoHorizontalPageOverflow(page: Page, stateName: string) {
  const dimensions = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const overflowers = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: `${element.tagName.toLowerCase()}.${element.className}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((entry) => entry.left < -1 || entry.right > clientWidth + 1)
      .slice(0, 8);
    return {
      clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowers,
    };
  });
  expect(
    dimensions.scrollWidth,
    `${stateName}: document width ${dimensions.scrollWidth}px exceeded viewport ${dimensions.clientWidth}px; overflowers ${JSON.stringify(dimensions.overflowers)}`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectTouchTarget(locator: Locator, name: string) {
  await expect(locator, `${name} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${name} should have a measurable hit area`).not.toBeNull();
  expect(box?.width ?? 0, `${name} target width`).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0, `${name} target height`).toBeGreaterThanOrEqual(44);
}

async function openComfortAndAccess(page: Page) {
  const summary = page
    .locator("summary")
    .filter({ hasText: "Comfort & access" })
    .first();
  await expectTouchTarget(summary, "Comfort & access disclosure");
  const details = summary.locator("xpath=..");
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await summary.click();
  }
  return { details, summary };
}

function preferenceChoice(page: Page, name: string | RegExp) {
  return page
    .getByRole("radio", { name })
    .or(page.getByRole("checkbox", { name }))
    .first();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test("390x844 reading runtime reflows with large text, reduced motion, and 44px targets", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await resetBrowserState(page);

  const startMath = page.getByRole("button", { name: "Start mathematics" });
  const startReading = page.getByRole("button", { name: "Start reading" });
  const runProbes = page.getByRole("button", {
    name: "Run adversarial probes",
  });
  await expectTouchTarget(startMath, "Start mathematics");
  await expectTouchTarget(startReading, "Start reading");
  await expectTouchTarget(runProbes, "Run adversarial probes");
  await expectNoHorizontalPageOverflow(page, "mobile home");

  await startReading.click();
  await expect(page.locator("#main-content")).toBeVisible();
  await expectNoHorizontalPageOverflow(page, "mobile check-in");
  await page.getByRole("radio", { name: /Ready to begin/i }).check();
  await page.getByRole("button", { name: /Begin warm-up/i }).click();

  await expect(
    page.getByRole("navigation", { name: "Learning segment progress" }),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page, "mobile learning");

  const { details, summary } = await openComfortAndAccess(page);
  const timerGroup = details.getByRole("group", { name: /timer/i });
  for (const timerName of ["Visible", "Minimal", "Hidden"]) {
    const radio = timerGroup.getByRole("radio", {
      name: timerName,
      exact: true,
    });
    const label = radio.locator("xpath=ancestor::label[1]");
    await expectTouchTarget(label, `${timerName} timer option`);
  }

  const reducedMotion = preferenceChoice(
    page,
    /Reduced motion|No motion|None/i,
  );
  const largeText = preferenceChoice(page, /Large text|Larger/i);
  await reducedMotion.check();
  await largeText.check();
  await summary.click();

  let breakAction = page.getByRole("button", {
    name: "I need a break",
    exact: true,
  });
  if (!(await breakAction.isVisible())) {
    const support = page
      .locator("summary")
      .filter({ hasText: /learning support|Jarvis can help/i })
      .first();
    await expectTouchTarget(support, "learning support disclosure");
    await support.click();
    breakAction = page.getByRole("button", {
      name: "I need a break",
      exact: true,
    });
  }
  await expectTouchTarget(breakAction, "I need a break");

  const activeResponse = page
    .locator("#main-content")
    .locator('input:not([type="hidden"]), textarea, select')
    .first();
  await expect(activeResponse).toBeEnabled();
  await expectNoHorizontalPageOverflow(
    page,
    "mobile learning with large text and support open",
  );

  const animatedElements = await page.locator("#main-content *").evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const style = getComputedStyle(element);
        const duration = Math.max(
          ...style.animationDuration.split(",").map((entry) => {
            const value = Number.parseFloat(entry);
            return entry.trim().endsWith("ms") ? value : value * 1_000;
          }),
        );
        return style.animationName !== "none" && duration > 0.01;
      }).length,
  );
  expect(animatedElements).toBe(0);

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureDocumentationScreenshot(
    page,
    "05-mobile-reading-large-text-v2.png",
  );
});

test("mobile adversarial results remain reachable and do not overflow the page", async ({
  page,
}) => {
  await resetBrowserState(page);
  const runProbes = page.getByRole("button", {
    name: "Run adversarial probes",
  });
  await expectTouchTarget(runProbes, "Run adversarial probes");
  await runProbes.click();

  // `adversarial-results` is documented in the companion agent report as the
  // sole required data-testid used by these browser specifications.
  const results = page.getByTestId("adversarial-results");
  await expect(results).toBeVisible();
  await expect(results.getByRole("listitem")).toHaveCount(7);
  await expectNoHorizontalPageOverflow(page, "mobile adversarial results");
});
