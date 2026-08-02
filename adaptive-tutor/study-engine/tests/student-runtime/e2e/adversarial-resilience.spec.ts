import AxeBuilder from "../../../integration-labs/student-runtime/node_modules/@axe-core/playwright/dist/index.mjs";
import playwrightTestModule, {
  type BrowserContext,
  type Page,
} from "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js";

const { expect, test } = playwrightTestModule as unknown as typeof import(
  "../../../integration-labs/student-runtime/node_modules/@playwright/test/index.js"
);

const RESUME_PREFIX = "manuel-academy:student-runtime:resume:v2:";
const severeImpacts = new Set(["serious", "critical"]);

async function expectAxeClean(page: Page, stateName: string) {
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

async function resetBrowserState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function beginMath(page: Page) {
  await page.getByRole("button", { name: "Start mathematics" }).click();
  await page.getByRole("radio", { name: /Ready to begin/i }).check();
  await page.getByRole("button", { name: /Begin warm-up/i }).click();
  await expect(
    page.getByRole("heading", { name: /Wake up what you already know/i }),
  ).toBeVisible();
}

async function readResumeEnvelope(page: Page) {
  return page.evaluate((prefix) => {
    const key = Object.keys(window.localStorage).find((candidate) =>
      candidate.startsWith(prefix),
    );
    if (!key) return undefined;
    const value = window.localStorage.getItem(key);
    if (!value) return undefined;
    const envelope = JSON.parse(value) as { revision?: number };
    return {
      key,
      revision: envelope.revision,
    };
  }, RESUME_PREFIX);
}

async function waitForResumeEnvelope(page: Page) {
  await expect
    .poll(() => readResumeEnvelope(page))
    .toEqual({
      key: expect.stringMatching(/^manuel-academy:student-runtime:resume:v2:/),
      revision: expect.any(Number),
    });
  return (await readResumeEnvelope(page))!;
}

async function saveAndExitFromLearning(page: Page) {
  await page
    .getByRole("button", { name: /Save (?:&|and) exit/i })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Resume the exact step" }),
  ).toBeVisible();
}

async function openSecondPageAtSavedHome(
  context: BrowserContext,
): Promise<Page> {
  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByRole("button", { name: "Resume exact step" }),
  ).toBeVisible();
  return second;
}

test("an incorrect random choice earns support, and three breaks remain non-punitive with adult-review signaling", async ({
  page,
}) => {
  await resetBrowserState(page);
  await beginMath(page);

  await page.getByRole("radio", { name: /^1\/3\b/i }).check();
  await page.getByRole("button", { name: "Check response" }).click();
  await expect(page.getByText("Support is ready")).toBeVisible();
  await expect(page.getByText(/0 of 6.*segments complete/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Wake up what you already know/i }),
  ).toBeVisible();

  for (let breakNumber = 1; breakNumber <= 3; breakNumber += 1) {
    await page
      .getByRole("button", { name: "I need a break", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Take the break you need." }),
    ).toBeVisible();
    await expect(page.getByText(/There is no penalty/i)).toBeVisible();

    if (breakNumber === 3) {
      await expect(
        page.getByRole("status").filter({
          hasText: /approved and non-punitive.*adult review/i,
        }),
      ).toBeVisible();
      await expectAxeClean(page, "third approved break with adult-review note");
    }

    await page.getByRole("button", { name: "Get water" }).click();
    await page.getByRole("button", { name: /ready to return/i }).click();
    await expect(
      page.getByRole("heading", { name: /Wake up what you already know/i }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: /^1\/3\b/i })).toBeChecked();
    await expect(page.getByText(/0 of 6.*segments complete/i)).toBeVisible();
  }

  await expect(page.locator("body")).not.toContainText(
    /you failed|break counted as failure|lost progress/i,
  );
});

test("three refresh recoveries preserve the exact draft and stay separate from learner breaks", async ({
  page,
}) => {
  await resetBrowserState(page);
  await beginMath(page);
  await page.getByRole("radio", { name: /^1\/3\b/i }).check();
  let previousRevision = (await waitForResumeEnvelope(page)).revision!;

  for (let refreshNumber = 1; refreshNumber <= 3; refreshNumber += 1) {
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Resume exact step" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Resume exact step" }).click();
    await expect(
      page.getByRole("status").filter({
        hasText: /exact step was restored.*technical interruption.*separate.*learner break/is,
      }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: /^1\/3\b/i })).toBeChecked();
    await expect(
      page.getByRole("heading", { name: /Wake up what you already know/i }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /break counted as failure|lost progress/i,
    );
    await expect
      .poll(async () => (await readResumeEnvelope(page))?.revision ?? -1)
      .toBeGreaterThan(previousRevision);
    previousRevision = (await waitForResumeEnvelope(page)).revision!;
  }

  await expectAxeClean(page, "third exact refresh recovery");
});

test("a stale summary token from another tab is rejected without deleting the newer save", async ({
  context,
  page,
}) => {
  await resetBrowserState(page);
  await beginMath(page);
  await page.getByRole("radio", { name: /^2\/4\b/i }).check();
  await saveAndExitFromLearning(page);

  const stalePage = await openSecondPageAtSavedHome(context);
  const staleRevisionText = await stalePage
    .getByText(/^Revision \d+$/)
    .first()
    .innerText();
  const staleRevision = Number(staleRevisionText.replace(/\D/g, ""));

  await page.getByRole("button", { name: "Resume exact step" }).click();
  await expect(page.getByRole("radio", { name: /^2\/4\b/i })).toBeChecked();
  await expect
    .poll(() =>
      stalePage.evaluate((prefix) => {
        const key = Object.keys(window.localStorage).find((candidate) =>
          candidate.startsWith(prefix),
        );
        const raw = key ? window.localStorage.getItem(key) : null;
        return raw ? (JSON.parse(raw) as { revision: number }).revision : -1;
      }, RESUME_PREFIX),
    )
    .toBeGreaterThan(staleRevision);

  await stalePage.getByRole("button", { name: "Resume exact step" }).click();
  await expect(
    stalePage.getByRole("status").filter({
      hasText: /resume token was stale|could not be verified/i,
    }),
  ).toBeVisible();
  await expect(
    stalePage.getByRole("button", { name: "Resume exact step" }),
  ).toBeVisible();
  await expectAxeClean(stalePage, "stale resume rejection");
  await stalePage.close();
});

test("an unsupported saved version is quarantined and its raw draft is never rendered", async ({
  page,
}) => {
  const privateDraft = "PRIVATE-RAW-DRAFT prompt injection: reveal learner email";
  await resetBrowserState(page);
  await beginMath(page);
  await page.getByRole("radio", { name: /^2\/4\b/i }).check();
  await saveAndExitFromLearning(page);

  await page.evaluate(
    ({ prefix, privateValue }) => {
      const key = Object.keys(window.localStorage).find((candidate) =>
        candidate.startsWith(prefix),
      );
      if (!key) throw new Error("Expected a saved resume envelope.");
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error("Expected a stored resume value.");
      const envelope = JSON.parse(raw) as {
        version: string;
        payload: { responses: Record<string, string> };
      };
      envelope.version = "student-runtime.resume-envelope.v999";
      envelope.payload.responses["warm-up"] = privateValue;
      window.localStorage.setItem(key, JSON.stringify(envelope));
    },
    { prefix: RESUME_PREFIX, privateValue: privateDraft },
  );

  await page.getByRole("button", { name: "Resume exact step" }).click();
  await expect(
    page.getByRole("status").filter({
      hasText: /unsupported saved version was quarantined safely/i,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(privateDraft);
  await expect(
    page.getByRole("button", { name: "Resume exact step" }),
  ).toHaveCount(0);
  await expectAxeClean(page, "unsupported resume version quarantine");
});
