import type { SegmentId } from "../../contracts/common.js";
import {
  STUDY_TASK_TYPES,
  type StudyTaskType,
} from "../../contracts/study-plan.js";
import type { ResumePoint } from "../../contracts/study-session.js";

/**
 * Session 4's 13 calendar labels are retained as a boundary vocabulary. Each
 * label is translated to a Session 1 canonical StudyTaskType before it enters
 * this runtime.
 */
export const SESSION_4_CALENDAR_BLOCK_TYPES = [
  "new_instruction",
  "guided_practice",
  "independent_practice",
  "reading",
  "writing",
  "memorization",
  "assessment",
  "project_work",
  "review",
  "physical_education",
  "outside_activity",
  "romeo_virtual_academy_activity",
  "parent_created_activity",
] as const;

export type Session4CalendarBlockType =
  (typeof SESSION_4_CALENDAR_BLOCK_TYPES)[number];

export interface CanonicalTaskMapping {
  readonly taskType: StudyTaskType;
  readonly customTaskTypeId?: string;
}

export const CALENDAR_TO_CANONICAL_TASK = {
  new_instruction: { taskType: "direct-instruction" },
  guided_practice: { taskType: "guided-practice" },
  independent_practice: { taskType: "independent-practice" },
  reading: { taskType: "reading" },
  writing: { taskType: "writing" },
  memorization: { taskType: "retrieval-practice" },
  assessment: { taskType: "mastery-check" },
  project_work: { taskType: "project-work" },
  review: { taskType: "retrieval-practice" },
  physical_education: {
    taskType: "custom",
    customTaskTypeId: "physical-education",
  },
  outside_activity: {
    taskType: "custom",
    customTaskTypeId: "outside-activity",
  },
  romeo_virtual_academy_activity: {
    taskType: "custom",
    customTaskTypeId: "romeo-virtual-academy-activity",
  },
  parent_created_activity: {
    taskType: "custom",
    customTaskTypeId: "parent-created-activity",
  },
} as const satisfies Record<Session4CalendarBlockType, CanonicalTaskMapping>;

/**
 * Card 5's canonical-to-calendar direction. Ambiguous canonical task types are
 * deliberately absent: their plan must supply an explicit Session 4 block
 * type instead of asking this projection to guess from a title.
 */
export const CANONICAL_TASK_TO_DEFAULT_CALENDAR_BLOCK = {
  "direct-instruction": "new_instruction",
  "worked-example": "new_instruction",
  "guided-practice": "guided_practice",
  "independent-practice": "independent_practice",
  "retrieval-practice": "review",
  "prerequisite-remediation": "review",
  reading: "reading",
  writing: "writing",
  "project-work": "project_work",
  "mastery-check": "assessment",
} as const satisfies Partial<Record<StudyTaskType, Session4CalendarBlockType>>;

export type CalendarSource =
  | "manuel_academy"
  | "romeo_virtual_academy"
  | "parent";

export type CalendarActor = "system" | "student" | "parent";
export type CalendarBlockState =
  | "scheduled"
  | "active"
  | "paused"
  | "completed";
export type TimerVisibility = "shown" | "hidden";
export type LocalTimeDisambiguation = "earlier" | "later";
export type CalendarPlacementSource =
  | "explicit-offset"
  | "lab-wall-time-resolution";

/**
 * These categories are intentionally distinct. In particular, an outside or
 * technical interruption is never rewritten as a learner-requested break.
 */
export const CALENDAR_INTERRUPTION_CATEGORIES = [
  "planned_break",
  "requested_break",
  "outside_interruption",
  "technical_interruption",
] as const;

export type CalendarInterruptionCategory =
  (typeof CALENDAR_INTERRUPTION_CATEGORIES)[number];

export type InterruptionApprovalState =
  | "approved"
  | "requested"
  | "not_required";

export interface StableSourceIdentity {
  readonly source: CalendarSource;
  /** Stable opaque ID supplied by the source; it is never regenerated here. */
  readonly externalItemId: string;
}

export interface CalendarSegmentInput {
  /**
   * The canonical SegmentId bytes. This adapter validates but never derives,
   * trims, normalizes, or re-spells this value.
   */
  readonly segmentId: string;
  readonly title: string;
  readonly estimatedMinutes: number;
  /**
   * When supplied from a canonical LessonSegment, its classification wins.
   * The block mapping is only the compatibility fallback for Session 4 input.
   */
  readonly canonicalTaskType?: StudyTaskType;
  readonly customTaskTypeId?: string;
  /** Optional work never contributes to the required-work completion bar. */
  readonly required?: boolean;
}

export interface CalendarSegment {
  readonly segmentId: SegmentId;
  /** One-based position in the unsplit canonical plan. */
  readonly planOrdinal: number;
  readonly title: string;
  readonly canonicalTaskType: StudyTaskType;
  readonly customTaskTypeId?: string;
  readonly estimatedMinutes: number;
  readonly required: boolean;
  /** Active work in this calendar occurrence, kept separate from estimates. */
  readonly actualActiveSeconds: number;
  /**
   * Active seconds carried into a continuation for the current segment. They
   * locate the canonical resume point but are not counted again as occurrence
   * duration.
   */
  readonly elapsedActiveSecondsBeforeBlock: number;
  readonly completedAt?: string | undefined;
}

export interface ExactResumeMetadata {
  readonly segmentId: SegmentId;
  /** One-based position in the original displayed plan. */
  readonly segmentOrdinal: number;
  readonly elapsedActiveSecondsInSegment: number;
  readonly responseDraftRef?: string;
  readonly completedSegmentIds: readonly SegmentId[];
  readonly remainingSegmentIds: readonly SegmentId[];
  readonly capturedAt: string;
}

export interface CalendarInterruptionRecord {
  readonly category: CalendarInterruptionCategory;
  readonly approvalState: InterruptionApprovalState;
  readonly interruptedAt: string;
  readonly actor: CalendarActor;
  readonly resumePoint: ExactResumeMetadata;
}

export type CalendarAuditEvent =
  | {
      readonly type: "created";
      readonly at: string;
      readonly actor: "system" | "parent";
    }
  | {
      readonly type: "started" | "resumed";
      readonly at: string;
      readonly actor: CalendarActor;
      readonly segmentId: SegmentId;
    }
  | {
      readonly type: "segment_completed";
      readonly at: string;
      readonly actor: CalendarActor;
      readonly segmentId: SegmentId;
    }
  | {
      readonly type: "interrupted";
      readonly at: string;
      readonly actor: CalendarActor;
      readonly category: CalendarInterruptionCategory;
      readonly approvalState: InterruptionApprovalState;
      readonly segmentId: SegmentId;
    }
  | {
      readonly type: "drag_drop_rescheduled";
      readonly at: string;
      readonly actor: "student" | "parent";
      readonly fromLocalStart: string;
      readonly toLocalStart: string;
      readonly fromStartInstant: string;
      readonly toStartInstant: string;
      readonly fromIntendedLocalDate: string;
      readonly toIntendedLocalDate: string;
    }
  | {
      readonly type: "parent_edited";
      readonly at: string;
      readonly actor: "parent";
      readonly changedFields: readonly ParentEditableField[];
    }
  | {
      readonly type: "continuation_created";
      readonly at: string;
      readonly actor: "system" | "parent";
      readonly continuationBlockId: string;
      readonly continuationKey: string;
    };

export interface CalendarLineage {
  readonly rootInternalBlockId: string;
  /**
   * "root" for the imported/created occurrence. Continuations use a stable
   * host-provided key so retrying the command is idempotent.
   */
  readonly continuationKey: string;
  readonly continuationOf?: string;
  /** Completed plan segments carried across an occurrence boundary. */
  readonly completedBeforeOccurrence: readonly SegmentId[];
}

export interface CalendarBlock {
  readonly schemaVersion: "calendar-parent-runtime.v1";
  /** Stable local ID. Repeat imports preserve the first accepted value. */
  readonly internalBlockId: string;
  readonly learnerRef: string;
  readonly sourceIdentity: StableSourceIdentity;
  readonly lineage: CalendarLineage;
  readonly title: string;
  readonly subject?: string;
  readonly blockType: Session4CalendarBlockType;
  readonly canonicalTask: CanonicalTaskMapping;
  readonly householdTimeZone: string;
  /** The requested learner-local wall time, in YYYY-MM-DDTHH:mm form. */
  readonly scheduledLocalStart: string;
  /** The preserved explicit-offset instant, or the lab-resolved fallback. */
  readonly scheduledStartInstant: string;
  /** Historical learner-local date snapshot; never recomputed after zone changes. */
  readonly intendedLocalDate: string;
  /** Marks whether Card 5's explicit-offset placement boundary was supplied. */
  readonly placementSource: CalendarPlacementSource;
  readonly estimatedDurationMinutes: number;
  readonly actualDurationSeconds: number;
  readonly timerVisibility: TimerVisibility;
  readonly state: CalendarBlockState;
  readonly segments: readonly CalendarSegment[];
  readonly activeSince?: string | undefined;
  readonly resumePoint?: ExactResumeMetadata | undefined;
  readonly currentInterruption?: CalendarInterruptionRecord | undefined;
  readonly interruptionHistory: readonly CalendarInterruptionRecord[];
  readonly revision: number;
  readonly lastEventAt: string;
  readonly events: readonly CalendarAuditEvent[];
}

export interface CreateCalendarBlockInput {
  readonly internalBlockId: string;
  readonly learnerRef: string;
  readonly sourceIdentity: StableSourceIdentity;
  readonly title: string;
  readonly subject?: string;
  readonly blockType: Session4CalendarBlockType;
  readonly householdTimeZone: string;
  readonly scheduledLocalStart: string;
  /**
   * Card 5 placement seam. Supply together with intendedLocalDate. The value
   * is preserved byte-for-byte after validating it against the wall time and
   * household zone. Omission uses the clearly marked local-lab fallback.
   */
  readonly scheduledStart?: string;
  readonly intendedLocalDate?: string;
  readonly localTimeDisambiguation?: LocalTimeDisambiguation;
  readonly segments: readonly CalendarSegmentInput[];
  readonly createdAt: string;
  readonly createdBy?: "system" | "parent";
  readonly timerVisibility?: TimerVisibility;
}

export type ParentActivityBlockType =
  | "parent_created_activity"
  | "physical_education"
  | "outside_activity";

export interface CreateParentActivityInput
  extends Omit<
    CreateCalendarBlockInput,
    "sourceIdentity" | "blockType" | "createdBy"
  > {
  readonly parentActivityId: string;
  readonly blockType: ParentActivityBlockType;
}

export interface InterruptCalendarBlockInput {
  readonly at: string;
  readonly actor: CalendarActor;
  readonly category: CalendarInterruptionCategory;
  readonly approvalState?: InterruptionApprovalState;
  readonly responseDraftRef?: string;
}

export type ParentEditableField =
  | "title"
  | "subject"
  | "scheduledLocalStart"
  | "scheduledStart"
  | "timerVisibility"
  | "segmentEstimates";

export interface ParentCalendarEditInput {
  readonly at: string;
  readonly title?: string;
  readonly subject?: string;
  readonly scheduledLocalStart?: string;
  readonly scheduledStart?: string;
  readonly intendedLocalDate?: string;
  readonly localTimeDisambiguation?: LocalTimeDisambiguation;
  readonly timerVisibility?: TimerVisibility;
  readonly segmentEstimates?: Readonly<Record<string, number>>;
}

export interface CalendarBlockView {
  readonly internalBlockId: string;
  readonly externalItemId: string;
  readonly state: CalendarBlockState;
  readonly segmentsCompleted: number;
  readonly totalSegments: number;
  readonly requiredSegmentsCompleted: number;
  readonly requiredSegmentsTotal: number;
  readonly requiredWorkCompletionPercent: number;
  readonly estimatedDurationMinutes: number;
  readonly estimatedRemainingMinutes: number;
  readonly actualDurationMinutes: number;
  readonly resumePoint?: ExactResumeMetadata;
}

export interface RequiredWorkCompletionBar {
  readonly basis: "required-segment-units";
  readonly completedRequiredUnits: number;
  readonly totalRequiredUnits: number;
  readonly percent: number;
}

export class CalendarRuntimeError extends Error {
  public readonly name = "CalendarRuntimeError";

  public constructor(
    public readonly code:
      | "invalid_identifier"
      | "invalid_text"
      | "invalid_duration"
      | "invalid_timestamp"
      | "invalid_local_time"
      | "local_date_mismatch"
      | "invalid_time_zone"
      | "nonexistent_local_time"
      | "invalid_state"
      | "invalid_segment"
      | "invalid_block_type"
      | "invalid_interruption"
      | "event_out_of_order"
      | "identity_conflict"
      | "invalid_edit",
    message: string,
  ) {
    super(message);
  }
}

// Mirrors Session 1 expectId. In particular, slash is valid and all accepted
// bytes are returned unchanged.
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const LOCAL_MINUTE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function assertIdentifier(value: string, field: string): void {
  if (!OPAQUE_ID.test(value)) {
    throw new CalendarRuntimeError(
      "invalid_identifier",
      `${field} must be an opaque 1-128 character identifier.`,
    );
  }
}

function assertText(value: string, field: string, maximum = 200): void {
  if (value.trim().length === 0 || value.trim().length > maximum) {
    throw new CalendarRuntimeError(
      "invalid_text",
      `${field} must contain 1-${maximum} visible characters.`,
    );
  }
}

function parseInstant(value: string): number {
  if (!OFFSET_TIMESTAMP.test(value)) {
    throw new CalendarRuntimeError(
      "invalid_timestamp",
      "Instants must be ISO 8601 timestamps with Z or an explicit offset.",
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new CalendarRuntimeError(
      "invalid_timestamp",
      "The timestamp is not a real instant.",
    );
  }
  return parsed;
}

function assertRealLocalDate(value: string): void {
  const match = LOCAL_DATE.exec(value);
  if (!match) {
    throw new CalendarRuntimeError(
      "invalid_local_time",
      "Learner-local dates must use YYYY-MM-DD.",
    );
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new CalendarRuntimeError(
      "invalid_local_time",
      "The learner-local date is not a real calendar date.",
    );
  }
}

export function assertHouseholdTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new CalendarRuntimeError(
      "invalid_time_zone",
      "householdTimeZone must be a supported IANA time-zone name.",
    );
  }
}

interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function parseLocalMinute(value: string): LocalParts {
  const match = LOCAL_MINUTE.exec(value);
  if (!match) {
    throw new CalendarRuntimeError(
      "invalid_local_time",
      "Learner-local times must use YYYY-MM-DDTHH:mm.",
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day ||
    date.getUTCHours() !== parts.hour ||
    date.getUTCMinutes() !== parts.minute
  ) {
    throw new CalendarRuntimeError(
      "invalid_local_time",
      "The learner-local time is not a real calendar minute.",
    );
  }
  return parts;
}

function localPartsForInstant(instant: number, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const numberPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type)?.value;
    if (part === undefined) {
      throw new CalendarRuntimeError(
        "invalid_time_zone",
        "The runtime could not format the requested local time.",
      );
    }
    return Number(part);
  };
  return {
    year: numberPart("year"),
    month: numberPart("month"),
    day: numberPart("day"),
    hour: numberPart("hour"),
    minute: numberPart("minute"),
  };
}

function sameLocalMinute(left: LocalParts, right: LocalParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function localDateForParts(parts: LocalParts): string {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

/**
 * Resolves a wall-clock minute by IANA zone. A DST overlap can produce two
 * instants and is resolved explicitly; a spring-forward gap is rejected.
 */
export function resolveLearnerLocalStart(
  localStart: string,
  householdTimeZone: string,
  disambiguation: LocalTimeDisambiguation = "earlier",
): string {
  assertHouseholdTimeZone(householdTimeZone);
  const requested = parseLocalMinute(localStart);
  const naiveUtc = Date.UTC(
    requested.year,
    requested.month - 1,
    requested.day,
    requested.hour,
    requested.minute,
  );
  const candidateOffsets = new Set<number>();
  const matches: number[] = [];

  // Sample both sides of any nearby civil-time transition, then verify each
  // candidate against the requested wall minute. This discovers fractional
  // hour offsets without guessing a fixed list and avoids a minute-by-minute
  // search.
  for (let deltaHours = -36; deltaHours <= 36; deltaHours += 3) {
    const sample = naiveUtc + deltaHours * 60 * 60_000;
    const local = localPartsForInstant(sample, householdTimeZone);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
    );
    candidateOffsets.add(localAsUtc - sample);
  }
  for (const offset of candidateOffsets) {
    const candidate = naiveUtc - offset;
    if (
      sameLocalMinute(
        localPartsForInstant(candidate, householdTimeZone),
        requested,
      )
    ) {
      matches.push(candidate);
    }
  }
  matches.sort((left, right) => left - right);

  if (matches.length === 0) {
    throw new CalendarRuntimeError(
      "nonexistent_local_time",
      "The requested learner-local minute does not exist because of a time-zone transition.",
    );
  }
  const selected =
    disambiguation === "later" ? matches.at(-1)! : matches.at(0)!;
  return new Date(selected).toISOString();
}

interface ResolveCalendarPlacementInput {
  readonly scheduledLocalStart: string;
  readonly householdTimeZone: string;
  readonly scheduledStart?: string;
  readonly intendedLocalDate?: string;
  readonly localTimeDisambiguation?: LocalTimeDisambiguation;
}

interface ResolvedCalendarPlacement {
  readonly scheduledStartInstant: string;
  readonly intendedLocalDate: string;
  readonly placementSource: CalendarPlacementSource;
}

/**
 * Reconciles Card 5's preferred explicit-offset placement with the older
 * Session 4 wall-time input. Explicit placement is preserved byte-for-byte.
 * The wall-time-only path remains available solely for this isolated lab and
 * is visibly tagged so a host cannot mistake it for an authorized policy.
 */
function resolveCalendarPlacement(
  input: ResolveCalendarPlacementInput,
): ResolvedCalendarPlacement {
  assertHouseholdTimeZone(input.householdTimeZone);
  const requested = parseLocalMinute(input.scheduledLocalStart);
  const localDate = localDateForParts(requested);
  const hasExplicitStart = input.scheduledStart !== undefined;
  const hasIntendedDate = input.intendedLocalDate !== undefined;

  if (hasExplicitStart !== hasIntendedDate) {
    throw new CalendarRuntimeError(
      "local_date_mismatch",
      "scheduledStart and intendedLocalDate must be supplied together.",
    );
  }

  if (input.scheduledStart !== undefined) {
    const intendedLocalDate = input.intendedLocalDate!;
    assertRealLocalDate(intendedLocalDate);
    if (intendedLocalDate !== localDate) {
      throw new CalendarRuntimeError(
        "local_date_mismatch",
        "intendedLocalDate must match the requested learner-local wall date.",
      );
    }
    const instant = parseInstant(input.scheduledStart);
    const projected = localPartsForInstant(
      instant,
      input.householdTimeZone,
    );
    if (!sameLocalMinute(projected, requested)) {
      throw new CalendarRuntimeError(
        "local_date_mismatch",
        "scheduledStart does not map to scheduledLocalStart in the supplied household zone.",
      );
    }
    if (localDateForParts(projected) !== intendedLocalDate) {
      throw new CalendarRuntimeError(
        "local_date_mismatch",
        "scheduledStart does not fall on intendedLocalDate in the supplied household zone.",
      );
    }
    return {
      scheduledStartInstant: input.scheduledStart,
      intendedLocalDate,
      placementSource: "explicit-offset",
    };
  }

  return {
    scheduledStartInstant: resolveLearnerLocalStart(
      input.scheduledLocalStart,
      input.householdTimeZone,
      input.localTimeDisambiguation,
    ),
    intendedLocalDate: localDate,
    placementSource: "lab-wall-time-resolution",
  };
}

export function learnerLocalDate(
  instant: string,
  householdTimeZone: string,
): string {
  assertHouseholdTimeZone(householdTimeZone);
  const parts = localPartsForInstant(
    parseInstant(instant),
    householdTimeZone,
  );
  return localDateForParts(parts);
}

function roundMinutes(seconds: number): number {
  return Math.round((seconds / 60 + Number.EPSILON) * 100) / 100;
}

function totalEstimate(segments: readonly CalendarSegment[]): number {
  return segments.reduce(
    (total, segment) => total + segment.estimatedMinutes,
    0,
  );
}

function totalActualSeconds(segments: readonly CalendarSegment[]): number {
  return segments.reduce(
    (total, segment) => total + segment.actualActiveSeconds,
    0,
  );
}

function currentSegment(block: CalendarBlock): CalendarSegment | undefined {
  return block.segments.find((segment) => segment.completedAt === undefined);
}

function assertChronological(block: CalendarBlock, at: string): number {
  const instant = parseInstant(at);
  if (instant < parseInstant(block.lastEventAt)) {
    throw new CalendarRuntimeError(
      "event_out_of_order",
      "Calendar events must be applied in chronological order.",
    );
  }
  return instant;
}

function appendEvent(
  block: CalendarBlock,
  event: CalendarAuditEvent,
  changes: Partial<CalendarBlock>,
): CalendarBlock {
  const next = {
    ...block,
    ...changes,
    revision: block.revision + 1,
    lastEventAt: event.at,
    events: [...block.events, event],
  };
  return {
    ...next,
    estimatedDurationMinutes: totalEstimate(next.segments),
    actualDurationSeconds: totalActualSeconds(next.segments),
  };
}

function addActiveTime(
  block: CalendarBlock,
  at: string,
): readonly CalendarSegment[] {
  const activeSince = block.activeSince;
  const activeSegment = currentSegment(block);
  if (!activeSince || !activeSegment) return block.segments;
  const seconds = (parseInstant(at) - parseInstant(activeSince)) / 1_000;
  if (seconds < 0) {
    throw new CalendarRuntimeError(
      "event_out_of_order",
      "An active interval cannot end before it starts.",
    );
  }
  if (!Number.isInteger(seconds)) {
    throw new CalendarRuntimeError(
      "invalid_timestamp",
      "Active-work intervals must resolve to an exact whole number of seconds.",
    );
  }
  return block.segments.map((segment) =>
    segment.segmentId === activeSegment.segmentId
      ? {
          ...segment,
          actualActiveSeconds: segment.actualActiveSeconds + seconds,
        }
      : segment,
  );
}

function buildResumePoint(
  block: CalendarBlock,
  segments: readonly CalendarSegment[],
  at: string,
  responseDraftRef?: string,
): ExactResumeMetadata {
  const incomplete = segments.find((segment) => !segment.completedAt);
  if (!incomplete) {
    throw new CalendarRuntimeError(
      "invalid_state",
      "A completed block has no resume point.",
    );
  }
  const completedSegmentIds = segments
    .filter((segment) => segment.completedAt)
    .map((segment) => segment.segmentId);
  const remainingSegmentIds = segments
    .filter((segment) => !segment.completedAt)
    .map((segment) => segment.segmentId);
  const segmentOrdinal =
    incomplete.planOrdinal;
  return {
    segmentId: incomplete.segmentId,
    segmentOrdinal,
    elapsedActiveSecondsInSegment:
      incomplete.elapsedActiveSecondsBeforeBlock +
      incomplete.actualActiveSeconds,
    ...(responseDraftRef === undefined ? {} : { responseDraftRef }),
    completedSegmentIds: [
      ...block.lineage.completedBeforeOccurrence,
      ...completedSegmentIds.filter(
        (id) => !block.lineage.completedBeforeOccurrence.includes(id),
      ),
    ],
    remainingSegmentIds,
    capturedAt: at,
  };
}

export function canonicalTaskForCalendarType(
  blockType: Session4CalendarBlockType,
): CanonicalTaskMapping {
  if (!SESSION_4_CALENDAR_BLOCK_TYPES.includes(blockType)) {
    throw new CalendarRuntimeError(
      "invalid_block_type",
      "The Session 4 calendar block type is not supported.",
    );
  }
  return CALENDAR_TO_CANONICAL_TASK[blockType];
}

/**
 * Projects a canonical task to Session 4. Card 5 requires an explicit block
 * type for problem-solving, discussion, reflection, and custom tasks.
 */
export function calendarBlockTypeForCanonicalTask(
  taskType: StudyTaskType,
  explicitBlockType?: Session4CalendarBlockType,
): Session4CalendarBlockType {
  if (!STUDY_TASK_TYPES.includes(taskType)) {
    throw new CalendarRuntimeError(
      "invalid_block_type",
      "The canonical study task type is not supported.",
    );
  }
  if (explicitBlockType !== undefined) {
    canonicalTaskForCalendarType(explicitBlockType);
    return explicitBlockType;
  }
  const projected = (
    CANONICAL_TASK_TO_DEFAULT_CALENDAR_BLOCK as Readonly<
      Partial<Record<StudyTaskType, Session4CalendarBlockType>>
    >
  )[taskType];
  if (projected === undefined) {
    throw new CalendarRuntimeError(
      "invalid_block_type",
      "This canonical task requires an explicit reviewed calendar block type.",
    );
  }
  return projected;
}

export function createCalendarBlock(
  input: CreateCalendarBlockInput,
): CalendarBlock {
  assertIdentifier(input.internalBlockId, "internalBlockId");
  assertIdentifier(input.learnerRef, "learnerRef");
  assertIdentifier(input.sourceIdentity.externalItemId, "externalItemId");
  assertText(input.title, "title");
  if (input.subject !== undefined) assertText(input.subject, "subject", 100);
  parseInstant(input.createdAt);
  assertHouseholdTimeZone(input.householdTimeZone);
  const placement = resolveCalendarPlacement({
    scheduledLocalStart: input.scheduledLocalStart,
    householdTimeZone: input.householdTimeZone,
    ...(input.scheduledStart === undefined
      ? {}
      : { scheduledStart: input.scheduledStart }),
    ...(input.intendedLocalDate === undefined
      ? {}
      : { intendedLocalDate: input.intendedLocalDate }),
    ...(input.localTimeDisambiguation === undefined
      ? {}
      : { localTimeDisambiguation: input.localTimeDisambiguation }),
  });
  if (input.segments.length === 0) {
    throw new CalendarRuntimeError(
      "invalid_segment",
      "A calendar block must contain at least one segment.",
    );
  }
  const canonicalTask = canonicalTaskForCalendarType(input.blockType);
  const seen = new Set<string>();
  const segments = input.segments.map((segment, index) => {
    assertIdentifier(segment.segmentId, "segmentId");
    assertText(segment.title, "segment title");
    if (seen.has(segment.segmentId)) {
      throw new CalendarRuntimeError(
        "invalid_segment",
        "Segment identifiers must be unique within a block.",
      );
    }
    seen.add(segment.segmentId);
    if (
      !Number.isFinite(segment.estimatedMinutes) ||
      segment.estimatedMinutes <= 0
    ) {
      throw new CalendarRuntimeError(
        "invalid_duration",
        "Segment estimates must be positive finite minute values.",
      );
    }
    const canonicalTaskType =
      segment.canonicalTaskType ?? canonicalTask.taskType;
    if (!STUDY_TASK_TYPES.includes(canonicalTaskType)) {
      throw new CalendarRuntimeError(
        "invalid_segment",
        "canonicalTaskType is not a Session 1 StudyTaskType.",
      );
    }
    const inheritedCustomTaskTypeId =
      canonicalTaskType === "custom" &&
      "customTaskTypeId" in canonicalTask
        ? canonicalTask.customTaskTypeId
        : undefined;
    const customTaskTypeId =
      segment.customTaskTypeId ?? inheritedCustomTaskTypeId;
    if (canonicalTaskType === "custom" && customTaskTypeId === undefined) {
      throw new CalendarRuntimeError(
        "invalid_segment",
        "A custom canonical segment requires customTaskTypeId.",
      );
    }
    if (canonicalTaskType !== "custom" && segment.customTaskTypeId !== undefined) {
      throw new CalendarRuntimeError(
        "invalid_segment",
        "customTaskTypeId is allowed only for a custom canonical segment.",
      );
    }
    if (customTaskTypeId !== undefined) {
      assertIdentifier(customTaskTypeId, "customTaskTypeId");
    }
    return {
      segmentId: segment.segmentId as SegmentId,
      planOrdinal: index + 1,
      title: segment.title.trim(),
      canonicalTaskType,
      ...(customTaskTypeId === undefined ? {} : { customTaskTypeId }),
      estimatedMinutes: segment.estimatedMinutes,
      required: segment.required ?? true,
      actualActiveSeconds: 0,
      elapsedActiveSecondsBeforeBlock: 0,
    };
  });

  return {
    schemaVersion: "calendar-parent-runtime.v1",
    internalBlockId: input.internalBlockId,
    learnerRef: input.learnerRef,
    sourceIdentity: input.sourceIdentity,
    lineage: {
      rootInternalBlockId: input.internalBlockId,
      continuationKey: "root",
      completedBeforeOccurrence: [],
    },
    title: input.title.trim(),
    ...(input.subject === undefined ? {} : { subject: input.subject.trim() }),
    blockType: input.blockType,
    canonicalTask,
    householdTimeZone: input.householdTimeZone,
    scheduledLocalStart: input.scheduledLocalStart,
    scheduledStartInstant: placement.scheduledStartInstant,
    intendedLocalDate: placement.intendedLocalDate,
    placementSource: placement.placementSource,
    estimatedDurationMinutes: totalEstimate(segments),
    actualDurationSeconds: 0,
    timerVisibility: input.timerVisibility ?? "shown",
    state: "scheduled",
    segments,
    interruptionHistory: [],
    revision: 0,
    lastEventAt: input.createdAt,
    events: [
      {
        type: "created",
        at: input.createdAt,
        actor: input.createdBy ?? "system",
      },
    ],
  };
}

export function createParentActivity(
  input: CreateParentActivityInput,
): CalendarBlock {
  return createCalendarBlock({
    ...input,
    sourceIdentity: {
      source: "parent",
      externalItemId: input.parentActivityId,
    },
    createdBy: "parent",
  });
}

export function startCalendarBlock(
  block: CalendarBlock,
  at: string,
  actor: CalendarActor = "student",
): CalendarBlock {
  assertChronological(block, at);
  if (block.state !== "scheduled") {
    throw new CalendarRuntimeError(
      "invalid_state",
      "Only a scheduled block can be started.",
    );
  }
  const segment = currentSegment(block);
  if (!segment) {
    throw new CalendarRuntimeError(
      "invalid_state",
      "A block without remaining work cannot be started.",
    );
  }
  return appendEvent(
    block,
    { type: "started", at, actor, segmentId: segment.segmentId },
    {
      state: "active",
      activeSince: at,
      currentInterruption: undefined,
      resumePoint: undefined,
    },
  );
}

export function completeCurrentSegment(
  block: CalendarBlock,
  input: {
    readonly segmentId: string;
    readonly at: string;
    readonly actor?: CalendarActor;
  },
): CalendarBlock {
  assertChronological(block, input.at);
  if (block.state !== "active") {
    throw new CalendarRuntimeError(
      "invalid_state",
      "A segment can be completed only while its block is active.",
    );
  }
  const segment = currentSegment(block);
  if (!segment || segment.segmentId !== input.segmentId) {
    throw new CalendarRuntimeError(
      "invalid_segment",
      "Segments must be completed in their displayed order.",
    );
  }
  const segments = addActiveTime(block, input.at).map((candidate) =>
    candidate.segmentId === input.segmentId
      ? { ...candidate, completedAt: input.at }
      : candidate,
  );
  const completed = segments.every((candidate) => candidate.completedAt);
  return appendEvent(
    block,
    {
      type: "segment_completed",
      at: input.at,
      actor: input.actor ?? "student",
      segmentId: segment.segmentId,
    },
    {
      segments,
      state: completed ? "completed" : "active",
      activeSince: completed ? undefined : input.at,
      resumePoint: undefined,
      currentInterruption: undefined,
    },
  );
}

function defaultApprovalState(
  category: CalendarInterruptionCategory,
): InterruptionApprovalState {
  if (category === "planned_break") return "approved";
  if (category === "requested_break") return "requested";
  return "not_required";
}

function assertInterruptionApproval(
  category: CalendarInterruptionCategory,
  approvalState: InterruptionApprovalState,
): void {
  if (
    category === "planned_break" &&
    approvalState !== "approved"
  ) {
    throw new CalendarRuntimeError(
      "invalid_interruption",
      "A planned break must already be approved.",
    );
  }
  if (
    category === "requested_break" &&
    approvalState === "not_required"
  ) {
    throw new CalendarRuntimeError(
      "invalid_interruption",
      "A requested break must remain requested or be explicitly approved.",
    );
  }
}

export function interruptCalendarBlock(
  block: CalendarBlock,
  input: InterruptCalendarBlockInput,
): CalendarBlock {
  assertChronological(block, input.at);
  if (input.responseDraftRef !== undefined) {
    assertIdentifier(input.responseDraftRef, "responseDraftRef");
  }
  if (block.state !== "active") {
    throw new CalendarRuntimeError(
      "invalid_state",
      "Only active work can be interrupted.",
    );
  }
  if (!CALENDAR_INTERRUPTION_CATEGORIES.includes(input.category)) {
    throw new CalendarRuntimeError(
      "invalid_interruption",
      "The interruption category is not supported.",
    );
  }
  const approvalState =
    input.approvalState ?? defaultApprovalState(input.category);
  assertInterruptionApproval(input.category, approvalState);
  const segments = addActiveTime(block, input.at);
  const resumePoint = buildResumePoint(
    block,
    segments,
    input.at,
    input.responseDraftRef,
  );
  const interruption = {
    category: input.category,
    approvalState,
    interruptedAt: input.at,
    actor: input.actor,
    resumePoint,
  } satisfies CalendarInterruptionRecord;
  return appendEvent(
    block,
    {
      type: "interrupted",
      at: input.at,
      actor: input.actor,
      category: input.category,
      approvalState,
      segmentId: resumePoint.segmentId,
    },
    {
      segments,
      state: "paused",
      activeSince: undefined,
      resumePoint,
      currentInterruption: interruption,
      interruptionHistory: [...block.interruptionHistory, interruption],
    },
  );
}

export function resumeCalendarBlock(
  block: CalendarBlock,
  at: string,
  actor: CalendarActor = "student",
): CalendarBlock {
  assertChronological(block, at);
  if (block.state !== "paused") {
    throw new CalendarRuntimeError(
      "invalid_state",
      "Only a paused block can be resumed.",
    );
  }
  const segment = currentSegment(block);
  if (!segment || !block.resumePoint) {
    throw new CalendarRuntimeError(
      "invalid_state",
      "A paused block must have remaining work and an exact resume point.",
    );
  }
  return appendEvent(
    block,
    { type: "resumed", at, actor, segmentId: segment.segmentId },
    {
      state: "active",
      activeSince: at,
      currentInterruption: undefined,
      resumePoint: undefined,
    },
  );
}

export function dragDropReschedule(
  block: CalendarBlock,
  input: {
    readonly at: string;
    readonly actor: "student" | "parent";
    readonly scheduledLocalStart: string;
    readonly scheduledStart?: string;
    readonly intendedLocalDate?: string;
    readonly localTimeDisambiguation?: LocalTimeDisambiguation;
  },
): CalendarBlock {
  assertChronological(block, input.at);
  if (block.state === "active" || block.state === "completed") {
    throw new CalendarRuntimeError(
      "invalid_state",
      "Active or completed work cannot be drag-and-drop rescheduled.",
    );
  }
  const placement = resolveCalendarPlacement({
    scheduledLocalStart: input.scheduledLocalStart,
    householdTimeZone: block.householdTimeZone,
    ...(input.scheduledStart === undefined
      ? {}
      : { scheduledStart: input.scheduledStart }),
    ...(input.intendedLocalDate === undefined
      ? {}
      : { intendedLocalDate: input.intendedLocalDate }),
    ...(input.localTimeDisambiguation === undefined
      ? {}
      : { localTimeDisambiguation: input.localTimeDisambiguation }),
  });
  return appendEvent(
    block,
    {
      type: "drag_drop_rescheduled",
      at: input.at,
      actor: input.actor,
      fromLocalStart: block.scheduledLocalStart,
      toLocalStart: input.scheduledLocalStart,
      fromStartInstant: block.scheduledStartInstant,
      toStartInstant: placement.scheduledStartInstant,
      fromIntendedLocalDate: block.intendedLocalDate,
      toIntendedLocalDate: placement.intendedLocalDate,
    },
    {
      scheduledLocalStart: input.scheduledLocalStart,
      scheduledStartInstant: placement.scheduledStartInstant,
      intendedLocalDate: placement.intendedLocalDate,
      placementSource: placement.placementSource,
    },
  );
}

export function parentEditCalendarBlock(
  block: CalendarBlock,
  input: ParentCalendarEditInput,
): CalendarBlock {
  assertChronological(block, input.at);
  if (block.state === "active" || block.state === "completed") {
    throw new CalendarRuntimeError(
      "invalid_state",
      "Active or completed work cannot be edited.",
    );
  }
  const changedFields: ParentEditableField[] = [];
  let title = block.title;
  let subject = block.subject;
  let scheduledLocalStart = block.scheduledLocalStart;
  let scheduledStartInstant = block.scheduledStartInstant;
  let intendedLocalDate = block.intendedLocalDate;
  let placementSource = block.placementSource;
  let timerVisibility = block.timerVisibility;
  let segments = block.segments;

  if (input.title !== undefined && input.title !== block.title) {
    assertText(input.title, "title");
    title = input.title.trim();
    changedFields.push("title");
  }
  if (input.subject !== undefined && input.subject !== block.subject) {
    assertText(input.subject, "subject", 100);
    subject = input.subject.trim();
    changedFields.push("subject");
  }
  if (
    input.scheduledLocalStart !== undefined &&
    input.scheduledLocalStart !== block.scheduledLocalStart
  ) {
    const placement = resolveCalendarPlacement({
      scheduledLocalStart: input.scheduledLocalStart,
      householdTimeZone: block.householdTimeZone,
      ...(input.scheduledStart === undefined
        ? {}
        : { scheduledStart: input.scheduledStart }),
      ...(input.intendedLocalDate === undefined
        ? {}
        : { intendedLocalDate: input.intendedLocalDate }),
      ...(input.localTimeDisambiguation === undefined
        ? {}
        : { localTimeDisambiguation: input.localTimeDisambiguation }),
    });
    scheduledStartInstant = placement.scheduledStartInstant;
    intendedLocalDate = placement.intendedLocalDate;
    placementSource = placement.placementSource;
    scheduledLocalStart = input.scheduledLocalStart;
    changedFields.push("scheduledLocalStart");
    if (placement.placementSource === "explicit-offset") {
      changedFields.push("scheduledStart");
    }
  } else if (
    input.scheduledStart !== undefined ||
    input.intendedLocalDate !== undefined
  ) {
    throw new CalendarRuntimeError(
      "invalid_edit",
      "Explicit placement metadata requires a changed scheduledLocalStart.",
    );
  }
  if (
    input.timerVisibility !== undefined &&
    input.timerVisibility !== block.timerVisibility
  ) {
    timerVisibility = input.timerVisibility;
    changedFields.push("timerVisibility");
  }
  if (input.segmentEstimates !== undefined) {
    const segmentIds = new Set<string>(
      block.segments.map((segment) => segment.segmentId),
    );
    for (const [segmentId, estimate] of Object.entries(
      input.segmentEstimates,
    )) {
      if (!segmentIds.has(segmentId)) {
        throw new CalendarRuntimeError(
          "invalid_edit",
          `No segment matches the estimate override ${segmentId}.`,
        );
      }
      if (!Number.isFinite(estimate) || estimate <= 0) {
        throw new CalendarRuntimeError(
          "invalid_duration",
          "Parent-edited estimates must be positive finite minute values.",
        );
      }
    }
    segments = block.segments.map((segment) => {
      const estimate = input.segmentEstimates?.[segment.segmentId];
      return estimate === undefined
        ? segment
        : {
            ...segment,
            estimatedMinutes: estimate,
          };
    });
    changedFields.push("segmentEstimates");
  }
  if (changedFields.length === 0) {
    throw new CalendarRuntimeError(
      "invalid_edit",
      "A parent edit must change at least one supported field.",
    );
  }
  return appendEvent(
    block,
    {
      type: "parent_edited",
      at: input.at,
      actor: "parent",
      changedFields,
    },
    {
      title,
      ...(subject === undefined ? {} : { subject }),
      scheduledLocalStart,
      scheduledStartInstant,
      intendedLocalDate,
      placementSource,
      timerVisibility,
      segments,
    },
  );
}

export function calendarBlockView(block: CalendarBlock): CalendarBlockView {
  const completed = block.segments.filter((segment) => segment.completedAt);
  const required = block.segments.filter((segment) => segment.required);
  const completedRequired = required.filter((segment) => segment.completedAt);
  const requiredWorkCompletionPercent =
    required.length === 0
      ? 100
      : Math.round((completedRequired.length / required.length) * 100);
  return {
    internalBlockId: block.internalBlockId,
    externalItemId: block.sourceIdentity.externalItemId,
    state: block.state,
    segmentsCompleted: completed.length,
    totalSegments: block.segments.length,
    requiredSegmentsCompleted: completedRequired.length,
    requiredSegmentsTotal: required.length,
    requiredWorkCompletionPercent,
    estimatedDurationMinutes: block.estimatedDurationMinutes,
    estimatedRemainingMinutes: block.segments
      .filter((segment) => !segment.completedAt)
      .reduce((total, segment) => total + segment.estimatedMinutes, 0),
    actualDurationMinutes: roundMinutes(block.actualDurationSeconds),
    ...(block.resumePoint === undefined
      ? {}
      : { resumePoint: block.resumePoint }),
  };
}

function logicalWorkUnitKey(
  block: CalendarBlock,
  segment: CalendarSegment,
): string {
  return JSON.stringify([
    block.learnerRef,
    block.sourceIdentity.source,
    block.sourceIdentity.externalItemId,
    segment.segmentId,
  ]);
}

/**
 * Completion is based on explicit required segment units, never elapsed time.
 * Logical units copied into a continuation are collapsed by stable source and
 * segment identity.
 */
export function requiredWorkCompletionBar(
  blocks: readonly CalendarBlock[],
): RequiredWorkCompletionBar {
  const units = new Map<
    string,
    { readonly required: boolean; readonly completed: boolean }
  >();
  for (const block of blocks) {
    for (const segment of block.segments) {
      const key = logicalWorkUnitKey(block, segment);
      const prior = units.get(key);
      units.set(key, {
        required: segment.required || prior?.required === true,
        completed: segment.completedAt !== undefined || prior?.completed === true,
      });
    }
  }
  const required = [...units.values()].filter((unit) => unit.required);
  const completedRequiredUnits = required.filter(
    (unit) => unit.completed,
  ).length;
  return {
    basis: "required-segment-units",
    completedRequiredUnits,
    totalRequiredUnits: required.length,
    percent:
      required.length === 0
        ? 100
        : Math.round((completedRequiredUnits / required.length) * 100),
  };
}

export function dailyRequiredWorkCompletionBar(
  blocks: readonly CalendarBlock[],
  localDate: string,
  householdTimeZone: string,
): RequiredWorkCompletionBar {
  assertRealLocalDate(localDate);
  assertHouseholdTimeZone(householdTimeZone);
  return requiredWorkCompletionBar(
    blocks.filter(
      (block) =>
        block.householdTimeZone === householdTimeZone &&
        block.intendedLocalDate === localDate,
    ),
  );
}

function logicalBlockIdentity(block: CalendarBlock): string {
  return JSON.stringify([
    block.learnerRef,
    block.sourceIdentity.source,
    block.sourceIdentity.externalItemId,
    block.lineage.continuationKey,
  ]);
}

function laterRecord(left: CalendarBlock, right: CalendarBlock): CalendarBlock {
  if (left.revision !== right.revision) {
    return left.revision > right.revision ? left : right;
  }
  return parseInstant(left.lastEventAt) >= parseInstant(right.lastEventAt)
    ? left
    : right;
}

/**
 * Repeat imports collapse on stable external identity. If a host generated a
 * second local ID for the repeat, the first accepted internal ID is retained.
 */
export function mergeCalendarBlocks(
  existing: readonly CalendarBlock[],
  incoming: readonly CalendarBlock[],
): readonly CalendarBlock[] {
  const byIdentity = new Map<string, CalendarBlock>();
  const identityByInternalId = new Map<string, string>();

  for (const block of [...existing, ...incoming]) {
    const identity = logicalBlockIdentity(block);
    const priorIdentity = identityByInternalId.get(block.internalBlockId);
    if (priorIdentity !== undefined && priorIdentity !== identity) {
      throw new CalendarRuntimeError(
        "identity_conflict",
        "One internalBlockId cannot refer to two source records.",
      );
    }
    identityByInternalId.set(block.internalBlockId, identity);
    const prior = byIdentity.get(identity);
    if (!prior) {
      byIdentity.set(identity, block);
      continue;
    }
    const winner = laterRecord(prior, block);
    byIdentity.set(
      identity,
      winner.internalBlockId === prior.internalBlockId
        ? winner
        : {
            ...winner,
            internalBlockId: prior.internalBlockId,
            lineage: {
              ...winner.lineage,
              rootInternalBlockId:
                winner.lineage.continuationKey === "root"
                  ? prior.internalBlockId
                  : winner.lineage.rootInternalBlockId,
            },
          },
    );
  }

  return [...byIdentity.values()].sort(
    (left, right) =>
      parseInstant(left.scheduledStartInstant) -
        parseInstant(right.scheduledStartInstant) ||
      left.internalBlockId.localeCompare(right.internalBlockId),
  );
}

export interface CreateAutomaticContinuationInput {
  readonly originalInternalBlockId: string;
  readonly continuationInternalBlockId: string;
  /** Stable idempotency key, for example "2026-07-29-am". */
  readonly continuationKey: string;
  readonly scheduledLocalStart: string;
  readonly scheduledStart?: string;
  readonly intendedLocalDate?: string;
  readonly localTimeDisambiguation?: LocalTimeDisambiguation;
  readonly at: string;
  readonly actor?: "system" | "parent";
}

export interface AutomaticContinuationResult {
  readonly blocks: readonly CalendarBlock[];
  readonly continuation: CalendarBlock;
  readonly created: boolean;
}

export function createAutomaticContinuation(
  blocks: readonly CalendarBlock[],
  input: CreateAutomaticContinuationInput,
): AutomaticContinuationResult {
  assertIdentifier(input.originalInternalBlockId, "originalInternalBlockId");
  assertIdentifier(
    input.continuationInternalBlockId,
    "continuationInternalBlockId",
  );
  assertIdentifier(input.continuationKey, "continuationKey");
  parseInstant(input.at);
  const original = blocks.find(
    (block) => block.internalBlockId === input.originalInternalBlockId,
  );
  if (!original) {
    throw new CalendarRuntimeError(
      "invalid_identifier",
      "The original calendar block was not found.",
    );
  }
  assertChronological(original, input.at);
  const existing = blocks.find(
    (block) =>
      block.learnerRef === original.learnerRef &&
      block.sourceIdentity.source === original.sourceIdentity.source &&
      block.sourceIdentity.externalItemId ===
        original.sourceIdentity.externalItemId &&
      block.lineage.continuationKey === input.continuationKey,
  );
  if (existing) {
    return { blocks, continuation: existing, created: false };
  }
  const idConflict = blocks.some(
    (block) =>
      block.internalBlockId === input.continuationInternalBlockId,
  );
  if (idConflict) {
    throw new CalendarRuntimeError(
      "identity_conflict",
      "The continuation internal ID is already in use.",
    );
  }
  if (
    original.state !== "paused" ||
    !original.resumePoint ||
    original.segments.every((segment) => segment.completedAt) ||
    original.segments.every((segment) => !segment.completedAt)
  ) {
    throw new CalendarRuntimeError(
      "invalid_state",
      "Automatic continuation requires a partially completed paused block.",
    );
  }
  const placement = resolveCalendarPlacement({
    scheduledLocalStart: input.scheduledLocalStart,
    householdTimeZone: original.householdTimeZone,
    ...(input.scheduledStart === undefined
      ? {}
      : { scheduledStart: input.scheduledStart }),
    ...(input.intendedLocalDate === undefined
      ? {}
      : { intendedLocalDate: input.intendedLocalDate }),
    ...(input.localTimeDisambiguation === undefined
      ? {}
      : { localTimeDisambiguation: input.localTimeDisambiguation }),
  });
  const remaining = original.segments
    .filter((segment) => !segment.completedAt)
    .map((segment) => ({
      ...segment,
      actualActiveSeconds: 0,
      elapsedActiveSecondsBeforeBlock:
        segment.segmentId === original.resumePoint!.segmentId
          ? original.resumePoint!.elapsedActiveSecondsInSegment
          : 0,
      completedAt: undefined,
    }));
  const continuation: CalendarBlock = {
    ...original,
    internalBlockId: input.continuationInternalBlockId,
    lineage: {
      rootInternalBlockId: original.lineage.rootInternalBlockId,
      continuationKey: input.continuationKey,
      continuationOf: original.internalBlockId,
      completedBeforeOccurrence:
        original.resumePoint.completedSegmentIds,
    },
    scheduledLocalStart: input.scheduledLocalStart,
    scheduledStartInstant: placement.scheduledStartInstant,
    intendedLocalDate: placement.intendedLocalDate,
    placementSource: placement.placementSource,
    estimatedDurationMinutes: totalEstimate(remaining),
    actualDurationSeconds: 0,
    state: "scheduled",
    segments: remaining,
    activeSince: undefined,
    resumePoint: {
      ...original.resumePoint,
      capturedAt: input.at,
    },
    currentInterruption: undefined,
    interruptionHistory: [],
    revision: 0,
    lastEventAt: input.at,
    events: [
      {
        type: "created",
        at: input.at,
        actor: input.actor ?? "system",
      },
    ],
  };
  const updatedOriginal = appendEvent(
    original,
    {
      type: "continuation_created",
      at: input.at,
      actor: input.actor ?? "system",
      continuationBlockId: continuation.internalBlockId,
      continuationKey: input.continuationKey,
    },
    {},
  );
  return {
    blocks: [
      ...blocks.map((block) =>
        block.internalBlockId === original.internalBlockId
          ? updatedOriginal
          : block,
      ),
      continuation,
    ],
    continuation,
    created: true,
  };
}

/**
 * Adapter helper for the canonical Session 1 ResumePoint. The cast applies
 * only the compile-time brand; identifier bytes remain unchanged.
 */
export function toCanonicalResumePoint(
  resume: ExactResumeMetadata,
): ResumePoint {
  return {
    segmentId: resume.segmentId,
    elapsedActiveSecondsInSegment:
      resume.elapsedActiveSecondsInSegment,
    ...(resume.responseDraftRef === undefined
      ? {}
      : { responseDraftRef: resume.responseDraftRef }),
  };
}
