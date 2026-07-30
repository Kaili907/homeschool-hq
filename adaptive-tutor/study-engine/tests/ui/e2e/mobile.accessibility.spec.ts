import {
  AxeBuilder,
  expect,
  test,
} from "../../../prototype/src/e2eSupport";

test("mobile session reflows and honors reduced/no-motion preferences", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  expect(
    await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);

  const start = page.getByRole("button", { name: "Start mathematics" });
  const startBox = await start.boundingBox();
  expect(startBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await start.click();

  await page.getByRole("radio", { name: /Ready to begin/ }).check();
  await page.getByRole("button", { name: "Begin warm-up" }).click();
  await expect(
    page.getByRole("heading", { name: "Wake up what you already know" }),
  ).toBeVisible();

  const reducedAnimationMilliseconds = await page
    .locator(".jarvis-core__ring--primary")
    .evaluate((element) => {
      const durations = getComputedStyle(element).animationDuration.split(",");
      return Math.max(
        ...durations.map((duration) => {
          const value = Number.parseFloat(duration);
          return duration.trim().endsWith("ms") ? value : value * 1_000;
        }),
      );
    });
  expect(reducedAnimationMilliseconds).toBeLessThanOrEqual(0.01);

  const timerToggle = page.getByRole("button", { name: "Pause optional timer" });
  const timerBox = await timerToggle.boundingBox();
  expect(timerBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(timerBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  const comfort = page.locator("summary").filter({ hasText: "Comfort & access" });
  await comfort.click();
  await page.getByRole("radio", { name: "None" }).check();
  await expect(page.getByTestId("study-ux-app")).toHaveAttribute("data-motion", "none");
  await expect(page.locator(".jarvis-core")).toHaveAttribute("data-motion", "none");
  await expect(page.locator(".jarvis-core__ring--primary")).toHaveCSS(
    "animation-name",
    "none",
  );

  await page.getByRole("radio", { name: "Larger" }).check();
  await comfort.click();

  const viewportState = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    pageScrollWidth: document.documentElement.scrollWidth,
    textScale: getComputedStyle(document.querySelector("[data-testid='study-ux-app']")!)
      .getPropertyValue("--text-scale")
      .trim(),
  }));
  expect(viewportState.pageScrollWidth).toBeLessThanOrEqual(
    viewportState.innerWidth + 1,
  );
  expect(viewportState.textScale).toBe("1.3");

  const accessibility = await new AxeBuilder({ page }).analyze();
  const seriousViolations = accessibility.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    seriousViolations,
    seriousViolations
      .map((violation) => `${violation.id}: ${violation.help}`)
      .join("\n"),
  ).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath("mobile-no-motion-large-text.png"),
    fullPage: true,
  });
});
