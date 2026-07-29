#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { chromium } from "../../adaptive-tutor/study-engine/prototype/node_modules/playwright/index.mjs";

const previewUrl =
  process.argv[2] ??
  process.env.MASTERY_PREVIEW_URL ??
  "http://127.0.0.1:4178";
const axePath = fileURLToPath(
  new URL(
    "../../adaptive-tutor/study-engine/prototype/node_modules/axe-core/axe.min.js",
    import.meta.url,
  ),
);
const artifactDirectory = fileURLToPath(
  new URL("./artifacts/", import.meta.url),
);
const screenshotPath = fileURLToPath(
  new URL("./artifacts/mastery-desktop.png", import.meta.url),
);

const requiredQuestions = [
  "What is the student learning?",
  "What prerequisite is blocking progress?",
  "What evidence supports the current state?",
  "How confident is the system?",
  "What should happen next?",
  "When did the student last demonstrate the skill independently?",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runAxe(page, label) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    if (!globalThis.axe) throw new Error("axe-core did not initialize.");
    return globalThis.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
  });

  return {
    label,
    passes: result.passes.length,
    incomplete: result.incomplete.map((item) => ({
      id: item.id,
      impact: item.impact,
      help: item.help,
      nodes: item.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
        reviewReasons: [...node.any, ...node.all, ...node.none]
          .map((check) => check.message)
          .filter(Boolean),
      })),
    })),
    violations: result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  };
}

async function validateStatusText(page) {
  const statuses = await page.locator(".ma-mastery-status").evaluateAll((nodes) =>
    nodes.map((node) => ({
      state: node.getAttribute("data-state"),
      text: node.textContent?.trim() ?? "",
    })),
  );
  assert(statuses.length > 0, "No mastery status indicators were rendered.");
  for (const status of statuses) {
    assert(status.state, "A mastery status is missing its machine-readable state.");
    assert(
      status.text.length > 0,
      `Mastery state ${status.state ?? "(unknown)"} relies on color alone.`,
    );
  }
}

const browserErrors = [];
const results = [];
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`console: ${message.text()}`);
    }
  });

  await page.goto(previewUrl, { waitUntil: "networkidle" });
  await page.locator("main#mastery-main.ma-mastery").waitFor();
  assert(
    (await page.locator("#mastery-content").count()) === 1,
    "The skip-link target must be unique.",
  );

  await page.keyboard.press("Tab");
  const firstFocusedText = (
    (await page.locator(":focus").textContent()) ?? ""
  ).trim();
  assert(
    firstFocusedText === "Skip to mastery content",
    `Expected the skip link first in keyboard order; received "${firstFocusedText}".`,
  );
  await page.keyboard.press("Enter");
  assert(
    (await page.locator(":focus").getAttribute("id")) === "mastery-content",
    "Activating the skip link did not move focus to the mastery content.",
  );

  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    animations: "disabled",
  });

  const accessibleListButton = page.getByRole("button", {
    name: "Accessible list",
  });
  await accessibleListButton.focus();
  await page.keyboard.press("Enter");
  await page
    .locator('ol[aria-label="Mastery skills in text format"]')
    .waitFor();
  await validateStatusText(page);
  results.push(await runAxe(page, "desktop student accessible-list view"));

  const visibleStateLabels = [
    "Mastered",
    "Currently learning",
    "Needs reinforcement",
    "Blocked by prerequisite",
    "Not yet assessed",
    "Evidence uncertain",
  ];
  for (const label of visibleStateLabels) {
    assert(
      (await page.getByText(label, { exact: true }).count()) > 0,
      `The visible label "${label}" is missing from the mastery view.`,
    );
  }

  const parentViewButton = page.getByRole("button", {
    name: "Parent skill detail",
  });
  await parentViewButton.focus();
  await page.keyboard.press("Enter");
  await page.locator("article.ma-parent-skill").waitFor();
  for (const question of requiredQuestions) {
    assert(
      (await page.getByRole("heading", { name: question, exact: true }).count()) ===
        1,
      `Parent detail is missing required question heading "${question}".`,
    );
  }

  await page
    .getByText("Manual parent or teacher override", { exact: true })
    .click();
  assert(
    (await page.getByLabel("Override state").count()) === 1,
    "Override-state control does not have a unique accessible label.",
  );
  assert(
    (await page.getByLabel("Role").count()) === 1,
    "Override-role control does not have a unique accessible label.",
  );
  assert(
    (await page.getByLabel("Your name").count()) === 1,
    "Override actor input does not have a unique accessible label.",
  );
  assert(
    (await page.getByLabel("Reason for this decision").count()) === 1,
    "Override reason does not have a unique accessible label.",
  );
  results.push(await runAxe(page, "desktop parent detail and override form"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Student mastery map" }).click();
  await page.getByRole("button", { name: "Accessible list" }).click();
  await page
    .locator('ol[aria-label="Mastery skills in text format"]')
    .waitFor();
  results.push(await runAxe(page, "mobile student accessible-list view"));

  const violations = results.flatMap((result) =>
    result.violations.map((violation) => ({
      view: result.label,
      ...violation,
    })),
  );

  const summary = {
    previewUrl,
    screenshot: "tests/mastery/artifacts/mastery-desktop.png",
    views: results.map((result) => ({
      label: result.label,
      passes: result.passes,
      incomplete: result.incomplete,
      violationCount: result.violations.length,
    })),
    browserErrors,
    violations,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  assert(
    browserErrors.length === 0,
    `Browser errors were observed:\n${browserErrors.join("\n")}`,
  );
  assert(
    violations.length === 0,
    `axe-core found ${violations.length} WCAG A/AA violation(s).`,
  );
} finally {
  await browser.close();
}
