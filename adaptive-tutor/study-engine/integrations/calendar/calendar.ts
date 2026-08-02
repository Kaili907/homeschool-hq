import {
  CALENDAR_PAUSE_REASONS,
  DAILY_CALENDAR_BLOCK_TYPES,
  type AutomaticContinuationInput,
  type AutomaticContinuationResult,
  type CalendarActor,
  type CalendarAuditEvent,
  type CalendarBlock,
  type CalendarBlockView,
  type CalendarCompletionBar,
  type CalendarCompletionState,
  CalendarIntegrationError,
  type CalendarPauseReason,
  type CalendarSegment,
  type CreateCalendarBlockInput,
  type ParentCalendarEditInput,
  type PlannedCalendarItem,
  type RescheduleCalendarBlockInput,
} from "./types.js";

const OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPAQUE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function roundMinutes(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertOpaqueReference(value: string, field: string): void {
  if (!OPAQUE_REFERENCE.test(value)) {
    throw new CalendarIntegrationError(
      "invalid_reference",
      `${field} must be an opaque 1-128 character reference.`,
    );
  }
}

function assertText(value: string, field: string, maximum = 160): void {
  if (value.trim().length === 0 || value.trim().length > maximum) {
    throw new CalendarIntegrationError(
      "invalid_text",
      `${field} must contain 1-${maximum} visible characters.`,
    );
  }
}

function parseOffsetTimestamp(value: string): number {
  if (!OFFSET_TIMESTAMP.test(value)) {
    throw new CalendarIntegrationError(
      "invalid_timestamp",
      "Calendar timestamps must be ISO 8601 values with an explicit UTC offset.",
    );
  }

  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) {
    throw new CalendarIntegrationError(
      "invalid_timestamp",
      "Calendar timestamp is not a valid instant.",
    );
  }
  return instant;
}

function assertCalendarDate(value: string): void {
  if (!CALENDAR_DATE.test(value)) {
    throw new CalendarIntegrationError(
      "invalid_timestamp",
      "Calendar dates must use YYYY-MM-DD.",
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new CalendarIntegrationError(
      "invalid_timestamp",
      "Calendar date is not a real date.",
    );
  }
}

function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new CalendarIntegrationError(
      "invalid_time_zone",
      "Calendar timeZone must be a supported IANA time-zone name.",
    );
  }
}

function assertChronological(block: CalendarBlock, at: string): number {
  const eventInstant = parseOffsetTimestamp(at);
  if (eventInstant < parseOffsetTimestamp(block.lastEventAt)) {
    throw new CalendarIntegrationError(
      "event_out_of_order",
      "Calendar events must be chronological.",
    );
  }
  return eventInstant;
}

function completionStateForSegments(
  segments: readonly CalendarSegment[],
): CalendarCompletionState {
  const completed = segments.filter((segment) => segment.completedAt).length;
  if (completed === 0) return "not_started";
  if (completed === segments.length) return "complete";
  return "partially_complete";
}

function firstIncompleteSegment(
  block: CalendarBlock,
): CalendarSegment | undefined {
  return block.segments.find((segment) => !segment.completedAt);
}

function elapsedActiveMinutes(block: CalendarBlock, at: string): number {
  if (!block.activeSince) return 0;
  const elapsed =
    (parseOffsetTimestamp(at) - parseOffsetTimestamp(block.activeSince)) /
    60_000;
  if (elapsed < 0) {
    throw new CalendarIntegrationError(
      "event_out_of_order",
      "An active calendar interval cannot end before it starts.",
    );
  }
  return roundMinutes(elapsed);
}

function applyActiveTime(
  block: CalendarBlock,
  at: string,
): readonly CalendarSegment[] {
  const current = firstIncompleteSegment(block);
  if (!current) return block.segments;
  const elapsed = elapsedActiveMinutes(block, at);

  return block.segments.map((segment) =>
    segment.segmentId === current.segmentId
      ? {
          ...segment,
          actualMinutes: roundMinutes(segment.actualMinutes + elapsed),
        }
      : segment,
  );
}

function appendEvent(
  block: CalendarBlock,
  event: CalendarAuditEvent,
  changes: Partial<CalendarBlock>,
): CalendarBlock {
  return {
    ...block,
    ...changes,
    revision: block.revision + 1,
    lastEventAt: event.at,
    events: [...block.events, event],
  };
}

export function calendarDateInTimeZone(
  timestamp: string,
  timeZone: string,
): string {
  const instant = parseOffsetTimestamp(timestamp);
  assertTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((candidate) => candidate.type === type)?.value;
    if (!value) {
      throw new CalendarIntegrationError(
        "invalid_time_zone",
        "The runtime could not format the requested calendar date.",
      );
    }
    return value;
  };

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function createCalendarBlock(
  input: CreateCalendarBlockInput,
): CalendarBlock {
  assertOpaqueReference(input.entryId, "entryId");
  assertOpaqueReference(input.learnerRef, "learnerRef");
  assertOpaqueReference(input.sourceItemRef, "sourceItemRef");
  assertText(input.title, "title");
  if (input.subject !== undefined) assertText(input.subject, "subject", 80);
  if (!DAILY_CALENDAR_BLOCK_TYPES.includes(input.blockType)) {
    throw new CalendarIntegrationError(
      "invalid_text",
      "blockType is not a supported daily calendar block type.",
    );
  }
  parseOffsetTimestamp(input.scheduledStart);
  parseOffsetTimestamp(input.createdAt);
  assertTimeZone(input.timeZone);

  if (input.segments.length === 0) {
    throw new CalendarIntegrationError(
      "invalid_segment",
      "A calendar block must contain at least one segment.",
    );
  }

  const seen = new Set<string>();
  const segments = input.segments.map((segment) => {
    assertOpaqueReference(segment.segmentId, "segmentId");
    assertText(segment.title, "segment title");
    if (seen.has(segment.segmentId)) {
      throw new CalendarIntegrationError(
        "invalid_segment",
        "Segment identifiers must be unique within a calendar block.",
      );
    }
    seen.add(segment.segmentId);
    if (
      !Number.isFinite(segment.estimatedMinutes) ||
      segment.estimatedMinutes <= 0
    ) {
      throw new CalendarIntegrationError(
        "invalid_duration",
        "Segment estimates must be positive minute values.",
      );
    }
    return {
      ...segment,
      title: segment.title.trim(),
      estimatedMinutes: roundMinutes(segment.estimatedMinutes),
      actualMinutes: 0,
    };
  });

  const estimatedMinutes = roundMinutes(
    segments.reduce((total, segment) => total + segment.estimatedMinutes, 0),
  );
  const dedupeKey =
    input.dedupeKey ?? `${input.source}:${input.sourceItemRef}`;
  if (dedupeKey.trim().length === 0 || dedupeKey.length > 320) {
    throw new CalendarIntegrationError(
      "invalid_reference",
      "dedupeKey must contain 1-320 characters.",
    );
  }
  if (input.continuationOf) {
    assertOpaqueReference(input.continuationOf, "continuationOf");
  }

  return {
    schemaVersion: "provisional-calendar-block.v1",
    entryId: input.entryId,
    dedupeKey,
    learnerRef: input.learnerRef,
    source: input.source,
    sourceItemRef: input.sourceItemRef,
    title: input.title.trim(),
    ...(input.subject === undefined
      ? {}
      : { subject: input.subject.trim() }),
    blockType: input.blockType,
    scheduledStart: input.scheduledStart,
    timeZone: input.timeZone,
    estimatedMinutes,
    executionState: "scheduled",
    segments,
    ...(input.continuationOf
      ? { continuationOf: input.continuationOf }
      : {}),
    timerVisibility: input.timerVisibility ?? "shown",
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

export function transformPlannedCalendarItem(
  input: PlannedCalendarItem,
): CalendarBlock {
  const block = createCalendarBlock(input);
  if (
    input.intendedLocalDate !== undefined &&
    calendarDateInTimeZone(input.scheduledStart, input.timeZone) !==
      input.intendedLocalDate
  ) {
    assertCalendarDate(input.intendedLocalDate);
    throw new CalendarIntegrationError(
      "local_date_mismatch",
      "scheduledStart does not fall on intendedLocalDate in the supplied timeZone.",
    );
  }
  return block;
}

export function startCalendarBlock(
  block: CalendarBlock,
  at: string,
  actor: CalendarActor = "student",
): CalendarBlock {
  assertChronological(block, at);
  if (block.executionState !== "scheduled") {
    throw new CalendarIntegrationError(
      "invalid_state",
      "Only a scheduled block can be started.",
    );
  }
  const current = firstIncompleteSegment(block);
  if (!current) {
    throw new CalendarIntegrationError(
      "invalid_state",
      "A block without remaining segments cannot be started.",
    );
  }

  return appendEvent(
    block,
    { type: "started", at, actor, segmentId: current.segmentId },
    { executionState: "active", activeSince: at },
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
  if (block.executionState !== "active") {
    throw new CalendarIntegrationError(
      "invalid_state",
      "A segment can be completed only while its block is active.",
    );
  }
  const current = firstIncompleteSegment(block);
  if (!current || current.segmentId !== input.segmentId) {
    throw new CalendarIntegrationError(
      "invalid_segment",
      "Segments must be completed in their displayed order.",
    );
  }

  const withActiveTime = applyActiveTime(block, input.at).map((segment) =>
    segment.segmentId === input.segmentId
      ? { ...segment, completedAt: input.at }
      : segment,
  );
  const isComplete = withActiveTime.every((segment) => segment.completedAt);

  return appendEvent(
    block,
    {
      type: "segment_completed",
      at: input.at,
      actor: input.actor ?? "student",
      segmentId: input.segmentId,
    },
    {
      segments: withActiveTime,
      executionState: isComplete ? "completed" : "active",
      activeSince: isComplete ? undefined : input.at,
      pause: undefined,
    },
  );
}

export function pauseCalendarBlock(
  block: CalendarBlock,
  input: {
    readonly at: string;
    readonly actor: CalendarActor;
    readonly reason: CalendarPauseReason;
    readonly approved: boolean;
  },
): CalendarBlock {
  assertChronological(block, input.at);
  if (block.executionState !== "active") {
    throw new CalendarIntegrationError(
      "invalid_state",
      "Only an active block can be paused.",
    );
  }
  if (!CALENDAR_PAUSE_REASONS.includes(input.reason)) {
    throw new CalendarIntegrationError(
      "invalid_pause",
      "Pause reason is not supported.",
    );
  }
  if (input.reason === "approved_break" && !input.approved) {
    throw new CalendarIntegrationError(
      "invalid_pause",
      "An approved break must be visibly marked approved.",
    );
  }

  return appendEvent(
    block,
    {
      type: "paused",
      at: input.at,
      actor: input.actor,
      reason: input.reason,
      approved: input.approved,
    },
    {
      segments: applyActiveTime(block, input.at),
      executionState: "paused",
      activeSince: undefined,
      pause: {
        reason: input.reason,
        approved: input.approved,
        pausedAt: input.at,
      },
    },
  );
}

export function resumeCalendarBlock(
  block: CalendarBlock,
  at: string,
  actor: CalendarActor = "student",
): CalendarBlock {
  assertChronological(block, at);
  if (block.executionState !== "paused") {
    throw new CalendarIntegrationError(
      "invalid_state",
      "Only a paused block can be resumed.",
    );
  }
  const current = firstIncompleteSegment(block);
  if (!current) {
    throw new CalendarIntegrationError(
      "invalid_state",
      "A completed block has no resumable segment.",
    );
  }

  return appendEvent(
    block,
    { type: "resumed", at, actor, segmentId: current.segmentId },
    {
      executionState: "active",
      activeSince: at,
      pause: undefined,
    },
  );
}

export function rescheduleCalendarBlock(
  block: CalendarBlock,
  input: RescheduleCalendarBlockInput,
): CalendarBlock {
  assertChronological(block, input.at);
  parseOffsetTimestamp(input.scheduledStart);
  assertTimeZone(input.timeZone);
  if (block.executionState === "completed") {
    throw new CalendarIntegrationError(
      "invalid_state",
      "A completed calendar block cannot be rescheduled.",
    );
  }

  return appendEvent(
    block,
    {
      type: "rescheduled",
      at: input.at,
      actor: input.actor,
      method: input.method,
      from: block.scheduledStart,
      to: input.scheduledStart,
    },
    {
      scheduledStart: input.scheduledStart,
      timeZone: input.timeZone,
    },
  );
}

export function applyParentCalendarEdit(
  block: CalendarBlock,
  input: ParentCalendarEditInput,
): CalendarBlock {
  assertChronological(block, input.at);
  if (block.executionState === "completed") {
    throw new CalendarIntegrationError(
      "invalid_state",
      "A completed calendar block cannot be edited.",
    );
  }
  const changedFields: (
    | "title"
    | "subject"
    | "scheduledStart"
    | "timeZone"
    | "timerVisibility"
  )[] = [];
  const changes: {
    title?: string;
    subject?: string;
    scheduledStart?: string;
    timeZone?: string;
    timerVisibility?: "shown" | "hidden";
  } = {};

  if (input.title !== undefined && input.title.trim() !== block.title) {
    assertText(input.title, "title");
    changes.title = input.title.trim();
    changedFields.push("title");
  }
  if (input.subject !== undefined && input.subject.trim() !== block.subject) {
    assertText(input.subject, "subject", 80);
    changes.subject = input.subject.trim();
    changedFields.push("subject");
  }
  if (
    input.scheduledStart !== undefined &&
    input.scheduledStart !== block.scheduledStart
  ) {
    parseOffsetTimestamp(input.scheduledStart);
    changes.scheduledStart = input.scheduledStart;
    changedFields.push("scheduledStart");
  }
  if (input.timeZone !== undefined && input.timeZone !== block.timeZone) {
    assertTimeZone(input.timeZone);
    changes.timeZone = input.timeZone;
    changedFields.push("timeZone");
  }
  if (
    input.timerVisibility !== undefined &&
    input.timerVisibility !== block.timerVisibility
  ) {
    changes.timerVisibility = input.timerVisibility;
    changedFields.push("timerVisibility");
  }
  if (changedFields.length === 0) {
    throw new CalendarIntegrationError(
      "invalid_edit",
      "A parent edit must change at least one visible calendar field.",
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
    changes,
  );
}

export function calendarBlockView(block: CalendarBlock): CalendarBlockView {
  const completed = block.segments.filter(
    (segment) => segment.completedAt,
  ).length;
  const completedEstimate = block.segments
    .filter((segment) => segment.completedAt)
    .reduce((total, segment) => total + segment.estimatedMinutes, 0);
  const remaining = roundMinutes(block.estimatedMinutes - completedEstimate);
  const actualMinutes = roundMinutes(
    block.segments.reduce(
      (total, segment) => total + segment.actualMinutes,
      0,
    ),
  );

  return {
    entryId: block.entryId,
    title: block.title,
    executionState: block.executionState,
    completionState: completionStateForSegments(block.segments),
    segmentsCompleted: completed,
    totalSegments: block.segments.length,
    estimatedMinutes: block.estimatedMinutes,
    estimatedMinutesRemaining: Math.max(0, remaining),
    actualMinutes,
    ...(firstIncompleteSegment(block)
      ? { resumeAt: firstIncompleteSegment(block)?.title }
      : {}),
    completionPercent:
      block.estimatedMinutes === 0
        ? 0
        : Math.round((completedEstimate / block.estimatedMinutes) * 100),
  };
}

export function createAutomaticContinuation(
  block: CalendarBlock,
  input: AutomaticContinuationInput,
): AutomaticContinuationResult {
  assertChronological(block, input.at);
  assertOpaqueReference(input.continuationEntryId, "continuationEntryId");
  assertOpaqueReference(input.continuationRef, "continuationRef");
  if (
    block.executionState !== "paused" ||
    completionStateForSegments(block.segments) !== "partially_complete"
  ) {
    throw new CalendarIntegrationError(
      "invalid_state",
      "Automatic continuation requires paused, partially completed work.",
    );
  }
  const remaining = block.segments
    .filter((segment) => !segment.completedAt)
    .map((segment) => ({
      segmentId: segment.segmentId,
      title: segment.title,
      estimatedMinutes: segment.estimatedMinutes,
    }));

  const continuation = createCalendarBlock({
    entryId: input.continuationEntryId,
    learnerRef: block.learnerRef,
    source: block.source,
    sourceItemRef: input.continuationRef,
    dedupeKey: `continuation:${block.dedupeKey}:${input.continuationRef}`,
    title: block.title,
    ...(block.subject ? { subject: block.subject } : {}),
    blockType: block.blockType,
    scheduledStart: input.scheduledStart,
    timeZone: input.timeZone,
    segments: remaining,
    createdAt: input.at,
    createdBy: input.actor ?? "system",
    continuationOf: block.entryId,
    timerVisibility: block.timerVisibility,
  });
  const original = appendEvent(
    block,
    {
      type: "continuation_created",
      at: input.at,
      actor: input.actor ?? "system",
      continuationEntryId: input.continuationEntryId,
    },
    {},
  );

  return { original, continuation };
}

function completionBar(blocks: readonly CalendarBlock[]): CalendarCompletionBar {
  const scheduledEstimatedMinutes = roundMinutes(
    blocks.reduce((total, block) => total + block.estimatedMinutes, 0),
  );
  const completedEstimatedMinutes = roundMinutes(
    blocks.reduce(
      (blockTotal, block) =>
        blockTotal +
        block.segments
          .filter((segment) => segment.completedAt)
          .reduce(
            (segmentTotal, segment) =>
              segmentTotal + segment.estimatedMinutes,
            0,
          ),
      0,
    ),
  );

  return {
    completedEstimatedMinutes,
    scheduledEstimatedMinutes,
    completedBlocks: blocks.filter(
      (block) => block.executionState === "completed",
    ).length,
    totalBlocks: blocks.length,
    percent:
      scheduledEstimatedMinutes === 0
        ? 0
        : Math.round(
            (completedEstimatedMinutes / scheduledEstimatedMinutes) * 100,
          ),
  };
}

export function dailyCompletionBar(
  blocks: readonly CalendarBlock[],
  localDate: string,
  timeZone: string,
): CalendarCompletionBar {
  assertCalendarDate(localDate);
  assertTimeZone(timeZone);
  return completionBar(
    blocks.filter(
      (block) =>
        calendarDateInTimeZone(block.scheduledStart, timeZone) === localDate,
    ),
  );
}

function addCalendarDays(localDate: string, days: number): string {
  assertCalendarDate(localDate);
  const [year, month, day] = localDate.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [
    result.getUTCFullYear().toString().padStart(4, "0"),
    (result.getUTCMonth() + 1).toString().padStart(2, "0"),
    result.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

export function weeklyCompletionBar(
  blocks: readonly CalendarBlock[],
  weekStartLocalDate: string,
  timeZone: string,
): CalendarCompletionBar {
  assertCalendarDate(weekStartLocalDate);
  assertTimeZone(timeZone);
  const weekEndExclusive = addCalendarDays(weekStartLocalDate, 7);
  return completionBar(
    blocks.filter((block) => {
      const localDate = calendarDateInTimeZone(
        block.scheduledStart,
        timeZone,
      );
      return (
        localDate >= weekStartLocalDate && localDate < weekEndExclusive
      );
    }),
  );
}

function identityFor(block: CalendarBlock): string {
  return `${block.learnerRef}\u0000${block.dedupeKey}`;
}

function newerBlock(left: CalendarBlock, right: CalendarBlock): CalendarBlock {
  if (left.revision !== right.revision) {
    return left.revision > right.revision ? left : right;
  }
  const leftInstant = parseOffsetTimestamp(left.lastEventAt);
  const rightInstant = parseOffsetTimestamp(right.lastEventAt);
  return rightInstant > leftInstant ? right : left;
}

/**
 * Merges imports without creating duplicate entries. A locally changed block
 * wins over a fresh revision-zero import with the same stable identity.
 */
export function mergeCalendarEntries(
  existing: readonly CalendarBlock[],
  incoming: readonly CalendarBlock[],
): readonly CalendarBlock[] {
  const byIdentity = new Map<string, CalendarBlock>();
  const entryIdentity = new Map<string, string>();

  for (const block of [...existing, ...incoming]) {
    const identity = identityFor(block);
    const priorIdentity = entryIdentity.get(block.entryId);
    if (priorIdentity !== undefined && priorIdentity !== identity) {
      throw new CalendarIntegrationError(
        "identity_conflict",
        "One entryId cannot identify two different calendar records.",
      );
    }
    entryIdentity.set(block.entryId, identity);
    const prior = byIdentity.get(identity);
    byIdentity.set(identity, prior ? newerBlock(prior, block) : block);
  }

  return [...byIdentity.values()].sort((left, right) => {
    const timeDifference =
      parseOffsetTimestamp(left.scheduledStart) -
      parseOffsetTimestamp(right.scheduledStart);
    return timeDifference || left.entryId.localeCompare(right.entryId);
  });
}
