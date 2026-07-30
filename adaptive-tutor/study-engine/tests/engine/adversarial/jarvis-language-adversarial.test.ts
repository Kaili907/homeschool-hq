import { describe, expect, it } from "vitest";

import {
  inspectCoachLanguage,
  UnsafeCoachLanguageError,
} from "../../../engine/safety/index.js";
import {
  JARVIS_PROMPT_IDS,
  JARVIS_SYSTEM_GUARDRAIL,
  renderJarvisPrompt,
  type JarvisPromptContext,
} from "../../../prompts/index.js";

const prohibitedLanguage = [
  "You were not paying attention.",
  "You weren't paying attention.",
  "You were clearly not paying attention.",
  "You failed because you did not focus.",
  "You failed because you weren't focused.",
  "You obviously failed because you did not focus.",
  "You should be able to sit longer.",
  "You have ADHD.",
  "You may have ADHD.",
  "You have severe ADHD.",
  "You are dyslexic.",
  "This proves you have an attention disorder.",
  "Your permanent attention span is short.",
  "Your attention span will always be short.",
  "Your attention span is permanently short.",
  "You lost your break.",
  "Your break is forfeited.",
  "You don't get a break.",
] as const;

describe("adversarial Jarvis language and prompt injection validation", () => {
  it.each(prohibitedLanguage)("detects hostile coaching language: %s", (text) => {
    expect(inspectCoachLanguage(text)).not.toEqual([]);
  });

  it("blocks hostile free text injected through every text-bearing context field", () => {
    const attacks: readonly [
      Parameters<typeof renderJarvisPrompt>[0],
      JarvisPromptContext,
    ][] = [
      [
        "begin_work_block",
        { taskLabel: "fractions; you were not paying attention" },
      ],
      [
        "explain_today_goal",
        { goal: "continue because you failed because you did not focus" },
      ],
      [
        "recognize_strong_effort",
        { effortEvidence: "lost your break" },
      ],
      [
        "suggest_break",
        {
          breakLabel: "parent_configured",
          parentConfiguredActivity: "quiet time; you have ADHD",
        },
      ],
    ];

    for (const [id, context] of attacks) {
      expect(() => renderJarvisPrompt(id, context)).toThrowError(
        UnsafeCoachLanguageError,
      );
    }
  });

  it("rejects an invalid runtime break label instead of rendering undefined", () => {
    expect(() =>
      renderJarvisPrompt("suggest_break", {
        breakLabel: "punishment" as never,
      }),
    ).toThrowError(TypeError);
  });

  it("rejects a duration increase larger than the largest supported grade-band step", () => {
    expect(() =>
      renderJarvisPrompt("suggest_small_duration_increase", {
        durationDeltaMinutes: 100,
        durationMinutes: 110,
      }),
    ).toThrowError(TypeError);
  });

  it("renders all defaults without blame, diagnosis, permanence, or coercion", () => {
    for (const id of JARVIS_PROMPT_IDS) {
      const message = renderJarvisPrompt(id);
      expect(inspectCoachLanguage(message)).toEqual([]);
      expect(message).not.toMatch(
        /not paying attention|failed because|sit longer|diagnos|adhd|dyslex|permanent attention|always be short|lost your break|break is forfeited/i,
      );
    }
    expect(inspectCoachLanguage(JARVIS_SYSTEM_GUARDRAIL)).toEqual([]);
  });

  it("does not echo accidental PII fields that are outside the prompt contract", () => {
    const context = {
      taskLabel: "fractions",
      durationMinutes: 10,
      studentName: "PRIVATE STUDENT",
      email: "private@example.invalid",
      birthdate: "2000-01-01",
      diagnosis: "PRIVATE DIAGNOSIS",
    } as unknown as JarvisPromptContext;

    expect(renderJarvisPrompt("begin_work_block", context)).not.toMatch(
      /PRIVATE STUDENT|private@example\.invalid|2000-01-01|PRIVATE DIAGNOSIS|studentName|email|birthdate|diagnosis/,
    );
  });
});
