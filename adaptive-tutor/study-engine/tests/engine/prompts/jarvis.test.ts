import { describe, expect, it } from "vitest";
import {
  JARVIS_PROMPT_IDS,
  JARVIS_PROMPT_TEMPLATES,
  JARVIS_SYSTEM_GUARDRAIL,
  renderJarvisPrompt,
} from "../../../prompts/index.js";
import {
  assertSafeCoachLanguage,
  inspectCoachLanguage,
  UnsafeCoachLanguageError,
} from "../../../engine/safety/index.js";

const prohibitedOutputs = [
  "You were not paying attention.",
  "You failed because you did not focus.",
  "You should be able to sit longer.",
] as const;

describe("Jarvis session-coach prompts", () => {
  it("provides every required coaching moment exactly once", () => {
    expect(JARVIS_PROMPT_IDS).toHaveLength(12);
    expect(new Set(JARVIS_PROMPT_IDS).size).toBe(12);
    expect(JARVIS_PROMPT_TEMPLATES.map(({ id }) => id)).toEqual(
      JARVIS_PROMPT_IDS,
    );
  });

  it("renders all fixed/default templates through the safety guard", () => {
    for (const id of JARVIS_PROMPT_IDS) {
      const message = renderJarvisPrompt(id);
      expect(message.length).toBeGreaterThan(10);
      expect(inspectCoachLanguage(message)).toEqual([]);
    }
    expect(inspectCoachLanguage(JARVIS_SYSTEM_GUARDRAIL)).toEqual([]);
  });

  it.each(prohibitedOutputs)("rejects prohibited output: %s", (message) => {
    expect(() => assertSafeCoachLanguage(message)).toThrowError(
      UnsafeCoachLanguageError,
    );
  });

  it.each([
    "You have ADHD.",
    "This proves you have an attention disorder.",
    "Your permanent attention span is ten minutes.",
    "You lost your break.",
  ])("rejects diagnostic, permanent, or punitive language: %s", (message) => {
    expect(inspectCoachLanguage(message)).not.toEqual([]);
  });

  it("does not allow unsafe free text to bypass output validation", () => {
    expect(() =>
      renderJarvisPrompt("explain_today_goal", {
        goal: "finish this because you were not paying attention",
      }),
    ).toThrowError(UnsafeCoachLanguageError);
    expect(() =>
      renderJarvisPrompt("recognize_strong_effort", {
        effortEvidence: "lost your break",
      }),
    ).toThrowError(UnsafeCoachLanguageError);
  });

  it("uses learner choice for a conservative duration increase", () => {
    const message = renderJarvisPrompt("suggest_small_duration_increase", {
      durationDeltaMinutes: 2,
      durationMinutes: 22,
    });

    expect(message).toContain("small increase of 2 minutes");
    expect(message).toContain("Would you like");
    expect(message).toContain("Keeping the current duration is also okay");
  });

  it("treats approved breaks as part of the plan", () => {
    const message = renderJarvisPrompt("suggest_break", {
      breakLabel: "movement",
    });

    expect(message).toContain("movement break");
    expect(message).toContain("not a failure");
  });

  it("normalizes control characters and limits arbitrary context length", () => {
    const message = renderJarvisPrompt("explain_today_goal", {
      goal: `practice\u0000fractions ${"safely ".repeat(100)}`,
    });

    expect(message).not.toContain("\u0000");
    expect(message.length).toBeLessThan(250);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid duration %s",
    (durationMinutes) => {
      expect(() =>
        renderJarvisPrompt("begin_work_block", { durationMinutes }),
      ).toThrowError(TypeError);
    },
  );

  it("does not collect or echo direct identity fields", () => {
    const contextKeys = [
      "taskLabel",
      "goal",
      "effortEvidence",
      "durationMinutes",
      "durationDeltaMinutes",
      "breakLabel",
      "parentConfiguredActivity",
    ];

    expect(contextKeys).not.toContain("studentName");
    expect(contextKeys).not.toContain("email");
    expect(
      JSON.stringify(
        JARVIS_PROMPT_TEMPLATES.map(({ id, purpose }) => ({ id, purpose })),
      ),
    ).not.toMatch(/studentName|email|birthdate|diagnosis|transcript/i);
  });
});
