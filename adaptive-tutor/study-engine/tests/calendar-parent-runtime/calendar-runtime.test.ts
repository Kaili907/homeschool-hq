import { describe, expect, it } from "vitest";
import {
  CALENDAR_INTERRUPTION_CATEGORIES,
  CALENDAR_TO_CANONICAL_TASK,
  CANONICAL_TASK_TO_DEFAULT_CALENDAR_BLOCK,
  SESSION_4_CALENDAR_BLOCK_TYPES,
  CalendarRuntimeError,
  calendarBlockView,
  calendarBlockTypeForCanonicalTask,
  canonicalTaskForCalendarType,
  completeCurrentSegment,
  createAutomaticContinuation,
  createCalendarBlock,
  createParentActivity,
  dailyRequiredWorkCompletionBar,
  dragDropReschedule,
  interruptCalendarBlock,
  learnerLocalDate,
  mergeCalendarBlocks,
  parentEditCalendarBlock,
  requiredWorkCompletionBar,
  resolveLearnerLocalStart,
  resumeCalendarBlock,
  startCalendarBlock,
  toCanonicalResumePoint,
  type CalendarBlock,
  type Session4CalendarBlockType,
} from "../../integration-labs/calendar-parent-runtime/calendar-runtime.js";

const CREATED_AT = "2026-07-27T16:00:00Z";
const LEARNER = "learner-calendar-runtime";
const TIME_ZONE = "America/New_York";

function sourceForType(blockType: Session4CalendarBlockType) {
  if (blockType === "romeo_virtual_academy_activity") {
    return "romeo_virtual_academy" as const;
  }
  if (
    blockType === "parent_created_activity" ||
    blockType === "physical_education" ||
    blockType === "outside_activity"
  ) {
    return "parent" as const;
  }
  return "manuel_academy" as const;
}

function oneSegmentBlock(
  internalBlockId = "calendar-block-1",
  externalItemId = "lesson-1",
): CalendarBlock {
  return createCalendarBlock({
    internalBlockId,
    learnerRef: LEARNER,
    sourceIdentity: {
      source: "manuel_academy",
      externalItemId,
    },
    title: "One segment",
    subject: "Math",
    blockType: "guided_practice",
    householdTimeZone: TIME_ZONE,
    scheduledLocalStart: "2026-07-28T09:00",
    createdAt: CREATED_AT,
    segments: [
      {
        segmentId: "segment-1",
        title: "Guided work",
        estimatedMinutes: 10,
      },
    ],
  });
}

function fractionsLesson(): CalendarBlock {
  return createCalendarBlock({
    internalBlockId: "fractions-block",
    learnerRef: LEARNER,
    sourceIdentity: {
      source: "manuel_academy",
      externalItemId: "fractions-lesson-006",
    },
    title: "Fractions Lesson",
    subject: "Math",
    blockType: "guided_practice",
    householdTimeZone: TIME_ZONE,
    scheduledLocalStart: "2026-07-28T09:00",
    createdAt: CREATED_AT,
    segments: [
      { segmentId: "warm-up", title: "Warm-up", estimatedMinutes: 4 },
      { segmentId: "visual", title: "Visual Model", estimatedMinutes: 5 },
      { segmentId: "example", title: "Worked Example", estimatedMinutes: 5 },
      {
        segmentId: "guided",
        title: "Guided Practice",
        estimatedMinutes: 8,
      },
      {
        segmentId: "independent",
        title: "Independent Practice",
        estimatedMinutes: 5,
      },
      { segmentId: "check-in", title: "Check-in", estimatedMinutes: 3 },
    ],
  });
}

function partialFractionsLesson(): CalendarBlock {
  let block = startCalendarBlock(
    fractionsLesson(),
    "2026-07-28T13:00:00Z",
  );
  block = completeCurrentSegment(block, {
    segmentId: "warm-up",
    at: "2026-07-28T13:03:00Z",
  });
  block = completeCurrentSegment(block, {
    segmentId: "visual",
    at: "2026-07-28T13:06:00Z",
  });
  block = completeCurrentSegment(block, {
    segmentId: "example",
    at: "2026-07-28T13:09:00Z",
  });
  return interruptCalendarBlock(block, {
    at: "2026-07-28T13:10:00Z",
    actor: "student",
    category: "planned_break",
    responseDraftRef: "draft-ref-guided-1",
  });
}

describe("Session 4 to canonical task mapping", () => {
  it("maps all 13 legacy calendar block types exhaustively", () => {
    expect(SESSION_4_CALENDAR_BLOCK_TYPES).toHaveLength(13);
    expect(Object.keys(CALENDAR_TO_CANONICAL_TASK)).toEqual(
      SESSION_4_CALENDAR_BLOCK_TYPES,
    );
    expect(CALENDAR_TO_CANONICAL_TASK).toEqual({
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
    });

    const blocks = SESSION_4_CALENDAR_BLOCK_TYPES.map((blockType, index) =>
      createCalendarBlock({
        internalBlockId: `mapped-${index + 1}`,
        learnerRef: LEARNER,
        sourceIdentity: {
          source: sourceForType(blockType),
          externalItemId: `external-${index + 1}`,
        },
        title: `Mapped type ${index + 1}`,
        blockType,
        householdTimeZone: TIME_ZONE,
        scheduledLocalStart: `2026-07-28T${String(8 + index).padStart(2, "0")}:00`,
        createdAt: CREATED_AT,
        segments: [
          {
            segmentId: `mapped-segment-${index + 1}`,
            title: "Mapped segment",
            estimatedMinutes: 10,
          },
        ],
      }),
    );

    expect(
      blocks.map((block) => block.segments[0]!.canonicalTaskType),
    ).toEqual(
      SESSION_4_CALENDAR_BLOCK_TYPES.map(
        (blockType) => canonicalTaskForCalendarType(blockType).taskType,
      ),
    );
  });

  it("uses Card 5 canonical defaults and refuses to guess ambiguous tasks", () => {
    expect(CANONICAL_TASK_TO_DEFAULT_CALENDAR_BLOCK).toEqual({
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
    });
    expect(calendarBlockTypeForCanonicalTask("worked-example")).toBe(
      "new_instruction",
    );
    expect(
      calendarBlockTypeForCanonicalTask("prerequisite-remediation"),
    ).toBe("review");
    expect(() =>
      calendarBlockTypeForCanonicalTask("reflection"),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarRuntimeError>>({
        code: "invalid_block_type",
      }),
    );
    expect(
      calendarBlockTypeForCanonicalTask(
        "reflection",
        "parent_created_activity",
      ),
    ).toBe("parent_created_activity");

    const workedExample = createCalendarBlock({
      internalBlockId: "worked-example-block",
      learnerRef: LEARNER,
      sourceIdentity: {
        source: "manuel_academy",
        externalItemId: "lesson/ratios",
      },
      title: "Ratios",
      blockType: "new_instruction",
      householdTimeZone: TIME_ZONE,
      scheduledLocalStart: "2026-07-28T08:00",
      createdAt: CREATED_AT,
      segments: [
        {
          segmentId: "plan/ratios/segment/Worked-A",
          title: "Worked example",
          canonicalTaskType: "worked-example",
          estimatedMinutes: 10,
        },
      ],
    });

    expect(workedExample.segments[0]).toMatchObject({
      segmentId: "plan/ratios/segment/Worked-A",
      canonicalTaskType: "worked-example",
    });
  });
});

describe("stable identities and calendar editing", () => {
  it("preserves external and internal IDs through drag/drop and parent edits", () => {
    const original = oneSegmentBlock();
    const dragged = dragDropReschedule(original, {
      at: "2026-07-27T16:05:00Z",
      actor: "student",
      scheduledLocalStart: "2026-07-29T10:15",
      scheduledStart: "2026-07-29T10:15:00-04:00",
      intendedLocalDate: "2026-07-29",
    });
    const edited = parentEditCalendarBlock(dragged, {
      at: "2026-07-27T16:06:00Z",
      title: "Short guided work",
      timerVisibility: "hidden",
      segmentEstimates: { "segment-1": 8 },
    });

    expect(edited).toMatchObject({
      internalBlockId: "calendar-block-1",
      sourceIdentity: {
        source: "manuel_academy",
        externalItemId: "lesson-1",
      },
      scheduledLocalStart: "2026-07-29T10:15",
      scheduledStartInstant: "2026-07-29T10:15:00-04:00",
      intendedLocalDate: "2026-07-29",
      placementSource: "explicit-offset",
      title: "Short guided work",
      timerVisibility: "hidden",
      estimatedDurationMinutes: 8,
      revision: 2,
    });
    expect(edited.events.slice(-2)).toEqual([
      expect.objectContaining({
        type: "drag_drop_rescheduled",
        toLocalStart: "2026-07-29T10:15",
        toStartInstant: "2026-07-29T10:15:00-04:00",
        toIntendedLocalDate: "2026-07-29",
      }),
      expect.objectContaining({
        type: "parent_edited",
        changedFields: ["title", "timerVisibility", "segmentEstimates"],
      }),
    ]);
    expect(original.scheduledLocalStart).toBe("2026-07-28T09:00");
  });

  it("collapses a repeat import while preserving the first internal ID", () => {
    const first = oneSegmentBlock("stable-local-id", "stable-source-id");
    const repeat = oneSegmentBlock("throwaway-repeat-id", "stable-source-id");

    expect(mergeCalendarBlocks([first], [repeat])).toEqual([first]);
  });

  it("preserves canonical slash and case bytes in segment and external IDs", () => {
    const upper = createCalendarBlock({
      internalBlockId: "Calendar/Block/A",
      learnerRef: "Learner/Stable-A",
      sourceIdentity: {
        source: "manuel_academy",
        externalItemId: "Provider/Course/Assignment-A",
      },
      title: "Stable identifier fixture",
      blockType: "reading",
      householdTimeZone: TIME_ZONE,
      scheduledLocalStart: "2026-07-28T10:00",
      createdAt: CREATED_AT,
      segments: [
        {
          segmentId: "Plan/Segment/A",
          title: "Read",
          estimatedMinutes: 10,
        },
      ],
    });
    const lower = createCalendarBlock({
      ...{
        internalBlockId: "Calendar/Block/B",
        learnerRef: "Learner/Stable-A",
        sourceIdentity: {
          source: "manuel_academy" as const,
          externalItemId: "provider/Course/Assignment-A",
        },
        title: "Stable identifier fixture",
        blockType: "reading" as const,
        householdTimeZone: TIME_ZONE,
        scheduledLocalStart: "2026-07-28T10:00",
        createdAt: CREATED_AT,
        segments: [
          {
            segmentId: "Plan/Segment/A",
            title: "Read",
            estimatedMinutes: 10,
          },
        ],
      },
    });

    expect(upper.sourceIdentity.externalItemId).toBe(
      "Provider/Course/Assignment-A",
    );
    expect(upper.segments[0]?.segmentId).toBe("Plan/Segment/A");
    expect(mergeCalendarBlocks([upper], [lower])).toHaveLength(2);
  });

  it("creates parent activities, PE, and outside activities without source ambiguity", () => {
    const parentBlocks = (
      [
        ["parent_created_activity", "parent-created-activity"],
        ["physical_education", "physical-education"],
        ["outside_activity", "outside-activity"],
      ] as const
    ).map(([blockType, customTaskTypeId], index) => {
      const block = createParentActivity({
        internalBlockId: `parent-block-${index + 1}`,
        parentActivityId: `parent-activity-${index + 1}`,
        learnerRef: LEARNER,
        title: `Parent activity ${index + 1}`,
        blockType,
        householdTimeZone: TIME_ZONE,
        scheduledLocalStart: `2026-07-30T${String(9 + index).padStart(2, "0")}:00`,
        createdAt: CREATED_AT,
        segments: [
          {
            segmentId: `parent-segment-${index + 1}`,
            title: "Activity",
            estimatedMinutes: 20,
          },
        ],
      });
      expect(block.sourceIdentity.source).toBe("parent");
      expect(block.canonicalTask).toEqual({
        taskType: "custom",
        customTaskTypeId,
      });
      expect(block.events[0]).toMatchObject({
        type: "created",
        actor: "parent",
      });
      return block;
    });

    expect(parentBlocks.map((block) => block.blockType)).toEqual([
      "parent_created_activity",
      "physical_education",
      "outside_activity",
    ]);
  });
});

describe("partial completion, exact resume, and idempotent continuation", () => {
  it("captures the exact 3-of-6 canonical resume point and separate durations", () => {
    const partial = partialFractionsLesson();
    const view = calendarBlockView(partial);

    expect(view).toMatchObject({
      state: "paused",
      segmentsCompleted: 3,
      totalSegments: 6,
      requiredSegmentsCompleted: 3,
      requiredSegmentsTotal: 6,
      requiredWorkCompletionPercent: 50,
      estimatedDurationMinutes: 30,
      estimatedRemainingMinutes: 16,
      actualDurationMinutes: 10,
    });
    expect(view.resumePoint).toEqual({
      segmentId: "guided",
      segmentOrdinal: 4,
      elapsedActiveSecondsInSegment: 60,
      responseDraftRef: "draft-ref-guided-1",
      completedSegmentIds: ["warm-up", "visual", "example"],
      remainingSegmentIds: ["guided", "independent", "check-in"],
      capturedAt: "2026-07-28T13:10:00Z",
    });
    expect(toCanonicalResumePoint(view.resumePoint!)).toEqual({
      segmentId: "guided",
      elapsedActiveSecondsInSegment: 60,
      responseDraftRef: "draft-ref-guided-1",
    });
  });

  it("continues only remaining work and does not duplicate a retried command", () => {
    const partial = partialFractionsLesson();
    const first = createAutomaticContinuation([partial], {
      originalInternalBlockId: partial.internalBlockId,
      continuationInternalBlockId: "fractions-continuation",
      continuationKey: "2026-07-29-am",
      scheduledLocalStart: "2026-07-29T09:00",
      scheduledStart: "2026-07-29T09:00:00-04:00",
      intendedLocalDate: "2026-07-29",
      at: "2026-07-28T13:11:00Z",
    });

    expect(first.created).toBe(true);
    expect(first.blocks).toHaveLength(2);
    expect(first.continuation).toMatchObject({
      internalBlockId: "fractions-continuation",
      sourceIdentity: partial.sourceIdentity,
      estimatedDurationMinutes: 16,
      actualDurationSeconds: 0,
      state: "scheduled",
      scheduledStartInstant: "2026-07-29T09:00:00-04:00",
      intendedLocalDate: "2026-07-29",
      placementSource: "explicit-offset",
      lineage: {
        rootInternalBlockId: "fractions-block",
        continuationKey: "2026-07-29-am",
        continuationOf: "fractions-block",
        completedBeforeOccurrence: ["warm-up", "visual", "example"],
      },
    });
    expect(
      first.continuation.segments.map((segment) => segment.segmentId),
    ).toEqual(["guided", "independent", "check-in"]);
    expect(first.continuation.segments[0]).toMatchObject({
      planOrdinal: 4,
      elapsedActiveSecondsBeforeBlock: 60,
      actualActiveSeconds: 0,
    });
    expect(first.continuation.resumePoint?.segmentOrdinal).toBe(4);

    const retried = createAutomaticContinuation(first.blocks, {
      originalInternalBlockId: partial.internalBlockId,
      continuationInternalBlockId: "ignored-new-id",
      continuationKey: "2026-07-29-am",
      scheduledLocalStart: "2026-07-29T09:00",
      scheduledStart: "2026-07-29T09:00:00-04:00",
      intendedLocalDate: "2026-07-29",
      at: "2026-07-28T13:12:00Z",
    });

    expect(retried.created).toBe(false);
    expect(retried.blocks).toHaveLength(2);
    expect(retried.continuation.internalBlockId).toBe(
      "fractions-continuation",
    );
    expect(requiredWorkCompletionBar(first.blocks)).toEqual({
      basis: "required-segment-units",
      completedRequiredUnits: 3,
      totalRequiredUnits: 6,
      percent: 50,
    });
  });

  it("rejects fractional active seconds instead of corrupting canonical resume", () => {
    const active = startCalendarBlock(
      oneSegmentBlock("whole-seconds", "whole-seconds-source"),
      "2026-07-28T13:00:00.500Z",
    );
    expect(() =>
      interruptCalendarBlock(active, {
        at: "2026-07-28T13:00:01.750Z",
        actor: "student",
        category: "requested_break",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarRuntimeError>>({
        code: "invalid_timestamp",
      }),
    );
  });
});

describe("break and interruption semantics", () => {
  it("keeps all four categories distinct across exact resume cycles", () => {
    let block = startCalendarBlock(
      oneSegmentBlock("interruptions", "interruptions-source"),
      "2026-07-28T13:00:00Z",
    );
    const cases = [
      ["planned_break", "approved"],
      ["requested_break", "requested"],
      ["outside_interruption", "not_required"],
      ["technical_interruption", "not_required"],
    ] as const;

    cases.forEach(([category, approvalState], index) => {
      const interruptedAt = `2026-07-28T13:${String(index * 2 + 1).padStart(2, "0")}:00Z`;
      block = interruptCalendarBlock(block, {
        at: interruptedAt,
        actor: index === 2 ? "parent" : "student",
        category,
        approvalState,
      });
      expect(block.currentInterruption).toMatchObject({
        category,
        approvalState,
      });
      if (index < cases.length - 1) {
        block = resumeCalendarBlock(
          block,
          `2026-07-28T13:${String(index * 2 + 2).padStart(2, "0")}:00Z`,
        );
      }
    });

    expect(block.interruptionHistory.map(({ category }) => category)).toEqual(
      CALENDAR_INTERRUPTION_CATEGORIES,
    );
    expect(calendarBlockView(block).actualDurationMinutes).toBe(4);
  });

  it("does not treat an unapproved planned break as a valid category record", () => {
    const active = startCalendarBlock(
      oneSegmentBlock("planned-break", "planned-break-source"),
      "2026-07-28T13:00:00Z",
    );
    expect(() =>
      interruptCalendarBlock(active, {
        at: "2026-07-28T13:01:00Z",
        actor: "student",
        category: "planned_break",
        approvalState: "requested",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarRuntimeError>>({
        code: "invalid_interruption",
      }),
    );
  });
});

describe("required-work completion", () => {
  it("uses required segment units and cannot be inflated by time alone", () => {
    let block = createCalendarBlock({
      internalBlockId: "required-work",
      learnerRef: LEARNER,
      sourceIdentity: {
        source: "manuel_academy",
        externalItemId: "required-work-source",
      },
      title: "Required work",
      blockType: "independent_practice",
      householdTimeZone: TIME_ZONE,
      scheduledLocalStart: "2026-07-28T11:00",
      createdAt: CREATED_AT,
      segments: [
        {
          segmentId: "required-1",
          title: "Required one",
          estimatedMinutes: 5,
        },
        {
          segmentId: "required-2",
          title: "Required two",
          estimatedMinutes: 5,
        },
        {
          segmentId: "optional",
          title: "Optional extension",
          estimatedMinutes: 30,
          required: false,
        },
      ],
    });
    block = startCalendarBlock(block, "2026-07-28T15:00:00Z");
    block = interruptCalendarBlock(block, {
      at: "2026-07-28T15:30:00Z",
      actor: "student",
      category: "requested_break",
    });

    expect(calendarBlockView(block).actualDurationMinutes).toBe(30);
    expect(requiredWorkCompletionBar([block])).toMatchObject({
      completedRequiredUnits: 0,
      totalRequiredUnits: 2,
      percent: 0,
    });

    block = resumeCalendarBlock(block, "2026-07-28T15:31:00Z");
    block = completeCurrentSegment(block, {
      segmentId: "required-1",
      at: "2026-07-28T15:32:00Z",
    });

    expect(calendarBlockView(block).actualDurationMinutes).toBe(31);
    expect(requiredWorkCompletionBar([block])).toEqual({
      basis: "required-segment-units",
      completedRequiredUnits: 1,
      totalRequiredUnits: 2,
      percent: 50,
    });
    expect(
      dailyRequiredWorkCompletionBar(
        [block],
        "2026-07-28",
        TIME_ZONE,
      ),
    ).toEqual(requiredWorkCompletionBar([block]));
  });
});

describe("household IANA time-zone and DST behavior", () => {
  it("preserves an explicit offset placement and validates its local date", () => {
    const laterOverlap = createCalendarBlock({
      internalBlockId: "fall-overlap",
      learnerRef: LEARNER,
      sourceIdentity: {
        source: "manuel_academy",
        externalItemId: "fall-overlap-source",
      },
      title: "Fall overlap",
      blockType: "review",
      householdTimeZone: TIME_ZONE,
      scheduledLocalStart: "2026-11-01T01:30",
      scheduledStart: "2026-11-01T01:30:00-05:00",
      intendedLocalDate: "2026-11-01",
      createdAt: CREATED_AT,
      segments: [
        {
          segmentId: "fall-overlap-segment",
          title: "Review",
          estimatedMinutes: 10,
        },
      ],
    });

    expect(laterOverlap).toMatchObject({
      scheduledLocalStart: "2026-11-01T01:30",
      scheduledStartInstant: "2026-11-01T01:30:00-05:00",
      intendedLocalDate: "2026-11-01",
      householdTimeZone: TIME_ZONE,
      placementSource: "explicit-offset",
    });
    expect(() =>
      createCalendarBlock({
        internalBlockId: "spring-gap-explicit",
        learnerRef: LEARNER,
        sourceIdentity: {
          source: "manuel_academy",
          externalItemId: "spring-gap-explicit-source",
        },
        title: "Invalid spring gap",
        blockType: "review",
        householdTimeZone: TIME_ZONE,
        scheduledLocalStart: "2026-03-08T02:30",
        scheduledStart: "2026-03-08T02:30:00-05:00",
        intendedLocalDate: "2026-03-08",
        createdAt: CREATED_AT,
        segments: [
          {
            segmentId: "spring-gap-explicit-segment",
            title: "Review",
            estimatedMinutes: 10,
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarRuntimeError>>({
        code: "local_date_mismatch",
      }),
    );
  });

  it("resolves both fall-back instants deterministically", () => {
    const earlier = resolveLearnerLocalStart(
      "2026-11-01T01:30",
      TIME_ZONE,
      "earlier",
    );
    const later = resolveLearnerLocalStart(
      "2026-11-01T01:30",
      TIME_ZONE,
      "later",
    );

    expect(Date.parse(later) - Date.parse(earlier)).toBe(60 * 60 * 1_000);
    expect(earlier).toBe("2026-11-01T05:30:00.000Z");
    expect(later).toBe("2026-11-01T06:30:00.000Z");
    expect(learnerLocalDate(earlier, TIME_ZONE)).toBe("2026-11-01");
    expect(learnerLocalDate(later, TIME_ZONE)).toBe("2026-11-01");
  });

  it("rejects a spring-forward gap and an unknown household zone", () => {
    expect(() =>
      resolveLearnerLocalStart(
        "2026-03-08T02:30",
        TIME_ZONE,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarRuntimeError>>({
        code: "nonexistent_local_time",
      }),
    );
    expect(() =>
      resolveLearnerLocalStart(
        "2026-07-28T09:00",
        "Mars/Olympus_Mons",
      ),
    ).toThrowError(
      expect.objectContaining<Partial<CalendarRuntimeError>>({
        code: "invalid_time_zone",
      }),
    );
  });

  it("groups an offset-boundary instant by the household's local date", () => {
    expect(
      learnerLocalDate("2026-07-29T00:30:00Z", "America/New_York"),
    ).toBe("2026-07-28");
    expect(learnerLocalDate("2026-07-29T00:30:00Z", "Asia/Tokyo")).toBe(
      "2026-07-29",
    );
  });

  it("uses each block's persisted date and zone snapshot for daily bars", () => {
    const boundary = createCalendarBlock({
      internalBlockId: "historical-zone-snapshot",
      learnerRef: LEARNER,
      sourceIdentity: {
        source: "manuel_academy",
        externalItemId: "historical-zone-source",
      },
      title: "Historical zone",
      blockType: "reading",
      householdTimeZone: "America/New_York",
      scheduledLocalStart: "2026-07-28T20:30",
      scheduledStart: "2026-07-29T00:30:00Z",
      intendedLocalDate: "2026-07-28",
      createdAt: CREATED_AT,
      segments: [
        {
          segmentId: "historical-zone-segment",
          title: "Read",
          estimatedMinutes: 10,
        },
      ],
    });

    expect(
      dailyRequiredWorkCompletionBar(
        [boundary],
        "2026-07-28",
        "America/New_York",
      ),
    ).toMatchObject({ totalRequiredUnits: 1 });
    expect(
      dailyRequiredWorkCompletionBar(
        [boundary],
        "2026-07-29",
        "Asia/Tokyo",
      ),
    ).toEqual({
      basis: "required-segment-units",
      completedRequiredUnits: 0,
      totalRequiredUnits: 0,
      percent: 100,
    });
  });
});
