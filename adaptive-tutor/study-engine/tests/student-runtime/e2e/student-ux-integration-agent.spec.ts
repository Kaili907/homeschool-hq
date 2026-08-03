import playwrightTestModule, {
  type Locator,
  type Page,
} from "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js";

const { expect, test } = playwrightTestModule as unknown as typeof import(
  "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js"
);

async function resetBrowserState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function expectTouchTarget(locator: Locator, label: string) {
  await expect(locator, `${label} is visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} has a measurable box`).not.toBeNull();
  expect(box?.width ?? 0, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0, `${label} height`).toBeGreaterThanOrEqual(44);
}

test("task-first mobile flow keeps focus, captions, reason-coded support, and canonical references usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 667 });
  await resetBrowserState(page);

  await expect(page.getByText("Card 5 · DEC-012 constraints")).toBeVisible();
  await page.getByRole("button", { name: "Start mathematics" }).click();

  const goalHeading = page.getByRole("heading", {
    name: /I can build and explain equivalent fractions/i,
  });
  await expect(goalHeading).toBeFocused();
  await expect(page.locator("#main-content")).toContainText(
    "6 learning segments",
  );
  await expect(page.locator("#main-content")).not.toContainText(
    "7 canonical segments",
  );

  const readyRadio = page.getByRole("radio", { name: /Ready to begin/i });
  await page.getByText("Ready to begin", { exact: true }).click();
  await expect(readyRadio).toBeChecked();
  await page.getByRole("button", { name: "Begin warm-up" }).click();

  const taskHeading = page.getByRole("heading", {
    name: "Wake up what you already know",
  });
  await expect(taskHeading).toBeFocused();
  const task = page.locator(".task-panel");
  const support = page.locator(".learning-support");
  const supportHandle = await support.elementHandle();
  expect(supportHandle).not.toBeNull();
  expect(
    await task.evaluate(
      (taskElement, supportElement) =>
        Boolean(
          taskElement.compareDocumentPosition(supportElement as Node) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      supportHandle,
    ),
  ).toBe(true);
  await expect(task).toContainText(
    /Canonical task reference.*seg_[a-z0-9]+/i,
  );

  const comfortSummary = page
    .locator("summary")
    .filter({ hasText: "Comfort & access" })
    .first();
  await comfortSummary.click();
  const comfortDetails = comfortSummary.locator("xpath=..");
  const captions = comfortDetails.getByRole("checkbox", {
    name: /Captions/i,
  });
  await expect(captions).toBeChecked();
  await captions.click();
  await expect(captions).toBeChecked();
  await expect(
    page.getByText(/Captions stay on in this accessibility-first integration lab/i),
  ).toBeVisible();

  await comfortDetails
    .getByRole("radio", { name: "Hidden", exact: true })
    .check();
  await expect(page.getByTestId("hidden-timer")).toBeVisible();
  await expect(page.getByTestId("hidden-timer")).not.toContainText(/\d/);
  await page.keyboard.press("Escape");
  await expect(comfortSummary).toBeFocused();
  await expect(comfortDetails).not.toHaveAttribute("open", "");

  const supportSummary = page
    .locator("summary")
    .filter({ hasText: /Choose how Jarvis can help/i });
  await supportSummary.click();
  await page.getByRole("button", { name: "This is too hard" }).click();
  await page.getByRole("button", { name: "Show transcript" }).click();
  const transcript = page.getByRole("region", { name: "Session transcript" });
  await expect(transcript).toContainText(
    /Thanks for saying that.*smaller example.*same goal/i,
  );
  await expect(transcript).toContainText(
    "learner-action:more-support",
  );
  await expect(transcript).not.toContainText(
    /failed|lazy|behind|try harder|too many breaks/i,
  );
  await transcript.focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Show transcript" }),
  ).toBeFocused();

  await page.getByRole("radio", { name: /^2\/4\b/i }).check();
  await page.getByRole("button", { name: "Check response" }).click();
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Build an equivalent fraction" }),
  ).toBeFocused();

  await expectTouchTarget(
    page.getByRole("button", { name: "I need a break", exact: true }),
    "direct break action",
  );
  await expectTouchTarget(
    page.getByRole("button", { name: "Save and exit", exact: true }).last(),
    "direct save action",
  );

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
});
