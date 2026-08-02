import {
  EXTERNAL_ASSIGNMENT_FIELDS,
  ExternalCaptureError,
  type AssignmentFieldConflict,
  type AssignmentFieldValueMap,
  type DuplicateDetection,
  type ExternalAssignmentField,
  type ExternalAssignmentRecord,
  type ExternalCaptureActor,
  type ProviderAssignmentUpdate,
  type ProviderUpdateReconciliation,
} from "./types.js";
import { assertExternalCapturePermission } from "./permissions.js";
import {
  assertCredentialFree,
  assertOffsetTimestamp,
  assertOpaqueReference,
  validateAssignmentFieldValue,
} from "./validation.js";

function normalizeComparisonText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalReference(value: string): string {
  assertOpaqueReference(value, "originalAssignmentReference");
  return value.trim();
}

export function externalAssignmentDedupeKey(
  providerId: string,
  originalAssignmentReference: string,
): string {
  assertOpaqueReference(providerId, "providerId");
  const reference = canonicalReference(originalAssignmentReference);
  return `external:${encodeURIComponent(providerId)}:${encodeURIComponent(reference)}`;
}

function dueDateKey(record: ExternalAssignmentRecord): string {
  if (!record.due) return "";
  if (record.due.kind === "instant") {
    return record.due.dueAt.slice(0, 10);
  }
  return record.due.localDate;
}

export function detectExternalAssignmentDuplicate(
  candidate: Pick<
    ExternalAssignmentRecord,
    | "learnerRef"
    | "provider"
    | "originalAssignmentReference"
    | "title"
    | "externalCourse"
    | "due"
  >,
  existing: readonly ExternalAssignmentRecord[],
): DuplicateDetection {
  const dedupeKey = externalAssignmentDedupeKey(
    candidate.provider.providerId,
    candidate.originalAssignmentReference,
  );
  const exact = existing.find(
    (record) =>
      record.learnerRef === candidate.learnerRef &&
      externalAssignmentDedupeKey(
        record.provider.providerId,
        record.originalAssignmentReference,
      ) === dedupeKey,
  );
  if (exact) {
    return {
      kind: "exact",
      existingAssignmentId: exact.assignmentId,
      dedupeKey,
    };
  }

  const titleKey = normalizeComparisonText(candidate.title);
  const courseKey = normalizeComparisonText(
    candidate.externalCourse.displayName,
  );
  const candidateDue =
    candidate.due?.kind === "instant"
      ? candidate.due.dueAt.slice(0, 10)
      : candidate.due?.localDate ?? "";
  const possible = existing.filter(
    (record) =>
      record.learnerRef === candidate.learnerRef &&
      record.provider.providerId === candidate.provider.providerId &&
      normalizeComparisonText(record.title) === titleKey &&
      normalizeComparisonText(record.externalCourse.displayName) ===
        courseKey &&
      dueDateKey(record) === candidateDue,
  );
  return possible.length > 0
    ? {
        kind: "possible",
        existingAssignmentIds: possible.map(
          (record) => record.assignmentId,
        ),
        reasons: [
          "Same learner, provider, normalized title, course, and due date.",
          "Provider reference differs, so a parent must decide whether this is a duplicate.",
        ],
      }
    : { kind: "none", dedupeKey };
}

function recordFields(
  assignment: ExternalAssignmentRecord,
): AssignmentFieldValueMap {
  return {
    title: assignment.title,
    course: assignment.externalCourse,
    section: assignment.externalSection ?? null,
    originalAssignmentReference: assignment.originalAssignmentReference,
    due: assignment.due ?? null,
    instructions: assignment.instructions ?? null,
    rubric: assignment.rubric ?? null,
    estimatedDurationMinutes:
      assignment.estimatedDurationMinutes ?? null,
    sourceUrl: assignment.sourceUrl ?? null,
  };
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withSyncState(
  assignment: ExternalAssignmentRecord,
  update: ProviderAssignmentUpdate,
  state: "current" | "pending" | "conflict",
  message: string,
): ExternalAssignmentRecord {
  return {
    ...assignment,
    providerSync: {
      ...assignment.providerSync,
      state,
      lastAttemptedAt: update.observedAt,
      ...(state === "current"
        ? { lastSucceededAt: update.observedAt }
        : {}),
      ...(update.providerRevision
        ? { providerRevision: update.providerRevision }
        : {}),
      message,
    },
    revision: assignment.revision + 1,
    updatedAt: update.observedAt,
  };
}

/**
 * Provider updates never overwrite confirmed fields. They become either a
 * proposal or a visible conflict for a later user confirmation.
 */
export function reconcileProviderAssignmentUpdate(
  assignment: ExternalAssignmentRecord,
  update: ProviderAssignmentUpdate,
  proposedBy: ExternalCaptureActor,
): ProviderUpdateReconciliation {
  assertCredentialFree(update);
  assertExternalCapturePermission(
    proposedBy,
    "apply_provider_update",
    assignment.learnerRef,
  );
  if (assignment.provider.providerId !== update.providerId) {
    throw new ExternalCaptureError(
      "provider_mismatch",
      "Provider update does not match the assignment provider.",
      "providerId",
    );
  }
  if (
    assignment.originalAssignmentReference !==
    update.originalAssignmentReference
  ) {
    throw new ExternalCaptureError(
      "identity_conflict",
      "Provider update changed the original assignment reference.",
      "originalAssignmentReference",
    );
  }
  assertOffsetTimestamp(update.observedAt, "observedAt");
  if (Date.parse(update.observedAt) < Date.parse(assignment.updatedAt)) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Provider observation is older than the current assignment revision.",
      "observedAt",
    );
  }
  const current = recordFields(assignment);
  const changed: ExternalAssignmentField[] = [];
  const conflicts: AssignmentFieldConflict[] = [];
  for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
    const incoming = update.proposedFields[field];
    if (incoming === undefined) continue;
    const validation = validateAssignmentFieldValue(
      field,
      incoming,
      `proposedFields.${field}`,
    );
    if (!validation.ok) {
      const first = validation.issues[0];
      throw new ExternalCaptureError(
        first.code === "credential_material"
          ? "credential_material"
          : "invalid_input",
        first.message,
        first.path,
      );
    }
    if (field === "originalAssignmentReference") {
      if (incoming !== assignment.originalAssignmentReference) {
        throw new ExternalCaptureError(
          "identity_conflict",
          "A provider update cannot replace source assignment identity.",
          "proposedFields.originalAssignmentReference",
        );
      }
      continue;
    }
    if (!jsonEqual(current[field], incoming)) {
      changed.push(field);
      if (current[field] !== null) {
        conflicts.push({
          field,
          currentValue: current[field],
          incomingValue: incoming,
          status: "requires_confirmation",
          reason: "confirmed_value_changed_by_provider",
        });
      }
    }
  }
  if (changed.length === 0) {
    return {
      status: "no_change",
      assignment: withSyncState(
        assignment,
        update,
        "current",
        "Provider observation matched the confirmed assignment.",
      ),
    };
  }
  if (conflicts.length > 0) {
    return {
      status: "conflict",
      assignment: withSyncState(
        assignment,
        update,
        "conflict",
        "Provider changes conflict with confirmed values and require user review.",
      ),
      proposedUpdate: update,
      conflicts,
    };
  }
  return {
    status: "proposal_ready",
    assignment: withSyncState(
      assignment,
      update,
      "pending",
      "Provider supplied new optional values that require confirmation.",
    ),
    proposedUpdate: update,
  };
}

export type ProviderUpdateFieldDecision = "accept_update" | "keep_confirmed";

export interface ConfirmProviderUpdateInput {
  readonly reviewedBy: ExternalCaptureActor;
  readonly reviewedAt: string;
  readonly decisions: Partial<
    Record<ExternalAssignmentField, ProviderUpdateFieldDecision>
  >;
}

export interface ConfirmProviderUpdateResult {
  readonly assignment: ExternalAssignmentRecord;
  readonly acceptedFields: readonly ExternalAssignmentField[];
  readonly retainedFields: readonly ExternalAssignmentField[];
}

/**
 * Applies only fields explicitly reviewed by a parent/student. Every changed
 * field in the update needs a decision; unchanged fields need none.
 */
export function confirmProviderAssignmentUpdate(
  assignment: ExternalAssignmentRecord,
  update: ProviderAssignmentUpdate,
  input: ConfirmProviderUpdateInput,
): ConfirmProviderUpdateResult {
  assertCredentialFree(update);
  assertCredentialFree(input);
  assertExternalCapturePermission(
    input.reviewedBy,
    "confirm_extraction",
    assignment.learnerRef,
  );
  assertOffsetTimestamp(update.observedAt, "observedAt");
  assertOffsetTimestamp(input.reviewedAt, "reviewedAt");
  if (Date.parse(update.observedAt) < Date.parse(assignment.updatedAt)) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Provider observation is older than the current assignment revision.",
      "observedAt",
    );
  }
  if (
    Date.parse(input.reviewedAt) < Date.parse(update.observedAt) ||
    Date.parse(input.reviewedAt) < Date.parse(assignment.updatedAt)
  ) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Provider-update confirmation cannot predate the update or assignment revision.",
      "reviewedAt",
    );
  }
  if (
    update.providerId !== assignment.provider.providerId ||
    update.originalAssignmentReference !==
      assignment.originalAssignmentReference
  ) {
    throw new ExternalCaptureError(
      "identity_conflict",
      "Provider update identity does not match this assignment.",
    );
  }
  const current = recordFields(assignment);
  const next: AssignmentFieldValueMap = { ...current };
  const acceptedFields: ExternalAssignmentField[] = [];
  const retainedFields: ExternalAssignmentField[] = [];
  for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
    const incoming = update.proposedFields[field];
    if (incoming === undefined || jsonEqual(current[field], incoming)) {
      continue;
    }
    const validation = validateAssignmentFieldValue(
      field,
      incoming,
      `proposedFields.${field}`,
    );
    if (!validation.ok) {
      const first = validation.issues[0];
      throw new ExternalCaptureError(
        first.code === "credential_material"
          ? "credential_material"
          : "invalid_input",
        first.message,
        first.path,
      );
    }
    const decision = input.decisions[field];
    if (!decision) {
      throw new ExternalCaptureError(
        "confirmation_incomplete",
        `Provider update field ${field} has not been reviewed.`,
        `decisions.${field}`,
      );
    }
    if (field === "originalAssignmentReference") {
      throw new ExternalCaptureError(
        "identity_conflict",
        "Original provider identity cannot be changed by an update.",
        `proposedFields.${field}`,
      );
    }
    if (decision === "accept_update") {
      (next as Record<ExternalAssignmentField, unknown>)[field] = incoming;
      acceptedFields.push(field);
    } else {
      retainedFields.push(field);
    }
  }
  const updated: ExternalAssignmentRecord = {
    ...assignment,
    title: next.title,
    externalCourse: next.course,
    ...(next.section
      ? { externalSection: next.section }
      : { externalSection: undefined }),
    ...(next.due ? { due: next.due } : { due: undefined }),
    ...(next.instructions
      ? { instructions: next.instructions }
      : { instructions: undefined }),
    ...(next.rubric ? { rubric: next.rubric } : { rubric: undefined }),
    ...(next.estimatedDurationMinutes
      ? { estimatedDurationMinutes: next.estimatedDurationMinutes }
      : { estimatedDurationMinutes: undefined }),
    ...(next.sourceUrl
      ? { sourceUrl: next.sourceUrl }
      : { sourceUrl: undefined }),
    providerSync: {
      ...assignment.providerSync,
      state: "current",
      lastAttemptedAt: update.observedAt,
      lastSucceededAt: input.reviewedAt,
      ...(update.providerRevision
        ? { providerRevision: update.providerRevision }
        : {}),
      message:
        retainedFields.length > 0
          ? "Provider update reviewed; confirmed local values were retained where selected."
          : "Provider update reviewed and accepted.",
    },
    revision: assignment.revision + 1,
    updatedAt: input.reviewedAt,
  };
  return { assignment: updated, acceptedFields, retainedFields };
}
