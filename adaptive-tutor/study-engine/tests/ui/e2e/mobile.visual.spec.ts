import { AxeBuilder, expect, test } from "../../../prototype/src/e2eSupport";

test("mobile reading layout reflows with large text, no motion, and touch-safe controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Start reading" }).click();
  await page.getByLabel(/I need a gentle start/i).click();
  await page.getByRole("button", { name: "Begin warm-up" }).click();

  await page.getByText("Comfort & access").click();
  await page.getByLabel("None").click();
  await page.getByLabel("Larger").click();
  await page.getByText("Comfort & access").click();
  await page.getByText("Choose how Jarvis can help").click();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const breakButton = page.getByRole("button", { name: "I need a break" });
  const box = await breakButton.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  await page.locator("#main-content").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../docs/ui/screenshots/04-reading-mobile.png",
  });
});
