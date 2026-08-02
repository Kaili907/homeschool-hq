import {
  EXTERNAL_ASSIGNMENT_FIELDS,
  EXTERNAL_CAPTURE_SCHEMA_VERSION,
  ExternalCaptureError,
  type AssignmentExtractionResult,
  type AssignmentFieldProposals,
  type AssignmentFieldValueMap,
  type DocumentAssignmentIntakeInput,
  type ExternalAssignmentField,
  type ExternalDue,
  type ExtractionFallbackReason,
  type ExtractionSourceEvidence,
  type ManualAssignmentIntakeInput,
  type ProposedField,
  type RichTextCapture,
  type RubricCapture,
} from "./types.js";
import { assertExternalCapturePermission } from "./permissions.js";
import {
  assertCalendarDate,
  assertCredentialFree,
  assertIanaTimeZone,
  assertOffsetTimestamp,
  assertOpaqueReference,
  normalizeHttpsUrl,
  normalizeVisibleText,
  roundConfidence,
  stripCredentialLines,
  validateAssignmentFieldValue,
  validateAttachmentMetadata,
} from "./validation.js";

const FIELD_LABEL =
  /^(?:assignment(?:\s+title)?|title|course|class|section|assignment(?:\s+id|\s+number|\s+ref(?:erence)?)?|due(?:\s+date)?|instructions?|directions?|rubric|grading|estimated(?:\s+time|\s+duration)?|duration|link|url)\s*[:#-]/i;

function evidence(
  method: ExtractionSourceEvidence["method"],
  sourceLabel: string,
  attachmentId?: string,
  excerpt?: string,
): ExtractionSourceEvidence {
  return {
    method,
    sourceLabel,
    ...(attachmentId ? { attachmentId } : {}),
    ...(excerpt
      ? { excerpt: excerpt.trim().slice(0, 500) }
      : {}),
  };
}

function proposed<Field extends ExternalAssignmentField>(
  field: Field,
  value: NoInfer<AssignmentFieldValueMap[Field]>,
  confidence: number,
  sourceEvidence: readonly ExtractionSourceEvidence[],
  warnings: readonly string[] = [],
): ProposedField<AssignmentFieldValueMap[Field]> {
  const validation = validateAssignmentFieldValue(field, value);
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
  return {
    status: "proposed",
    value,
    confidence: roundConfidence(confidence),
    evidence: sourceEvidence,
    warnings,
  };
}

function missing<Field extends ExternalAssignmentField>(
  warning: string,
): ProposedField<AssignmentFieldValueMap[Field]> {
  return {
    status: "missing",
    confidence: 0,
    evidence: [],
    warnings: [warning],
  };
}

function unreadable<Field extends ExternalAssignmentField>(
  warning: string,
  sourceEvidence: readonly ExtractionSourceEvidence[],
): ProposedField<AssignmentFieldValueMap[Field]> {
  return {
    status: "unreadable",
    confidence: 0,
    evidence: sourceEvidence,
    warnings: [warning],
  };
}

function blankFields(
  state: "missing" | "unreadable",
  reason: string,
  sourceEvidence: readonly ExtractionSourceEvidence[] = [],
): AssignmentFieldProposals {
  const create = <Field extends ExternalAssignmentField>(
    _field: Field,
  ): ProposedField<AssignmentFieldValueMap[Field]> =>
    state === "unreadable"
      ? unreadable(reason, sourceEvidence)
      : missing(reason);
  return {
    title: create("title"),
    course: create("course"),
    section: create("section"),
    originalAssignmentReference: create("originalAssignmentReference"),
    due: create("due"),
    instructions: create("instructions"),
    rubric: create("rubric"),
    estimatedDurationMinutes: create("estimatedDurationMinutes"),
    sourceUrl: create("sourceUrl"),
  };
}

function validateBase(
  input: ManualAssignmentIntakeInput | DocumentAssignmentIntakeInput,
): void {
  if (input.schemaVersion !== EXTERNAL_CAPTURE_SCHEMA_VERSION) {
    throw new ExternalCaptureError(
      "invalid_input",
      "Unsupported external capture schema version.",
      "schemaVersion",
    );
  }
  assertOpaqueReference(input.captureId, "captureId");
  assertOpaqueReference(input.learnerRef, "learnerRef");
  assertOffsetTimestamp(input.submittedAt, "submittedAt");
  assertIanaTimeZone(input.defaultTimeZone, "defaultTimeZone");
  assertOpaqueReference(input.provider.providerId, "provider.providerId");
  normalizeVisibleText(
    input.provider.displayName,
    "provider.displayName",
    160,
  );
  normalizeVisibleText(
    input.provider.privacyNotice,
    "provider.privacyNotice",
    1_000,
  );
  if (
    input.provider.connectionMode === "manual_only" &&
    input.provider.synchronizationAvailable
  ) {
    throw new ExternalCaptureError(
      "invalid_input",
      "A manual-only provider cannot claim synchronization.",
      "provider.synchronizationAvailable",
    );
  }
  assertExternalCapturePermission(
    input.submittedBy,
    "create_intake",
    input.learnerRef,
  );
}

function calculateConfidence(fields: AssignmentFieldProposals): number {
  return roundConfidence(
    EXTERNAL_ASSIGNMENT_FIELDS.reduce(
      (total, field) => total + fields[field].confidence,
      0,
    ) / EXTERNAL_ASSIGNMENT_FIELDS.length,
  );
}

function resultStatus(
  fields: AssignmentFieldProposals,
): AssignmentExtractionResult["status"] {
  const required = [
    fields.title,
    fields.course,
    fields.originalAssignmentReference,
  ];
  const proposedCount = EXTERNAL_ASSIGNMENT_FIELDS.filter(
    (field) => fields[field].status === "proposed",
  ).length;
  if (proposedCount === 0) return "manual_entry_required";
  if (required.every((field) => field.status === "proposed")) {
    return "proposal_ready";
  }
  return "partial_proposal";
}

export function createManualExtractionProposal(
  input: ManualAssignmentIntakeInput,
): AssignmentExtractionResult {
  validateBase(input);
  if (input.submittedBy.role !== "parent") {
    throw new ExternalCaptureError(
      "permission_denied",
      "The manual-create workflow is parent-only; students may upload a source for review.",
      "submittedBy.role",
    );
  }
  assertCredentialFree(input);
  const sourceEvidence = evidence(
    "manual_entry",
    `Manual entry by ${input.submittedBy.role}`,
  );

  const make = <Field extends ExternalAssignmentField>(
    field: Field,
  ): ProposedField<AssignmentFieldValueMap[Field]> => {
    const value = input.values[field];
    return value === undefined
      ? missing(`No ${field} was entered; review and enter a value if needed.`)
      : proposed(
          field,
          value as AssignmentFieldValueMap[Field],
          1,
          [sourceEvidence],
        );
  };
  const attachments = [...(input.attachments ?? [])];
  attachments.forEach((attachment) => {
    const validation = validateAttachmentMetadata(attachment);
    if (!validation.ok) {
      const first = validation.issues[0];
      throw new ExternalCaptureError(
        first.code === "credential_material"
          ? "credential_material"
          : "invalid_input",
        first.message,
        `attachments.${first.path}`,
      );
    }
  });
  const fields: AssignmentFieldProposals = {
    title: make("title"),
    course: make("course"),
    section: make("section"),
    originalAssignmentReference: make("originalAssignmentReference"),
    due: make("due"),
    instructions: make("instructions"),
    rubric: make("rubric"),
    estimatedDurationMinutes: make("estimatedDurationMinutes"),
    sourceUrl: make("sourceUrl"),
  };
  const status = resultStatus(fields);
  return {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    extractionId: `${input.captureId}:manual`,
    captureId: input.captureId,
    learnerRef: input.learnerRef,
    provider: input.provider,
    sourceKind: "manual",
    status,
    fields,
    attachments,
    overallConfidence: calculateConfidence(fields),
    warnings:
      status === "proposal_ready"
        ? []
        : ["Required assignment details must be entered during review."],
    fallback: {
      required: status === "manual_entry_required",
      ...(status === "manual_entry_required"
        ? { reason: "no_assignment_fields_found" as const }
        : {}),
      message:
        status === "manual_entry_required"
          ? "Enter the assignment details manually."
          : "Review every field, including fields intentionally left blank.",
      nextStep:
        status === "manual_entry_required"
          ? "manual_entry"
          : "review_and_confirm",
    },
    requiresFieldByFieldConfirmation: true,
    extractedAt: input.submittedAt,
  };
}

interface FoundLine {
  readonly value: string;
  readonly line: string;
  readonly confidence: number;
}

function findLabel(
  lines: readonly string[],
  labels: readonly string[],
): FoundLine | undefined {
  const escaped = labels.map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(
    `^(?:${escaped.join("|")})\\s*[:#-]\\s*(.+)$`,
    "i",
  );
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match?.[1]?.trim()) {
      return { value: match[1].trim(), line, confidence: 0.94 };
    }
  }
  return undefined;
}

function findBlock(
  lines: readonly string[],
  labels: readonly string[],
): FoundLine | undefined {
  const escaped = labels.map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(
    `^(?:${escaped.join("|")})\\s*[:#-]\\s*(.*)$`,
    "i",
  );
  for (let index = 0; index < lines.length; index += 1) {
    const match = pattern.exec(lines[index]);
    if (!match) continue;
    const collected: string[] = [];
    if (match[1]?.trim()) collected.push(match[1].trim());
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (FIELD_LABEL.test(lines[cursor])) break;
      collected.push(lines[cursor]);
    }
    const value = collected.join("\n").trim();
    if (value.length > 0) {
      return {
        value,
        line: lines.slice(index, index + Math.max(1, collected.length)).join(
          "\n",
        ),
        confidence: match[1]?.trim() ? 0.91 : 0.82,
      };
    }
  }
  return undefined;
}

const MONTHS: Readonly<Record<string, number>> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function datePartsToIso(year: number, month: number, day: number): string | null {
  const value = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  try {
    assertCalendarDate(value, "extracted due date");
    return value;
  } catch {
    return null;
  }
}

function parseLocalDate(text: string): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) return datePartsToIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(text);
  if (numeric) {
    return datePartsToIso(
      Number(numeric[3]),
      Number(numeric[1]),
      Number(numeric[2]),
    );
  }

  const named =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b/i.exec(
      text,
    );
  if (named) {
    return datePartsToIso(
      Number(named[3]),
      MONTHS[named[1].toLowerCase()],
      Number(named[2]),
    );
  }
  return null;
}

function parseLocalTime(text: string): string | null {
  const twelveHour =
    /\b(1[0-2]|0?[1-9]):([0-5]\d)\s*(a\.?m\.?|p\.?m\.?)\b/i.exec(text);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const isPm = twelveHour[3].toLowerCase().startsWith("p");
    if (hour === 12) hour = 0;
    if (isPm) hour += 12;
    return `${hour.toString().padStart(2, "0")}:${twelveHour[2]}`;
  }
  const twentyFour = /\b([01]\d|2[0-3]):([0-5]\d)\b/.exec(text);
  return twentyFour ? `${twentyFour[1]}:${twentyFour[2]}` : null;
}

function parseDue(text: string, defaultTimeZone: string): ExternalDue | null {
  const instant =
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})\b/.exec(
      text,
    )?.[0];
  if (instant) {
    try {
      assertOffsetTimestamp(instant, "extracted due instant");
      return { kind: "instant", dueAt: instant, timeZone: defaultTimeZone };
    } catch {
      return null;
    }
  }
  const localDate = parseLocalDate(text);
  if (!localDate) return null;
  const localTime = parseLocalTime(text);
  return localTime
    ? {
        kind: "local_date_time",
        localDate,
        localTime,
        timeZone: defaultTimeZone,
      }
    : { kind: "date", localDate, timeZone: defaultTimeZone };
}

function parseDuration(text: string): number | null {
  const hours = /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i.exec(text);
  const minutes = /\b(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/i.exec(text);
  if (!hours && !minutes) return null;
  const value =
    (hours ? Number(hours[1]) * 60 : 0) +
    (minutes ? Number(minutes[1]) : 0);
  return Number.isFinite(value) && value > 0 && value <= 1_440
    ? Math.round(value * 100) / 100
    : null;
}

function normalizeExtractedReference(value: string): string | null {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9_.:@/-]+/g, "-")
    .slice(0, 256);
  try {
    assertOpaqueReference(normalized, "extracted assignment reference");
    return normalized;
  } catch {
    return null;
  }
}

function inferTitle(lines: readonly string[]): FoundLine | undefined {
  const labeled = findLabel(lines, ["assignment title", "assignment", "title"]);
  if (labeled) return labeled;
  const first = lines.find(
    (line) =>
      !FIELD_LABEL.test(line) &&
      line.length >= 3 &&
      line.length <= 200 &&
      !/^https?:\/\//i.test(line),
  );
  return first
    ? { value: first, line: first, confidence: 0.58 }
    : undefined;
}

function fieldEvidence(
  input: DocumentAssignmentIntakeInput,
  found: FoundLine,
): readonly ExtractionSourceEvidence[] {
  if (input.content.state !== "available") return [];
  return [
    evidence(
      input.content.method,
      input.attachment.fileName,
      input.attachment.attachmentId,
      found.line,
    ),
  ];
}

function extractionFailure(
  input: DocumentAssignmentIntakeInput,
  reason: ExtractionFallbackReason,
  message: string,
  unreadableState: boolean,
): AssignmentExtractionResult {
  const sourceEvidence = evidence(
    "ocr",
    input.attachment.fileName,
    input.attachment.attachmentId,
  );
  const fields = blankFields(
    unreadableState ? "unreadable" : "missing",
    message,
    unreadableState ? [sourceEvidence] : [],
  );
  return {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    extractionId: `${input.captureId}:document`,
    captureId: input.captureId,
    learnerRef: input.learnerRef,
    provider: input.provider,
    sourceKind: "document",
    status: "manual_entry_required",
    fields,
    attachments: [input.attachment],
    overallConfidence: 0,
    warnings: [message],
    fallback: {
      required: true,
      reason,
      message,
      nextStep: "manual_entry",
    },
    requiresFieldByFieldConfirmation: true,
    extractedAt: input.submittedAt,
  };
}

export function extractDocumentAssignmentProposal(
  input: DocumentAssignmentIntakeInput,
): AssignmentExtractionResult {
  validateBase(input);
  const attachmentValidation = validateAttachmentMetadata(input.attachment);
  if (!attachmentValidation.ok) {
    const first = attachmentValidation.issues[0];
    throw new ExternalCaptureError(
      first.code === "credential_material"
        ? "credential_material"
        : "invalid_input",
      first.message,
      `attachment${first.path.slice(1)}`,
    );
  }
  if (input.attachment.purpose !== "intake_source") {
    throw new ExternalCaptureError(
      "invalid_input",
      "An extraction attachment must have intake_source purpose.",
      "attachment.purpose",
    );
  }
  if (input.attachment.availability === "quarantined") {
    throw new ExternalCaptureError(
      "invalid_input",
      "A quarantined attachment cannot be read or processed. Use a cleared replacement or manual entry.",
      "attachment.availability",
    );
  }
  if (
    input.content.state === "missing" ||
    input.attachment.availability === "missing"
  ) {
    return extractionFailure(
      input,
      "missing_file",
      "The source file is missing. Re-upload it or enter assignment details manually.",
      false,
    );
  }
  if (
    input.content.state === "unreadable" ||
    input.attachment.availability === "unreadable"
  ) {
    return extractionFailure(
      input,
      "unreadable_image",
      "The image or document could not be read. Upload a clearer copy or use manual entry.",
      true,
    );
  }
  if (
    input.content.state === "unsupported" ||
    input.attachment.availability === "unsupported"
  ) {
    return extractionFailure(
      input,
      "unsupported_media",
      "This file type is not supported for extraction. Convert it or use manual entry.",
      false,
    );
  }
  if (input.content.state === "extractor_unavailable") {
    return extractionFailure(
      input,
      "extractor_unavailable",
      "Text extraction is unavailable. The assignment can still be entered manually.",
      false,
    );
  }

  if (input.content.state !== "available") {
    return extractionFailure(
      input,
      "extractor_unavailable",
      "Text extraction did not return readable content. Enter the assignment manually.",
      false,
    );
  }
  const content = input.content;
  const sanitized = stripCredentialLines(content.text);
  const lines = sanitized.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return extractionFailure(
      input,
      "no_assignment_fields_found",
      sanitized.removedLineCount > 0
        ? "Only credential-like text was detected and it was discarded. Enter assignment details manually."
        : "No readable assignment details were found. Enter them manually.",
      false,
    );
  }

  const title = inferTitle(lines);
  const course = findLabel(lines, ["course", "class"]);
  const section = findLabel(lines, ["section"]);
  const reference = findLabel(lines, [
    "assignment id",
    "assignment number",
    "assignment ref",
    "assignment reference",
  ]);
  const due = findLabel(lines, ["due", "due date"]);
  const instructions = findBlock(lines, ["instructions", "instruction", "directions", "direction"]);
  const rubric = findBlock(lines, ["rubric", "grading"]);
  const duration = findLabel(lines, [
    "estimated time",
    "estimated duration",
    "duration",
  ]);
  const urlLine =
    findLabel(lines, ["link", "url"]) ??
    (() => {
      const line = lines.find((candidate) => /https:\/\//i.test(candidate));
      const match = line ? /(https:\/\/\S+)/i.exec(line) : undefined;
      return line && match
        ? { value: match[1], line, confidence: 0.83 }
        : undefined;
    })();

  const parsedDue = due ? parseDue(due.value, input.defaultTimeZone) : null;
  const parsedDuration = duration ? parseDuration(duration.value) : null;
  const parsedReference = reference
    ? normalizeExtractedReference(reference.value)
    : null;
  let parsedUrl: string | null = null;
  let sourceUrlWarning: string | undefined;
  if (urlLine) {
    try {
      parsedUrl = normalizeHttpsUrl(urlLine.value, "extracted source URL");
    } catch (error) {
      const captureError = error as ExternalCaptureError;
      sourceUrlWarning =
        captureError.code === "credential_material"
          ? "A credential-bearing URL was discarded."
          : "The detected assignment URL was not a safe HTTPS URL.";
    }
  }

  const methodWarning =
    content.method === "ocr"
      ? ["OCR can misread text; compare this value with the source."]
      : [];

  const fields: AssignmentFieldProposals = {
    title: title
      ? proposed<"title">(
          "title",
          normalizeVisibleText(title.value, "title", 500),
          title.confidence,
          fieldEvidence(input, title),
          methodWarning,
        )
      : missing<"title">("No assignment title was detected."),
    course: course
      ? proposed<"course">(
          "course",
          {
            displayName: normalizeVisibleText(
              course.value,
              "course.displayName",
              160,
            ),
          },
          course.confidence,
          fieldEvidence(input, course),
          methodWarning,
        )
      : missing<"course">("No course name was detected."),
    section: section
      ? proposed<"section">(
          "section",
          {
            displayName: normalizeVisibleText(
              section.value,
              "section.displayName",
              160,
            ),
          },
          section.confidence,
          fieldEvidence(input, section),
          methodWarning,
        )
      : missing<"section">(
          "No section was detected; it may be left blank after review.",
        ),
    originalAssignmentReference: reference && parsedReference
      ? proposed<"originalAssignmentReference">(
          "originalAssignmentReference",
          parsedReference,
          reference.confidence,
          fieldEvidence(input, reference),
          methodWarning,
        )
      : missing<"originalAssignmentReference">(
          reference
            ? "The detected reference was not a safe stable identifier. Enter the provider's original assignment ID."
            : "No stable assignment reference was detected. Enter the provider's original assignment ID.",
        ),
    due:
      due && parsedDue
        ? proposed<"due">(
            "due",
            parsedDue,
            due.confidence - (parsedDue.kind === "instant" ? 0.02 : 0.08),
            fieldEvidence(input, due),
            [
              ...methodWarning,
              "Confirm the date, time, and displayed time zone before scheduling.",
            ],
          )
        : missing<"due">(
            due
              ? "A due value was detected but could not be interpreted safely."
              : "No due date was detected; it may be left blank after review.",
          ),
    instructions: instructions
      ? proposed<"instructions">(
          "instructions",
          {
            format: "plain_text",
            text: normalizeVisibleText(
              instructions.value,
              "instructions.text",
              50_000,
            ),
          } satisfies RichTextCapture,
          instructions.confidence,
          fieldEvidence(input, instructions),
          methodWarning,
        )
      : missing<"instructions">(
          "No instructions were detected; they may be added during review.",
        ),
    rubric: rubric
      ? proposed<"rubric">(
          "rubric",
          {
            rawText: normalizeVisibleText(
              rubric.value,
              "rubric.rawText",
              50_000,
            ),
            criteria: [],
          } satisfies RubricCapture,
          rubric.confidence,
          fieldEvidence(input, rubric),
          [
            ...methodWarning,
            "Rubric structure was preserved as source text and needs review.",
          ],
        )
      : missing<"rubric">(
          "No rubric was detected; it may be left blank after review.",
        ),
    estimatedDurationMinutes:
      duration && parsedDuration
        ? proposed<"estimatedDurationMinutes">(
            "estimatedDurationMinutes",
            parsedDuration,
            duration.confidence - 0.03,
            fieldEvidence(input, duration),
            methodWarning,
          )
        : missing<"estimatedDurationMinutes">(
            duration
              ? "A duration was detected but could not be interpreted safely."
              : "No estimated duration was detected.",
          ),
    sourceUrl:
      urlLine && parsedUrl
        ? proposed<"sourceUrl">(
            "sourceUrl",
            parsedUrl,
            urlLine.confidence,
            fieldEvidence(input, urlLine),
            methodWarning,
          )
        : missing<"sourceUrl">(
            sourceUrlWarning ??
              "No safe HTTPS assignment link was detected; it may be left blank.",
          ),
  };
  const status = resultStatus(fields);
  const warnings = [
    "Extracted text and dates are proposals until every field is confirmed.",
    ...(sanitized.removedLineCount > 0
      ? [
          `${sanitized.removedLineCount} credential-like line(s) were discarded and were not stored.`,
        ]
      : []),
    ...(sourceUrlWarning ? [sourceUrlWarning] : []),
  ];
  return {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    extractionId: `${input.captureId}:document`,
    captureId: input.captureId,
    learnerRef: input.learnerRef,
    provider: input.provider,
    sourceKind: "document",
    status,
    fields,
    attachments: [input.attachment],
    overallConfidence: calculateConfidence(fields),
    warnings,
    fallback: {
      required: status === "manual_entry_required",
      ...(status === "manual_entry_required"
        ? { reason: "no_assignment_fields_found" as const }
        : {}),
      message:
        status === "manual_entry_required"
          ? "Enter the assignment details manually."
          : "Compare each proposal with its evidence, edit as needed, and confirm every field.",
      nextStep:
        status === "manual_entry_required"
          ? "manual_entry"
          : "review_and_confirm",
    },
    requiresFieldByFieldConfirmation: true,
    extractedAt: input.submittedAt,
  };
}
