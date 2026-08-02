import {
  EXTERNAL_ASSIGNMENT_FIELDS,
  EXTERNAL_CAPTURE_SCHEMA_VERSION,
  ExternalCaptureError,
  type AssignmentExtractionResult,
  type AssignmentFieldValueMap,
  type CompletionEvidenceRequirement,
  type ConfirmationAudit,
  type ConfirmationInput,
  type ConfirmedFieldAudit,
  type ExternalAssignmentField,
  type ExternalAssignmentRecord,
  type FieldConfirmationDecision,
  type ProviderSyncStatus,
} from "./types.js";
import { assertExternalCapturePermission } from "./permissions.js";
import {
  assertCredentialFree,
  assertOffsetTimestamp,
  assertOpaqueReference,
  assertValidExtractionResult,
  validateAssignmentFieldValue,
} from "./validation.js";

const REQUIRED_FIELDS = new Set<ExternalAssignmentField>([
  "title",
  "course",
  "originalAssignmentReference",
]);

function validateEvidenceRequirement(
  requirement: CompletionEvidenceRequirement,
): void {
  if (requirement.parentApprovalRequired && !requirement.required) {
    throw new ExternalCaptureError(
      "invalid_input",
      "Parent evidence approval can be required only when completion evidence is required.",
      "evidenceRequirement.parentApprovalRequired",
    );
  }
  if (
    !Number.isInteger(requirement.minimumAttachmentCount) ||
    requirement.minimumAttachmentCount < 0 ||
    (requirement.required && requirement.minimumAttachmentCount < 1)
  ) {
    throw new ExternalCaptureError(
      "invalid_input",
      "Required evidence must configure at least one attachment.",
      "evidenceRequirement.minimumAttachmentCount",
    );
  }
  if (
    !Array.isArray(requirement.acceptedMediaTypes) ||
    requirement.acceptedMediaTypes.some(
      (mediaType) =>
        typeof mediaType !== "string" || mediaType.trim().length === 0,
    )
  ) {
    throw new ExternalCaptureError(
      "invalid_input",
      "Evidence media types must be non-empty strings.",
      "evidenceRequirement.acceptedMediaTypes",
    );
  }
}

function resolveField<Field extends ExternalAssignmentField>(
  extraction: AssignmentExtractionResult,
  field: Field,
  decision: FieldConfirmationDecision<Field>,
): AssignmentFieldValueMap[Field] | null {
  if (decision.field !== field) {
    throw new ExternalCaptureError(
      "confirmation_incomplete",
      `Confirmation decision for ${field} names a different field.`,
      `decisions.${field}.field`,
    );
  }
  const proposal = extraction.fields[field];
  if (decision.decision === "accept") {
    if (
      proposal.status !== "proposed" ||
      !Object.prototype.hasOwnProperty.call(proposal, "value")
    ) {
      throw new ExternalCaptureError(
        "confirmation_incomplete",
        `${field} has no proposal to accept; edit or explicitly clear it.`,
        `decisions.${field}`,
      );
    }
    return proposal.value as AssignmentFieldValueMap[Field];
  }
  if (decision.decision === "clear") {
    if (REQUIRED_FIELDS.has(field)) {
      throw new ExternalCaptureError(
        "required_field_missing",
        `${field} cannot be cleared before scheduling.`,
        `decisions.${field}`,
      );
    }
    return null;
  }
  const validation = validateAssignmentFieldValue(
    field,
    decision.value,
    `decisions.${field}.value`,
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
  return decision.value;
}

function initialProviderSyncStatus(
  extraction: AssignmentExtractionResult,
): ProviderSyncStatus {
  if (
    extraction.provider.connectionMode === "authorized_adapter" &&
    extraction.provider.synchronizationAvailable
  ) {
    return {
      mode: "not_configured",
      state: "never",
      message:
        "An adapter may be available, but host-managed authorization is not configured.",
    };
  }
  return {
    mode: "manual_only",
    state: "manual",
    message:
      "Manual capture only; no direct provider synchronization is configured.",
  };
}

function auditEntry<Field extends ExternalAssignmentField>(
  extraction: AssignmentExtractionResult,
  input: ConfirmationInput,
  field: Field,
): ConfirmedFieldAudit<Field> {
  const decision = input.decisions[field];
  return {
    field,
    decision: decision.decision,
    proposalConfidence: extraction.fields[field].confidence,
    proposalEvidence: extraction.fields[field].evidence,
    reviewedBy: {
      actorRef: input.reviewedBy.actorRef,
      role: input.reviewedBy.role as "parent" | "student",
    },
    reviewedAt: input.reviewedAt,
  };
}

/**
 * The only transition from extraction to an assignment record. Every field,
 * including optional/missing ones, needs an accept/edit/clear decision.
 */
export function confirmExtractionProposal(
  extraction: AssignmentExtractionResult,
  input: ConfirmationInput,
): ExternalAssignmentRecord {
  assertValidExtractionResult(extraction);
  assertCredentialFree(input);
  assertOpaqueReference(input.assignmentId, "assignmentId");
  assertOffsetTimestamp(input.reviewedAt, "reviewedAt");
  if (Date.parse(input.reviewedAt) < Date.parse(extraction.extractedAt)) {
    throw new ExternalCaptureError(
      "invalid_state",
      "Confirmation cannot predate the extraction proposal.",
      "reviewedAt",
    );
  }
  assertExternalCapturePermission(
    input.reviewedBy,
    "confirm_extraction",
    extraction.learnerRef,
  );
  validateEvidenceRequirement(input.evidenceRequirement);

  if (
    !input.decisions ||
    EXTERNAL_ASSIGNMENT_FIELDS.some(
      (field) =>
        !Object.prototype.hasOwnProperty.call(input.decisions, field) ||
        !input.decisions[field],
    )
  ) {
    throw new ExternalCaptureError(
      "confirmation_incomplete",
      "Every extracted field must receive an explicit confirmation decision.",
      "decisions",
    );
  }

  const title = resolveField(extraction, "title", input.decisions.title);
  const course = resolveField(extraction, "course", input.decisions.course);
  const section = resolveField(
    extraction,
    "section",
    input.decisions.section,
  );
  const originalAssignmentReference = resolveField(
    extraction,
    "originalAssignmentReference",
    input.decisions.originalAssignmentReference,
  );
  const due = resolveField(extraction, "due", input.decisions.due);
  const instructions = resolveField(
    extraction,
    "instructions",
    input.decisions.instructions,
  );
  const rubric = resolveField(
    extraction,
    "rubric",
    input.decisions.rubric,
  );
  const estimatedDurationMinutes = resolveField(
    extraction,
    "estimatedDurationMinutes",
    input.decisions.estimatedDurationMinutes,
  );
  const sourceUrl = resolveField(
    extraction,
    "sourceUrl",
    input.decisions.sourceUrl,
  );

  if (title === null || course === null || originalAssignmentReference === null) {
    throw new ExternalCaptureError(
      "required_field_missing",
      "Title, course, and original assignment reference are required.",
    );
  }

  const fieldAudit: ConfirmationAudit = {
    title: auditEntry(extraction, input, "title"),
    course: auditEntry(extraction, input, "course"),
    section: auditEntry(extraction, input, "section"),
    originalAssignmentReference: auditEntry(
      extraction,
      input,
      "originalAssignmentReference",
    ),
    due: auditEntry(extraction, input, "due"),
    instructions: auditEntry(extraction, input, "instructions"),
    rubric: auditEntry(extraction, input, "rubric"),
    estimatedDurationMinutes: auditEntry(
      extraction,
      input,
      "estimatedDurationMinutes",
    ),
    sourceUrl: auditEntry(extraction, input, "sourceUrl"),
  };

  return {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    assignmentId: input.assignmentId,
    captureId: extraction.captureId,
    learnerRef: extraction.learnerRef,
    provider: extraction.provider,
    originalAssignmentReference,
    title,
    externalCourse: course,
    ...(section ? { externalSection: section } : {}),
    ...(due ? { due } : {}),
    ...(instructions ? { instructions } : {}),
    ...(rubric ? { rubric } : {}),
    ...(estimatedDurationMinutes
      ? { estimatedDurationMinutes }
      : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    intakeAttachments: extraction.attachments,
    confirmation: {
      allFieldsReviewed: true,
      reviewedBy: {
        actorRef: input.reviewedBy.actorRef,
        role: input.reviewedBy.role as "parent" | "student",
      },
      reviewedAt: input.reviewedAt,
      fields: fieldAudit,
    },
    evidenceRequirement: input.evidenceRequirement,
    evidence: [],
    lifecycle: "confirmed",
    providerSync: initialProviderSyncStatus(extraction),
    revision: 0,
    updatedAt: input.reviewedAt,
  };
}
