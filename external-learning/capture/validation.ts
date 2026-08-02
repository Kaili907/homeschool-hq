import {
  EXTERNAL_ASSIGNMENT_FIELDS,
  EXTERNAL_CAPTURE_SCHEMA_VERSION,
  ExternalCaptureError,
  type AssignmentExtractionResult,
  type AssignmentFieldValueMap,
  type AttachmentMetadata,
  type CourseSectionMapping,
  type ExternalAssignmentField,
  type ExternalAssignmentRecord,
  type ExternalCaptureActor,
  type ExternalDue,
  type ExternalProviderDescriptor,
  type ExtractionSourceEvidence,
  type RichTextCapture,
  type RubricCapture,
} from "./types.js";

const OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const OPAQUE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,255}$/;
const SHA_256 = /^[a-fA-F0-9]{64}$/;
const MEDIA_TYPE =
  /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;
const CREDENTIAL_KEY =
  /(?:password|passcode|credential|login|username|access.?token|refresh.?token|session.?cookie|api.?key|secret)/i;
const CREDENTIAL_VALUE =
  /\b(?:school\s+)?(?:password|passcode|access[\s_-]?token|refresh[\s_-]?token|session[\s_-]?cookie|api[\s_-]?key|secret)\s*(?::|=|\bis\b)\s*\S+/i;
const CREDENTIAL_QUERY =
  /^(?:token|auth|authorization|key|api_key|password|passcode|credential|secret)$/i;

export interface ValidationIssue {
  readonly path: string;
  readonly code:
    | "type"
    | "required"
    | "format"
    | "range"
    | "enum"
    | "credential_material"
    | "invariant"
    | "unexpected";
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  issues: ValidationIssue[],
  path: string,
  code: ValidationIssue["code"],
  message: string,
): void {
  issues.push({ path, code, message });
}

export function normalizeVisibleText(
  value: string,
  field: string,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must be text.`,
      field,
    );
  }
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must contain 1-${maximum} visible characters.`,
      field,
    );
  }
  if (CREDENTIAL_VALUE.test(normalized)) {
    throw new ExternalCaptureError(
      "credential_material",
      `${field} appears to contain credential material and cannot be stored.`,
      field,
    );
  }
  return normalized;
}

export function assertOpaqueReference(value: string, field: string): void {
  if (typeof value !== "string" || !OPAQUE_REFERENCE.test(value)) {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must be an opaque 1-256 character reference.`,
      field,
    );
  }
}

export function assertOffsetTimestamp(value: string, field: string): void {
  if (
    typeof value !== "string" ||
    !OFFSET_TIMESTAMP.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must be a valid ISO 8601 timestamp with Z or a numeric offset.`,
      field,
    );
  }
}

export function assertCalendarDate(value: string, field: string): void {
  if (typeof value !== "string" || !CALENDAR_DATE.test(value)) {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must use YYYY-MM-DD.`,
      field,
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} is not a real calendar date.`,
      field,
    );
  }
}

export function assertLocalTime(value: string, field: string): void {
  if (typeof value !== "string" || !LOCAL_TIME.test(value)) {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must use 24-hour HH:mm or HH:mm:ss.`,
      field,
    );
  }
}

export function assertIanaTimeZone(value: string, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must be an IANA time-zone name.`,
      field,
    );
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
  } catch {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must be a supported IANA time-zone name.`,
      field,
    );
  }
}

export function normalizeHttpsUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must be a valid HTTPS URL.`,
      field,
    );
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw new ExternalCaptureError(
      "invalid_input",
      `${field} must be HTTPS and cannot contain embedded credentials.`,
      field,
    );
  }
  for (const key of parsed.searchParams.keys()) {
    if (CREDENTIAL_QUERY.test(key)) {
      throw new ExternalCaptureError(
        "credential_material",
        `${field} cannot contain credential-bearing query parameters.`,
        field,
      );
    }
  }
  return parsed.toString();
}

/**
 * Rejects credential-shaped fields at every nesting level, cycle-safe. Text
 * such as `Password: value` is also rejected so OCR/manual payloads cannot
 * accidentally persist school access material.
 */
export function assertCredentialFree(value: unknown): void {
  const seen = new Set<object>();
  const visit = (candidate: unknown, path: string): void => {
    if (typeof candidate === "string") {
      if (CREDENTIAL_VALUE.test(candidate)) {
        throw new ExternalCaptureError(
          "credential_material",
          "External capture payloads must not contain school passwords, tokens, or secrets.",
          path,
        );
      }
      return;
    }
    if (candidate === null || typeof candidate !== "object") return;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      candidate.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    for (const [key, nested] of Object.entries(candidate)) {
      if (
        key === "__proto__" ||
        key === "prototype" ||
        key === "constructor" ||
        CREDENTIAL_KEY.test(key)
      ) {
        throw new ExternalCaptureError(
          "credential_material",
          "External capture payloads must not contain credential fields.",
          path ? `${path}.${key}` : key,
        );
      }
      visit(nested, path ? `${path}.${key}` : key);
    }
  };
  visit(value, "$");
}

export function stripCredentialLines(text: string): {
  readonly text: string;
  readonly removedLineCount: number;
} {
  let removedLineCount = 0;
  const kept = text.split(/\r?\n/).filter((line) => {
    if (
      CREDENTIAL_VALUE.test(line) ||
      /^\s*(?:school\s+)?(?:username|login|user\s*id)\s*(?::|=|\bis\b)/i.test(
        line,
      )
    ) {
      removedLineCount += 1;
      return false;
    }
    return true;
  });
  return { text: kept.join("\n"), removedLineCount };
}

export function validateDueValue(
  value: unknown,
  path = "$.due",
): ValidationResult<ExternalDue> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{ path, code: "type", message: "Due value must be an object." }],
    };
  }
  try {
    if (
      value.kind !== "date" &&
      value.kind !== "local_date_time" &&
      value.kind !== "instant"
    ) {
      issue(issues, `${path}.kind`, "enum", "Unsupported due-date kind.");
    } else {
      assertIanaTimeZone(value.timeZone as string, `${path}.timeZone`);
      if (value.kind === "instant") {
        assertOffsetTimestamp(value.dueAt as string, `${path}.dueAt`);
      } else {
        assertCalendarDate(value.localDate as string, `${path}.localDate`);
        if (value.kind === "local_date_time") {
          assertLocalTime(value.localTime as string, `${path}.localTime`);
        }
      }
    }
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? path,
      "format",
      captureError.message,
    );
  }
  return issues.length === 0
    ? { ok: true, value: value as unknown as ExternalDue }
    : { ok: false, issues };
}

function validateProvider(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, "type", "Provider must be an object.");
    return;
  }
  try {
    assertOpaqueReference(value.providerId as string, `${path}.providerId`);
    normalizeVisibleText(
      value.displayName as string,
      `${path}.displayName`,
      160,
    );
    normalizeVisibleText(
      value.privacyNotice as string,
      `${path}.privacyNotice`,
      1_000,
    );
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? path,
      captureError.code === "credential_material"
        ? "credential_material"
        : "format",
      captureError.message,
    );
  }
  if (
    value.connectionMode !== "manual_only" &&
    value.connectionMode !== "authorized_adapter"
  ) {
    issue(
      issues,
      `${path}.connectionMode`,
      "enum",
      "Unsupported connection mode.",
    );
  }
  if (typeof value.synchronizationAvailable !== "boolean") {
    issue(
      issues,
      `${path}.synchronizationAvailable`,
      "type",
      "synchronizationAvailable must be boolean.",
    );
  }
  if (typeof value.provisional !== "boolean") {
    issue(
      issues,
      `${path}.provisional`,
      "type",
      "provisional must be boolean.",
    );
  }
  if (
    value.connectionMode === "manual_only" &&
    value.synchronizationAvailable === true
  ) {
    issue(
      issues,
      path,
      "invariant",
      "A manual-only provider cannot claim synchronization.",
    );
  }
}

function validateActor(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, "type", "Actor must be an object.");
    return;
  }
  try {
    assertOpaqueReference(value.actorRef as string, `${path}.actorRef`);
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(issues, captureError.path ?? path, "format", captureError.message);
  }
  if (
    value.role !== "parent" &&
    value.role !== "student" &&
    value.role !== "provider_adapter" &&
    value.role !== "system"
  ) {
    issue(issues, `${path}.role`, "enum", "Unsupported actor role.");
  }
  if (!Array.isArray(value.learnerRefs)) {
    issue(
      issues,
      `${path}.learnerRefs`,
      "type",
      "learnerRefs must be an array.",
    );
  }
}

export function validateAttachmentMetadata(
  value: unknown,
): ValidationResult<AttachmentMetadata> {
  const issues: ValidationIssue[] = [];
  try {
    assertCredentialFree(value);
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? "$",
      "credential_material",
      captureError.message,
    );
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [
        ...issues,
        { path: "$", code: "type", message: "Attachment must be an object." },
      ],
    };
  }
  try {
    assertOpaqueReference(
      value.attachmentId as string,
      "$.attachmentId",
    );
    normalizeVisibleText(value.fileName as string, "$.fileName", 255);
    assertOffsetTimestamp(value.uploadedAt as string, "$.uploadedAt");
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? "$",
      captureError.code === "credential_material"
        ? "credential_material"
        : "format",
      captureError.message,
    );
  }
  if (
    value.purpose !== "intake_source" &&
    value.purpose !== "completion_evidence"
  ) {
    issue(issues, "$.purpose", "enum", "Unsupported attachment purpose.");
  }
  if (typeof value.mediaType !== "string" || !MEDIA_TYPE.test(value.mediaType)) {
    issue(issues, "$.mediaType", "format", "Invalid media type.");
  }
  if (
    typeof value.byteSize !== "number" ||
    !Number.isSafeInteger(value.byteSize) ||
    value.byteSize < 0
  ) {
    issue(
      issues,
      "$.byteSize",
      "range",
      "byteSize must be a non-negative safe integer.",
    );
  }
  if (typeof value.sha256 !== "string" || !SHA_256.test(value.sha256)) {
    issue(
      issues,
      "$.sha256",
      "format",
      "sha256 must contain 64 hexadecimal characters.",
    );
  }
  if (
    value.availability !== "available" &&
    value.availability !== "missing" &&
    value.availability !== "unreadable" &&
    value.availability !== "unsupported" &&
    value.availability !== "quarantined"
  ) {
    issue(
      issues,
      "$.availability",
      "enum",
      "Unsupported attachment availability.",
    );
  }
  if (
    value.pageCount !== undefined &&
    (typeof value.pageCount !== "number" ||
      !Number.isInteger(value.pageCount) ||
      value.pageCount < 1)
  ) {
    issue(
      issues,
      "$.pageCount",
      "range",
      "pageCount must be a positive integer.",
    );
  }
  if (!isRecord(value.uploadedBy)) {
    issue(issues, "$.uploadedBy", "type", "uploadedBy must be an object.");
  } else {
    try {
      assertOpaqueReference(
        value.uploadedBy.actorRef as string,
        "$.uploadedBy.actorRef",
      );
    } catch (error) {
      const captureError = error as ExternalCaptureError;
      issue(
        issues,
        captureError.path ?? "$.uploadedBy",
        "format",
        captureError.message,
      );
    }
    if (
      value.uploadedBy.role !== "parent" &&
      value.uploadedBy.role !== "student"
    ) {
      issue(
        issues,
        "$.uploadedBy.role",
        "enum",
        "Only a parent or student may upload an attachment.",
      );
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as unknown as AttachmentMetadata }
    : { ok: false, issues };
}

function validateEvidence(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, "type", "Evidence must be an object.");
    return;
  }
  if (
    value.method !== "manual_entry" &&
    value.method !== "ocr" &&
    value.method !== "embedded_document_text" &&
    value.method !== "authorized_provider_payload"
  ) {
    issue(issues, `${path}.method`, "enum", "Unsupported extraction method.");
  }
  try {
    normalizeVisibleText(
      value.sourceLabel as string,
      `${path}.sourceLabel`,
      160,
    );
    if (value.excerpt !== undefined) {
      normalizeVisibleText(
        value.excerpt as string,
        `${path}.excerpt`,
        500,
      );
    }
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? path,
      captureError.code === "credential_material"
        ? "credential_material"
        : "format",
      captureError.message,
    );
  }
}

function validateCourse(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, "type", "Course must be an object.");
    return;
  }
  try {
    normalizeVisibleText(
      value.displayName as string,
      `${path}.displayName`,
      160,
    );
    if (value.externalCourseRef !== undefined) {
      assertOpaqueReference(
        value.externalCourseRef as string,
        `${path}.externalCourseRef`,
      );
    }
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(issues, captureError.path ?? path, "format", captureError.message);
  }
}

function validateSection(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, "type", "Section must be an object.");
    return;
  }
  try {
    normalizeVisibleText(
      value.displayName as string,
      `${path}.displayName`,
      160,
    );
    if (value.externalSectionRef !== undefined) {
      assertOpaqueReference(
        value.externalSectionRef as string,
        `${path}.externalSectionRef`,
      );
    }
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(issues, captureError.path ?? path, "format", captureError.message);
  }
}

function validateRichText(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, "type", "Rich text must be an object.");
    return;
  }
  if (value.format !== "plain_text" && value.format !== "markdown") {
    issue(issues, `${path}.format`, "enum", "Unsupported text format.");
  }
  try {
    normalizeVisibleText(value.text as string, `${path}.text`, 50_000);
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? path,
      captureError.code === "credential_material"
        ? "credential_material"
        : "format",
      captureError.message,
    );
  }
}

function validateRubric(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, "type", "Rubric must be an object.");
    return;
  }
  if (!Array.isArray(value.criteria)) {
    issue(issues, `${path}.criteria`, "type", "criteria must be an array.");
  }
  if (
    value.pointsPossible !== undefined &&
    (typeof value.pointsPossible !== "number" ||
      !Number.isFinite(value.pointsPossible) ||
      value.pointsPossible < 0)
  ) {
    issue(
      issues,
      `${path}.pointsPossible`,
      "range",
      "pointsPossible must be non-negative.",
    );
  }
  try {
    if (value.title !== undefined) {
      normalizeVisibleText(value.title as string, `${path}.title`, 240);
    }
    if (value.rawText !== undefined) {
      normalizeVisibleText(value.rawText as string, `${path}.rawText`, 50_000);
    }
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? path,
      captureError.code === "credential_material"
        ? "credential_material"
        : "format",
      captureError.message,
    );
  }
}

export function validateAssignmentFieldValue<Field extends ExternalAssignmentField>(
  field: Field,
  value: unknown,
  path = `$.fields.${field}.value`,
): ValidationResult<AssignmentFieldValueMap[Field]> {
  const issues: ValidationIssue[] = [];
  try {
    assertCredentialFree(value);
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? path,
      "credential_material",
      captureError.message,
    );
  }

  switch (field) {
    case "title":
      try {
        normalizeVisibleText(value as string, path, 500);
      } catch (error) {
        const captureError = error as ExternalCaptureError;
        issue(issues, captureError.path ?? path, "format", captureError.message);
      }
      break;
    case "course":
      validateCourse(value, path, issues);
      break;
    case "section":
      if (value !== null) validateSection(value, path, issues);
      break;
    case "originalAssignmentReference":
      try {
        assertOpaqueReference(value as string, path);
      } catch (error) {
        const captureError = error as ExternalCaptureError;
        issue(issues, captureError.path ?? path, "format", captureError.message);
      }
      break;
    case "due":
      if (value !== null) {
        const result = validateDueValue(value, path);
        if (!result.ok) issues.push(...result.issues);
      }
      break;
    case "instructions":
      if (value !== null) validateRichText(value, path, issues);
      break;
    case "rubric":
      if (value !== null) validateRubric(value, path, issues);
      break;
    case "estimatedDurationMinutes":
      if (
        value !== null &&
        (typeof value !== "number" ||
          !Number.isFinite(value) ||
          value <= 0 ||
          value > 24 * 60)
      ) {
        issue(
          issues,
          path,
          "range",
          "Estimated duration must be from 0 to 1,440 minutes.",
        );
      }
      break;
    case "sourceUrl":
      if (value !== null) {
        try {
          normalizeHttpsUrl(value as string, path);
        } catch (error) {
          const captureError = error as ExternalCaptureError;
          issue(
            issues,
            captureError.path ?? path,
            captureError.code === "credential_material"
              ? "credential_material"
              : "format",
            captureError.message,
          );
        }
      }
      break;
  }

  return issues.length === 0
    ? {
        ok: true,
        value: value as AssignmentFieldValueMap[Field],
      }
    : { ok: false, issues };
}

export function validateExtractionResult(
  value: unknown,
): ValidationResult<AssignmentExtractionResult> {
  const issues: ValidationIssue[] = [];
  try {
    assertCredentialFree(value);
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? "$",
      "credential_material",
      captureError.message,
    );
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [
        ...issues,
        {
          path: "$",
          code: "type",
          message: "Extraction result must be an object.",
        },
      ],
    };
  }
  if (value.schemaVersion !== EXTERNAL_CAPTURE_SCHEMA_VERSION) {
    issue(
      issues,
      "$.schemaVersion",
      "enum",
      "Unsupported capture schema version.",
    );
  }
  try {
    assertOpaqueReference(value.extractionId as string, "$.extractionId");
    assertOpaqueReference(value.captureId as string, "$.captureId");
    assertOpaqueReference(value.learnerRef as string, "$.learnerRef");
    assertOffsetTimestamp(value.extractedAt as string, "$.extractedAt");
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(issues, captureError.path ?? "$", "format", captureError.message);
  }
  validateProvider(value.provider, "$.provider", issues);
  if (
    value.sourceKind !== "manual" &&
    value.sourceKind !== "document" &&
    value.sourceKind !== "authorized_provider_payload"
  ) {
    issue(issues, "$.sourceKind", "enum", "Unsupported extraction source.");
  }
  if (
    value.status !== "proposal_ready" &&
    value.status !== "partial_proposal" &&
    value.status !== "manual_entry_required"
  ) {
    issue(issues, "$.status", "enum", "Unsupported extraction status.");
  }
  if (
    typeof value.overallConfidence !== "number" ||
    !Number.isFinite(value.overallConfidence) ||
    value.overallConfidence < 0 ||
    value.overallConfidence > 1
  ) {
    issue(
      issues,
      "$.overallConfidence",
      "range",
      "overallConfidence must be from 0 through 1.",
    );
  }
  if (value.requiresFieldByFieldConfirmation !== true) {
    issue(
      issues,
      "$.requiresFieldByFieldConfirmation",
      "invariant",
      "Every extraction result must require field-by-field confirmation.",
    );
  }
  if (!Array.isArray(value.attachments)) {
    issue(
      issues,
      "$.attachments",
      "type",
      "attachments must be an array.",
    );
  } else {
    value.attachments.forEach((attachment, index) => {
      const result = validateAttachmentMetadata(attachment);
      if (!result.ok) {
        result.issues.forEach((entry) =>
          issue(
            issues,
            `$.attachments[${index}]${entry.path.slice(1)}`,
            entry.code,
            entry.message,
          ),
        );
      }
    });
  }
  if (!isRecord(value.fields)) {
    issue(issues, "$.fields", "type", "fields must be an object.");
  } else {
    for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
      const proposal = value.fields[field];
      const proposalPath = `$.fields.${field}`;
      if (!isRecord(proposal)) {
        issue(
          issues,
          proposalPath,
          "required",
          "Every assignment field must have a proposal record.",
        );
        continue;
      }
      if (
        proposal.status !== "proposed" &&
        proposal.status !== "missing" &&
        proposal.status !== "unreadable"
      ) {
        issue(
          issues,
          `${proposalPath}.status`,
          "enum",
          "Unsupported proposal status.",
        );
      }
      if (
        typeof proposal.confidence !== "number" ||
        !Number.isFinite(proposal.confidence) ||
        proposal.confidence < 0 ||
        proposal.confidence > 1
      ) {
        issue(
          issues,
          `${proposalPath}.confidence`,
          "range",
          "Field confidence must be from 0 through 1.",
        );
      }
      if (!Array.isArray(proposal.evidence)) {
        issue(
          issues,
          `${proposalPath}.evidence`,
          "type",
          "Field evidence must be an array.",
        );
      } else {
        if (proposal.status === "proposed" && proposal.evidence.length === 0) {
          issue(
            issues,
            `${proposalPath}.evidence`,
            "required",
            "Every proposed field must include source evidence.",
          );
        }
        proposal.evidence.forEach((entry, index) =>
          validateEvidence(
            entry,
            `${proposalPath}.evidence[${index}]`,
            issues,
          ),
        );
      }
      if (!Array.isArray(proposal.warnings)) {
        issue(
          issues,
          `${proposalPath}.warnings`,
          "type",
          "Field warnings must be an array.",
        );
      }
      if (proposal.status === "proposed") {
        if (!Object.prototype.hasOwnProperty.call(proposal, "value")) {
          issue(
            issues,
            `${proposalPath}.value`,
            "required",
            "A proposed field must include a value.",
          );
        } else {
          const result = validateAssignmentFieldValue(
            field,
            proposal.value,
            `${proposalPath}.value`,
          );
          if (!result.ok) issues.push(...result.issues);
        }
      }
    }
  }
  return issues.length === 0
    ? { ok: true, value: value as unknown as AssignmentExtractionResult }
    : { ok: false, issues };
}

export function validateCourseSectionMapping(
  value: unknown,
): ValidationResult<CourseSectionMapping> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [
        { path: "$", code: "type", message: "Mapping must be an object." },
      ],
    };
  }
  try {
    assertCredentialFree(value);
    assertOpaqueReference(value.mappingId as string, "$.mappingId");
    assertOpaqueReference(value.learnerRef as string, "$.learnerRef");
    assertOpaqueReference(value.providerId as string, "$.providerId");
    assertOpaqueReference(
      value.confirmedByParentRef as string,
      "$.confirmedByParentRef",
    );
    assertOffsetTimestamp(value.confirmedAt as string, "$.confirmedAt");
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? "$",
      captureError.code === "credential_material"
        ? "credential_material"
        : "format",
      captureError.message,
    );
  }
  validateCourse(value.externalCourse, "$.externalCourse", issues);
  if (value.externalSection !== undefined) {
    validateSection(value.externalSection, "$.externalSection", issues);
  }
  if (!isRecord(value.target)) {
    issue(issues, "$.target", "type", "Mapping target must be an object.");
  } else {
    try {
      assertOpaqueReference(value.target.courseRef as string, "$.target.courseRef");
      if (value.target.sectionRef !== undefined) {
        assertOpaqueReference(
          value.target.sectionRef as string,
          "$.target.sectionRef",
        );
      }
      normalizeVisibleText(
        value.target.displayName as string,
        "$.target.displayName",
        160,
      );
    } catch (error) {
      const captureError = error as ExternalCaptureError;
      issue(issues, captureError.path ?? "$.target", "format", captureError.message);
    }
  }
  if (
    typeof value.revision !== "number" ||
    !Number.isInteger(value.revision) ||
    value.revision < 0
  ) {
    issue(
      issues,
      "$.revision",
      "range",
      "Mapping revision must be a non-negative integer.",
    );
  }
  return issues.length === 0
    ? { ok: true, value: value as unknown as CourseSectionMapping }
    : { ok: false, issues };
}

/**
 * Record validation focuses on security- and workflow-critical invariants. The
 * confirmation/lifecycle constructors are the canonical way to create records.
 */
export function validateExternalAssignmentRecord(
  value: unknown,
): ValidationResult<ExternalAssignmentRecord> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [
        {
          path: "$",
          code: "type",
          message: "Assignment record must be an object.",
        },
      ],
    };
  }
  try {
    assertCredentialFree(value);
    assertOpaqueReference(value.assignmentId as string, "$.assignmentId");
    assertOpaqueReference(value.captureId as string, "$.captureId");
    assertOpaqueReference(value.learnerRef as string, "$.learnerRef");
    assertOpaqueReference(
      value.originalAssignmentReference as string,
      "$.originalAssignmentReference",
    );
    normalizeVisibleText(value.title as string, "$.title", 500);
    assertOffsetTimestamp(value.updatedAt as string, "$.updatedAt");
  } catch (error) {
    const captureError = error as ExternalCaptureError;
    issue(
      issues,
      captureError.path ?? "$",
      captureError.code === "credential_material"
        ? "credential_material"
        : "format",
      captureError.message,
    );
  }
  if (value.schemaVersion !== EXTERNAL_CAPTURE_SCHEMA_VERSION) {
    issue(
      issues,
      "$.schemaVersion",
      "enum",
      "Unsupported capture schema version.",
    );
  }
  validateProvider(value.provider, "$.provider", issues);
  validateCourse(value.externalCourse, "$.externalCourse", issues);
  if (value.externalSection !== undefined) {
    validateSection(value.externalSection, "$.externalSection", issues);
  }
  if (value.due !== undefined) {
    const due = validateDueValue(value.due, "$.due");
    if (!due.ok) issues.push(...due.issues);
  }
  if (!isRecord(value.confirmation)) {
    issue(
      issues,
      "$.confirmation",
      "required",
      "Assignment must contain confirmation audit data.",
    );
  } else {
    if (value.confirmation.allFieldsReviewed !== true) {
      issue(
        issues,
        "$.confirmation.allFieldsReviewed",
        "invariant",
        "All extracted fields must be reviewed before persistence.",
      );
    }
    if (!isRecord(value.confirmation.fields)) {
      issue(
        issues,
        "$.confirmation.fields",
        "type",
        "Confirmation fields must be an object.",
      );
    } else {
      for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
        if (!isRecord(value.confirmation.fields[field])) {
          issue(
            issues,
            `$.confirmation.fields.${field}`,
            "required",
            "Every extracted field needs a confirmation audit.",
          );
        }
      }
    }
  }
  if (!Array.isArray(value.intakeAttachments)) {
    issue(
      issues,
      "$.intakeAttachments",
      "type",
      "intakeAttachments must be an array.",
    );
  } else {
    value.intakeAttachments.forEach((attachment, index) => {
      const result = validateAttachmentMetadata(attachment);
      if (!result.ok) {
        result.issues.forEach((entry) =>
          issue(
            issues,
            `$.intakeAttachments[${index}]${entry.path.slice(1)}`,
            entry.code,
            entry.message,
          ),
        );
      }
    });
  }
  const lifecycleValues = [
    "confirmed",
    "scheduled",
    "evidence_pending",
    "evidence_returned",
    "approved",
    "completed",
  ];
  if (!lifecycleValues.includes(value.lifecycle as string)) {
    issue(issues, "$.lifecycle", "enum", "Unsupported assignment lifecycle.");
  }
  if (value.schedule === undefined) {
    if (
      value.lifecycle !== "confirmed" &&
      lifecycleValues.includes(value.lifecycle as string)
    ) {
      issue(
        issues,
        "$.schedule",
        "required",
        "A non-confirmed lifecycle requires a real host calendar link.",
      );
    }
  } else if (!isRecord(value.schedule)) {
    issue(issues, "$.schedule", "type", "schedule must be an object.");
  } else {
    try {
      assertOpaqueReference(
        value.schedule.calendarEntryRef as string,
        "$.schedule.calendarEntryRef",
      );
      assertOffsetTimestamp(
        value.schedule.scheduledStart as string,
        "$.schedule.scheduledStart",
      );
      assertIanaTimeZone(
        value.schedule.timeZone as string,
        "$.schedule.timeZone",
      );
      assertOffsetTimestamp(
        value.schedule.linkedAt as string,
        "$.schedule.linkedAt",
      );
    } catch (error) {
      const captureError = error as ExternalCaptureError;
      issue(
        issues,
        captureError.path ?? "$.schedule",
        "format",
        captureError.message,
      );
    }
    if (
      !isRecord(value.schedule.linkedBy) ||
      value.schedule.linkedBy.role !== "parent"
    ) {
      issue(
        issues,
        "$.schedule.linkedBy",
        "invariant",
        "A schedule link must record the parent who requested it.",
      );
    }
  }
  if (!isRecord(value.evidenceRequirement)) {
    issue(
      issues,
      "$.evidenceRequirement",
      "type",
      "evidenceRequirement must be an object.",
    );
  } else {
    const requirement = value.evidenceRequirement;
    if (
      typeof requirement.required !== "boolean" ||
      typeof requirement.noteRequired !== "boolean" ||
      typeof requirement.parentApprovalRequired !== "boolean"
    ) {
      issue(
        issues,
        "$.evidenceRequirement",
        "type",
        "Evidence requirement flags must be boolean.",
      );
    }
    if (
      typeof requirement.minimumAttachmentCount !== "number" ||
      !Number.isInteger(requirement.minimumAttachmentCount) ||
      requirement.minimumAttachmentCount < 0 ||
      (requirement.required === true &&
        requirement.minimumAttachmentCount < 1)
    ) {
      issue(
        issues,
        "$.evidenceRequirement.minimumAttachmentCount",
        "range",
        "Required evidence needs at least one attachment.",
      );
    }
    if (!Array.isArray(requirement.acceptedMediaTypes)) {
      issue(
        issues,
        "$.evidenceRequirement.acceptedMediaTypes",
        "type",
        "acceptedMediaTypes must be an array.",
      );
    }
    if (
      requirement.parentApprovalRequired === true &&
      requirement.required !== true
    ) {
      issue(
        issues,
        "$.evidenceRequirement.parentApprovalRequired",
        "invariant",
        "Parent evidence approval requires completion evidence.",
      );
    }
  }
  if (!Array.isArray(value.evidence)) {
    issue(issues, "$.evidence", "type", "evidence must be an array.");
  } else {
    value.evidence.forEach((entry, index) => {
      const path = `$.evidence[${index}]`;
      if (!isRecord(entry)) {
        issue(issues, path, "type", "Evidence entry must be an object.");
        return;
      }
      try {
        assertOpaqueReference(entry.evidenceId as string, `${path}.evidenceId`);
        assertOffsetTimestamp(entry.submittedAt as string, `${path}.submittedAt`);
      } catch (error) {
        const captureError = error as ExternalCaptureError;
        issue(
          issues,
          captureError.path ?? path,
          "format",
          captureError.message,
        );
      }
      if (entry.assignmentId !== value.assignmentId) {
        issue(
          issues,
          `${path}.assignmentId`,
          "invariant",
          "Evidence must belong to this assignment.",
        );
      }
      if (
        entry.status !== "pending_parent_approval" &&
        entry.status !== "approved" &&
        entry.status !== "returned"
      ) {
        issue(
          issues,
          `${path}.status`,
          "enum",
          "Unsupported evidence status.",
        );
      }
      if (!Array.isArray(entry.attachments)) {
        issue(
          issues,
          `${path}.attachments`,
          "type",
          "Evidence attachments must be an array.",
        );
      } else {
        entry.attachments.forEach((attachment, attachmentIndex) => {
          const result = validateAttachmentMetadata(attachment);
          if (!result.ok) {
            result.issues.forEach((attachmentIssue) =>
              issue(
                issues,
                `${path}.attachments[${attachmentIndex}]${attachmentIssue.path.slice(1)}`,
                attachmentIssue.code,
                attachmentIssue.message,
              ),
            );
          }
        });
      }
      if (entry.status === "returned") {
        if (
          !isRecord(entry.review) ||
          entry.review.decision !== "return" ||
          typeof entry.review.note !== "string" ||
          entry.review.note.trim().length === 0
        ) {
          issue(
            issues,
            `${path}.review`,
            "invariant",
            "Returned evidence requires a parent return review and note.",
          );
        }
      }
    });
  }
  if (!isRecord(value.providerSync)) {
    issue(
      issues,
      "$.providerSync",
      "type",
      "providerSync must be an object.",
    );
  } else {
    if (
      value.providerSync.mode !== "manual_only" &&
      value.providerSync.mode !== "not_configured" &&
      value.providerSync.mode !== "authorized" &&
      value.providerSync.mode !== "authorization_expired"
    ) {
      issue(
        issues,
        "$.providerSync.mode",
        "enum",
        "Unsupported provider sync mode.",
      );
    }
    if (
      value.providerSync.state !== "never" &&
      value.providerSync.state !== "manual" &&
      value.providerSync.state !== "pending" &&
      value.providerSync.state !== "current" &&
      value.providerSync.state !== "conflict" &&
      value.providerSync.state !== "error"
    ) {
      issue(
        issues,
        "$.providerSync.state",
        "enum",
        "Unsupported provider sync state.",
      );
    }
    if (
      isRecord(value.provider) &&
      value.provider.connectionMode === "manual_only" &&
      value.providerSync.mode !== "manual_only"
    ) {
      issue(
        issues,
        "$.providerSync.mode",
        "invariant",
        "A manual-only provider cannot have an authorized sync status.",
      );
    }
  }
  if (
    value.lifecycle === "completed" &&
    !completionRequirementsSatisfiedForValidation(value)
  ) {
    issue(
      issues,
      "$.lifecycle",
      "invariant",
      "A completed assignment must satisfy its evidence and approval policy.",
    );
  }
  if (value.lifecycle === "completed") {
    if (typeof value.completedAt !== "string") {
      issue(
        issues,
        "$.completedAt",
        "required",
        "A completed assignment needs completedAt.",
      );
    } else {
      try {
        assertOffsetTimestamp(value.completedAt, "$.completedAt");
      } catch (error) {
        const captureError = error as ExternalCaptureError;
        issue(
          issues,
          captureError.path ?? "$.completedAt",
          "format",
          captureError.message,
        );
      }
    }
  }
  if (
    typeof value.revision !== "number" ||
    !Number.isInteger(value.revision) ||
    value.revision < 0
  ) {
    issue(
      issues,
      "$.revision",
      "range",
      "revision must be a non-negative integer.",
    );
  }
  return issues.length === 0
    ? { ok: true, value: value as unknown as ExternalAssignmentRecord }
    : { ok: false, issues };
}

function completionRequirementsSatisfiedForValidation(
  record: Record<string, unknown>,
): boolean {
  if (!isRecord(record.evidenceRequirement)) return false;
  const requirement = record.evidenceRequirement;
  if (requirement.required !== true) return true;
  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    return false;
  }
  const submissions = record.evidence.filter(isRecord);
  const minimum =
    typeof requirement.minimumAttachmentCount === "number"
      ? requirement.minimumAttachmentCount
      : Number.POSITIVE_INFINITY;
  const accepted = Array.isArray(requirement.acceptedMediaTypes)
    ? requirement.acceptedMediaTypes.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const validEvidence = submissions.filter((entry) => {
    if (entry.status !== "approved" || !Array.isArray(entry.attachments)) {
      return false;
    }
    if (entry.attachments.length < minimum) return false;
    if (
      requirement.noteRequired === true &&
      (typeof entry.note !== "string" || entry.note.trim().length === 0)
    ) {
      return false;
    }
    return entry.attachments.every((attachment) => {
      if (
        !isRecord(attachment) ||
        attachment.purpose !== "completion_evidence" ||
        attachment.availability !== "available" ||
        typeof attachment.mediaType !== "string"
      ) {
        return false;
      }
      const attachmentMediaType = attachment.mediaType;
      return (
        accepted.length === 0 ||
        accepted.some(
          (mediaType) =>
            mediaType === attachmentMediaType ||
            (mediaType.endsWith("/*") &&
              attachmentMediaType.startsWith(mediaType.slice(0, -1))),
        )
      );
    });
  });
  if (requirement.parentApprovalRequired === true) {
    return validEvidence.some(
      (entry) =>
        isRecord(entry.review) &&
        entry.review.decision === "approve" &&
        typeof entry.review.parentRef === "string" &&
        entry.review.parentRef.length > 0,
    );
  }
  return validEvidence.length > 0;
}

export function validateActorShape(
  value: unknown,
): ValidationResult<ExternalCaptureActor> {
  const issues: ValidationIssue[] = [];
  validateActor(value, "$", issues);
  return issues.length === 0
    ? { ok: true, value: value as unknown as ExternalCaptureActor }
    : { ok: false, issues };
}

export function assertValidExtractionResult(
  value: unknown,
): asserts value is AssignmentExtractionResult {
  const result = validateExtractionResult(value);
  if (!result.ok) {
    const first = result.issues[0];
    throw new ExternalCaptureError(
      first.code === "credential_material"
        ? "credential_material"
        : "invalid_input",
      first.message,
      first.path,
    );
  }
}

export function assertValidAssignmentRecord(
  value: unknown,
): asserts value is ExternalAssignmentRecord {
  const result = validateExternalAssignmentRecord(value);
  if (!result.ok) {
    const first = result.issues[0];
    throw new ExternalCaptureError(
      first.code === "credential_material"
        ? "credential_material"
        : "invalid_input",
      first.message,
      first.path,
    );
  }
}

export function roundConfidence(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export type { ExternalProviderDescriptor, ExtractionSourceEvidence, RichTextCapture, RubricCapture };
