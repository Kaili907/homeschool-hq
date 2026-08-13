import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { expect, test } = require(
  "../../../runtime/node_modules/@playwright/test/index.js",
) as typeof import("../../../runtime/node_modules/@playwright/test/index.js");

const activityModuleUrl = `/@fs/${fileURLToPath(
  new URL("../../../../../src/security/session/activity.ts", import.meta.url),
).replaceAll("\\", "/")}`;
const learnerSessionModuleUrl = `/@fs/${fileURLToPath(
  new URL("../../../../../src/security/session/learnerSession.ts", import.meta.url),
).replaceAll("\\", "/")}`;
const sessionPolicyModuleUrl = `/@fs/${fileURLToPath(
  new URL("../../../../../src/security/contracts/sessionPolicy.ts", import.meta.url),
).replaceAll("\\", "/")}`;

async function installActivityCounter(
  page: import("../../../runtime/node_modules/@playwright/test/index.js").Page,
) {
  await page.evaluate(async (moduleUrl) => {
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
    controller.start();
    Object.assign(window, {
      __securityActivityTest: {
        controller,
        writes: () => activityWrites,
      },
    });
  }, activityModuleUrl);
}

async function activityWrites(
  page: import("../../../runtime/node_modules/@playwright/test/index.js").Page,
) {
  return page.evaluate(() => (
    window as unknown as { __securityActivityTest: { writes: () => number } }
  ).__securityActivityTest.writes());
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.setContent(`
    <main style="height: 20000px">
      <button type="button">Learner control</button>
    </main>
  `);
});

test("trusted programmatic scroll has zero learner activity authority", async ({
  page,
}) => {
  await installActivityCounter(page);
  const scrollEventTrusted = await page.evaluate(async () => {
    let trusted: boolean | null = null;
    const observedScroll = new Promise<void>((resolve) => {
      window.addEventListener("scroll", (event) => {
        trusted = event.isTrusted;
        resolve();
      }, { once: true });
    });
    window.scrollTo(0, 100);
    await observedScroll;
    return trusted;
  });

  expect(scrollEventTrusted).toBe(true);
  expect(await activityWrites(page)).toBe(0);

  await page.evaluate(async () => {
    for (const y of [300, 500, 700, 900]) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  });
  expect(await activityWrites(page)).toBe(0);
});

test("one native multi-wheel burst counts once and a later gesture counts again", async ({
  page,
}) => {
  await installActivityCounter(page);

  // Playwright cannot reproduce OS-generated inertia precisely. Repeated native
  // wheel input over longer than the quiet period, without ever becoming quiet,
  // exercises the production gesture state against the strongest available burst.
  for (let event = 0; event < 14; event += 1) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(200);
  }
  await expect.poll(() => activityWrites(page)).toBe(1);

  await page.evaluate(async () => {
    for (const y of [2500, 2800, 3100, 3400, 3700]) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  });
  expect(await activityWrites(page)).toBe(1);

  await page.waitForTimeout(2_100);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => activityWrites(page)).toBe(2);
});

test("pointer and keyboard interactions do not receive duplicate scroll activity", async ({
  page,
}) => {
  await installActivityCounter(page);

  await page.getByRole("button", { name: "Learner control" }).click();
  await expect.poll(() => activityWrites(page)).toBe(1);
  await page.evaluate(async () => {
    window.scrollTo(0, 500);
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  expect(await activityWrites(page)).toBe(1);

  await page.keyboard.press("PageDown");
  await expect.poll(() => activityWrites(page)).toBe(2);
  await page.waitForTimeout(100);
  expect(await activityWrites(page)).toBe(2);
});

test("nonqualifying scroll cannot move the actual learner idle boundary", async ({
  page,
}) => {
  await page.evaluate(async ([activityUrl, learnerUrl, policyUrl]) => {
    const [{ createBrowserLearnerActivityController }, { LearnerSessionController }, { SECURITY_SESSION_POLICY }] =
      await Promise.all([import(activityUrl), import(learnerUrl), import(policyUrl)]);
    let now = Date.parse("2026-08-09T12:00:00.000Z");
    const revocation = {
      currentEpoch: () => 0,
      subscribe: () => () => undefined,
    };
    window.sessionStorage.clear();
    const session = new LearnerSessionController({
      storage: window.sessionStorage,
      revocation,
      ownershipLockManager: navigator.locks,
      clock: () => now,
      randomUUID: () => "d9428888-122b-4f9b-9424-1f35c63d5750",
      activityWriteThrottleMs: 0,
    });
    let controller = createBrowserLearnerActivityController(session);
    await session.create("p1");
    controller.start();
    Object.assign(window, {
      __securityIdleBoundaryTest: {
        idleTimeoutMs: SECURITY_SESSION_POLICY.learner.idleTimeoutMs,
        setNow: (value: number) => { now = value; },
        check: () => session.recheck(),
        lastActivity: () => session.session?.lastMeaningfulActivityAt ?? null,
        restart: async (value: number) => {
          controller.stop();
          now = value;
          await session.create("p1");
          controller = createBrowserLearnerActivityController(session);
          controller.start();
        },
      },
    });
  }, [activityModuleUrl, learnerSessionModuleUrl, sessionPolicyModuleUrl] as const);

  const firstActivityAt = Date.parse("2026-08-09T12:00:01.000Z");
  await page.evaluate((value) => {
    const state = (window as unknown as {
      __securityIdleBoundaryTest: { setNow: (now: number) => void };
    }).__securityIdleBoundaryTest;
    state.setNow(value);
  }, firstActivityAt);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => (
    window as unknown as {
      __securityIdleBoundaryTest: { lastActivity: () => string | null };
    }
  ).__securityIdleBoundaryTest.lastActivity())).toBe(new Date(firstActivityAt).toISOString());

  const first = await page.evaluate(() => {
    const state = (window as unknown as {
      __securityIdleBoundaryTest: {
        idleTimeoutMs: number;
        lastActivity: () => string | null;
      };
    }).__securityIdleBoundaryTest;
    return { idleTimeoutMs: state.idleTimeoutMs, lastActivity: state.lastActivity() };
  });
  expect(first.lastActivity).toBe(new Date(firstActivityAt).toISOString());

  await page.evaluate((value) => {
    const state = (window as unknown as {
      __securityIdleBoundaryTest: { setNow: (now: number) => void };
    }).__securityIdleBoundaryTest;
    state.setNow(value);
  }, firstActivityAt + first.idleTimeoutMs - 1);
  await page.mouse.wheel(0, 120);
  await page.evaluate(async () => {
    window.scrollTo(0, 1_000);
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  expect(await page.evaluate(() => (
    window as unknown as {
      __securityIdleBoundaryTest: { lastActivity: () => string | null };
    }
  ).__securityIdleBoundaryTest.lastActivity())).toBe(new Date(firstActivityAt).toISOString());

  expect(await page.evaluate((value) => {
    const state = (window as unknown as {
      __securityIdleBoundaryTest: {
        setNow: (now: number) => void;
        check: () => unknown;
      };
    }).__securityIdleBoundaryTest;
    state.setNow(value);
    return state.check();
  }, firstActivityAt + first.idleTimeoutMs)).toEqual({ status: "ended", reason: "idle-expired" });

  const secondStartedAt = firstActivityAt + first.idleTimeoutMs + 10_000;
  await page.evaluate(async (value) => {
    const state = (window as unknown as {
      __securityIdleBoundaryTest: { restart: (now: number) => Promise<void> };
    }).__securityIdleBoundaryTest;
    await state.restart(value);
  }, secondStartedAt);
  const secondActivityAt = secondStartedAt + first.idleTimeoutMs - 1;
  await page.evaluate((value) => {
    const state = (window as unknown as {
      __securityIdleBoundaryTest: { setNow: (now: number) => void };
    }).__securityIdleBoundaryTest;
    state.setNow(value);
  }, secondActivityAt);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => (
    window as unknown as {
      __securityIdleBoundaryTest: { lastActivity: () => string | null };
    }
  ).__securityIdleBoundaryTest.lastActivity())).toBe(new Date(secondActivityAt).toISOString());

  expect(await page.evaluate((value) => {
    const state = (window as unknown as {
      __securityIdleBoundaryTest: {
        setNow: (now: number) => void;
        check: () => unknown;
      };
    }).__securityIdleBoundaryTest;
    state.setNow(value);
    return state.check();
  }, secondStartedAt + first.idleTimeoutMs)).toMatchObject({ status: "active" });
  expect(await page.evaluate((value) => {
    const state = (window as unknown as {
      __securityIdleBoundaryTest: {
        setNow: (now: number) => void;
        check: () => unknown;
      };
    }).__securityIdleBoundaryTest;
    state.setNow(value);
    return state.check();
  }, secondActivityAt + first.idleTimeoutMs)).toEqual({ status: "ended", reason: "idle-expired" });
});
