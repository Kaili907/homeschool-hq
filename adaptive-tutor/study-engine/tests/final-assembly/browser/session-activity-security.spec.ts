import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { expect, test } = require(
  "../../../runtime/node_modules/@playwright/test/index.js",
) as typeof import("../../../runtime/node_modules/@playwright/test/index.js");

const activityModuleUrl = `/@fs/${fileURLToPath(
  new URL("../../../../../src/security/session/activity.ts", import.meta.url),
).replaceAll("\\", "/")}`;

test("trusted programmatic scroll cannot extend learner activity", async ({
  page,
}) => {
  await page.goto("/");
  await page.setContent(`
    <main style="height: 4000px">
      <button type="button">Learner control</button>
    </main>
  `);

  const programmatic = await page.evaluate(async (moduleUrl) => {
    const { createBrowserLearnerActivityController } = await import(moduleUrl);
    let activityWrites = 0;
    const active = Object.freeze({ status: "active", session: {} });
    const session = {
      recheck: () => active,
      noteMeaningfulActivity: () => {
        activityWrites += 1;
        return active;
      },
      flushActivity: () => active,
    };
    const controller = createBrowserLearnerActivityController(session);
    window.scrollTo(0, 0);
    controller.start();
    let scrollEventTrusted: boolean | null = null;
    const observedScroll = new Promise<void>((resolve) => {
      window.addEventListener("scroll", (event) => {
        scrollEventTrusted = event.isTrusted;
        resolve();
      }, { once: true });
    });

    window.scrollTo(0, 100);
    await observedScroll;
    await new Promise((resolve) => setTimeout(resolve, 25));
    Object.assign(window, {
      __securityActivityTest: {
        controller,
        writes: () => activityWrites,
      },
    });
    return { scrollEventTrusted, activityWrites };
  }, activityModuleUrl);

  expect(programmatic).toEqual({
    scrollEventTrusted: true,
    activityWrites: 0,
  });

  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __securityActivityTest: { writes: () => number } }
  ).__securityActivityTest.writes())).toBe(1);

  await page.evaluate(async () => {
    window.scrollTo(0, 500);
    await new Promise((resolve) => setTimeout(resolve, 25));
    window.scrollTo(0, 700);
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  expect(await page.evaluate(() => (
    window as unknown as { __securityActivityTest: { writes: () => number } }
  ).__securityActivityTest.writes())).toBe(1);
});
