import {
  AxeBuilder,
  expect,
  test,
  type Page,
} from "../../../prototype/src/e2eSupport";
import { STORAGE_KEY } from "../../../prototype/src/sessionStore";

async function startReading(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Start reading" }).click();
  await page.getByLabel(/Ready to begin/i).click();
  await page.getByRole("button", { name: "Begin warm-up" }).click();
}

async function chooseAndContinue(page: Page, label: RegExp) {
  await page.getByLabel(label).click();
  await page.getByRole("button", { name: "Check my response" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("accidental refresh restores the exact reading draft and records a technical interruption", async ({
  page,
}) => {
  await startReading(page);
  await chooseAndContinue(page, /Signals a change or contrast/i);
  await chooseAndContinue(page, /Unsure or slow to act/i);
  await chooseAndContinue(page, /The puppy hides, then approaches slowly/i);

  const draft = "Weary means tired because Leila drops her pack and sinks onto a bench.";
  const response = page.getByLabel(/After the long hike, Leila felt weary/i);
  await response.fill(draft);
  await expect
    .poll(() =>
      page.evaluate(
        ({ key }) => {
          const raw = window.localStorage.getItem(key);
          if (!raw) return undefined;
          const parsed = JSON.parse(raw) as {
            sessions?: { reading?: { answers?: Record<string, string> } };
          };
          return parsed.sessions?.reading?.answers?.["independent-attempt"];
        },
        { key: STORAGE_KEY },
      ),
    )
    .toBe(draft);
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Explain your inference" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Your exact step was restored." }),
  ).toBeVisible();
  await expect(page.getByLabel(/After the long hike, Leila felt weary/i)).toHaveValue(draft);
  await expect(page.getByRole("button", { name: "Resume optional timer" })).toBeVisible();

  await page.getByText("Saved learning & recovery details").click();
  await expect(page.getByTestId("technical-interruption-count")).toHaveText("1");
  await expect(page.getByTestId("current-completion-event-count")).toHaveText("0");

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  await page.locator("#main-content").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../docs/ui/screenshots/06-technical-recovery.png",
  });
});

test("timer modes, no-audio fallback, keyboard controls, and reduced motion remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    for (const apiName of [
      "speechSynthesis",
      "SpeechSynthesisUtterance",
      "SpeechRecognition",
      "webkitSpeechRecognition",
    ]) {
      let owner: object | null = window;
      while (owner) {
        Reflect.deleteProperty(owner, apiName);
        owner = Object.getPrototypeOf(owner) as object | null;
      }
    }
  });
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.getByRole("button", { name: "Start mathematics" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel(/Ready to begin/i).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Begin warm-up" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByText(/Voice is unavailable on this device/i)).toBeVisible();
  await page.getByText("Comfort & access").click();
  await page.getByLabel("No audio").click();
  await page.getByLabel("Minimal").last().click();
  await expect(page.getByTestId("minimal-timer")).toBeVisible();
  await expect(page.getByTestId("minimal-timer")).not.toContainText(/\d\d:\d\d/);
  await page
    .getByRole("group", { name: "Optional timer display" })
    .getByRole("radio", { name: "Hidden" })
    .click();
  await expect(page.getByTestId("hidden-timer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause optional timer" })).toBeVisible();

  const animationName = await page
    .locator(".jarvis-core__ring--primary")
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(animationName).toBe("none");

  await page.getByText("Comfort & access").click();
  await page.getByText("Choose how Jarvis can help").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Let me answer aloud/i }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/typed draft is ready/i)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
