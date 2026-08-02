import {
  expect,
  test,
  type Page,
} from "../../../prototype/src/e2eSupport";
import { STORAGE_KEY } from "../../../prototype/src/sessionStore";

async function startMathWarmUp(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start mathematics" }).click();
  await page.getByRole("radio", { name: /Ready to begin/ }).check();
  await page.getByRole("button", { name: "Begin warm-up" }).click();
  await expect(
    page.getByRole("heading", { name: "Wake up what you already know" }),
  ).toBeVisible();
}

async function completeChoice(page: Page, value: string) {
  await page.locator(`.response-card input[type="radio"][value="${value}"]`).check();
  await page.getByRole("button", { name: "Check my response" }).click();
  await expect(page.getByText("Ready for the next step")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

test("accidental refresh restores the independent-attempt draft and exact step", async ({
  page,
}, testInfo) => {
  await startMathWarmUp(page);
  await completeChoice(page, "2/4");
  await completeChoice(page, "6/8");
  await completeChoice(page, "2");

  await expect(
    page.locator(".task-panel__step").getByText("Step 4 of 6"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your turn" })).toBeVisible();

  const draft = "4/";
  const answer = page.getByRole("textbox", {
    name: /Write a fraction with denominator 10/,
  });
  await answer.fill(draft);

  await expect
    .poll(() =>
      page.evaluate(
        ({ key }) => {
          const raw = window.localStorage.getItem(key);
          if (!raw) return undefined;
          const parsed = JSON.parse(raw) as {
            sessions?: { math?: { answers?: Record<string, string> } };
          };
          return parsed.sessions?.math?.answers?.["independent-attempt"];
        },
        { key: STORAGE_KEY },
      ),
    )
    .toBe(draft);

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Your turn" }),
  ).toBeVisible();
  await expect(
    page.locator(".task-panel__step").getByText("Step 4 of 6"),
  ).toBeVisible();
  await expect(answer).toHaveValue(draft);
  await expect(page.getByText("Your exact step was restored.")).toBeVisible();
  await expect(
    page.getByText(/optional timer is paused until you choose resume/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume optional timer" }),
  ).toBeVisible();

  await page
    .locator("summary")
    .filter({ hasText: "Saved learning & recovery details" })
    .click();
  await expect(page.getByTestId("technical-interruption-count")).toHaveText("1");
  await expect(page.getByTestId("current-completion-event-count")).toHaveText("0");

  await page.screenshot({
    path: testInfo.outputPath("independent-attempt-refresh-recovery.png"),
    fullPage: true,
  });
});
