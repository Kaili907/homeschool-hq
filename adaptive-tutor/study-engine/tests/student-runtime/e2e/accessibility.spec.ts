import AxeBuilder from "../../../integration-labs/student-runtime/node_modules/@axe-core/playwright/dist/index.mjs";
import playwrightTestModule, {
  type Locator,
  type Page,
} from "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js";

const { expect, test } = playwrightTestModule as unknown as typeof import(
  "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js"
);
const severeImpacts = new Set(["serious", "critical"]);

async function resetBrowserState(page: Page, path = "/") {
  await page.goto(path);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function expectNoSeriousOrCriticalAxeViolations(
  page: Page,
  stateName: string,
) {
  const result = await new AxeBuilder({ page }).analyze();
  const severe = result.violations.filter((violation) =>
    severeImpacts.has(violation.impact ?? ""),
  );

  expect(
    severe,
    `${stateName}: ${severe
      .map((violation) => `${violation.id} — ${violation.help}`)
      .join("; ")}`,
  ).toEqual([]);
}

async function openComfortAndAccess(page: Page) {
  const summary = page
    .locator("summary")
    .filter({ hasText: "Comfort & access" })
    .first();
  await expect(summary).toBeVisible();
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

async function beginLesson(
  page: Page,
  subject: "mathematics" | "reading",
  path = "/",
) {
  await resetBrowserState(page, path);
  await page
    .getByRole("button", {
      name: subject === "mathematics" ? "Start mathematics" : "Start reading",
    })
    .click();

  await expect(page.locator("#main-content")).toBeVisible();
  const ready = page.getByRole("radio", { name: /Ready to begin/i });
  await expect(ready).toBeVisible();
  await ready.check();
  await page.getByRole("button", { name: /Begin warm-up/i }).click();

  await expect(
    page.getByRole("navigation", { name: "Learning segment progress" }),
  ).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
}

async function tabTo(page: Page, target: Locator, maximumTabs = 60) {
  await expect(target).toBeVisible();
  for (let index = 0; index < maximumTabs; index += 1) {
    const isFocused = await target
      .evaluate((element) => element === document.activeElement)
      .catch(() => false);
    if (isFocused) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

async function expectVisibleFocus(page: Page) {
  const focusStyle = await page.locator(":focus").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      boxShadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });

  const hasVisibleOutline =
    focusStyle.outlineStyle !== "none" && focusStyle.outlineWidth >= 2;
  const hasVisibleShadow =
    focusStyle.boxShadow !== "none" && focusStyle.boxShadow.trim().length > 0;
  expect(hasVisibleOutline || hasVisibleShadow).toBe(true);
}

async function exposeBreakActionWithKeyboard(page: Page) {
  const breakAction = page.getByRole("button", {
    name: "I need a break",
    exact: true,
  });
  if (!(await breakAction.isVisible())) {
    const supportDisclosure = page
      .locator("summary")
      .filter({ hasText: /learning support|Jarvis can help/i })
      .first();
    await tabTo(page, supportDisclosure);
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");
  }
  await expect(breakAction).toBeVisible();
  return breakAction;
}

test("home, check-in, lesson, and timer-anxiety states are semantic and axe-clean", async ({
  page,
}) => {
  await resetBrowserState(page);

  await expect(
    page.getByRole("button", { name: "Start mathematics" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start reading" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run adversarial probes" }),
  ).toBeVisible();
  await expectNoSeriousOrCriticalAxeViolations(page, "home");

  await page.getByRole("button", { name: "Start mathematics" }).click();
  await expect(page.locator("#main-content")).toBeVisible();
  await expectNoSeriousOrCriticalAxeViolations(page, "check-in");

  await page.getByRole("radio", { name: /Ready to begin/i }).check();
  await page.getByRole("button", { name: /Begin warm-up/i }).click();

  const progress = page.getByRole("navigation", {
    name: "Learning segment progress",
  });
  await expect(progress).toBeVisible();
  await expect(
    page.getByRole("button", { name: "I need a break", exact: true }),
  ).toBeAttached();

  const progressBeforeTimerChanges = await progress.innerText();
  const { details } = await openComfortAndAccess(page);
  const timerChoices = details.getByRole("group", { name: /timer/i });
  const visible = timerChoices.getByRole("radio", {
    name: "Visible",
    exact: true,
  });
  const minimal = timerChoices.getByRole("radio", {
    name: "Minimal",
    exact: true,
  });
  const hidden = timerChoices.getByRole("radio", {
    name: "Hidden",
    exact: true,
  });

  await visible.check();
  await expect(visible).toBeChecked();
  await minimal.check();
  await expect(minimal).toBeChecked();
  await expect(page.getByText(/\b\d{1,2}:\d{2}\b/)).toHaveCount(0);
  await hidden.check();
  await expect(hidden).toBeChecked();
  await expect(page.getByText(/\b\d{1,2}:\d{2}\b/)).toHaveCount(0);

  await page.waitForTimeout(1_100);
  expect(await progress.innerText()).toBe(progressBeforeTimerChanges);
  const liveRegionText = (
    await page.locator('[role="status"], [aria-live]').allInnerTexts()
  ).join(" ");
  expect(liveRegionText).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  await expect(page.locator("body")).not.toContainText(
    /hurry|too slow|you failed|time is running out/i,
  );

  await expectNoSeriousOrCriticalAxeViolations(
    page,
    "learning with hidden timer",
  );
});

test("a keyboard-only learner has visible focus, logical order, and direct break access", async ({
  page,
}) => {
  await resetBrowserState(page);

  const skipLink = page.getByRole("link", {
    name: /Skip to (?:current activity|main content)/i,
  });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const start = page.getByRole("button", { name: "Start mathematics" });
  await tabTo(page, start);
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");

  const ready = page.getByRole("radio", { name: /Ready to begin/i });
  await tabTo(page, ready);
  await expectVisibleFocus(page);
  await page.keyboard.press("Space");
  await expect(ready).toBeChecked();

  const begin = page.getByRole("button", { name: /Begin warm-up/i });
  await tabTo(page, begin);
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");

  const progress = page.getByRole("navigation", {
    name: "Learning segment progress",
  });
  const breakAction = await exposeBreakActionWithKeyboard(page);
  const progressPrecedesBreak = await progress.evaluate(
    (progressElement, breakElement) =>
      Boolean(
        progressElement.compareDocumentPosition(breakElement as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    await breakAction.elementHandle(),
  );
  expect(progressPrecedesBreak).toBe(true);

  await tabTo(page, breakAction);
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");

  const breakHeading = page.getByRole("heading", { name: /break/i }).first();
  await expect(breakHeading).toBeVisible();
  await expect(breakHeading).toBeFocused();
  await expectNoSeriousOrCriticalAxeViolations(page, "break");
});

test("reduced motion, large text, no audio, unavailable speech, and missing media keep text paths usable", async ({
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

  await beginLesson(page, "mathematics", "/?media=missing");
  const mainText = page.locator("#main-content p").first();
  const defaultFontSize = await mainText.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );

  const { details } = await openComfortAndAccess(page);
  const captions = details.getByRole("checkbox", { name: /Captions/i });
  const transcript = details.getByRole("checkbox", { name: /Transcript/i });
  const reducedMotion = preferenceChoice(
    page,
    /Reduced motion|No motion|None/i,
  );
  const noAudio = preferenceChoice(page, /No audio/i);
  const largeText = preferenceChoice(page, /Large text|Larger/i);

  await expect(captions).toBeChecked();
  await captions.click();
  await expect(captions).toBeChecked();
  await expect(
    page.getByRole("status").filter({ hasText: /Captions stay on/i }),
  ).toBeVisible();
  await transcript.check();
  await expect(transcript).toBeChecked();
  await expect(reducedMotion).toBeVisible();
  await reducedMotion.check();
  await expect(noAudio).toBeVisible();
  await noAudio.check();
  await expect(largeText).toBeVisible();
  await largeText.check();
  await details.locator("summary").click();

  const enlargedFontSize = await mainText.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(enlargedFontSize).toBeGreaterThan(defaultFontSize);

  const animatedElements = await page.locator("#main-content *").evaluateAll(
    (elements) =>
      elements
        .filter((element) => {
          const style = getComputedStyle(element);
          const durations = style.animationDuration
            .split(",")
            .map((duration) => {
              const value = Number.parseFloat(duration);
              return duration.trim().endsWith("ms") ? value : value * 1_000;
            });
          return (
            style.animationName !== "none" &&
            Math.max(...durations) > 0.01
          );
        })
        .map((element) => {
          const htmlElement = element as HTMLElement;
          return htmlElement.id || htmlElement.className || htmlElement.tagName;
        }),
  );
  expect(animatedElements).toEqual([]);

  await expect(page.locator("body")).toContainText(
    /audio (?:is off|isn.?t available)|voice (?:isn.?t available|is unavailable)/i,
  );
  await expect(page.getByText("Jarvis captions", { exact: true })).toBeVisible();
  const transcriptRegion = page.getByRole("region", {
    name: "Session transcript",
  });
  await expect(transcriptRegion).toBeVisible();
  await transcriptRegion.focus();
  await page.keyboard.press("Escape");
  await expect(transcriptRegion).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Show transcript" }),
  ).toBeFocused();

  const supportDisclosure = page
    .locator("summary")
    .filter({ hasText: /Choose how Jarvis can help/i })
    .first();
  await supportDisclosure.click();
  const answerAloud = page.getByRole("button", {
    name: /Let me answer aloud.*typing is ready/i,
  });
  await expect(answerAloud).toBeEnabled();
  await answerAloud.click();
  await expect(page.getByText("Jarvis captions", { exact: true })).toBeVisible();
  await expect(page.locator(".jarvis-core__utterance")).toContainText(
    /Speech input is unavailable.*Typing is ready.*place is unchanged/i,
  );
  await expect(page.locator("#main-content")).toContainText(
    /(?:visual|media).*(?:isn.?t available|unavailable).*(?:text|same idea)/i,
  );

  const responseControls = page
    .locator("#main-content")
    .locator('input:not([type="hidden"]), textarea, select');
  await expect(responseControls.first()).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "I need a break", exact: true }),
  ).toBeAttached();

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
  await expectNoSeriousOrCriticalAxeViolations(
    page,
    "fallbacks with reduced motion and large text",
  );
});

test("the adversarial demonstration exposes exactly seven passing, axe-clean results", async ({
  page,
}) => {
  await resetBrowserState(page);
  await page.getByRole("button", { name: "Run adversarial probes" }).click();

  // This test id is the one intentional non-semantic observability hook in this
  // suite. It scopes deterministic security/integrity probe output without
  // coupling the test to the surrounding visual layout.
  const results = page.getByTestId("adversarial-results");
  await expect(results).toBeVisible();
  const rows = results.getByRole("listitem");
  await expect(rows).toHaveCount(7);
  for (const row of await rows.all()) {
    await expect(row).toContainText(/\bpass(?:ed)?\b/i);
  }

  await expect(results).toContainText(/forged completion/i);
  await expect(results).toContainText(/duplicate (?:event|completion)/i);
  await expect(results).toContainText(/privacy|raw.*omitted|PII/i);
  await expect(results).toContainText(/unsupported version/i);
  await expect(results).toContainText(/blame language/i);
  await expect(results).toContainText(/excessive increase|duration.*cap/i);
  await expect(results).toContainText(/repeated breaks/i);
  await expect(results).toContainText(/adult review/i);

  await expectNoSeriousOrCriticalAxeViolations(
    page,
    "adversarial probe results",
  );
});
