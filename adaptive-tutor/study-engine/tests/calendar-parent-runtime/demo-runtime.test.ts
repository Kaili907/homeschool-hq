import { describe, expect, it } from "vitest";
import {
  RUNTIME_SCENARIOS,
  deterministicScenarioTrace,
  type RuntimeScenarioId,
} from "../../integration-labs/calendar-parent-runtime/demo-scenarios.js";

function scenario(id: RuntimeScenarioId) {
  const value = RUNTIME_SCENARIOS.find((item) => item.id === id);
  if (value === undefined) {
    throw new Error(`Missing demonstration scenario: ${id}`);
  }
  return value;
}

describe("working calendar/parent runtime demonstration model", () => {
  it("includes all six required end-to-end demonstrations", () => {
    expect(RUNTIME_SCENARIOS.map(({ id }) => id)).toEqual([
      "retrieval-failure",
      "successful-review",
      "partial-resume",
      "parent-rejects",
      "accommodation",
      "romeo",
    ]);

    expect(
      scenario("retrieval-failure").metrics.find(
        ({ label }) => label === "Reviews held",
      )?.value,
    ).not.toBe("0");
    expect(
      scenario("successful-review").metrics.find(
        ({ label }) => label === "Next interval",
      )?.value,
    ).toMatch(/days$/);
    expect(
      scenario("partial-resume").metrics.find(
        ({ label }) => label === "Required work",
      )?.value,
    ).toBe("50%");
    expect(
      scenario("parent-rejects").controls.some(
        ({ status }) => status === "history",
      ),
    ).toBe(true);
    expect(
      scenario("accommodation").metrics.find(
        ({ label }) => label === "Timer",
      )?.value,
    ).toBe("Hidden");
    expect(
      scenario("romeo").metrics.find(({ label }) => label === "Credentials")
        ?.value,
    ).toBe("0");
  });

  it("demonstrates all ten parent controls in the mobile-safe card model", () => {
    expect(
      scenario("accommodation").controls.map(({ label }) => label),
    ).toEqual([
      "Accept recommendation",
      "Reject recommendation",
      "Set maximum work duration",
      "Set break duration",
      "Hide timers",
      "Add accommodation",
      "Reschedule incomplete work",
      "Mark interruption",
      "Add private note",
      "Request teacher or tutor review",
    ]);
  });

  it("keeps deterministic traces stable across repeated evaluation", () => {
    const first = deterministicScenarioTrace();
    const second = deterministicScenarioTrace();

    expect(second).toStrictEqual(first);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toHaveLength(6);
    expect(first.every(({ ids }) => ids.length >= 3)).toBe(true);
    expect(
      first.every(
        ({ ids }) => new Set(ids).size === ids.length,
      ),
    ).toBe(true);
  });

  it("exposes estimates separately from actual duration and required work", () => {
    const partial = scenario("partial-resume");
    expect(
      partial.metrics.map(({ label, value }) => `${label}:${value}`),
    ).toEqual(
      expect.arrayContaining([
        "Required work:50%",
        "Remaining:16 min",
        "Actual work:10 min",
        "Continuation:idempotent",
      ]),
    );
  });

  it("contains no direct identity, raw-response, transcript, or diagnosis field", () => {
    const serialized = JSON.stringify(RUNTIME_SCENARIOS);

    expect(serialized).not.toMatch(
      /"(?:studentName|learnerName|email|phone|birthDate|rawAnswer|rawResponse|transcript|diagnosis|hiddenBehaviorScore|password|accessToken|sessionCookie)"\s*:/i,
    );
    expect(serialized).not.toMatch(
      /\b(lazy|bad student|failed again|cannot focus|attention span)\b/i,
    );
  });
});
