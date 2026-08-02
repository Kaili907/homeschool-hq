import {
  createCalendarBlock,
  type CalendarBlock,
} from "../calendar/index.js";
import {
  type EffectiveAssignmentProgress,
  type EnteredAssignmentProgress,
  type ExternalAssignmentAdapter,
  type RomeoCalendarScheduleInput,
  RomeoAdapterError,
  type RomeoVirtualAcademyAssignment,
  type RomeoVirtualAcademyAssignmentInput,
} from "./types.js";

const OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPAQUE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const CREDENTIAL_FIELD =
  /(?:password|passcode|credential|login|username|access.?token|refresh.?token|session.?cookie|api.?key|secret)/i;
const CREDENTIAL_QUERY_PARAMETER =
  /^(?:token|auth|authorization|key|api_key|password|credential)$/i;
const COMPLETION_STATES = ["not_started", "in_progress", "completed"] as const;

function assertCredentialFree(
  value: unknown,
  seen = new Set<unknown>(),
): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);

  for (const [key, nested] of Object.entries(value)) {
    if (CREDENTIAL_FIELD.test(key)) {
      throw new RomeoAdapterError(
        "credential_material",
        "External assignment payloads must not contain login or credential material.",
      );
    }
    assertCredentialFree(nested, seen);
  }
}

function assertOpaqueReference(value: string, field: string): void {
  if (!OPAQUE_REFERENCE.test(value)) {
    throw new RomeoAdapterError(
      "invalid_reference",
      `${field} must be an opaque 1-128 character reference.`,
    );
  }
}

function normalizeText(
  value: string,
  field: string,
  maximum: number,
): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new RomeoAdapterError(
      "invalid_text",
      `${field} must contain 1-${maximum} visible characters.`,
    );
  }
  return normalized;
}

function assertDueDate(value: string): void {
  if (!CALENDAR_DATE.test(value)) {
    throw new RomeoAdapterError(
      "invalid_due_date",
      "External dueDate must use YYYY-MM-DD.",
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RomeoAdapterError(
      "invalid_due_date",
      "External dueDate is not a real calendar date.",
    );
  }
}

function assertOffsetTimestamp(value: string): void {
  if (!OFFSET_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new RomeoAdapterError(
      "invalid_timestamp",
      "Progress timestamps must be valid ISO 8601 values with an explicit offset.",
    );
  }
}

function normalizeProgress(
  progress: EnteredAssignmentProgress | undefined,
): EnteredAssignmentProgress | undefined {
  if (progress === undefined) return undefined;
  if (
    !Number.isInteger(progress.completedUnits) ||
    !Number.isInteger(progress.totalUnits) ||
    progress.totalUnits <= 0 ||
    progress.completedUnits < 0 ||
    progress.completedUnits > progress.totalUnits
  ) {
    throw new RomeoAdapterError(
      "invalid_progress",
      "Entered progress must be whole units from zero through totalUnits.",
    );
  }
  assertOffsetTimestamp(progress.updatedAt);
  return { ...progress };
}

function normalizeExternalUrl(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RomeoAdapterError(
      "invalid_url",
      "externalUrlReference must be a valid HTTPS URL.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new RomeoAdapterError(
      "invalid_url",
      "externalUrlReference must be HTTPS and must not embed credentials.",
    );
  }
  for (const key of url.searchParams.keys()) {
    if (CREDENTIAL_QUERY_PARAMETER.test(key)) {
      throw new RomeoAdapterError(
        "credential_material",
        "externalUrlReference must not contain credential-bearing query parameters.",
      );
    }
  }
  return url.toString();
}

export function normalizeRomeoAssignment(
  input: RomeoVirtualAcademyAssignmentInput,
): RomeoVirtualAcademyAssignment {
  assertCredentialFree(input);
  assertOpaqueReference(
    input.externalAssignmentRef,
    "externalAssignmentRef",
  );
  assertDueDate(input.dueDate);
  if (
    !Number.isFinite(input.estimatedDurationMinutes) ||
    input.estimatedDurationMinutes <= 0
  ) {
    throw new RomeoAdapterError(
      "invalid_duration",
      "estimatedDurationMinutes must be positive.",
    );
  }
  if (!COMPLETION_STATES.includes(input.completionState)) {
    throw new RomeoAdapterError(
      "invalid_completion_state",
      "completionState must be not_started, in_progress, or completed.",
    );
  }

  const parentEnteredProgress = normalizeProgress(
    input.parentEnteredProgress,
  );
  const studentEnteredProgress = normalizeProgress(
    input.studentEnteredProgress,
  );
  const externalUrlReference = normalizeExternalUrl(
    input.externalUrlReference,
  );
  const support = input.linkedManuelAcademyTutoringSupport;
  if (support) {
    assertOpaqueReference(support.supportRef, "supportRef");
    normalizeText(support.title, "tutoring support title", 160);
    if (
      support.state !== "available" &&
      support.state !== "requested" &&
      support.state !== "completed"
    ) {
      throw new RomeoAdapterError(
        "invalid_text",
        "Tutoring support state is not supported.",
      );
    }
  }

  return {
    schemaVersion: "provisional-external-assignment.v1",
    provider: "romeo_virtual_academy",
    externalAssignmentRef: input.externalAssignmentRef,
    externalAssignmentTitle: normalizeText(
      input.externalAssignmentTitle,
      "externalAssignmentTitle",
      200,
    ),
    externalCourse: normalizeText(
      input.externalCourse,
      "externalCourse",
      120,
    ),
    dueDate: input.dueDate,
    estimatedDurationMinutes:
      Math.round((input.estimatedDurationMinutes + Number.EPSILON) * 100) /
      100,
    completionState: input.completionState,
    ...(parentEnteredProgress ? { parentEnteredProgress } : {}),
    ...(studentEnteredProgress ? { studentEnteredProgress } : {}),
    ...(support
      ? {
          linkedManuelAcademyTutoringSupport: {
            supportRef: support.supportRef,
            title: support.title.trim(),
            state: support.state,
          },
        }
      : {}),
    ...(input.resumeNote === undefined
      ? {}
      : {
          resumeNote: normalizeText(input.resumeNote, "resumeNote", 500),
        }),
    ...(externalUrlReference ? { externalUrlReference } : {}),
  };
}

function progressRatio(progress: EnteredAssignmentProgress): number {
  return progress.completedUnits / progress.totalUnits;
}

export function effectiveRomeoProgress(
  assignment: RomeoVirtualAcademyAssignment,
): EffectiveAssignmentProgress {
  if (assignment.completionState === "completed") {
    return {
      completedUnits: 1,
      totalUnits: 1,
      percent: 100,
      source: "external_state",
    };
  }
  const candidates = [
    assignment.parentEnteredProgress
      ? {
          progress: assignment.parentEnteredProgress,
          source: "parent" as const,
        }
      : undefined,
    assignment.studentEnteredProgress
      ? {
          progress: assignment.studentEnteredProgress,
          source: "student" as const,
        }
      : undefined,
  ].filter(
    (
      candidate,
    ): candidate is {
      progress: EnteredAssignmentProgress;
      source: "parent" | "student";
    } => candidate !== undefined,
  );
  if (candidates.length === 0) {
    return {
      completedUnits: 0,
      totalUnits: 1,
      percent: 0,
      source: "none",
    };
  }
  candidates.sort((left, right) => {
    const ratioDifference =
      progressRatio(right.progress) - progressRatio(left.progress);
    if (ratioDifference !== 0) return ratioDifference;
    return (
      Date.parse(right.progress.updatedAt) -
      Date.parse(left.progress.updatedAt)
    );
  });
  const selected = candidates[0];
  return {
    completedUnits: selected.progress.completedUnits,
    totalUnits: selected.progress.totalUnits,
    percent: Math.round(progressRatio(selected.progress) * 100),
    source: selected.source,
  };
}

export function romeoAssignmentToCalendarBlock(
  assignment: RomeoVirtualAcademyAssignment,
  schedule: RomeoCalendarScheduleInput,
): CalendarBlock {
  return createCalendarBlock({
    entryId: schedule.entryId,
    learnerRef: schedule.learnerRef,
    source: "romeo_virtual_academy",
    sourceItemRef: assignment.externalAssignmentRef,
    title: assignment.externalAssignmentTitle,
    subject: assignment.externalCourse,
    blockType: "romeo_virtual_academy_activity",
    scheduledStart: schedule.scheduledStart,
    timeZone: schedule.timeZone,
    createdAt: schedule.createdAt,
    segments: [
      {
        segmentId: "external-assignment-work",
        title: "External assignment work",
        estimatedMinutes: assignment.estimatedDurationMinutes,
      },
    ],
  });
}

export const romeoVirtualAcademyAdapter: ExternalAssignmentAdapter<
  RomeoVirtualAcademyAssignmentInput,
  RomeoVirtualAcademyAssignment,
  RomeoCalendarScheduleInput,
  CalendarBlock
> = {
  provider: "romeo_virtual_academy",
  normalize: normalizeRomeoAssignment,
  toCalendar: romeoAssignmentToCalendarBlock,
};
