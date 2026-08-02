import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const labDirectory = resolve(scriptsDirectory, "..");
const screenshotDirectory = join(labDirectory, "screenshots");
const baseUrl = process.env.CALENDAR_PARENT_RUNTIME_URL ?? "http://127.0.0.1:4189";
const executablePath =
  process.env.CHROME_EXECUTABLE ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const targets = [
  {
    name: "01-retrieval-failure-desktop.png",
    scenario: "retrieval-failure",
    viewport: { width: 1440, height: 1050 },
  },
  {
    name: "02-partial-resume-desktop.png",
    scenario: "partial-resume",
    viewport: { width: 1440, height: 1050 },
  },
  {
    name: "03-parent-controls-mobile.png",
    scenario: "accommodation",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "04-romeo-adapter-desktop.png",
    scenario: "romeo",
    viewport: { width: 1440, height: 1050 },
  },
];

await mkdir(screenshotDirectory, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  headless: true,
});

const artifacts = [];
try {
  for (const target of targets) {
    const page = await browser.newPage({
      viewport: target.viewport,
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await page.goto(
      `${baseUrl}/?scenario=${encodeURIComponent(target.scenario)}`,
      { waitUntil: "networkidle" },
    );
    await page.locator(
      `[data-active-scenario="${target.scenario}"]`,
    ).waitFor();

    const audit = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      const minimumButtonHeight = Math.min(
        ...buttons.map((button) => button.getBoundingClientRect().height),
      );
      return {
        scenarioTabs: document.querySelectorAll("[data-scenario]").length,
        minimumButtonHeight,
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
        title: document.title,
      };
    });

    if (pageErrors.length > 0) {
      throw new Error(
        `Browser errors in ${target.scenario}: ${pageErrors.join("; ")}`,
      );
    }
    if (audit.scenarioTabs !== 6) {
      throw new Error(`${target.scenario} did not expose all six scenarios.`);
    }
    if (audit.minimumButtonHeight < 44) {
      throw new Error(
        `${target.scenario} has a touch target below 44px: ${audit.minimumButtonHeight}`,
      );
    }
    if (audit.horizontalOverflow) {
      throw new Error(`${target.scenario} has horizontal viewport overflow.`);
    }

    const path = join(screenshotDirectory, target.name);
    const bytes = await page.screenshot({
      path,
      fullPage: true,
      animations: "disabled",
    });
    artifacts.push({
      file: target.name,
      scenario: target.scenario,
      viewport: target.viewport,
      title: audit.title,
      sha256: createHash("sha256")
        .update(bytes)
        .digest("hex")
        .toUpperCase(),
      result: "PASS",
    });
    await page.close();
  }
} finally {
  await browser.close();
}

const manifest = {
  artifact: "manuel-academy.calendar-parent-runtime.screenshots",
  capturedOn: "2026-07-29",
  browser: "system Google Chrome via playwright-core",
  baseUrl,
  artifacts,
};
await writeFile(
  join(screenshotDirectory, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

process.stdout.write(
  `${JSON.stringify({ result: "PASS", screenshots: artifacts }, null, 2)}\n`,
);
