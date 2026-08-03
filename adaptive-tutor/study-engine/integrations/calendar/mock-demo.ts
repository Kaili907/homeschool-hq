import {
  applyParentCalendarEdit,
  calendarBlockView,
  completeCurrentSegment,
  createAutomaticContinuation,
  createCalendarBlock,
  dailyCompletionBar,
  pauseCalendarBlock,
  rescheduleCalendarBlock,
  resumeCalendarBlock,
  startCalendarBlock,
  weeklyCompletionBar,
} from "./calendar.js";
import {
  DAILY_CALENDAR_BLOCK_TYPES,
  type CalendarBlock,
  type CalendarBlockView,
  type CalendarCompletionBar,
} from "./types.js";

export interface CalendarMockDemonstration {
  readonly everyDailyBlockType: readonly CalendarBlock[];
  readonly partialFractionsLesson: CalendarBlock;
  readonly partialFractionsView: CalendarBlockView;
  readonly automaticContinuation: CalendarBlock;
  readonly dragDropRescheduledProject: CalendarBlock;
  readonly parentEditedReading: CalendarBlock;
  readonly technicalInterruption: CalendarBlock;
  readonly dailyCompletion: CalendarCompletionBar;
  readonly weeklyCompletion: CalendarCompletionBar;
}

function oneSegmentFixture(
  blockType: (typeof DAILY_CALENDAR_BLOCK_TYPES)[number],
  index: number,
): CalendarBlock {
  const hour = String(8 + index).padStart(2, "0");
  return createCalendarBlock({
    entryId: `demo-${blockType}`,
    learnerRef: "learner-demo-001",
    source:
      blockType === "parent_created_activity"
        ? "parent"
        : blockType === "romeo_virtual_academy_activity"
          ? "romeo_virtual_academy"
          : "manuel_academy",
    sourceItemRef: `source-${blockType}`,
    title: blockType
      .split("_")
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" "),
    blockType,
    scheduledStart: `2026-07-28T${hour}:00:00-04:00`,
    timeZone: "America/New_York",
    createdAt: "2026-07-27T12:00:00-04:00",
    createdBy: blockType === "parent_created_activity" ? "parent" : "system",
    segments: [
      {
        segmentId: `segment-${index + 1}`,
        title: "Activity",
        estimatedMinutes: 20,
      },
    ],
  });
}

/**
 * Executable demonstration data for product review. Nothing is persisted and
 * no production calendar is contacted.
 */
export function buildCalendarMockDemonstration(): CalendarMockDemonstration {
  const everyDailyBlockType = DAILY_CALENDAR_BLOCK_TYPES.map(oneSegmentFixture);

  let fractions = createCalendarBlock({
    entryId: "demo-fractions-lesson",
    learnerRef: "learner-demo-001",
    source: "manuel_academy",
    sourceItemRef: "lesson-fractions-006",
    title: "Fractions Lesson",
    subject: "Math",
    blockType: "guided_practice",
    scheduledStart: "2026-07-28T09:00:00-04:00",
    timeZone: "America/New_York",
    createdAt: "2026-07-27T12:00:00-04:00",
    segments: [
      { segmentId: "warm-up", title: "Warm-up", estimatedMinutes: 4 },
      { segmentId: "visual-model", title: "Visual Model", estimatedMinutes: 5 },
      { segmentId: "worked-example", title: "Worked Example", estimatedMinutes: 5 },
      {
        segmentId: "guided-practice",
        title: "Guided Practice",
        estimatedMinutes: 8,
      },
      {
        segmentId: "independent-practice",
        title: "Independent Practice",
        estimatedMinutes: 5,
      },
      { segmentId: "check-in", title: "Check-in", estimatedMinutes: 3 },
    ],
  });
  fractions = startCalendarBlock(
    fractions,
    "2026-07-28T09:00:00-04:00",
  );
  fractions = completeCurrentSegment(fractions, {
    segmentId: "warm-up",
    at: "2026-07-28T09:03:00-04:00",
  });
  fractions = completeCurrentSegment(fractions, {
    segmentId: "visual-model",
    at: "2026-07-28T09:06:00-04:00",
  });
  fractions = completeCurrentSegment(fractions, {
    segmentId: "worked-example",
    at: "2026-07-28T09:09:00-04:00",
  });
  fractions = pauseCalendarBlock(fractions, {
    at: "2026-07-28T09:10:00-04:00",
    actor: "student",
    reason: "approved_break",
    approved: true,
  });
  fractions = resumeCalendarBlock(
    fractions,
    "2026-07-28T09:15:00-04:00",
  );
  fractions = pauseCalendarBlock(fractions, {
    at: "2026-07-28T09:16:00-04:00",
    actor: "parent",
    reason: "outside_interruption",
    approved: true,
  });
  const continuationResult = createAutomaticContinuation(fractions, {
    continuationEntryId: "demo-fractions-continuation",
    continuationRef: "lesson-fractions-006-continuation-1",
    scheduledStart: "2026-07-29T09:00:00-04:00",
    timeZone: "America/New_York",
    at: "2026-07-28T09:17:00-04:00",
  });
  fractions = continuationResult.original;

  const project = createCalendarBlock({
    entryId: "demo-project",
    learnerRef: "learner-demo-001",
    source: "manuel_academy",
    sourceItemRef: "project-ecosystem",
    title: "Ecosystem Project",
    subject: "Science",
    blockType: "project_work",
    scheduledStart: "2026-07-28T11:00:00-04:00",
    timeZone: "America/New_York",
    createdAt: "2026-07-27T12:00:00-04:00",
    segments: [
      { segmentId: "research", title: "Research", estimatedMinutes: 25 },
    ],
  });
  const dragDropRescheduledProject = rescheduleCalendarBlock(project, {
    at: "2026-07-27T13:00:00-04:00",
    actor: "student",
    method: "drag_drop",
    scheduledStart: "2026-07-29T11:30:00-04:00",
    timeZone: "America/New_York",
  });

  const reading = createCalendarBlock({
    entryId: "demo-reading",
    learnerRef: "learner-demo-001",
    source: "manuel_academy",
    sourceItemRef: "reading-chapter-4",
    title: "Read Chapter 4",
    subject: "Reading",
    blockType: "reading",
    scheduledStart: "2026-07-28T13:00:00-04:00",
    timeZone: "America/New_York",
    createdAt: "2026-07-27T12:00:00-04:00",
    segments: [
      { segmentId: "chapter-4", title: "Chapter 4", estimatedMinutes: 20 },
    ],
  });
  const parentEditedReading = applyParentCalendarEdit(reading, {
    at: "2026-07-27T13:05:00-04:00",
    title: "Read Chapter 4 together",
    scheduledStart: "2026-07-28T13:30:00-04:00",
    timerVisibility: "hidden",
  });

  let writing = createCalendarBlock({
    entryId: "demo-writing-interruption",
    learnerRef: "learner-demo-001",
    source: "manuel_academy",
    sourceItemRef: "writing-outline",
    title: "Essay Outline",
    subject: "Writing",
    blockType: "writing",
    scheduledStart: "2026-07-28T14:00:00-04:00",
    timeZone: "America/New_York",
    createdAt: "2026-07-27T12:00:00-04:00",
    segments: [
      { segmentId: "outline", title: "Build the outline", estimatedMinutes: 15 },
    ],
  });
  writing = startCalendarBlock(writing, "2026-07-28T14:00:00-04:00");
  const technicalInterruption = pauseCalendarBlock(writing, {
    at: "2026-07-28T14:04:00-04:00",
    actor: "student",
    reason: "technical_interruption",
    approved: true,
  });

  const progressBlocks = [
    fractions,
    continuationResult.continuation,
    dragDropRescheduledProject,
    parentEditedReading,
    technicalInterruption,
  ];

  return {
    everyDailyBlockType,
    partialFractionsLesson: fractions,
    partialFractionsView: calendarBlockView(fractions),
    automaticContinuation: continuationResult.continuation,
    dragDropRescheduledProject,
    parentEditedReading,
    technicalInterruption,
    dailyCompletion: dailyCompletionBar(
      progressBlocks,
      "2026-07-28",
      "America/New_York",
    ),
    weeklyCompletion: weeklyCompletionBar(
      progressBlocks,
      "2026-07-27",
      "America/New_York",
    ),
  };
}
