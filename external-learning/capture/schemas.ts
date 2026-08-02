import type {
  AssignmentExtractionResult,
  AttachmentMetadata,
  CourseSectionMapping,
  ExternalAssignmentRecord,
} from "./types.js";
import {
  type ValidationResult,
  validateAttachmentMetadata,
  validateCourseSectionMapping,
  validateExternalAssignmentRecord,
  validateExtractionResult,
} from "./validation.js";

export type JsonSchema = Readonly<Record<string, unknown>>;

const idPattern = "^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,255}$";
const offsetTimestampPattern =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$";

export const attachmentMetadataJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manuel.academy/schemas/external-capture/attachment-metadata.v1.json",
  title: "External capture attachment metadata",
  type: "object",
  additionalProperties: false,
  required: [
    "attachmentId",
    "purpose",
    "fileName",
    "mediaType",
    "byteSize",
    "sha256",
    "uploadedAt",
    "uploadedBy",
    "availability",
  ],
  properties: {
    attachmentId: { type: "string", pattern: idPattern },
    purpose: {
      enum: ["intake_source", "completion_evidence"],
    },
    fileName: { type: "string", minLength: 1, maxLength: 255 },
    mediaType: {
      type: "string",
      pattern:
        "^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$",
    },
    byteSize: { type: "integer", minimum: 0 },
    sha256: { type: "string", pattern: "^[a-fA-F0-9]{64}$" },
    uploadedAt: { type: "string", pattern: offsetTimestampPattern },
    uploadedBy: {
      type: "object",
      additionalProperties: false,
      required: ["actorRef", "role"],
      properties: {
        actorRef: { type: "string", pattern: idPattern },
        role: { enum: ["parent", "student"] },
      },
    },
    availability: {
      enum: [
        "available",
        "missing",
        "unreadable",
        "unsupported",
        "quarantined",
      ],
    },
    pageCount: { type: "integer", minimum: 1 },
  },
} as const satisfies JsonSchema;

export const externalDueJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manuel.academy/schemas/external-capture/external-due.v1.json",
  title: "External assignment due value",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "localDate", "timeZone"],
      properties: {
        kind: { const: "date" },
        localDate: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        timeZone: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "localDate", "localTime", "timeZone"],
      properties: {
        kind: { const: "local_date_time" },
        localDate: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        localTime: {
          type: "string",
          pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?$",
        },
        timeZone: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "dueAt", "timeZone"],
      properties: {
        kind: { const: "instant" },
        dueAt: { type: "string", pattern: offsetTimestampPattern },
        timeZone: { type: "string", minLength: 1 },
      },
    },
  ],
} as const satisfies JsonSchema;

const sourceEvidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["method", "sourceLabel"],
  properties: {
    attachmentId: { type: "string", pattern: idPattern },
    method: {
      enum: [
        "manual_entry",
        "ocr",
        "embedded_document_text",
        "authorized_provider_payload",
      ],
    },
    sourceLabel: { type: "string", minLength: 1, maxLength: 160 },
    excerpt: { type: "string", minLength: 1, maxLength: 500 },
    region: {
      type: "object",
      additionalProperties: false,
      properties: {
        page: { type: "integer", minimum: 1 },
        x: { type: "number", minimum: 0 },
        y: { type: "number", minimum: 0 },
        width: { type: "number", exclusiveMinimum: 0 },
        height: { type: "number", exclusiveMinimum: 0 },
      },
    },
  },
} as const;

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "confidence", "evidence", "warnings"],
  properties: {
    status: { enum: ["proposed", "missing", "unreadable"] },
    value: {},
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: sourceEvidenceSchema },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

const providerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "providerId",
    "displayName",
    "connectionMode",
    "synchronizationAvailable",
    "provisional",
    "privacyNotice",
  ],
  properties: {
    providerId: { type: "string", pattern: idPattern },
    displayName: { type: "string", minLength: 1, maxLength: 160 },
    connectionMode: { enum: ["manual_only", "authorized_adapter"] },
    synchronizationAvailable: { type: "boolean" },
    provisional: { type: "boolean" },
    privacyNotice: { type: "string", minLength: 1, maxLength: 1_000 },
  },
} as const;

export const assignmentExtractionResultJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manuel.academy/schemas/external-capture/extraction-result.v1.json",
  title: "External assignment extraction result",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "extractionId",
    "captureId",
    "learnerRef",
    "provider",
    "sourceKind",
    "status",
    "fields",
    "attachments",
    "overallConfidence",
    "warnings",
    "fallback",
    "requiresFieldByFieldConfirmation",
    "extractedAt",
  ],
  properties: {
    schemaVersion: { const: "external-assignment-capture.v1" },
    extractionId: { type: "string", pattern: idPattern },
    captureId: { type: "string", pattern: idPattern },
    learnerRef: { type: "string", pattern: idPattern },
    provider: providerSchema,
    sourceKind: {
      enum: ["manual", "document", "authorized_provider_payload"],
    },
    status: {
      enum: [
        "proposal_ready",
        "partial_proposal",
        "manual_entry_required",
      ],
    },
    fields: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "course",
        "section",
        "originalAssignmentReference",
        "due",
        "instructions",
        "rubric",
        "estimatedDurationMinutes",
        "sourceUrl",
      ],
      properties: {
        title: proposalSchema,
        course: proposalSchema,
        section: proposalSchema,
        originalAssignmentReference: proposalSchema,
        due: proposalSchema,
        instructions: proposalSchema,
        rubric: proposalSchema,
        estimatedDurationMinutes: proposalSchema,
        sourceUrl: proposalSchema,
      },
    },
    attachments: {
      type: "array",
      items: { $ref: attachmentMetadataJsonSchema.$id },
    },
    overallConfidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: { type: "array", items: { type: "string" } },
    fallback: {
      type: "object",
      additionalProperties: false,
      required: ["required", "message", "nextStep"],
      properties: {
        required: { type: "boolean" },
        reason: {
          enum: [
            "missing_file",
            "unreadable_image",
            "unsupported_media",
            "extractor_unavailable",
            "no_assignment_fields_found",
          ],
        },
        message: { type: "string", minLength: 1 },
        nextStep: { enum: ["review_and_confirm", "manual_entry"] },
      },
    },
    requiresFieldByFieldConfirmation: { const: true },
    extractedAt: { type: "string", pattern: offsetTimestampPattern },
  },
} as const satisfies JsonSchema;

export const courseSectionMappingJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manuel.academy/schemas/external-capture/course-section-mapping.v1.json",
  title: "Confirmed external course and section mapping",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "mappingId",
    "learnerRef",
    "providerId",
    "externalCourse",
    "target",
    "status",
    "confirmedByParentRef",
    "confirmedAt",
    "revision",
  ],
  properties: {
    schemaVersion: { const: "external-assignment-capture.v1" },
    mappingId: { type: "string", pattern: idPattern },
    learnerRef: { type: "string", pattern: idPattern },
    providerId: { type: "string", pattern: idPattern },
    externalCourse: { type: "object" },
    externalSection: { type: "object" },
    target: { type: "object" },
    status: { const: "confirmed" },
    confirmedByParentRef: { type: "string", pattern: idPattern },
    confirmedAt: { type: "string", pattern: offsetTimestampPattern },
    revision: { type: "integer", minimum: 0 },
  },
} as const satisfies JsonSchema;

export const externalAssignmentRecordJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://manuel.academy/schemas/external-capture/assignment-record.v1.json",
  title: "Confirmed external assignment record",
  type: "object",
  required: [
    "schemaVersion",
    "assignmentId",
    "captureId",
    "learnerRef",
    "provider",
    "originalAssignmentReference",
    "title",
    "externalCourse",
    "intakeAttachments",
    "confirmation",
    "evidenceRequirement",
    "evidence",
    "lifecycle",
    "providerSync",
    "revision",
    "updatedAt",
  ],
  properties: {
    schemaVersion: { const: "external-assignment-capture.v1" },
    assignmentId: { type: "string", pattern: idPattern },
    captureId: { type: "string", pattern: idPattern },
    learnerRef: { type: "string", pattern: idPattern },
    provider: providerSchema,
    originalAssignmentReference: {
      type: "string",
      pattern: idPattern,
    },
    title: { type: "string", minLength: 1, maxLength: 500 },
    externalCourse: { type: "object" },
    externalSection: { type: "object" },
    due: { $ref: externalDueJsonSchema.$id },
    instructions: { type: "object" },
    rubric: { type: "object" },
    estimatedDurationMinutes: {
      type: "number",
      exclusiveMinimum: 0,
      maximum: 1_440,
    },
    sourceUrl: { type: "string", format: "uri", pattern: "^https://" },
    intakeAttachments: {
      type: "array",
      items: { $ref: attachmentMetadataJsonSchema.$id },
    },
    confirmation: { type: "object" },
    courseMapping: { type: "object" },
    schedule: { type: "object" },
    evidenceRequirement: { type: "object" },
    evidence: { type: "array", items: { type: "object" } },
    lifecycle: {
      enum: [
        "confirmed",
        "scheduled",
        "evidence_pending",
        "evidence_returned",
        "approved",
        "completed",
      ],
    },
    providerSync: { type: "object" },
    revision: { type: "integer", minimum: 0 },
    updatedAt: { type: "string", pattern: offsetTimestampPattern },
    completedAt: { type: "string", pattern: offsetTimestampPattern },
  },
} as const satisfies JsonSchema;

export type ExternalCaptureSchemaId =
  | "attachment-metadata"
  | "assignment-extraction-result"
  | "course-section-mapping"
  | "external-assignment-record";

export interface ExternalCaptureSchema<T> {
  readonly schemaId: ExternalCaptureSchemaId;
  readonly jsonSchema: JsonSchema;
  validate(value: unknown): ValidationResult<T>;
}

export const EXTERNAL_CAPTURE_SCHEMA_REGISTRY: readonly ExternalCaptureSchema<
  AttachmentMetadata | AssignmentExtractionResult | CourseSectionMapping | ExternalAssignmentRecord
>[] = [
  {
    schemaId: "attachment-metadata",
    jsonSchema: attachmentMetadataJsonSchema,
    validate: validateAttachmentMetadata,
  },
  {
    schemaId: "assignment-extraction-result",
    jsonSchema: assignmentExtractionResultJsonSchema,
    validate: validateExtractionResult,
  },
  {
    schemaId: "course-section-mapping",
    jsonSchema: courseSectionMappingJsonSchema,
    validate: validateCourseSectionMapping,
  },
  {
    schemaId: "external-assignment-record",
    jsonSchema: externalAssignmentRecordJsonSchema,
    validate: validateExternalAssignmentRecord,
  },
];

export function getExternalCaptureSchema(
  schemaId: ExternalCaptureSchemaId,
): ExternalCaptureSchema<unknown> {
  const schema = EXTERNAL_CAPTURE_SCHEMA_REGISTRY.find(
    (entry) => entry.schemaId === schemaId,
  );
  if (!schema) {
    throw new Error(`Unknown external capture schema: ${schemaId}`);
  }
  return schema as ExternalCaptureSchema<unknown>;
}

export function validateExternalCaptureSchema(
  schemaId: ExternalCaptureSchemaId,
  value: unknown,
): ValidationResult<unknown> {
  return getExternalCaptureSchema(schemaId).validate(value);
}
