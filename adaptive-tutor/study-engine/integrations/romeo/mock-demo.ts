import { mergeCalendarEntries } from "../calendar/index.js";
import {
  effectiveRomeoProgress,
  romeoVirtualAcademyAdapter,
} from "./adapter.js";
import type {
  EffectiveAssignmentProgress,
  RomeoVirtualAcademyAssignment,
} from "./types.js";

export function buildRomeoMockDemonstration(): {
  readonly assignment: RomeoVirtualAcademyAssignment;
  readonly effectiveProgress: EffectiveAssignmentProgress;
  readonly calendarEntryCountAfterRepeatImport: number;
} {
  const assignment = romeoVirtualAcademyAdapter.normalize({
    externalAssignmentRef: "rva-algebra-204",
    externalAssignmentTitle: "Solving Two-Step Equations",
    externalCourse: "Algebra I",
    dueDate: "2026-07-31",
    estimatedDurationMinutes: 35,
    completionState: "in_progress",
    parentEnteredProgress: {
      completedUnits: 2,
      totalUnits: 5,
      updatedAt: "2026-07-28T08:20:00-04:00",
    },
    studentEnteredProgress: {
      completedUnits: 3,
      totalUnits: 5,
      updatedAt: "2026-07-28T09:10:00-04:00",
    },
    linkedManuelAcademyTutoringSupport: {
      supportRef: "support-two-step-equations",
      title: "Practice two-step equations with the tutor",
      state: "available",
    },
    resumeNote: "Resume with question 6. You have already completed the examples.",
    externalUrlReference:
      "https://academy.example.invalid/assignments/rva-algebra-204",
  });
  const calendarEntry = romeoVirtualAcademyAdapter.toCalendar(assignment, {
    entryId: "calendar-rva-algebra-204",
    learnerRef: "learner-demo-001",
    scheduledStart: "2026-07-29T10:00:00-04:00",
    timeZone: "America/New_York",
    createdAt: "2026-07-28T09:15:00-04:00",
  });

  return {
    assignment,
    effectiveProgress: effectiveRomeoProgress(assignment),
    calendarEntryCountAfterRepeatImport: mergeCalendarEntries(
      [calendarEntry],
      [calendarEntry],
    ).length,
  };
}
