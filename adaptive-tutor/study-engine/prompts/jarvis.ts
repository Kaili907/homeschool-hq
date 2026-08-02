import { assertSafeCoachLanguage } from "../engine/safety/index.js";

export const JARVIS_PROMPT_IDS = [
  "begin_work_block",
  "explain_today_goal",
  "suggest_break",
  "resume_after_break",
  "offer_another_explanation",
  "offer_easier_example",
  "offer_different_example",
  "recognize_strong_effort",
  "suggest_small_duration_increase",
  "maintain_current_duration",
  "reduce_next_block",
  "escalate_for_review",
] as const;

export type JarvisPromptId = (typeof JARVIS_PROMPT_IDS)[number];

export type JarvisBreakLabel =
  | "planned"
  | "student_requested"
  | "movement"
  | "water"
  | "screen_rest"
  | "quiet_reset"
  | "parent_configured";

export interface JarvisPromptContext {
  readonly taskLabel?: string;
  readonly goal?: string;
  readonly effortEvidence?: string;
  readonly durationMinutes?: number;
  readonly durationDeltaMinutes?: number;
  readonly breakLabel?: JarvisBreakLabel;
  readonly parentConfiguredActivity?: string;
}

export interface JarvisPromptTemplate {
  readonly id: JarvisPromptId;
  readonly purpose: string;
  readonly render: (context?: JarvisPromptContext) => string;
}

const BREAK_LABELS: Readonly<Record<JarvisBreakLabel, string>> = {
  planned: "planned break",
  student_requested: "break you requested",
  movement: "movement break",
  water: "water break",
  screen_rest: "screen-rest break",
  quiet_reset: "quiet reset",
  parent_configured: "parent-configured activity",
};
const BREAK_LABEL_SET = new Set<JarvisBreakLabel>(
  Object.keys(BREAK_LABELS) as JarvisBreakLabel[],
);

function cleanPlainText(
  value: string | undefined,
  fallback: string,
  maxLength = 100,
): string {
  const cleaned = (value ?? fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
}

function positiveMinutes(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new TypeError("Prompt durations must be positive whole minutes.");
  }
  return value;
}

function safe(message: string): string {
  assertSafeCoachLanguage(message);
  return message;
}

function breakDescription(context: JarvisPromptContext): string {
  const label = context.breakLabel ?? "planned";
  if (!BREAK_LABEL_SET.has(label)) {
    throw new TypeError("Prompt break label is unsupported.");
  }
  if (label !== "parent_configured") {
    return BREAK_LABELS[label];
  }
  const activity = cleanPlainText(
    context.parentConfiguredActivity,
    "parent-configured activity",
    60,
  );
  return `${BREAK_LABELS.parent_configured} (${activity})`;
}

const templates: Readonly<Record<JarvisPromptId, JarvisPromptTemplate>> = {
  begin_work_block: {
    id: "begin_work_block",
    purpose: "Begin a bounded work block with learner agency.",
    render: (context = {}) => {
      const duration = positiveMinutes(context.durationMinutes, 10);
      const task = cleanPlainText(context.taskLabel, "today's task");
      return safe(
        `Let's begin a ${duration}-minute block for ${task}. We'll take it one step at a time, and you may ask for a pause.`,
      );
    },
  },
  explain_today_goal: {
    id: "explain_today_goal",
    purpose: "State a clear, limited goal.",
    render: (context = {}) => {
      const goal = cleanPlainText(
        context.goal,
        "practice one useful step",
        140,
      );
      return safe(
        `Today's goal is to ${goal}. We can use examples and work step by step.`,
      );
    },
  },
  suggest_break: {
    id: "suggest_break",
    purpose: "Offer a break without blame or penalty.",
    render: (context = {}) =>
      safe(
        `Would a ${breakDescription(context)} help before we decide what comes next? An approved break is part of the plan, not a failure.`,
      ),
  },
  resume_after_break: {
    id: "resume_after_break",
    purpose: "Resume gently after a break.",
    render: (context = {}) => {
      const task = cleanPlainText(context.taskLabel, "the task");
      return safe(
        `Welcome back. We can start with a quick check-in and one small step. Would you like to resume ${task}?`,
      );
    },
  },
  offer_another_explanation: {
    id: "offer_another_explanation",
    purpose: "Offer reteaching without implying inability.",
    render: () =>
      safe(
        "Would you like another explanation? I can show the same idea in a new way.",
      ),
  },
  offer_easier_example: {
    id: "offer_easier_example",
    purpose: "Reduce example difficulty while preserving the goal.",
    render: () =>
      safe(
        "Would you like an easier example first? We can use it to practice the same idea.",
      ),
  },
  offer_different_example: {
    id: "offer_different_example",
    purpose: "Change context without judging performance.",
    render: () =>
      safe(
        "Would a different example help? We can keep the goal and change the context.",
      ),
  },
  recognize_strong_effort: {
    id: "recognize_strong_effort",
    purpose: "Recognize observable effort rather than a fixed trait.",
    render: (context = {}) => {
      const evidence = cleanPlainText(
        context.effortEvidence,
        "kept trying each step",
        120,
      );
      return safe(
        `You ${evidence}. That steady effort gave us useful evidence for the next step.`,
      );
    },
  },
  suggest_small_duration_increase: {
    id: "suggest_small_duration_increase",
    purpose: "Offer, rather than impose, a conservative increase.",
    render: (context = {}) => {
      const increase = positiveMinutes(context.durationDeltaMinutes, 1);
      const duration = positiveMinutes(context.durationMinutes, 11);
      const currentDuration = duration - increase;
      if (
        increase > 5 ||
        currentDuration <= 0 ||
        increase / currentDuration > 0.1 + Number.EPSILON
      ) {
        throw new TypeError(
          "Prompt duration increase must be no more than five minutes or ten percent.",
        );
      }
      return safe(
        `Recent comparable blocks went well. The plan permits a small increase of ${increase} minute${increase === 1 ? "" : "s"}, to ${duration} minutes. Would you like to try that next time? Keeping the current duration is also okay.`,
      );
    },
  },
  maintain_current_duration: {
    id: "maintain_current_duration",
    purpose: "Normalize holding a stable duration.",
    render: (context = {}) => {
      const duration = positiveMinutes(context.durationMinutes, 10);
      return safe(
        `We'll keep the current ${duration}-minute block for now. Holding steady gives us more comparable evidence.`,
      );
    },
  },
  reduce_next_block: {
    id: "reduce_next_block",
    purpose: "Reduce duration without blame.",
    render: (context = {}) => {
      const duration = positiveMinutes(context.durationMinutes, 8);
      return safe(
        `Let's make the next block ${duration} minutes so the plan stays manageable. This is a pacing adjustment, not a judgment.`,
      );
    },
  },
  escalate_for_review: {
    id: "escalate_for_review",
    purpose: "Pause automatic changes when adult review is appropriate.",
    render: () =>
      safe(
        "The signals are mixed or this change needs review. Let's ask a parent or teacher to review the plan before changing it.",
      ),
  },
};

export const JARVIS_PROMPT_TEMPLATES: readonly JarvisPromptTemplate[] =
  JARVIS_PROMPT_IDS.map((id) => templates[id]);

export const JARVIS_SYSTEM_GUARDRAIL =
  "Act only as a supportive pacing coach. Use the supplied engine decision; do not calculate mastery, infer a condition, blame the learner, describe attention as permanent, revoke approved breaks, or pressure longer sitting. Offer choices and defer mixed or unsafe cases to a parent or teacher.";

export function renderJarvisPrompt(
  id: JarvisPromptId,
  context: JarvisPromptContext = {},
): string {
  return templates[id].render(context);
}
