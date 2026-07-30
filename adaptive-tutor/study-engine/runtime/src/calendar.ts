export {
  CALENDAR_INTERRUPTION_CATEGORIES,
  CALENDAR_TO_CANONICAL_TASK,
  CANONICAL_TASK_TO_DEFAULT_CALENDAR_BLOCK,
  assertHouseholdTimeZone,
  calendarBlockTypeForCanonicalTask,
  calendarBlockView,
  canonicalTaskForCalendarType,
  completeCurrentSegment,
  dailyRequiredWorkCompletionBar,
  interruptCalendarBlock,
  learnerLocalDate,
  mergeCalendarBlocks,
  requiredWorkCompletionBar,
  resumeCalendarBlock,
  startCalendarBlock,
  toCanonicalResumePoint,
  type AutomaticContinuationResult,
  type CalendarBlock,
  type CalendarBlockView,
  type CalendarInterruptionCategory,
  type CalendarSegment,
  type CalendarSegmentInput,
  type ExactResumeMetadata,
} from "../../integration-labs/calendar-parent-runtime/calendar-runtime.ts";

import {
  createAutomaticContinuation as acceptedCreateAutomaticContinuation,
  createCalendarBlock as acceptedCreateCalendarBlock,
  resolveLearnerLocalStart as acceptedResolveLearnerLocalStart,
  type CalendarBlock,
  type CreateAutomaticContinuationInput as AcceptedContinuationInput,
  type CreateCalendarBlockInput as AcceptedCalendarBlockInput,
  type LocalTimeDisambiguation,
} from "../../integration-labs/calendar-parent-runtime/calendar-runtime.ts";

export type CreateCalendarBlockInput = Omit<
  AcceptedCalendarBlockInput,
  "scheduledStart" | "intendedLocalDate" | "localTimeDisambiguation"
> & {
  readonly scheduledStart: string;
  readonly intendedLocalDate: string;
  readonly localTimeDisambiguation?: LocalTimeDisambiguation;
};

export type CreateAutomaticContinuationInput = Omit<
  AcceptedContinuationInput,
  "scheduledStart" | "intendedLocalDate" | "localTimeDisambiguation"
> & {
  readonly scheduledStart: string;
  readonly intendedLocalDate: string;
  readonly localTimeDisambiguation?: LocalTimeDisambiguation;
};

function assertDisambiguation(
  value: LocalTimeDisambiguation | undefined,
): void {
  if (value !== undefined && value !== "earlier" && value !== "later") {
    throw new Error("localTimeDisambiguation must be earlier or later.");
  }
}

function assertExplicitPlacement(input: {
  readonly scheduledStart?: unknown;
  readonly intendedLocalDate?: unknown;
}): void {
  if (
    typeof input.scheduledStart !== "string" ||
    typeof input.intendedLocalDate !== "string"
  ) {
    throw new Error(
      "An explicit offset-bearing scheduledStart and intendedLocalDate are required.",
    );
  }
}

export function resolveLearnerLocalStart(
  localStart: string,
  householdTimeZone: string,
  disambiguation: LocalTimeDisambiguation = "earlier",
): string {
  assertDisambiguation(disambiguation);
  return acceptedResolveLearnerLocalStart(
    localStart,
    householdTimeZone,
    disambiguation,
  );
}

export function createCalendarBlock(
  input: CreateCalendarBlockInput,
): CalendarBlock {
  assertExplicitPlacement(input);
  assertDisambiguation(input.localTimeDisambiguation);
  return acceptedCreateCalendarBlock(input);
}

export function createAutomaticContinuation(
  blocks: readonly CalendarBlock[],
  input: CreateAutomaticContinuationInput,
) {
  assertExplicitPlacement(input);
  assertDisambiguation(input.localTimeDisambiguation);
  return acceptedCreateAutomaticContinuation(blocks, input);
}

export type { LocalTimeDisambiguation };
