import {
  EXTERNAL_CAPTURE_SCHEMA_VERSION,
  type AssignmentExtractionResult,
  type AttachmentMetadata,
  type CompletionEvidenceRequirement,
  type ConfirmationInput,
  type DocumentAssignmentIntakeInput,
  type EvidenceSubmissionInput,
  type ExternalAssignmentRecord,
  type ExternalCaptureActor,
  type ExternalDue,
  type ExternalProviderDescriptor,
  type FieldConfirmationDecisions,
  type ManualAssignmentIntakeInput,
  type ProviderAssignmentUpdate,
  type SchedulePlacementInput,
} from "../../external-learning/capture/types.js";
import { ROMEO_VIRTUAL_ACADEMY_PROVIDER } from "../../external-learning/capture/adapters.js";
import { confirmExtractionProposal } from "../../external-learning/capture/confirmation.js";
import { createManualExtractionProposal } from "../../external-learning/capture/extraction.js";
import { linkExternalAssignmentToSchedule } from "../../external-learning/capture/lifecycle.js";

export const LEARNER_REF = "learner-romeo-001";
export const OTHER_LEARNER_REF = "learner-romeo-999";
export const PARENT_REF = "parent-001";
export const STUDENT_REF = "student-001";
export const PROVIDER_ACTOR_REF = "provider-adapter-001";
export const BASE_TIME = "2026-07-28T14:00:00-04:00";

export const parentActor: ExternalCaptureActor = {
  actorRef: PARENT_REF,
  role: "parent",
  learnerRefs: [LEARNER_REF],
  canApproveEvidence: true,
  canConfigureProviders: true,
};

export const parentWithoutApprovalActor: ExternalCaptureActor = {
  ...parentActor,
  actorRef: "parent-no-approval",
  canApproveEvidence: false,
};

export const studentActor: ExternalCaptureActor = {
  actorRef: STUDENT_REF,
  role: "student",
  learnerRefs: [LEARNER_REF],
};

export const providerActor: ExternalCaptureActor = {
  actorRef: PROVIDER_ACTOR_REF,
  role: "provider_adapter",
  learnerRefs: [LEARNER_REF],
};

export const outOfScopeParentActor: ExternalCaptureActor = {
  actorRef: "parent-out-of-scope",
  role: "parent",
  learnerRefs: [OTHER_LEARNER_REF],
  canApproveEvidence: true,
  canConfigureProviders: true,
};

export const defaultEvidenceRequirement: CompletionEvidenceRequirement = {
  required: true,
  minimumAttachmentCount: 1,
  acceptedMediaTypes: ["image/*", "application/pdf"],
  noteRequired: false,
  parentApprovalRequired: true,
};

export function makeAttachment(
  overrides: Partial<AttachmentMetadata> = {},
): AttachmentMetadata {
  return {
    attachmentId: "attachment-001",
    purpose: "intake_source",
    fileName: "romeo-assignment.png",
    mediaType: "image/png",
    byteSize: 42_000,
    sha256: "a".repeat(64),
    uploadedAt: BASE_TIME,
    uploadedBy: {
      actorRef: PARENT_REF,
      role: "parent",
    },
    availability: "available",
    pageCount: 1,
    ...overrides,
  };
}

export function makeEvidenceAttachment(
  overrides: Partial<AttachmentMetadata> = {},
): AttachmentMetadata {
  return makeAttachment({
    attachmentId: "evidence-attachment-001",
    purpose: "completion_evidence",
    fileName: "completed-work.jpg",
    mediaType: "image/jpeg",
    uploadedAt: "2026-07-29T13:00:00-04:00",
    uploadedBy: {
      actorRef: STUDENT_REF,
      role: "student",
    },
    ...overrides,
  });
}

export function makeManualIntake(
  overrides: Partial<ManualAssignmentIntakeInput> = {},
): ManualAssignmentIntakeInput {
  const due: ExternalDue = {
    kind: "local_date_time",
    localDate: "2026-08-03",
    localTime: "15:30",
    timeZone: "America/New_York",
  };
  return {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    captureId: "capture-001",
    learnerRef: LEARNER_REF,
    provider: ROMEO_VIRTUAL_ACADEMY_PROVIDER,
    submittedBy: parentActor,
    submittedAt: BASE_TIME,
    defaultTimeZone: "America/New_York",
    values: {
      title: "Plate Tectonics Lab",
      course: {
        displayName: "Earth Science",
        externalCourseRef: "course-earth-science",
      },
      section: {
        displayName: "Section A",
        externalSectionRef: "section-a",
      },
      originalAssignmentReference: "RVA-ES-204",
      due,
      instructions: {
        format: "plain_text",
        text: "Label each plate boundary and explain the observed movement.",
      },
      rubric: {
        title: "Lab rubric",
        criteria: [
          {
            criterionId: "accuracy",
            title: "Scientific accuracy",
            pointsPossible: 10,
          },
        ],
        pointsPossible: 10,
      },
      estimatedDurationMinutes: 45,
      sourceUrl: "https://school.example/assignments/RVA-ES-204",
    },
    attachments: [],
    ...overrides,
  };
}

export function makeDocumentIntake(
  overrides: Partial<DocumentAssignmentIntakeInput> = {},
): DocumentAssignmentIntakeInput {
  return {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    captureId: "capture-document-001",
    learnerRef: LEARNER_REF,
    provider: ROMEO_VIRTUAL_ACADEMY_PROVIDER,
    submittedBy: studentActor,
    submittedAt: BASE_TIME,
    defaultTimeZone: "America/New_York",
    attachment: makeAttachment({
      uploadedBy: {
        actorRef: STUDENT_REF,
        role: "student",
      },
    }),
    content: {
      state: "available",
      method: "ocr",
      text: [
        "Assignment Title: Plate Tectonics Lab",
        "Course: Earth Science",
        "Section: Section A",
        "Assignment ID: RVA-ES-204",
        "Due: August 3, 2026 3:30 PM",
        "Instructions: Label each plate boundary.",
        "Then explain the observed movement.",
        "Rubric: Accuracy 10 points",
        "Estimated Time: 45 minutes",
        "Link: https://school.example/assignments/RVA-ES-204",
      ].join("\n"),
    },
    ...overrides,
  };
}

export function acceptAllDecisions(): FieldConfirmationDecisions {
  return {
    title: { decision: "accept", field: "title" },
    course: { decision: "accept", field: "course" },
    section: { decision: "accept", field: "section" },
    originalAssignmentReference: {
      decision: "accept",
      field: "originalAssignmentReference",
    },
    due: { decision: "accept", field: "due" },
    instructions: { decision: "accept", field: "instructions" },
    rubric: { decision: "accept", field: "rubric" },
    estimatedDurationMinutes: {
      decision: "accept",
      field: "estimatedDurationMinutes",
    },
    sourceUrl: { decision: "accept", field: "sourceUrl" },
  };
}

export function makeConfirmationInput(
  overrides: Partial<ConfirmationInput> = {},
): ConfirmationInput {
  return {
    assignmentId: "assignment-001",
    reviewedBy: parentActor,
    reviewedAt: "2026-07-28T14:15:00-04:00",
    decisions: acceptAllDecisions(),
    evidenceRequirement: defaultEvidenceRequirement,
    ...overrides,
  };
}

export function makeExtraction(): AssignmentExtractionResult {
  return createManualExtractionProposal(makeManualIntake());
}

export function makeConfirmedAssignment(
  overrides: Partial<ExternalAssignmentRecord> = {},
  evidenceRequirement: CompletionEvidenceRequirement =
    defaultEvidenceRequirement,
): ExternalAssignmentRecord {
  const assignment = confirmExtractionProposal(
    makeExtraction(),
    makeConfirmationInput({ evidenceRequirement }),
  );
  return {
    ...assignment,
    ...overrides,
  };
}

export function makeSchedulePlacement(
  overrides: Partial<SchedulePlacementInput> = {},
): SchedulePlacementInput {
  return {
    scheduledStart: "2026-08-03T13:00:00-04:00",
    timeZone: "America/New_York",
    requestedBy: parentActor,
    requestedAt: "2026-07-28T14:30:00-04:00",
    ...overrides,
  };
}

export function makeScheduledAssignment(
  recordOverrides: Partial<ExternalAssignmentRecord> = {},
  evidenceRequirement: CompletionEvidenceRequirement =
    defaultEvidenceRequirement,
): ExternalAssignmentRecord {
  const confirmed = makeConfirmedAssignment(
    recordOverrides,
    evidenceRequirement,
  );
  return linkExternalAssignmentToSchedule(
    confirmed,
    makeSchedulePlacement(),
    "calendar-entry-001",
  ).assignment;
}

export function makeEvidenceInput(
  overrides: Partial<EvidenceSubmissionInput> = {},
): EvidenceSubmissionInput {
  return {
    evidenceId: "evidence-submission-001",
    submittedBy: studentActor,
    submittedAt: "2026-08-03T16:00:00-04:00",
    attachments: [makeEvidenceAttachment()],
    note: "Completed pages are attached.",
    ...overrides,
  };
}

export function makeProviderUpdate(
  overrides: Partial<ProviderAssignmentUpdate> = {},
): ProviderAssignmentUpdate {
  return {
    providerId: ROMEO_VIRTUAL_ACADEMY_PROVIDER.providerId,
    originalAssignmentReference: "RVA-ES-204",
    observedAt: "2026-07-29T09:00:00-04:00",
    providerRevision: "provider-revision-2",
    proposedFields: {
      title: "Plate Tectonics Lab — Revised",
    },
    ...overrides,
  };
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
