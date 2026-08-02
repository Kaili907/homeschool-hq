import path from "node:path";
import { fileURLToPath } from "node:url";
import playwrightTestModule, {
  type Page,
} from "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js";

const { expect, test } = playwrightTestModule as unknown as typeof import(
  "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js"
);

const SCREENSHOT_DIR = fileURLToPath(
  new URL("../../../docs/student-runtime/screenshots/", import.meta.url),
);

function screenshotPath(name: string) {
  return path.join(SCREENSHOT_DIR, name);
}

async function captureDocumentationScreenshot(
  page: Page,
  name: string,
) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: screenshotPath(name), fullPage: true });
}

function exactChoice(value: string) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
}

async function resetBrowserState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function startSubject(page: Page, subject: "mathematics" | "reading") {
  await page.getByRole("button", { name: `Start ${subject}` }).click();
  await page.getByRole("radio", { name: /Ready to begin/i }).check();
  await page.getByRole("button", { name: "Begin warm-up" }).click();
}

async function answerChoiceAndAdvance(page: Page, value: string) {
  await page.getByRole("radio", { name: exactChoice(value) }).check();
  await page.getByRole("button", { name: "Check response" }).click();
  await expect(page.getByText("Ready for the next step")).toBeVisible();
  await page
    .getByRole("button", { name: /^(?:Continue|See session choices)$/ })
    .click();
}

async function answerTextAndAdvance(page: Page, response: string) {
  await page.getByRole("textbox").fill(response);
  await page.getByRole("button", { name: "Check response" }).click();
  await expect(page.getByText("Ready for the next step")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function completeReflection(
  page: Page,
  choices: readonly [string, string, string],
) {
  for (const choice of choices) {
    await page.getByRole("radio", { name: choice, exact: true }).check();
  }
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText("Ready for the next step")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("Grade 5 math exchanges typed data through break, exact resume, evidence, and review", async ({
  page,
}) => {
  await resetBrowserState(page);
  await startSubject(page, "mathematics");

  await answerChoiceAndAdvance(page, "2/4");
  await answerChoiceAndAdvance(page, "6/8");
  await answerChoiceAndAdvance(page, "2");

  const independent = page.getByRole("textbox");
  await independent.fill("4/10");
  await page.getByRole("button", { name: "I need a break", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Take the break you need." }),
  ).toBeVisible();
  await expect(page.getByText(/return to Try it yourself exactly/i)).toBeVisible();
  await page.getByRole("button", { name: "Get water" }).click();
  await captureDocumentationScreenshot(
    page,
    "01-math-approved-water-break.png",
  );
  await page.getByRole("button", { name: /ready to return/i }).click();

  await expect(page.getByRole("textbox")).toHaveValue("4/10");
  await expect(
    page.getByRole("heading", { name: "Your turn" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check response" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await completeReflection(page, ["Ready to explain", "Steady", "Calm"]);
  await answerChoiceAndAdvance(page, "4/6");

  await expect(
    page.getByRole("heading", {
      name: "Your canonical learning cycle is ready to save.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Aggregate only")).toBeVisible();
  await expect(page.getByText(/America\/New_York/)).toBeVisible();
  await expect(page.getByText(/insufficient data/i)).toBeVisible();
  await expect(page.getByText(/1 comparable session/i)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("4/10");
  await captureDocumentationScreenshot(
    page,
    "02-math-review-recommendation.png",
  );

  await page.getByRole("button", { name: "Finish for today" }).click();
  await expect(
    page.getByRole("heading", {
      name: /saved without raw-answer leakage/i,
    }),
  ).toBeVisible();
});

test("Grade 5 reading gives low-confidence support, saves, refreshes, and resumes exact work", async ({
  page,
}) => {
  await resetBrowserState(page);
  await startSubject(page, "reading");

  await answerChoiceAndAdvance(page, "however");
  await answerChoiceAndAdvance(page, "hesitant");
  await answerChoiceAndAdvance(page, "shy");
  await answerTextAndAdvance(
    page,
    "Weary means tired because Leila dropped her backpack and sank onto a bench.",
  );
  await completeReflection(page, ["Not yet", "A lot", "Some frustration"]);
  await expect(
    page.getByText(/keep support close and take the next step together/i),
  ).toBeVisible();

  const exactExitChoice = page.getByRole("radio", {
    name: exactChoice("easily broken"),
  });
  await exactExitChoice.check();
  await page.getByRole("button", { name: "Save and exit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resume the exact step" }),
  ).toBeVisible();
  await expect(page.getByText(/Return to exit-ticket/i)).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Resume exact step" }).click();
  await expect(
    page.getByRole("heading", { name: "One last quick check" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: exactChoice("easily broken") }),
  ).toBeChecked();
  await captureDocumentationScreenshot(
    page,
    "03-reading-refresh-exact-resume.png",
  );

  await page.getByRole("button", { name: "Check response" }).click();
  await page.getByRole("button", { name: "See session choices" }).click();
  await expect(page.getByText("Aggregate only")).toBeVisible();
  await expect(page.getByText(/America\/New_York/)).toBeVisible();
});

test("the adversarial console captures all seven inspectable outcomes", async ({
  page,
}) => {
  await resetBrowserState(page);
  await page.getByRole("button", { name: "Run adversarial probes" }).click();
  const results = page.getByTestId("adversarial-results");
  await expect(results.getByRole("listitem")).toHaveCount(7);
  await expect(results.getByText(/Passed/)).toHaveCount(7);
  await captureDocumentationScreenshot(
    page,
    "04-adversarial-seven-passes.png",
  );
});
