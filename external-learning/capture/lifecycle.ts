import {
  EXTERNAL_CAPTURE_SCHEMA_VERSION,
  ExternalCaptureError,
  type CompletionEvidenceSubmission,
  type EvidenceSubmissionInput,
  type ExternalAssignmentRecord,
  type ExternalDue,
  type ExternalScheduleHandoff,
  type ParentEvidenceReviewInput,
  type SchedulePlacementInput,
} from "./types.js";
import { externalAssignmentDedupeKey } from "./identity.js";
import { assertExternalCapturePermission } from "./permissions.js";
import {
  assertCredentialFree,
  assertIanaTimeZone,
  assertOffsetTimestamp,
  assertOpaqueReference,
  normalizeVisibleText,
  validateAttachmentMetadata,
} from "./validation.js";

export interface ScheduleExternalAssignmentResult {
  readonly assignment: ExternalAssignmentRecord;
  readonly handoff: ExternalScheduleHandoff;
}

export interface CompletionGate {
  readonly allowed: boolean;
  readonly reasons: readonly (
    | "not_scheduled"
    | "evidence_missing"
    | "parent_approval_missing"
    | "evidence_returned"
  )[];
}

export type ScheduleDueAssessment =
  | { readonly status: "no_due_date" }
  | {
      readonly status: "on_or_before_due" | "after_due";
      readonly dueKind: ExternalDue["kind"];
    };

function localDateTimeParts(
  timestamp: string,
  timeZone: string,
): { readonly date: string; readonly time: string } {
  assertOffsetTimestamp(timestamp, "timestamp");
  assertIanaTimeZone(timeZone, "timeZone");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(Date.parse(timestamp));
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const value = parts.find((entry) => entry.type === type)?.value;
    if (!value) {
      throw new ExternalCaptureError(
        "invalid_input",
        "Runtime could not format the requested time-zone value.",
        "timeZone",
      );
    }
    return value;
  };
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export function assessScheduleAgainstDue(
  scheduledStart: string,
  due: ExternalDue | undefined,
): ScheduleDueAssessment {
  if (!due) return { status: "no_due_date" };
  if (due.kind === "instant") {
    assertOffsetTimestamp(scheduledStart, "scheduledStart");
    return {
      status:
        Date.parse(scheduledStart) <= Date.parse(due.dueAt)
          ? "on_or_before_due"
          : "after_due",
      dueKind: "instant",
    };
  }
  const scheduled = localDateTimeParts(scheduledStart, due.timeZone);
  if (due.kind === "date") {
    return {
      status:
        scheduled.date <= due.localDate
          ? "on_or_before_due"
          : "after_due",
      dueKind: "date",
    };
  }
  return {
    status:
      `${scheduled.date}T${scheduled.time}` <=
      `${due.localDate}T${due.localTime.slice(0, 5)}`
        ? "on_or_before_due"
        : "after_due",
    dueKind: "local_date_time",
  };
}

export function buildExternalScheduleHandoff(
  assignment: ExternalAssignmentRecord,
  placement: SchedulePlacementInput,
): ExternalScheduleHandoff {
  if (assignment.lifecycle !== "confirmed") {
    throw new ExternalCaptureError(
      "invalid_state",
      "Only a confirmed, unscheduled assignment can create a schedule handoff.",
      "lifecycle",
    );
  }
  assertExternalCapturePermission(
    placement.requestedBy,
    "schedule_assignment",
    assignment.learnerRef,
  );
  assertOffsetTimestamp(placement.scheduledStart, "scheduledStart");
  assertIanaTimeZone(placement.timeZone, "timeZone");
  assertOffsetTimestamp(placement.requestedAt, "requestedAt");
  if (Date.parse(placement.requestedAt) < Date.parse(assignment.updatedAt)) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Schedule request cannot predate the current assignment revision.",
      "requestedAt",
    );
  }
  return {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    status: "pending_host_calendar_write",
    assignmentId: assignment.assignmentId,
    learnerRef: assignment.learnerRef,
    sourceProviderId: assignment.provider.providerId,
    sourceProviderDisplayName: assignment.provider.displayName,
    originalAssignmentReference: assignment.originalAssignmentReference,
    dedupeKey: externalAssignmentDedupeKey(
      assignment.provider.providerId,
      assignment.originalAssignmentReference,
    ),
    title: assignment.title,
    courseDisplayName: assignment.externalCourse.displayName,
    ...(assignment.courseMapping
      ? {
          manuelCourseRef: assignment.courseMapping.target.courseRef,
          ...(assignment.courseMapping.target.sectionRef
            ? {
                manuelSectionRef:
                  assignment.courseMapping.target.sectionRef,
              }
            : {}),
        }
      : {}),
    ...(assignment.due ? { due: assignment.due } : {}),
    scheduledStart: placement.scheduledStart,
    timeZone: placement.timeZone,
    ...(assignment.estimatedDurationMinutes
      ? {
          estimatedDurationMinutes:
            assignment.estimatedDurationMinutes,
        }
      : {}),
    ...(assignment.instructions
      ? { instructions: assignment.instructions }
      : {}),
    ...(assignment.rubric ? { rubric: assignment.rubric } : {}),
    attachmentIds: assignment.intakeAttachments.map(
      (attachment) => attachment.attachmentId,
    ),
    evidenceRequired: assignment.evidenceRequirement.required,
    parentApprovalRequired:
      assignment.evidenceRequirement.parentApprovalRequired,
  };
}

/**
 * The host creates the actual calendar entry through its authorized boundary,
 * then supplies the opaque calendar reference to this transition.
 */
export function linkExternalAssignmentToSchedule(
  assignment: ExternalAssignmentRecord,
  placement: SchedulePlacementInput,
  calendarEntryRef: string,
): ScheduleExternalAssignmentResult {
  const handoff = buildExternalScheduleHandoff(assignment, placement);
  assertOpaqueReference(calendarEntryRef, "calendarEntryRef");
  return {
    handoff,
    assignment: {
      ...assignment,
      schedule: {
        calendarEntryRef,
        scheduledStart: placement.scheduledStart,
        timeZone: placement.timeZone,
        linkedAt: placement.requestedAt,
        linkedBy: {
          actorRef: placement.requestedBy.actorRef,
          role: "parent",
        },
      },
      lifecycle: "scheduled",
      revision: assignment.revision + 1,
      updatedAt: placement.requestedAt,
    },
  };
}

function acceptedMediaType(
  mediaType: string,
  accepted: readonly string[],
): boolean {
  if (accepted.length === 0) return true;
  return accepted.some((entry) => {
    if (entry === mediaType) return true;
    if (entry.endsWith("/*")) {
      return mediaType.startsWith(entry.slice(0, -1));
    }
    return false;
  });
}

export function submitCompletionEvidence(
  assignment: ExternalAssignmentRecord,
  input: EvidenceSubmissionInput,
): ExternalAssignmentRecord {
  if (
    assignment.lifecycle !== "scheduled" &&
    assignment.lifecycle !== "evidence_returned"
  ) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Evidence may be submitted only for scheduled or returned work.",
      "lifecycle",
    );
  }
  assertCredentialFree(input);
  assertExternalCapturePermission(
    input.submittedBy,
    "submit_evidence",
    assignment.learnerRef,
  );
  assertOpaqueReference(input.evidenceId, "evidenceId");
  assertOffsetTimestamp(input.submittedAt, "submittedAt");
  if (
    assignment.evidence.some(
      (evidence) => evidence.evidenceId === input.evidenceId,
    )
  ) {
    throw new ExternalCaptureError(
      "identity_conflict",
      "Evidence ID has already been used for this assignment.",
      "evidenceId",
    );
  }
  if (Date.parse(input.submittedAt) < Date.parse(assignment.updatedAt)) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Evidence submission cannot predate the current assignment revision.",
      "submittedAt",
    );
  }
  if (
    input.attachments.length <
    assignment.evidenceRequirement.minimumAttachmentCount
  ) {
    throw new ExternalCaptureError(
      "evidence_required",
      `At least ${assignment.evidenceRequirement.minimumAttachmentCount} evidence attachment(s) are required.`,
      "attachments",
    );
  }
  input.attachments.forEach((attachment, index) => {
    const validation = validateAttachmentMetadata(attachment);
    if (!validation.ok) {
      const first = validation.issues[0];
      throw new ExternalCaptureError(
        first.code === "credential_material"
          ? "credential_material"
          : "invalid_input",
        first.message,
        `attachments[${index}]${first.path.slice(1)}`,
      );
    }
    if (
      attachment.purpose !== "completion_evidence" ||
      attachment.availability !== "available"
    ) {
      throw new ExternalCaptureError(
        "evidence_required",
        "Completion evidence attachments must be available and marked completion_evidence.",
        `attachments[${index}]`,
      );
    }
    if (
      !acceptedMediaType(
        attachment.mediaType,
        assignment.evidenceRequirement.acceptedMediaTypes,
      )
    ) {
      throw new ExternalCaptureError(
        "invalid_input",
        `Evidence media type ${attachment.mediaType} is not accepted.`,
        `attachments[${index}].mediaType`,
      );
    }
  });
  const note =
    input.note === undefined
      ? undefined
      : normalizeVisibleText(input.note, "note", 5_000);
  if (assignment.evidenceRequirement.noteRequired && !note) {
    throw new ExternalCaptureError(
      "evidence_required",
      "A completion-evidence note is required.",
      "note",
    );
  }
  const status = assignment.evidenceRequirement.parentApprovalRequired
    ? "pending_parent_approval"
    : "approved";
  const submission: CompletionEvidenceSubmission = {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    evidenceId: input.evidenceId,
    assignmentId: assignment.assignmentId,
    revision: 0,
    submittedBy: {
      actorRef: input.submittedBy.actorRef,
      role: input.submittedBy.role as "parent" | "student",
    },
    submittedAt: input.submittedAt,
    attachments: input.attachments,
    ...(note ? { note } : {}),
    status,
  };
  return {
    ...assignment,
    evidence: [...assignment.evidence, submission],
    lifecycle:
      status === "approved" ? "approved" : "evidence_pending",
    revision: assignment.revision + 1,
    updatedAt: input.submittedAt,
  };
}

export function reviewCompletionEvidence(
  assignment: ExternalAssignmentRecord,
  evidenceId: string,
  input: ParentEvidenceReviewInput,
): ExternalAssignmentRecord {
  if (assignment.lifecycle !== "evidence_pending") {
    throw new ExternalCaptureError(
      "invalid_state",
      "Only pending completion evidence can be reviewed.",
      "lifecycle",
    );
  }
  assertExternalCapturePermission(
    input.reviewedBy,
    "review_evidence",
    assignment.learnerRef,
  );
  assertOffsetTimestamp(input.decidedAt, "decidedAt");
  const index = assignment.evidence.findIndex(
    (entry) => entry.evidenceId === evidenceId,
  );
  if (index < 0) {
    throw new ExternalCaptureError(
      "invalid_input",
      "Evidence submission was not found.",
      "evidenceId",
    );
  }
  const evidence = assignment.evidence[index];
  if (
    Date.parse(input.decidedAt) < Date.parse(evidence.submittedAt) ||
    Date.parse(input.decidedAt) < Date.parse(assignment.updatedAt)
  ) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Evidence review cannot predate the submission or assignment revision.",
      "decidedAt",
    );
  }
  if (evidence.status !== "pending_parent_approval") {
    throw new ExternalCaptureError(
      "invalid_state",
      "Evidence has already been reviewed.",
      "evidence.status",
    );
  }
  const note =
    input.note === undefined
      ? undefined
      : normalizeVisibleText(input.note, "note", 5_000);
  if (input.decision === "return" && !note) {
    throw new ExternalCaptureError(
      "invalid_input",
      "Returned evidence needs a parent note explaining what to add or correct.",
      "note",
    );
  }
  const updatedEvidence: CompletionEvidenceSubmission = {
    ...evidence,
    revision: evidence.revision + 1,
    status: input.decision === "approve" ? "approved" : "returned",
    review: {
      decision: input.decision,
      parentRef: input.reviewedBy.actorRef,
      decidedAt: input.decidedAt,
      reviewedEvidenceRevision: evidence.revision,
      ...(note ? { note } : {}),
    },
  };
  const allEvidence = [...assignment.evidence];
  allEvidence[index] = updatedEvidence;
  return {
    ...assignment,
    evidence: allEvidence,
    lifecycle:
      input.decision === "approve" ? "approved" : "evidence_returned",
    revision: assignment.revision + 1,
    updatedAt: input.decidedAt,
  };
}

export function externalAssignmentCompletionGate(
  assignment: ExternalAssignmentRecord,
): CompletionGate {
  const reasons: CompletionGate["reasons"][number][] = [];
  if (!assignment.schedule) reasons.push("not_scheduled");
  if (assignment.evidenceRequirement.required) {
    if (assignment.lifecycle === "evidence_returned") {
      reasons.push("evidence_returned");
    }
    const currentEvidence = assignment.evidence.filter(
      (entry) =>
        entry.status === "approved" ||
        entry.status === "pending_parent_approval",
    );
    const contentSatisfied = currentEvidence.filter(
      (entry) =>
        entry.attachments.length >=
          assignment.evidenceRequirement.minimumAttachmentCount &&
        (!assignment.evidenceRequirement.noteRequired ||
          Boolean(entry.note?.trim())) &&
        entry.attachments.every(
          (attachment) =>
            attachment.purpose === "completion_evidence" &&
            attachment.availability === "available" &&
            acceptedMediaType(
              attachment.mediaType,
              assignment.evidenceRequirement.acceptedMediaTypes,
            ),
        ),
    );
    if (contentSatisfied.length === 0) reasons.push("evidence_missing");
    if (
      assignment.evidenceRequirement.parentApprovalRequired &&
      !contentSatisfied.some(
        (entry) =>
          entry.status === "approved" &&
          entry.review?.decision === "approve",
      )
    ) {
      reasons.push("parent_approval_missing");
    }
  }
  return { allowed: reasons.length === 0, reasons };
}

export function markExternalAssignmentComplete(
  assignment: ExternalAssignmentRecord,
  completedBy: Parameters<typeof assertExternalCapturePermission>[0],
  completedAt: string,
): ExternalAssignmentRecord {
  if (assignment.lifecycle === "completed") return assignment;
  assertExternalCapturePermission(
    completedBy,
    "mark_complete",
    assignment.learnerRef,
  );
  assertOffsetTimestamp(completedAt, "completedAt");
  if (Date.parse(completedAt) < Date.parse(assignment.updatedAt)) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Completion cannot predate the current assignment revision.",
      "completedAt",
    );
  }
  const gate = externalAssignmentCompletionGate(assignment);
  if (!gate.allowed) {
    const needsApproval = gate.reasons.includes(
      "parent_approval_missing",
    );
    throw new ExternalCaptureError(
      needsApproval ? "approval_required" : "evidence_required",
      `External assignment cannot be completed: ${gate.reasons.join(", ")}.`,
      "lifecycle",
    );
  }
  return {
    ...assignment,
    lifecycle: "completed",
    completedAt,
    revision: assignment.revision + 1,
    updatedAt: completedAt,
  };
}
