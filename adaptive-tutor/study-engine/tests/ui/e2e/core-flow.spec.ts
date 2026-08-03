import { AxeBuilder, expect, test } from "../../../prototype/src/e2eSupport";

async function resetAndStart(
  page: Parameters<typeof test>[0] extends never ? never : any,
  subject: "mathematics" | "reading",
) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: `Start ${subject}` }).click();
  await page.getByLabel(/Ready to begin/i).click();
  await page.getByRole("button", { name: "Begin warm-up" }).click();
}

async function chooseAndContinue(page: any, label: RegExp | string) {
  await page.getByLabel(label).click();
  await page.getByRole("button", { name: "Check my response" }).click();
  await expect(page.getByText("Ready for the next step")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function takeAndReturnFromBreak(page: any, expectedHeading: string) {
  await page.getByText("Choose how Jarvis can help").click();
  await page.getByRole("button", { name: "I need a break" }).click();
  await expect(page.getByRole("heading", { name: "Take the break you need." })).toBeVisible();
  await page.screenshot({
    path: "../docs/ui/screenshots/03-break.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Stretch" }).click();
  await page.getByRole("button", { name: "I’m ready to return" }).click();
  await expect(page.getByText("Returning to")).toBeVisible();
  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible({
    timeout: 8_000,
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("mathematics session completes instruction, response, break, resume, and exit", async ({
  page,
}) => {
  await resetAndStart(page, "mathematics");
  await expect(page.getByText("Step 1 of 6").first()).toBeVisible();
  await page.locator("#main-content").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../docs/ui/screenshots/02-math-session.png",
  });

  await chooseAndContinue(page, /Two of four equal parts/i);
  await chooseAndContinue(page, /Six shaded pieces out of eight/i);
  await expect(page.getByRole("heading", { name: "Let’s do one together" })).toBeVisible();

  await takeAndReturnFromBreak(page, "Let’s do one together");
  await chooseAndContinue(page, /Two thirds/i);

  await page.getByLabel(/Write a fraction with denominator 10/i).fill("4/10");
  await page.getByRole("button", { name: "Check my response" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Getting there").click();
  await page.getByLabel("Steady").click();
  await page.getByRole("radio", { name: "Calm" }).click();
  await page.getByRole("button", { name: "Save check-in" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("4/6").click();
  await page.getByRole("button", { name: "Check my response" }).click();
  await page.getByRole("button", { name: "See session choices" }).click();

  await expect(
    page.getByRole("heading", { name: "You finished this learning cycle." }),
  ).toBeVisible();
  await expect(page.getByText("6 of 6", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.locator("#main-content").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../docs/ui/screenshots/05-session-choices.png",
  });
});

test("reading session includes active evidence, independent writing, break, and exit", async ({
  page,
}) => {
  await resetAndStart(page, "reading");
  await chooseAndContinue(page, /Signals a change or contrast/i);
  await chooseAndContinue(page, /Unsure or slow to act/i);

  await takeAndReturnFromBreak(page, "Let’s trace the evidence");
  await chooseAndContinue(page, /The puppy hides, then approaches slowly/i);

  const response = page.getByLabel(/After the long hike, Leila felt weary/i);
  await response.fill("Weary means tired; dropping the backpack and sinking down are clues.");
  await page.getByRole("button", { name: "Check my response" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Ready to explain").click();
  await page.getByLabel("A lot").click();
  await page.getByLabel("Some frustration").click();
  await page.getByRole("button", { name: "Save check-in" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("easily broken").click();
  await page.getByRole("button", { name: "Check my response" }).click();
  await page.getByRole("button", { name: "See session choices" }).click();
  await expect(
    page.getByRole("heading", { name: "You finished this learning cycle." }),
  ).toBeVisible();
});
