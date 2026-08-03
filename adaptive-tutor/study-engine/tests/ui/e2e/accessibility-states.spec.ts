import {
  AxeBuilder,
  expect,
  test,
  type Page,
} from "../../../prototype/src/e2eSupport";

async function expectNoAxeViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    `${state}: ${results.violations
      .map((violation) => `${violation.id} — ${violation.help}`)
      .join("; ")}`,
  ).toEqual([]);
}

test("home, check-in, learning, transcript, and break states pass axe", async ({ page }) => {
  await page.goto("/");
  await expectNoAxeViolations(page, "home");

  await page.getByRole("button", { name: "Start mathematics" }).click();
  await expectNoAxeViolations(page, "check-in");

  await page.getByRole("radio", { name: /Ready to begin/ }).check();
  await page.getByRole("button", { name: "Begin warm-up" }).click();
  await expectNoAxeViolations(page, "learning");

  await page.getByRole("button", { name: "Show transcript" }).click();
  await expectNoAxeViolations(page, "open transcript");

  await page.getByText("Choose how Jarvis can help").click();
  await page.getByRole("button", { name: "I need a break" }).click();
  await expectNoAxeViolations(page, "break");
});
