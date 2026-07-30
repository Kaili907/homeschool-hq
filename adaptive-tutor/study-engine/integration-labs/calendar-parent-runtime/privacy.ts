/**
 * Privacy boundaries for the calendar/parent runtime lab.
 *
 * This module is deliberately browser-safe and memory-only. It does not import
 * identity, authentication, storage, database, calendar, or network code.
 */

export const PARENT_RECOMMENDATION_PROJECTION_VERSION =
  "calendar-parent-runtime.parent-recommendation.v1" as const;

export const ADULT_PRIVATE_PROJECTION_VERSION =
  "calendar-parent-runtime.adult-private.v2" as const;

export const PRIVATE_NOTE_AUDIENCES = [
  "parent-only",
  "authorized-adults-only",
] as const;

export type PrivateNoteAudience =
  (typeof PRIVATE_NOTE_AUDIENCES)[number];
export type AdultRole = "parent" | "teacher" | "tutor";
export type PrivateNoteCategory =
  | "instructional"
  | "accommodation"
  | "schedule"
  | "review"
  | "other";

export interface ParentVisibleEvidence {
  readonly evidenceId: string;
  readonly description: string;
  readonly observedAt: string;
  readonly source:
    | "calendar-record"
    | "review-result"
    | "completed-work"
    | "parent-entry";
}

export interface ParentSafeRecommendation {
  readonly schemaVersion: typeof PARENT_RECOMMENDATION_PROJECTION_VERSION;
  readonly recommendationId: string;
  readonly createdAt: string;
  readonly direction: "increase" | "maintain" | "decrease";
  readonly summary: string;
  readonly suggestedMaximumWorkDurationMinutes?: number;
  readonly suggestedBreakDurationMinutes?: number;
  readonly evidence: readonly ParentVisibleEvidence[];
}

export interface RecommendationPrivacyReport {
  readonly recommendationId: string;
  /**
   * Paths only. Values are intentionally never copied into a privacy report.
   */
  readonly excludedSensitivePaths: readonly string[];
  readonly ignoredNonContractPaths: readonly string[];
  readonly neutralizedTextPaths: readonly string[];
}

export interface RecommendationProjectionResult {
  readonly recommendation: ParentSafeRecommendation;
  readonly privacyReport: RecommendationPrivacyReport;
}

export interface AdultActor {
  readonly role: AdultRole;
  readonly actorId: string;
}

export interface AdultPrivateNote {
  readonly noteId: string;
  readonly author: AdultActor;
  readonly category: PrivateNoteCategory;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /**
   * DEC-019 audience sidecar. `parent-only` must never be widened to the
   * canonical v1 `authorized-adults-only` visibility.
   */
  readonly audience: PrivateNoteAudience;
}

export interface AdultPrivateRecord {
  readonly kind: "parent-teacher-private";
  readonly schemaVersion: 1;
  readonly projectionVersion: typeof ADULT_PRIVATE_PROJECTION_VERSION;
  readonly recordId: string;
  readonly studentRef: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly notes: readonly AdultPrivateNote[];
}

export interface AdultPrivateNoteWrite {
  readonly recordId: string;
  readonly studentRef: string;
  readonly noteId: string;
  readonly author: AdultActor;
  readonly category: PrivateNoteCategory;
  readonly body: string;
  readonly at: string;
  /**
   * A parent-authored action defaults to `parent-only` when omitted.
   * Non-parent writers must choose an audience explicitly.
   */
  readonly audience?: PrivateNoteAudience;
}

export interface AdultPrivateAuthorization {
  readonly actor: AdultActor;
  readonly studentRef: string;
  readonly canReadPrivateNotes: boolean;
  readonly canWritePrivateNotes: boolean;
}

export interface AuthorizedAdultPrivateProjection {
  readonly schemaVersion: typeof ADULT_PRIVATE_PROJECTION_VERSION;
  readonly recordId: string;
  readonly studentRef: string;
  readonly revision: number;
  readonly notes: readonly AdultPrivateNote[];
}

/**
 * DEC-019 permits these four body-free fields in an authorized adult
 * operational event. Audience filtering happens before projection.
 */
export interface AuthorizedAdultPrivateOperationalEvent {
  readonly noteRef: string;
  readonly category: PrivateNoteCategory;
  readonly authorRef: string;
  readonly createdAt: string;
}

/**
 * Student projections receive no private-note reference, metadata, count, or
 * existence flag. The empty shape is deliberate.
 */
export type StudentPrivateNoteProjection = Readonly<Record<string, never>>;

export type PrivacyIssueCode =
  | "prohibited-field"
  | "prohibited-text"
  | "invalid-evidence"
  | "private-note-exposed"
  | "private-note-metadata-exposed";

export interface PrivacyIssue {
  readonly code: PrivacyIssueCode;
  readonly path: string;
  readonly message: string;
}

export class PrivacyBoundaryError extends Error {
  public readonly name = "PrivacyBoundaryError";

  public constructor(
    public readonly code:
      | "invalid-input"
      | "unauthorized-private-read"
      | "unauthorized-private-write"
      | "private-record-mismatch"
      | "duplicate-private-note",
    message: string,
  ) {
    super(message);
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const SENSITIVE_IDENTITY_FIELD =
  /^(?:(?:student|learner|child)?(?:full|first|last)?name|(?:student|learner|child)?(?:email|phone|address|birthdate|dateofbirth|dob|ssn))$/;
const SENSITIVE_RESPONSE_FIELD =
  /(?:raw)?(?:answers?|responses?|replies)(?:text|body|value|content|payload)?$/;
const SENSITIVE_SCORE_FIELD =
  /(?:(?:hidden|internal|private).*(?:scores?|index|indexes|indices|ratings?|metrics?)|(?:behavio(?:u)?r(?:al)?|engagement|attention|compliance)(?:scores?|index|indexes|indices|ratings?|metrics?))$/;
const SENSITIVE_CREDENTIAL_FIELD =
  /(?:usernames?|credentials?|passwords?|passcodes?|passwd|authtokens?|accesstokens?|refreshtokens?|idtokens?|apikeys?|clientsecrets?|cookies?|secrets?)$/;

const SENSITIVE_TEXT = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:student|learner|child)\s+(?:name|email|phone|address|date of birth|dob)\s*:/i,
  /\b(?:(?:raw\s+)?(?:student|learner|child)\s+)?(?:answer|response|reply)\s*:/i,
  /\btranscript\b/i,
  /\b(?:diagnos(?:is|ed|tic)|medical condition|adhd|autis(?:m|tic)|dyslexi(?:a|c)|dyscalculi(?:a|c)|dyspraxi(?:a|c)|ocd|ptsd|bipolar)\b/i,
  /\b(?:(?:hidden|internal|private)\s+)?(?:behavio(?:u)?r(?:al)?|engagement|attention|compliance)\s+(?:score|index|rating)\b/i,
  /\b(?:lazy|bad student|failure|failed again|cannot focus|can't focus|behind everyone)\b/i,
] as const;

const RECOMMENDATION_KEYS = new Set([
  "recommendationId",
  "createdAt",
  "direction",
  "summary",
  "suggestedMaximumWorkDurationMinutes",
  "suggestedBreakDurationMinutes",
  "evidence",
]);

const EVIDENCE_KEYS = new Set([
  "evidenceId",
  "description",
  "observedAt",
  "source",
]);

const NEUTRAL_RECOMMENDATION_SUMMARY =
  "A study-setting recommendation is available from parent-visible evidence.";
const NEUTRAL_EVIDENCE_DESCRIPTION =
  "Parent-visible study evidence was recorded.";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedSensitiveFieldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveField(key: string): boolean {
  const normalized = normalizedSensitiveFieldKey(key);
  return (
    SENSITIVE_IDENTITY_FIELD.test(normalized) ||
    normalized.includes("email") ||
    normalized.includes("phone") ||
    normalized.includes("telephone") ||
    normalized.endsWith("address") ||
    normalized.includes("birthdate") ||
    normalized.includes("dateofbirth") ||
    normalized.endsWith("dob") ||
    normalized.includes("ssn") ||
    SENSITIVE_RESPONSE_FIELD.test(normalized) ||
    SENSITIVE_SCORE_FIELD.test(normalized) ||
    SENSITIVE_CREDENTIAL_FIELD.test(normalized) ||
    normalized.includes("transcript") ||
    normalized.includes("diagnos") ||
    normalized.includes("medicalcondition")
  );
}

function assertId(value: string, field: string): void {
  if (!SAFE_ID.test(value)) {
    throw new PrivacyBoundaryError(
      "invalid-input",
      `${field} must be a stable opaque identifier.`,
    );
  }
}

function assertTimestamp(value: string, field: string): void {
  if (!OFFSET_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new PrivacyBoundaryError(
      "invalid-input",
      `${field} must include Z or an explicit UTC offset.`,
    );
  }
}

function requiredString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PrivacyBoundaryError(
      "invalid-input",
      `${key} must be a non-empty string.`,
    );
  }
  return value.trim().replace(/\s+/g, " ");
}

function optionalMinutes(
  record: Readonly<Record<string, unknown>>,
  key: string,
  maximum: number,
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    throw new PrivacyBoundaryError(
      "invalid-input",
      `${key} must be a whole number from 1 to ${maximum}.`,
    );
  }
  return value as number;
}

function containsSensitiveText(value: string): boolean {
  return SENSITIVE_TEXT.some((pattern) => pattern.test(value));
}

function safePublicText(
  value: string,
  fallback: string,
  maximumLength: number,
): { readonly value: string; readonly neutralized: boolean } {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > maximumLength ||
    containsSensitiveText(normalized)
  ) {
    return { value: fallback, neutralized: true };
  }
  return { value: normalized, neutralized: false };
}

function collectExcludedPaths(
  value: unknown,
  path: string,
  allowedKeys: ReadonlySet<string>,
  sensitive: string[],
  ignored: string[],
): void {
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (!allowedKeys.has(key)) {
      (isSensitiveField(key) ? sensitive : ignored).push(childPath);
      continue;
    }
    if (key === "evidence" && Array.isArray(child)) {
      child.forEach((entry, index) =>
        collectExcludedPaths(
          entry,
          `${childPath}[${index}]`,
          EVIDENCE_KEYS,
          sensitive,
          ignored,
        ),
      );
    }
  }
}

function projectEvidence(
  value: unknown,
  index: number,
  neutralizedTextPaths: string[],
): ParentVisibleEvidence | undefined {
  if (!isRecord(value)) return undefined;
  try {
    const evidenceId = requiredString(value, "evidenceId");
    const observedAt = requiredString(value, "observedAt");
    const source = requiredString(value, "source");
    const description = safePublicText(
      requiredString(value, "description"),
      NEUTRAL_EVIDENCE_DESCRIPTION,
      360,
    );
    assertId(evidenceId, `evidence[${index}].evidenceId`);
    assertTimestamp(observedAt, `evidence[${index}].observedAt`);
    if (
      ![
        "calendar-record",
        "review-result",
        "completed-work",
        "parent-entry",
      ].includes(source)
    ) {
      return undefined;
    }
    if (description.neutralized) {
      neutralizedTextPaths.push(`recommendation.evidence[${index}].description`);
    }
    return {
      evidenceId,
      description: description.value,
      observedAt,
      source: source as ParentVisibleEvidence["source"],
    };
  } catch {
    return undefined;
  }
}

/**
 * Creates a strict allow-list projection from an untrusted engine record.
 * Sensitive and unknown source fields are omitted; their values are never
 * copied to the report. Unsafe free text is replaced with neutral language.
 */
export function projectParentRecommendation(
  source: Readonly<Record<string, unknown>>,
): RecommendationProjectionResult {
  const recommendationId = requiredString(source, "recommendationId");
  const createdAt = requiredString(source, "createdAt");
  const direction = requiredString(source, "direction");
  const summary = safePublicText(
    requiredString(source, "summary"),
    NEUTRAL_RECOMMENDATION_SUMMARY,
    400,
  );
  assertId(recommendationId, "recommendationId");
  assertTimestamp(createdAt, "createdAt");
  if (!["increase", "maintain", "decrease"].includes(direction)) {
    throw new PrivacyBoundaryError(
      "invalid-input",
      "direction must be increase, maintain, or decrease.",
    );
  }

  const sensitive: string[] = [];
  const ignored: string[] = [];
  const neutralized: string[] = [];
  collectExcludedPaths(
    source,
    "recommendation",
    RECOMMENDATION_KEYS,
    sensitive,
    ignored,
  );
  if (summary.neutralized) neutralized.push("recommendation.summary");

  const evidenceSource = Array.isArray(source.evidence) ? source.evidence : [];
  const evidence = evidenceSource.flatMap((entry, index) => {
    const projected = projectEvidence(entry, index, neutralized);
    return projected === undefined ? [] : [projected];
  });

  const suggestedMaximumWorkDurationMinutes = optionalMinutes(
    source,
    "suggestedMaximumWorkDurationMinutes",
    240,
  );
  const suggestedBreakDurationMinutes = optionalMinutes(
    source,
    "suggestedBreakDurationMinutes",
    120,
  );

  const recommendation: ParentSafeRecommendation = {
    schemaVersion: PARENT_RECOMMENDATION_PROJECTION_VERSION,
    recommendationId,
    createdAt,
    direction: direction as ParentSafeRecommendation["direction"],
    summary: summary.value,
    ...(suggestedMaximumWorkDurationMinutes === undefined
      ? {}
      : { suggestedMaximumWorkDurationMinutes }),
    ...(suggestedBreakDurationMinutes === undefined
      ? {}
      : { suggestedBreakDurationMinutes }),
    evidence,
  };

  return {
    recommendation,
    privacyReport: {
      recommendationId,
      excludedSensitivePaths: [...new Set(sensitive)].sort(),
      ignoredNonContractPaths: [...new Set(ignored)].sort(),
      neutralizedTextPaths: [...new Set(neutralized)].sort(),
    },
  };
}

function inspectProjection(
  value: unknown,
  path: string,
  issues: PrivacyIssue[],
): void {
  if (typeof value === "string") {
    if (containsSensitiveText(value)) {
      issues.push({
        code: "prohibited-text",
        path,
        message:
          "Public recommendation text must exclude PII, raw responses, transcripts, diagnosis text, hidden scores, and blame language.",
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectProjection(entry, `${path}[${index}]`, issues),
    );
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isSensitiveField(key)) {
      issues.push({
        code: "prohibited-field",
        path: childPath,
        message: "The field is outside the parent recommendation projection.",
      });
    }
    inspectProjection(child, childPath, issues);
  }
}

export function auditParentRecommendationProjection(
  recommendation: ParentSafeRecommendation,
): readonly PrivacyIssue[] {
  const issues: PrivacyIssue[] = [];
  inspectProjection(recommendation, "recommendation", issues);
  recommendation.evidence.forEach((item, index) => {
    if (item.description.trim().length === 0) {
      issues.push({
        code: "invalid-evidence",
        path: `recommendation.evidence[${index}].description`,
        message: "Parent-visible evidence needs a non-empty description.",
      });
    }
  });
  return issues;
}

export function isParentSafeFunctionalText(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length > 0 &&
    normalized.length <= 500 &&
    !containsSensitiveText(normalized)
  );
}

export function createAdultPrivateRecord(input: {
  readonly recordId: string;
  readonly studentRef: string;
  readonly at: string;
}): AdultPrivateRecord {
  assertId(input.recordId, "recordId");
  assertId(input.studentRef, "studentRef");
  assertTimestamp(input.at, "at");
  return {
    kind: "parent-teacher-private",
    schemaVersion: 1,
    projectionVersion: ADULT_PRIVATE_PROJECTION_VERSION,
    recordId: input.recordId,
    studentRef: input.studentRef,
    revision: 0,
    createdAt: input.at,
    updatedAt: input.at,
    notes: [],
  };
}

function assertPrivateRecordAccess(
  record: AdultPrivateRecord,
  authorization: AdultPrivateAuthorization,
  mode: "read" | "write",
): void {
  if (record.studentRef !== authorization.studentRef) {
    throw new PrivacyBoundaryError(
      "private-record-mismatch",
      "The authorization and private record refer to different learners.",
    );
  }
  if (
    (mode === "read" && !authorization.canReadPrivateNotes) ||
    (mode === "write" && !authorization.canWritePrivateNotes)
  ) {
    throw new PrivacyBoundaryError(
      mode === "read"
        ? "unauthorized-private-read"
        : "unauthorized-private-write",
      `The adult authorization does not allow private-note ${mode}.`,
    );
  }
}

function privateNoteAudience(
  write: AdultPrivateNoteWrite,
): PrivateNoteAudience {
  if (write.audience !== undefined) {
    if (!PRIVATE_NOTE_AUDIENCES.includes(write.audience)) {
      throw new PrivacyBoundaryError(
        "invalid-input",
        "Private-note audience must be parent-only or authorized-adults-only.",
      );
    }
    return write.audience;
  }
  if (write.author.role === "parent") {
    return "parent-only";
  }
  throw new PrivacyBoundaryError(
    "invalid-input",
    "A non-parent private-note writer must choose an audience explicitly.",
  );
}

function noteIsVisibleTo(
  note: AdultPrivateNote,
  actor: AdultActor,
): boolean {
  if (!PRIVATE_NOTE_AUDIENCES.includes(note.audience)) return false;
  return (
    note.audience === "authorized-adults-only" ||
    actor.role === "parent"
  );
}

function authorizedVisibleNotes(
  record: AdultPrivateRecord,
  authorization: AdultPrivateAuthorization,
): readonly AdultPrivateNote[] {
  assertPrivateRecordAccess(record, authorization, "read");
  return record.notes.filter((note) =>
    noteIsVisibleTo(note, authorization.actor),
  );
}

export function writeAdultPrivateNote(
  record: AdultPrivateRecord,
  write: AdultPrivateNoteWrite,
  authorization: AdultPrivateAuthorization,
): AdultPrivateRecord {
  assertPrivateRecordAccess(record, authorization, "write");
  if (
    write.recordId !== record.recordId ||
    write.studentRef !== record.studentRef
  ) {
    throw new PrivacyBoundaryError(
      "private-record-mismatch",
      "The private-note command targets a different record.",
    );
  }
  assertId(write.noteId, "noteId");
  assertId(write.author.actorId, "author.actorId");
  assertTimestamp(write.at, "at");
  if (
    write.author.actorId !== authorization.actor.actorId ||
    write.author.role !== authorization.actor.role
  ) {
    throw new PrivacyBoundaryError(
      "unauthorized-private-write",
      "The private-note author must match the authorized adult.",
    );
  }
  const audience = privateNoteAudience(write);
  if (
    audience === "parent-only" &&
    write.author.role !== "parent"
  ) {
    throw new PrivacyBoundaryError(
      "unauthorized-private-write",
      "Only an authorized parent may create a parent-only note.",
    );
  }
  if (record.notes.some(({ noteId }) => noteId === write.noteId)) {
    throw new PrivacyBoundaryError(
      "duplicate-private-note",
      "The private note identifier already exists.",
    );
  }
  const body = write.body.trim().replace(/\r\n/g, "\n");
  if (body.length === 0 || body.length > 2_000) {
    throw new PrivacyBoundaryError(
      "invalid-input",
      "Private note body must be between 1 and 2,000 characters.",
    );
  }

  return {
    ...record,
    revision: record.revision + 1,
    updatedAt: write.at,
    notes: [
      ...record.notes,
      {
        noteId: write.noteId,
        author: write.author,
        category: write.category,
        body,
        createdAt: write.at,
        updatedAt: write.at,
        audience,
      },
    ],
  };
}

export function projectAuthorizedAdultPrivateNotes(
  record: AdultPrivateRecord,
  authorization: AdultPrivateAuthorization,
): AuthorizedAdultPrivateProjection {
  const visibleNotes = authorizedVisibleNotes(record, authorization);
  return {
    schemaVersion: ADULT_PRIVATE_PROJECTION_VERSION,
    recordId: record.recordId,
    studentRef: record.studentRef,
    // A non-parent cannot infer hidden parent-only note activity from the
    // repository's full revision counter.
    revision:
      authorization.actor.role === "parent"
        ? record.revision
        : visibleNotes.length,
    notes: visibleNotes.map((note) => ({
      ...note,
      author: { ...note.author },
    })),
  };
}

export function projectAuthorizedAdultPrivateOperationalEvents(
  record: AdultPrivateRecord,
  authorization: AdultPrivateAuthorization,
): readonly AuthorizedAdultPrivateOperationalEvent[] {
  return authorizedVisibleNotes(record, authorization).map((note) => ({
    noteRef: note.noteId,
    category: note.category,
    authorRef: note.author.actorId,
    createdAt: note.createdAt,
  }));
}

const EMPTY_STUDENT_PRIVATE_NOTE_PROJECTION =
  Object.freeze({}) as StudentPrivateNoteProjection;

export function projectStudentPrivateNotes(
  _record: AdultPrivateRecord,
): StudentPrivateNoteProjection {
  return EMPTY_STUDENT_PRIVATE_NOTE_PROJECTION;
}

/**
 * Verifies that a public value does not contain a private-note body or a
 * substantial excerpt. Traversal is cycle-safe and does not serialize the
 * input, so multiline bodies cannot evade the check through JSON escaping.
 */
export function auditPrivateNoteIsolation(
  publicValue: unknown,
  privateRecord: AdultPrivateRecord,
): readonly PrivacyIssue[] {
  const firstExposureByNote = new Map<number, string>();
  const seen = new WeakSet<object>();

  const inspect = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      const candidate = value.trim();
      for (const [index, note] of privateRecord.notes.entries()) {
        const body = note.body.trim();
        if (
          candidate === body ||
          candidate.includes(body) ||
          (candidate.length >= 24 && body.includes(candidate))
        ) {
          if (!firstExposureByNote.has(index)) {
            firstExposureByNote.set(index, path);
          }
        }
      }
      return;
    }
    if (value === null || typeof value !== "object" || seen.has(value)) {
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        inspect(entry, `${path}[${index}]`),
      );
      return;
    }
    if (value instanceof Map) {
      let index = 0;
      for (const [key, child] of value.entries()) {
        inspect(key, `${path}.<map-key:${index}>`);
        inspect(child, `${path}.<map-value:${index}>`);
        index += 1;
      }
      return;
    }
    if (value instanceof Set) {
      let index = 0;
      for (const child of value.values()) {
        inspect(child, `${path}.<set-value:${index}>`);
        index += 1;
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      inspect(child, `${path}.${key}`);
    }
  };

  inspect(publicValue, "publicValue");
  return [...firstExposureByNote.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, path]) => ({
      code: "private-note-exposed" as const,
      path,
      message:
        `A public projection exposed body content from adult-private note ${index}.`,
    }));
}

const STUDENT_PRIVATE_METADATA_KEYS = new Set([
  "audience",
  "body",
  "category",
  "excerpt",
  "exists",
  "hasnote",
  "hasnotes",
  "hasprivatenote",
  "hasprivatenotes",
  "note",
  "notecount",
  "noteexists",
  "noteid",
  "noteref",
  "notes",
  "privatenote",
  "privatenotecount",
  "privatenoteexists",
  "privatenoteid",
  "privatenoteref",
  "privatenotes",
  "visibility",
]);

function normalizedPrivateMetadataKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isExactlyEmptyStudentPrivateProjection(value: unknown): boolean {
  if (
    !isRecord(value) ||
    value instanceof Map ||
    value instanceof Set
  ) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value) as object | null;
    return (
      (prototype === Object.prototype || prototype === null) &&
      Reflect.ownKeys(value).length === 0
    );
  } catch {
    return false;
  }
}

/**
 * Audits a value intended specifically for the student private-note boundary.
 * DEC-019 requires this projection to be exactly an empty record. Recursive
 * inspection remains in place to classify body/reference leaks for useful
 * diagnostics, but any non-empty or non-record shape is itself a violation.
 */
export function auditStudentPrivateNoteProjection(
  studentValue: unknown,
  privateRecord: AdultPrivateRecord,
): readonly PrivacyIssue[] {
  const issues: PrivacyIssue[] = [];
  if (!isExactlyEmptyStudentPrivateProjection(studentValue)) {
    issues.push({
      code: "private-note-metadata-exposed",
      path: "studentPrivateProjection",
      message:
        "The student private-note projection must be exactly an empty record with no existence signal.",
    });
  }
  const seen = new WeakSet<object>();

  const inspect = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      for (const [index, note] of privateRecord.notes.entries()) {
        const trimmed = value.trim();
        if (
          trimmed === note.body ||
          trimmed === note.noteId ||
          (trimmed.length >= 24 && note.body.includes(trimmed))
        ) {
          issues.push({
            code:
              trimmed === note.body || note.body.includes(trimmed)
                ? "private-note-exposed"
                : "private-note-metadata-exposed",
            path,
            message:
              `Student projection exposed private-note data from repository note ${index}.`,
          });
        }
      }
      return;
    }
    if (value === null || typeof value !== "object" || seen.has(value)) {
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        inspect(entry, `${path}[${index}]`),
      );
      return;
    }
    if (value instanceof Map) {
      let index = 0;
      for (const [key, child] of value.entries()) {
        inspect(key, `${path}.<map-key:${index}>`);
        inspect(child, `${path}.<map-value:${index}>`);
        index += 1;
      }
      return;
    }
    if (value instanceof Set) {
      let index = 0;
      for (const child of value.values()) {
        inspect(child, `${path}.<set-value:${index}>`);
        index += 1;
      }
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (
        STUDENT_PRIVATE_METADATA_KEYS.has(
          normalizedPrivateMetadataKey(key),
        )
      ) {
        issues.push({
          code: "private-note-metadata-exposed",
          path: childPath,
          message:
            "Student projections must not reveal private-note metadata or existence.",
        });
      }
      inspect(child, childPath);
    }
  };

  inspect(studentValue, "studentPrivateProjection");
  return issues;
}
