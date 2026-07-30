import {
  expect,
  test,
  type Locator,
  type Page,
} from "../../../prototype/src/e2eSupport";

async function tabTo(page: Page, target: Locator, maximumTabs = 50) {
  await expect(target).toBeVisible();
  for (let index = 0; index < maximumTabs; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test("keyboard-only learner can enter, take a break, and return to the exact task", async ({
  page,
}) => {
  await page.goto("/");

  const start = page.getByRole("button", { name: "Start mathematics" });
  await tabTo(page, start);
  await page.keyboard.press("Enter");

  const ready = page.getByRole("radio", { name: /Ready to begin/ });
  await tabTo(page, ready);
  await page.keyboard.press("Space");
  await expect(ready).toBeChecked();

  const begin = page.getByRole("button", { name: "Begin warm-up" });
  await tabTo(page, begin);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Wake up what you already know" }),
  ).toBeVisible();

  const learnerActions = page
    .locator("summary")
    .filter({ hasText: "Choose how Jarvis can help" });
  await tabTo(page, learnerActions);
  await page.keyboard.press("Enter");

  const breakButton = page.getByRole("button", {
    name: "I need a break",
    exact: true,
  });
  await tabTo(page, breakButton);
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "Take the break you need." }),
  ).toBeVisible();
  await expect(page.getByText(/return to.*Warm-up.*exactly where/i)).toBeVisible();
  await expect(page.locator(".break-screen").getByRole("link")).toHaveCount(0);

  const water = page.getByRole("button", { name: "Get water" });
  await tabTo(page, water);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Get water" })).toBeVisible();

  const returnButton = page.getByRole("button", { name: /ready to return/i });
  await tabTo(page, returnButton);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: /Returning to Warm-up/ })).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Wake up what you already know" }),
  ).toBeVisible({ timeout: 8_000 });
  await expect(
    page.locator(".task-panel__step").getByText("Step 1 of 6"),
  ).toBeVisible();
  await expect(page.locator("#main-content")).toBeFocused();
});
