import {
  expect,
  test,
  type Page,
} from "../../../prototype/src/e2eSupport";

async function removeBrowserSpeechApis(page: Page) {
  await page.addInitScript(() => {
    const apiNames = [
      "speechSynthesis",
      "SpeechSynthesisUtterance",
      "SpeechRecognition",
      "webkitSpeechRecognition",
    ];
    for (const apiName of apiNames) {
      let owner: object | null = window;
      while (owner) {
        Reflect.deleteProperty(owner, apiName);
        owner = Object.getPrototypeOf(owner) as object | null;
      }
    }
  });
}

test("unavailable audio has a text fallback and all timer display modes remain optional", async ({
  page,
}) => {
  await removeBrowserSpeechApis(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Start mathematics" }).click();

  await expect(
    page.getByText(/Voice is unavailable on this device.*captions and text/i),
  ).toBeVisible();

  await page.getByRole("radio", { name: /Ready to begin/ }).check();
  await page.getByRole("button", { name: "Begin warm-up" }).click();
  await expect(page.getByTestId("visible-timer")).toBeVisible();

  await page
    .locator("summary")
    .filter({ hasText: "Choose how Jarvis can help" })
    .click();
  await page.getByRole("button", { name: "Read this to me" }).click();
  await expect(
    page.getByText(
      /Voice is unavailable on this device.*full instruction is available here/i,
    ),
  ).toBeVisible();

  const comfort = page.locator("summary").filter({ hasText: "Comfort & access" });
  await comfort.click();
  await page.getByRole("radio", { name: "No audio" }).check();
  await expect(page.locator(".jarvis-core")).toHaveAttribute("data-voice", "no-audio");
  await expect(
    page.getByText(/Audio is off.*every instruction on screen/i),
  ).toBeVisible();

  const timerDisplay = page.getByRole("group", {
    name: "Optional timer display",
  });
  await timerDisplay.getByRole("radio", { name: "Minimal" }).check();
  await expect(page.getByTestId("minimal-timer")).toBeVisible();
  await expect(
    page.locator(".task-panel__step").getByText("Step 1 of 6"),
  ).toBeVisible();

  await timerDisplay.getByRole("radio", { name: "Hidden" }).check();
  await expect(page.getByTestId("hidden-timer")).toBeVisible();
  await expect(
    page.locator(".task-panel__step").getByText("Step 1 of 6"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause optional timer" }),
  ).toBeVisible();

  await timerDisplay.getByRole("radio", { name: "Visible" }).check();
  await expect(page.getByTestId("visible-timer")).toBeVisible();
  await expect(page.getByText(/0 of 6.*learning segments complete/)).toBeVisible();
});
