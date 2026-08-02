import {
  GENERIC_MANUAL_PROVIDER,
  ROMEO_VIRTUAL_ACADEMY_PROVIDER,
  createManualExtractionProposal,
  extractDocumentAssignmentProposal,
} from "../index.js";
import type {
  AttachmentMetadata,
  ConfirmationInput,
  DocumentAssignmentIntakeInput,
  ExternalCaptureActor,
  FieldConfirmationDecisions,
  ManualAssignmentIntakeInput,
} from "../types.js";

export const parentActorFixture = {
  actorRef: "parent-fixture-1",
  role: "parent",
  learnerRefs: ["learner-fixture-1"],
  canApproveEvidence: true,
  canConfigureProviders: true,
} as const satisfies ExternalCaptureActor;

export const studentActorFixture = {
  actorRef: "student-fixture-1",
  role: "student",
  learnerRefs: ["learner-fixture-1"],
} as const satisfies ExternalCaptureActor;

export const romeoScreenshotAttachmentFixture = {
  attachmentId: "attachment-romeo-screen-1",
  purpose: "intake_source",
  fileName: "romeo-algebra-assignment.png",
  mediaType: "image/png",
  byteSize: 148_220,
  sha256: "a".repeat(64),
  uploadedAt: "2026-07-28T09:00:00-04:00",
  uploadedBy: {
    actorRef: studentActorFixture.actorRef,
    role: "student",
  },
  availability: "available",
  pageCount: 1,
} as const satisfies AttachmentMetadata;

export const readableRomeoScreenshotIntakeFixture = {
  schemaVersion: "external-assignment-capture.v1",
  captureId: "capture-romeo-algebra-204",
  learnerRef: "learner-fixture-1",
  provider: ROMEO_VIRTUAL_ACADEMY_PROVIDER,
  submittedBy: studentActorFixture,
  submittedAt: "2026-07-28T09:01:00-04:00",
  defaultTimeZone: "America/New_York",
  attachment: romeoScreenshotAttachmentFixture,
  content: {
    state: "available",
    method: "ocr",
    text: [
      "Assignment Title: Solving Two-Step Equations",
      "Course: Algebra I",
      "Section: Period 2",
      "Assignment ID: RVA-ALG-204",
      "Due: July 31, 2026 at 11:59 PM",
      "Estimated time: 35 minutes",
      "Instructions: Complete examples 1-5, then solve questions 1-12.",
      "Rubric: Show each inverse operation. 10 points possible.",
      "Link: https://school.example.invalid/assignments/RVA-ALG-204",
    ].join("\n"),
  },
} as const satisfies DocumentAssignmentIntakeInput;

export const missingFileIntakeFixture = {
  ...readableRomeoScreenshotIntakeFixture,
  captureId: "capture-romeo-missing-file",
  attachment: {
    ...romeoScreenshotAttachmentFixture,
    attachmentId: "attachment-romeo-missing",
    availability: "missing",
    byteSize: 0,
  },
  content: {
    state: "missing",
    diagnostic: "Upload reference no longer resolves.",
  },
} as const satisfies DocumentAssignmentIntakeInput;

export const unreadableImageIntakeFixture = {
  ...readableRomeoScreenshotIntakeFixture,
  captureId: "capture-romeo-unreadable",
  attachment: {
    ...romeoScreenshotAttachmentFixture,
    attachmentId: "attachment-romeo-unreadable",
    availability: "unreadable",
  },
  content: {
    state: "unreadable",
    diagnostic: "Image contrast was too low for OCR.",
  },
} as const satisfies DocumentAssignmentIntakeInput;

export const genericManualIntakeFixture = {
  schemaVersion: "external-assignment-capture.v1",
  captureId: "capture-manual-literature-1",
  learnerRef: "learner-fixture-1",
  provider: GENERIC_MANUAL_PROVIDER,
  submittedBy: parentActorFixture,
  submittedAt: "2026-07-28T10:00:00-04:00",
  defaultTimeZone: "America/New_York",
  values: {
    title: "Character analysis paragraph",
    course: { displayName: "World Literature" },
    section: null,
    originalAssignmentReference: "manual-lit-unit-3-task-2",
    due: {
      kind: "date",
      localDate: "2026-08-03",
      timeZone: "America/New_York",
    },
    instructions: {
      format: "plain_text",
      text: "Write one paragraph using two quotations from the assigned chapter.",
    },
    rubric: {
      rawText: "Claim 4 points; evidence 4 points; conventions 2 points.",
      criteria: [
        {
          criterionId: "claim",
          title: "Claim",
          pointsPossible: 4,
        },
        {
          criterionId: "evidence",
          title: "Evidence",
          pointsPossible: 4,
        },
        {
          criterionId: "conventions",
          title: "Conventions",
          pointsPossible: 2,
        },
      ],
      pointsPossible: 10,
    },
    estimatedDurationMinutes: 30,
    sourceUrl: null,
  },
} as const satisfies ManualAssignmentIntakeInput;

export const readableRomeoExtractionFixture =
  extractDocumentAssignmentProposal(readableRomeoScreenshotIntakeFixture);

export const missingFileExtractionFixture =
  extractDocumentAssignmentProposal(missingFileIntakeFixture);

export const unreadableImageExtractionFixture =
  extractDocumentAssignmentProposal(unreadableImageIntakeFixture);

export const genericManualExtractionFixture =
  createManualExtractionProposal(genericManualIntakeFixture);

export const acceptReadableRomeoFieldsFixture = {
  title: { field: "title", decision: "accept" },
  course: { field: "course", decision: "accept" },
  section: { field: "section", decision: "accept" },
  originalAssignmentReference: {
    field: "originalAssignmentReference",
    decision: "accept",
  },
  due: { field: "due", decision: "accept" },
  instructions: { field: "instructions", decision: "accept" },
  rubric: { field: "rubric", decision: "accept" },
  estimatedDurationMinutes: {
    field: "estimatedDurationMinutes",
    decision: "accept",
  },
  sourceUrl: { field: "sourceUrl", decision: "accept" },
} as const satisfies FieldConfirmationDecisions;

export const romeoConfirmationInputFixture = {
  assignmentId: "external-assignment-romeo-204",
  reviewedBy: parentActorFixture,
  reviewedAt: "2026-07-28T09:10:00-04:00",
  decisions: acceptReadableRomeoFieldsFixture,
  evidenceRequirement: {
    required: true,
    minimumAttachmentCount: 1,
    acceptedMediaTypes: ["image/*", "application/pdf"],
    noteRequired: false,
    parentApprovalRequired: true,
  },
} as const satisfies ConfirmationInput;
