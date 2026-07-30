import type { LearnerAction as StudyUxLearnerAction } from "@study-ui/LearnerActions";
import { UI_ADAPTER_VERSION } from "../runtimeTypes";

/**
 * Runtime-safe projection of the verified Study-UX learner-action vocabulary.
 *
 * This adapter keeps the state machine independent from the TSX component
 * module, while the type-only import and parity test prevent vocabulary drift.
 */
export const LEARNER_ACTION_VOCABULARY_VERSION =
  `${UI_ADAPTER_VERSION}.learner-actions` as const;

export const LEARNER_ACTIONS = [
  "I need help",
  "Show me another way",
  "Talk me through it",
  "Let’s do one together",
  "Give me a different example",
  "This is too easy",
  "This is too hard",
  "I need a break",
  "Read this to me",
  "Let me answer aloud",
  "Continue independently",
] as const satisfies readonly StudyUxLearnerAction[];

export type LearnerAction = (typeof LEARNER_ACTIONS)[number];
