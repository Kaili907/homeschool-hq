export {
  ROMEO_ASSIGNMENT_SCHEMA_VERSION,
  ROMEO_RUNTIME_BOUNDARY,
  assertRomeoCredentialFree,
  normalizeRomeoAssignment,
  projectRomeoAssignmentForPublic,
  updateRomeoAssignment,
  type RomeoAssignment,
  type RomeoAssignmentInput,
  type RomeoAssignmentUpdate,
  type RomeoPublicAssignmentProjection,
} from "../../integration-labs/calendar-parent-runtime/romeo-runtime.ts";

import {
  projectRomeoAssignmentToCalendar as acceptedProjectRomeoAssignmentToCalendar,
  romeoAssignmentToCalendarBlock as acceptedRomeoAssignmentToCalendarBlock,
  type RomeoAssignment,
  type RomeoCalendarProjection,
  type RomeoCalendarSchedule as AcceptedRomeoCalendarSchedule,
} from "../../integration-labs/calendar-parent-runtime/romeo-runtime.ts";
import type { CalendarBlock } from "./calendar.ts";

export type RomeoCalendarSchedule = Omit<
  AcceptedRomeoCalendarSchedule,
  "scheduledStart" | "intendedLocalDate"
> & {
  readonly scheduledStart: string;
  readonly intendedLocalDate: string;
};

export function romeoAssignmentToCalendarBlock(
  assignment: RomeoAssignment,
  schedule: RomeoCalendarSchedule,
): CalendarBlock {
  if (
    typeof schedule.scheduledStart !== "string" ||
    typeof schedule.intendedLocalDate !== "string"
  ) {
    throw new Error(
      "Romeo calendar projection requires explicit offset placement.",
    );
  }
  return acceptedRomeoAssignmentToCalendarBlock(assignment, schedule);
}

export function projectRomeoAssignmentToCalendar(
  assignment: RomeoAssignment,
  schedule: RomeoCalendarSchedule,
  existingBlocks: readonly CalendarBlock[] = [],
): RomeoCalendarProjection {
  if (
    typeof schedule.scheduledStart !== "string" ||
    typeof schedule.intendedLocalDate !== "string"
  ) {
    throw new Error(
      "Romeo calendar projection requires explicit offset placement.",
    );
  }
  return acceptedProjectRomeoAssignmentToCalendar(
    assignment,
    schedule,
    existingBlocks,
  );
}

export type { RomeoCalendarProjection };
