import {
  createCalendarBlock,
  mergeCalendarBlocks,
  type CalendarBlock,
  type LocalTimeDisambiguation,
  type TimerVisibility,
} from "./calendar-runtime.js";
import type {
  StudyPlanId,
  VersionedReference,
} from "../../contracts/common.js";

/**
 * This module is a credential-free, in-memory metadata boundary. It does not
 * log in to Romeo, control a browser, fetch a URL, scrape a page, persist
 * records, or synchronize with a production service.
 */
export const ROMEO_RUNTIME_BOUNDARY = {
  provider: "romeo_virtual_academy",
  credentialsRequested: false,
  credentialsStored: false,
  automaticLogin: false,
  scraping: false,
  networkRequests: false,
  persistence: false,
  productionSync: false,
} as const;

export const ROMEO_ASSIGNMENT_SCHEMA_VERSION = 1 as const;

/**
 * The dispatch DEC-018 identifier is crosswalked to the accepted R2
 * credential-free Romeo sidecar mapping.
 */
export const ROMEO_DEC_018_RECONCILIATION = {
  decisionId: "DEC-018",
  reconciled: true,
  validationStatus: "ACCEPTED_R2_PARITY",
  productionApproved: false,
  finalAssemblyAuthorized: false,
  supportReference:
    "VersionedReference<StudyPlanId>",
  limitation:
    "Production integration and final assembly remain separately unauthorized.",
} as const;

export const ROMEO_SOURCE_MODES = [
  "manual",
  "approved-import",
  "browser-assisted-reference",
] as const;

export type RomeoSourceMode = (typeof ROMEO_SOURCE_MODES)[number];

export const ROMEO_COMPLETION_STATES = [
  "not_started",
  "in_progress",
  "completed",
] as const;

export type RomeoCompletionState =
  (typeof ROMEO_COMPLETION_STATES)[number];

export const ROMEO_TUTORING_TARGET_TYPES = [
  "skill",
  "lesson",
] as const;

export type RomeoTutoringTargetType =
  (typeof ROMEO_TUTORING_TARGET_TYPES)[number];

export interface RomeoEnteredProgress {
  readonly completedUnits: number;
  readonly totalUnits: number;
  readonly updatedAt: string;
}

/**
 * The target ID is a host-supplied canonical Manuel Academy SkillId or
 * LessonId. This lab validates its opaque representation and preserves its
 * bytes; it does not derive or look up an identity.
 */
export interface LinkedManuelAcademyTutoring {
  readonly targetType: RomeoTutoringTargetType;
  readonly targetId: string;
  readonly title: string;
  /**
   * DEC-018 fallback until Tutor Core exposes a verified, more-specific
   * support reference. Despite the historical field name, the value is a
   * complete versioned reference rather than a bare ID.
   */
  readonly supportStudyPlanId: VersionedReference<StudyPlanId>;
}

export interface RomeoAssignmentInput {
  readonly schemaVersion: typeof ROMEO_ASSIGNMENT_SCHEMA_VERSION;
  readonly externalAssignmentId: string;
  /**
   * Opaque host-controlled launch indirection. It is safe to project; it is
   * never interpreted as a URI by this runtime.
   */
  readonly hostLaunchRef: string;
  readonly title: string;
  readonly course: string;
  /** Romeo supplies a calendar date; the adapter does not invent a due time. */
  readonly dueDate: string;
  readonly estimatedDurationMinutes: number;
  readonly completionState: RomeoCompletionState;
  readonly parentEnteredProgress?: RomeoEnteredProgress;
  readonly studentEnteredProgress?: RomeoEnteredProgress;
  readonly linkedManuelAcademyTutoring?: LinkedManuelAcademyTutoring;
  readonly resumeNote?: string;
  readonly externalUrlReference?: string;
  /** Observation time, always an unambiguous instant with an explicit offset. */
  readonly lastCheckedAt: string;
  readonly sourceMode: RomeoSourceMode;
}

export interface RomeoAssignment extends RomeoAssignmentInput {
  readonly provider: "romeo_virtual_academy";
}

export interface RomeoAssignmentUpdate {
  readonly schemaVersion: typeof ROMEO_ASSIGNMENT_SCHEMA_VERSION;
  /**
   * Optional concurrency guard. When present it must exactly match the stable
   * assignment ID; an update can never rename an external assignment.
   */
  readonly externalAssignmentId?: string;
  readonly hostLaunchRef?: string;
  readonly title?: string;
  readonly course?: string;
  readonly dueDate?: string;
  readonly estimatedDurationMinutes?: number;
  readonly completionState?: RomeoCompletionState;
  readonly parentEnteredProgress?: RomeoEnteredProgress | null;
  readonly studentEnteredProgress?: RomeoEnteredProgress | null;
  readonly linkedManuelAcademyTutoring?:
    | LinkedManuelAcademyTutoring
    | null;
  readonly resumeNote?: string | null;
  readonly externalUrlReference?: string | null;
  readonly lastCheckedAt: string;
  readonly sourceMode?: RomeoSourceMode;
}

export interface RomeoCalendarSchedule {
  readonly internalBlockId: string;
  readonly learnerRef: string;
  readonly householdTimeZone: string;
  readonly scheduledLocalStart: string;
  /**
   * Card 5 explicit placement seam. These values are optional only for the
   * lab's compatibility path and, when supplied, must be supplied together.
   * The calendar runtime verifies that the offset instant resolves to the
   * requested learner-local wall time and intended civil date.
   */
  readonly scheduledStart?: string;
  readonly intendedLocalDate?: string;
  readonly localTimeDisambiguation?: LocalTimeDisambiguation;
  readonly createdAt: string;
  readonly required?: boolean;
  readonly timerVisibility?: TimerVisibility;
}

export interface RomeoCalendarProjection {
  readonly blocks: readonly CalendarBlock[];
  readonly block: CalendarBlock;
  readonly hostLaunchRef: string;
  readonly action: "created" | "idempotent";
  readonly created: boolean;
}

/**
 * Allowlisted parent/student-safe projection. The adapter-only HTTPS
 * reference and free-text resume body are deliberately absent.
 */
export interface RomeoPublicAssignmentProjection {
  readonly schemaVersion: typeof ROMEO_ASSIGNMENT_SCHEMA_VERSION;
  readonly provider: "romeo_virtual_academy";
  readonly externalAssignmentId: string;
  readonly hostLaunchRef: string;
  readonly title: string;
  readonly course: string;
  readonly dueDate: string;
  readonly estimatedDurationMinutes: number;
  readonly completionState: RomeoCompletionState;
  readonly parentEnteredProgress?: RomeoEnteredProgress;
  readonly studentEnteredProgress?: RomeoEnteredProgress;
  readonly linkedManuelAcademyTutoring?: LinkedManuelAcademyTutoring;
  readonly lastCheckedAt: string;
  readonly sourceMode: RomeoSourceMode;
  readonly resumeNoteAvailable: boolean;
}

export type RomeoRuntimeErrorCode =
  | "credential_material"
  | "invalid_reference"
  | "invalid_text"
  | "invalid_due_date"
  | "invalid_duration"
  | "invalid_completion_state"
  | "invalid_progress"
  | "invalid_timestamp"
  | "invalid_source_mode"
  | "invalid_tutoring_link"
  | "invalid_url"
  | "unsupported_version"
  | "invalid_launch_reference"
  | "identity_conflict"
  | "stale_update"
  | "update_conflict";

export class RomeoRuntimeError extends Error {
  public readonly name = "RomeoRuntimeError";

  public constructor(
    public readonly code: RomeoRuntimeErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const OPAQUE_REFERENCE =
  /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const URI_SHAPED_REFERENCE =
  /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const OFFSET_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const URL_IN_TEXT =
  /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>"'`]+/g;
const BEARER_OR_BASIC_VALUE =
  /^\s*(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]{8,}={0,2}\s*$/i;
const CREDENTIAL_ASSIGNMENT_IN_TEXT =
  /\b(?:password|passcode|passwd|pwd|pin|otp|totp|mfa[\s_-]*(?:code|token)|verification[\s_-]*code|recovery[\s_-]*code|auth(?:orization)?[\s_-]*code|oauth[\s_-]*code|csrf[\s_-]*token|saml[\s_-]*response|sso[\s_-]*ticket|magic[\s_-]*link|user[\s_-]*name|login(?:[\s_-]*(?:id|name))?|api[\s_-]*key|access[\s_-]*token|refresh[\s_-]*token|auth(?:orization)?|session[\s_-]*(?:cookie|token|id)|cookie|client[\s_-]*secret|secret)\s*[:=]\s*\S+/i;

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCredentialKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return (
    normalized.includes("password") ||
    normalized.includes("passcode") ||
    normalized.includes("passwd") ||
    normalized === "pwd" ||
    normalized.includes("credential") ||
    normalized.includes("username") ||
    normalized.includes("login") ||
    normalized.includes("accesstoken") ||
    normalized.includes("refreshtoken") ||
    normalized.includes("idtoken") ||
    normalized.includes("authtoken") ||
    normalized.includes("bearertoken") ||
    normalized === "pin" ||
    normalized === "otp" ||
    normalized === "totp" ||
    normalized.includes("mfacode") ||
    normalized.includes("mfatoken") ||
    normalized.includes("verificationcode") ||
    normalized.includes("recoverycode") ||
    normalized.includes("authorizationcode") ||
    normalized.includes("authcode") ||
    normalized.includes("oauthcode") ||
    normalized.includes("csrftoken") ||
    normalized.includes("samlresponse") ||
    normalized.includes("ssoticket") ||
    normalized.includes("magiclink") ||
    normalized === "session" ||
    normalized.includes("sessionid") ||
    normalized.includes("sessiontoken") ||
    normalized === "token" ||
    normalized.includes("sessioncookie") ||
    normalized === "cookie" ||
    normalized === "cookies" ||
    normalized.includes("apikey") ||
    normalized.includes("clientsecret") ||
    normalized.includes("privatesecret") ||
    normalized === "secret" ||
    normalized === "authorization" ||
    normalized === "authentication" ||
    normalized === "auth" ||
    normalized === "authheader"
  );
}

function isCredentialQueryKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return (
    isCredentialKey(key) ||
    normalized.includes("signature") ||
    normalized.includes("accesskey") ||
    normalized.includes("privatekey") ||
    normalized === "key" ||
    normalized === "session" ||
    normalized === "sessionid"
  );
}

function credentialError(message: string): never {
  throw new RomeoRuntimeError("credential_material", message);
}

function assertRecordValue(value: unknown, field: string): void {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value instanceof Map ||
    value instanceof Set
  ) {
    throw new RomeoRuntimeError(
      "invalid_reference",
      `${field} must be a metadata record.`,
    );
  }
}

function assertUrlHasNoCredentialMaterial(
  url: URL,
  context: string,
): void {
  if (url.username !== "" || url.password !== "") {
    credentialError(`${context} must not embed URL user information.`);
  }
  for (const key of url.searchParams.keys()) {
    if (isCredentialQueryKey(key)) {
      credentialError(
        `${context} must not contain credential-like query parameters.`,
      );
    }
  }
  if (url.hash.length > 1) {
    const fragmentParameters = new URLSearchParams(url.hash.slice(1));
    for (const key of fragmentParameters.keys()) {
      if (isCredentialQueryKey(key)) {
        credentialError(
          `${context} must not contain credential-like fragment parameters.`,
        );
      }
    }
  }
}

function trimUrlPunctuation(value: string): string {
  return value.replace(/[),.;!?]+$/g, "");
}

function assertStringHasNoCredentialMaterial(value: string): void {
  if (BEARER_OR_BASIC_VALUE.test(value)) {
    credentialError(
      "Romeo metadata must not contain bearer or basic authorization material.",
    );
  }
  if (CREDENTIAL_ASSIGNMENT_IN_TEXT.test(value)) {
    credentialError(
      "Romeo metadata must not contain credential assignments in text.",
    );
  }
  for (const candidate of value.match(URL_IN_TEXT) ?? []) {
    try {
      assertUrlHasNoCredentialMaterial(
        new URL(trimUrlPunctuation(candidate)),
        "Romeo metadata URL",
      );
    } catch (error) {
      if (error instanceof RomeoRuntimeError) throw error;
      // Non-URL prose that happens to match the broad scanner is validated by
      // its field-specific validator, if it is an external URL field.
    }
  }
}

/**
 * Fails closed on credential-shaped keys at any nesting depth, including
 * unknown extension fields. Cycles are tolerated so hostile test objects
 * cannot cause unbounded recursion.
 */
export function assertRomeoCredentialFree(
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): void {
  if (typeof value === "string") {
    assertStringHasNoCredentialMaterial(value);
    return;
  }
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);

  if (value instanceof URL) {
    assertUrlHasNoCredentialMaterial(value, "Romeo metadata URL");
    return;
  }
  if (value instanceof Map) {
    for (const [key, nested] of value.entries()) {
      if (typeof key === "string" && isCredentialKey(key)) {
        credentialError(
          "Romeo metadata must not contain login or credential fields.",
        );
      }
      assertRomeoCredentialFree(key, seen);
      assertRomeoCredentialFree(nested, seen);
    }
    return;
  }
  if (value instanceof Set) {
    for (const nested of value.values()) {
      assertRomeoCredentialFree(nested, seen);
    }
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (isCredentialKey(key)) {
      credentialError(
        "Romeo metadata must not contain login or credential fields.",
      );
    }
    assertRomeoCredentialFree(nested, seen);
  }
}

function assertOpaqueReference(value: unknown, field: string): string {
  if (typeof value !== "string" || !OPAQUE_REFERENCE.test(value)) {
    throw new RomeoRuntimeError(
      "invalid_reference",
      `${field} must be an opaque 1-128 character reference.`,
    );
  }
  return value;
}

function assertNonUriOpaqueReference(
  value: unknown,
  field: string,
): string {
  const reference = assertOpaqueReference(value, field);
  if (URI_SHAPED_REFERENCE.test(reference)) {
    throw new RomeoRuntimeError(
      field === "hostLaunchRef"
        ? "invalid_launch_reference"
        : "invalid_reference",
      `${field} must be an opaque reference, not a URI.`,
    );
  }
  return reference;
}

function assertSupportedSchemaVersion(value: unknown): void {
  if (value !== ROMEO_ASSIGNMENT_SCHEMA_VERSION) {
    throw new RomeoRuntimeError(
      "unsupported_version",
      `Romeo assignment input schemaVersion must be ${ROMEO_ASSIGNMENT_SCHEMA_VERSION}.`,
    );
  }
}

function normalizePublicText(
  value: unknown,
  field: string,
  maximum: number,
): string {
  const normalized = normalizeText(value, field, maximum);
  if ((normalized.match(URL_IN_TEXT) ?? []).length > 0) {
    throw new RomeoRuntimeError(
      "invalid_url",
      `${field} must not contain an arbitrary URI.`,
    );
  }
  return normalized;
}

function normalizeText(
  value: unknown,
  field: string,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw new RomeoRuntimeError(
      "invalid_text",
      `${field} must be text.`,
    );
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new RomeoRuntimeError(
      "invalid_text",
      `${field} must contain 1-${maximum} visible characters.`,
    );
  }
  return normalized;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return days[month - 1] ?? 0;
}

function assertCalendarDate(value: unknown): string {
  if (typeof value !== "string") {
    throw new RomeoRuntimeError(
      "invalid_due_date",
      "dueDate must use YYYY-MM-DD.",
    );
  }
  const match = CALENDAR_DATE.exec(value);
  if (!match) {
    throw new RomeoRuntimeError(
      "invalid_due_date",
      "dueDate must use YYYY-MM-DD.",
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new RomeoRuntimeError(
      "invalid_due_date",
      "dueDate must be a real calendar date.",
    );
  }
  return value;
}

function assertOffsetTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new RomeoRuntimeError(
      "invalid_timestamp",
      `${field} must be an ISO 8601 instant with an explicit offset.`,
    );
  }
  const match = OFFSET_TIMESTAMP.exec(value);
  if (!match) {
    throw new RomeoRuntimeError(
      "invalid_timestamp",
      `${field} must be an ISO 8601 instant with an explicit offset.`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new RomeoRuntimeError(
      "invalid_timestamp",
      `${field} must be a real ISO 8601 instant with an explicit offset.`,
    );
  }
  return value;
}

function normalizeProgress(
  value: unknown,
  field: string,
): RomeoEnteredProgress {
  if (value === null || typeof value !== "object") {
    throw new RomeoRuntimeError(
      "invalid_progress",
      `${field} must be an entered-progress record.`,
    );
  }
  const progress = value as Partial<RomeoEnteredProgress>;
  if (
    !Number.isInteger(progress.completedUnits) ||
    !Number.isInteger(progress.totalUnits) ||
    progress.totalUnits === undefined ||
    progress.completedUnits === undefined ||
    progress.totalUnits <= 0 ||
    progress.completedUnits < 0 ||
    progress.completedUnits > progress.totalUnits
  ) {
    throw new RomeoRuntimeError(
      "invalid_progress",
      `${field} must use whole completed units from zero through totalUnits.`,
    );
  }
  return {
    completedUnits: progress.completedUnits,
    totalUnits: progress.totalUnits,
    updatedAt: assertOffsetTimestamp(
      progress.updatedAt,
      `${field}.updatedAt`,
    ),
  };
}

function normalizeTutoringLink(
  value: unknown,
): LinkedManuelAcademyTutoring {
  if (value === null || typeof value !== "object") {
    throw new RomeoRuntimeError(
      "invalid_tutoring_link",
      "linkedManuelAcademyTutoring must identify a skill or lesson.",
    );
  }
  const link = value as Partial<LinkedManuelAcademyTutoring>;
  if (
    typeof link.targetType !== "string" ||
    !ROMEO_TUTORING_TARGET_TYPES.includes(
      link.targetType as RomeoTutoringTargetType,
    )
  ) {
    throw new RomeoRuntimeError(
      "invalid_tutoring_link",
      "Tutoring targetType must be skill or lesson.",
    );
  }
  const supportStudyPlanId = link.supportStudyPlanId;
  if (
    supportStudyPlanId === null ||
    typeof supportStudyPlanId !== "object"
  ) {
    throw new RomeoRuntimeError(
      "invalid_tutoring_link",
      "supportStudyPlanId must be a versioned StudyPlanId reference.",
    );
  }
  const supportReference =
    supportStudyPlanId as Partial<VersionedReference<StudyPlanId>>;
  if (
    !Number.isInteger(supportReference.revision) ||
    supportReference.revision === undefined ||
    supportReference.revision < 1
  ) {
    throw new RomeoRuntimeError(
      "invalid_tutoring_link",
      "supportStudyPlanId.revision must be a positive integer.",
    );
  }
  return {
    targetType: link.targetType as RomeoTutoringTargetType,
    targetId: assertNonUriOpaqueReference(
      link.targetId,
      "linkedManuelAcademyTutoring.targetId",
    ),
    title: normalizePublicText(
      link.title,
      "linkedManuelAcademyTutoring.title",
      160,
    ),
    supportStudyPlanId: {
      id: assertNonUriOpaqueReference(
        supportReference.id,
        "linkedManuelAcademyTutoring.supportStudyPlanId.id",
      ) as StudyPlanId,
      revision: supportReference.revision,
    },
  };
}

function normalizeExternalUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new RomeoRuntimeError(
      "invalid_url",
      "externalUrlReference must be a valid HTTPS URL.",
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RomeoRuntimeError(
      "invalid_url",
      "externalUrlReference must be a valid HTTPS URL.",
    );
  }
  assertUrlHasNoCredentialMaterial(url, "externalUrlReference");
  if (url.protocol !== "https:") {
    throw new RomeoRuntimeError(
      "invalid_url",
      "externalUrlReference must use HTTPS.",
    );
  }
  return url.toString();
}

function normalizeDuration(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new RomeoRuntimeError(
      "invalid_duration",
      "estimatedDurationMinutes must be a positive finite number.",
    );
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCompletionState(
  value: unknown,
): RomeoCompletionState {
  if (
    typeof value !== "string" ||
    !ROMEO_COMPLETION_STATES.includes(value as RomeoCompletionState)
  ) {
    throw new RomeoRuntimeError(
      "invalid_completion_state",
      "completionState must be not_started, in_progress, or completed.",
    );
  }
  return value as RomeoCompletionState;
}

function normalizeSourceMode(value: unknown): RomeoSourceMode {
  if (
    typeof value !== "string" ||
    !ROMEO_SOURCE_MODES.includes(value as RomeoSourceMode)
  ) {
    throw new RomeoRuntimeError(
      "invalid_source_mode",
      "sourceMode must be manual, approved-import, or browser-assisted-reference.",
    );
  }
  return value as RomeoSourceMode;
}

export function normalizeRomeoAssignment(
  input: RomeoAssignmentInput,
): RomeoAssignment {
  assertRecordValue(input, "Romeo assignment input");
  assertRomeoCredentialFree(input);
  assertSupportedSchemaVersion(input.schemaVersion);
  const externalAssignmentId = assertNonUriOpaqueReference(
    input.externalAssignmentId,
    "externalAssignmentId",
  );
  const hostLaunchRef = assertNonUriOpaqueReference(
    input.hostLaunchRef,
    "hostLaunchRef",
  );
  if (hostLaunchRef === externalAssignmentId) {
    throw new RomeoRuntimeError(
      "invalid_launch_reference",
      "hostLaunchRef must be distinct from externalAssignmentId.",
    );
  }
  const parentEnteredProgress =
    input.parentEnteredProgress === undefined
      ? undefined
      : normalizeProgress(
          input.parentEnteredProgress,
          "parentEnteredProgress",
        );
  const studentEnteredProgress =
    input.studentEnteredProgress === undefined
      ? undefined
      : normalizeProgress(
          input.studentEnteredProgress,
          "studentEnteredProgress",
        );
  const linkedManuelAcademyTutoring =
    input.linkedManuelAcademyTutoring === undefined
      ? undefined
      : normalizeTutoringLink(input.linkedManuelAcademyTutoring);
  const resumeNote =
    input.resumeNote === undefined
      ? undefined
      : normalizeText(input.resumeNote, "resumeNote", 500);
  const externalUrlReference =
    input.externalUrlReference === undefined
      ? undefined
      : normalizeExternalUrl(input.externalUrlReference);
  if (
    externalUrlReference !== undefined &&
    hostLaunchRef === externalUrlReference
  ) {
    throw new RomeoRuntimeError(
      "invalid_launch_reference",
      "hostLaunchRef must be distinct from externalUrlReference.",
    );
  }

  return {
    schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
    provider: "romeo_virtual_academy",
    externalAssignmentId,
    hostLaunchRef,
    title: normalizePublicText(input.title, "title", 200),
    course: normalizePublicText(input.course, "course", 120),
    dueDate: assertCalendarDate(input.dueDate),
    estimatedDurationMinutes: normalizeDuration(
      input.estimatedDurationMinutes,
    ),
    completionState: normalizeCompletionState(input.completionState),
    ...(parentEnteredProgress === undefined
      ? {}
      : { parentEnteredProgress }),
    ...(studentEnteredProgress === undefined
      ? {}
      : { studentEnteredProgress }),
    ...(linkedManuelAcademyTutoring === undefined
      ? {}
      : { linkedManuelAcademyTutoring }),
    ...(resumeNote === undefined ? {} : { resumeNote }),
    ...(externalUrlReference === undefined
      ? {}
      : { externalUrlReference }),
    lastCheckedAt: assertOffsetTimestamp(
      input.lastCheckedAt,
      "lastCheckedAt",
    ),
    sourceMode: normalizeSourceMode(input.sourceMode),
  };
}

function assignmentInputFrom(
  assignment: RomeoAssignment,
): RomeoAssignmentInput {
  return {
    schemaVersion: assignment.schemaVersion,
    externalAssignmentId: assignment.externalAssignmentId,
    hostLaunchRef: assignment.hostLaunchRef,
    title: assignment.title,
    course: assignment.course,
    dueDate: assignment.dueDate,
    estimatedDurationMinutes: assignment.estimatedDurationMinutes,
    completionState: assignment.completionState,
    ...(assignment.parentEnteredProgress === undefined
      ? {}
      : { parentEnteredProgress: assignment.parentEnteredProgress }),
    ...(assignment.studentEnteredProgress === undefined
      ? {}
      : { studentEnteredProgress: assignment.studentEnteredProgress }),
    ...(assignment.linkedManuelAcademyTutoring === undefined
      ? {}
      : {
          linkedManuelAcademyTutoring:
            assignment.linkedManuelAcademyTutoring,
        }),
    ...(assignment.resumeNote === undefined
      ? {}
      : { resumeNote: assignment.resumeNote }),
    ...(assignment.externalUrlReference === undefined
      ? {}
      : { externalUrlReference: assignment.externalUrlReference }),
    lastCheckedAt: assignment.lastCheckedAt,
    sourceMode: assignment.sourceMode,
  };
}

function normalizeExistingAssignment(
  assignment: RomeoAssignment,
): RomeoAssignment {
  assertRecordValue(assignment, "Romeo assignment");
  assertRomeoCredentialFree(assignment);
  if (
    assignment.schemaVersion !== ROMEO_ASSIGNMENT_SCHEMA_VERSION ||
    assignment.provider !== "romeo_virtual_academy"
  ) {
    throw new RomeoRuntimeError(
      "invalid_reference",
      "The supplied value is not a Romeo runtime assignment.",
    );
  }
  return normalizeRomeoAssignment(assignmentInputFrom(assignment));
}

function hasOwn(
  value: object,
  key: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Applies an explicit, credential-free metadata observation. Parent and
 * student progress remain separate fields. The external assignment ID cannot
 * be changed, and observation times cannot move backwards.
 */
export function updateRomeoAssignment(
  assignment: RomeoAssignment,
  update: RomeoAssignmentUpdate,
): RomeoAssignment {
  const current = normalizeExistingAssignment(assignment);
  assertRecordValue(update, "Romeo assignment update");
  assertRomeoCredentialFree(update);
  assertSupportedSchemaVersion(update.schemaVersion);
  if (
    update.externalAssignmentId !== undefined &&
    update.externalAssignmentId !== current.externalAssignmentId
  ) {
    throw new RomeoRuntimeError(
      "identity_conflict",
      "A Romeo assignment update cannot change externalAssignmentId.",
    );
  }
  const lastCheckedAt = assertOffsetTimestamp(
    update.lastCheckedAt,
    "lastCheckedAt",
  );
  if (Date.parse(lastCheckedAt) < Date.parse(current.lastCheckedAt)) {
    throw new RomeoRuntimeError(
      "stale_update",
      "A Romeo assignment update cannot move lastCheckedAt backwards.",
    );
  }

  const parentEnteredProgress = hasOwn(
    update,
    "parentEnteredProgress",
  )
    ? update.parentEnteredProgress ?? undefined
    : current.parentEnteredProgress;
  const studentEnteredProgress = hasOwn(
    update,
    "studentEnteredProgress",
  )
    ? update.studentEnteredProgress ?? undefined
    : current.studentEnteredProgress;
  const linkedManuelAcademyTutoring = hasOwn(
    update,
    "linkedManuelAcademyTutoring",
  )
    ? update.linkedManuelAcademyTutoring ?? undefined
    : current.linkedManuelAcademyTutoring;
  const resumeNote = hasOwn(update, "resumeNote")
    ? update.resumeNote ?? undefined
    : current.resumeNote;
  const externalUrlReference = hasOwn(
    update,
    "externalUrlReference",
  )
    ? update.externalUrlReference ?? undefined
    : current.externalUrlReference;

  const next = normalizeRomeoAssignment({
    schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
    externalAssignmentId: current.externalAssignmentId,
    hostLaunchRef:
      update.hostLaunchRef ?? current.hostLaunchRef,
    title: update.title ?? current.title,
    course: update.course ?? current.course,
    dueDate: update.dueDate ?? current.dueDate,
    estimatedDurationMinutes:
      update.estimatedDurationMinutes ??
      current.estimatedDurationMinutes,
    completionState:
      update.completionState ?? current.completionState,
    ...(parentEnteredProgress === undefined
      ? {}
      : { parentEnteredProgress }),
    ...(studentEnteredProgress === undefined
      ? {}
      : { studentEnteredProgress }),
    ...(linkedManuelAcademyTutoring === undefined
      ? {}
      : { linkedManuelAcademyTutoring }),
    ...(resumeNote === undefined ? {} : { resumeNote }),
    ...(externalUrlReference === undefined
      ? {}
      : { externalUrlReference }),
    lastCheckedAt,
    sourceMode: update.sourceMode ?? current.sourceMode,
  });

  const currentSerialized = JSON.stringify(current);
  const nextSerialized = JSON.stringify(next);
  if (
    lastCheckedAt === current.lastCheckedAt &&
    currentSerialized !== nextSerialized
  ) {
    throw new RomeoRuntimeError(
      "update_conflict",
      "The same lastCheckedAt cannot describe two different Romeo assignment observations.",
    );
  }
  return currentSerialized === nextSerialized ? assignment : next;
}

/**
 * Produces the allowlisted public/parent projection required by DEC-018.
 * `externalUrlReference` and the free-text `resumeNote` body remain strictly
 * adapter-side; callers receive only an opaque host launch indirection and a
 * boolean indicating whether resume context exists.
 */
export function projectRomeoAssignmentForPublic(
  assignment: RomeoAssignment,
): RomeoPublicAssignmentProjection {
  const normalized = normalizeExistingAssignment(assignment);
  return {
    schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
    provider: "romeo_virtual_academy",
    externalAssignmentId: normalized.externalAssignmentId,
    hostLaunchRef: normalized.hostLaunchRef,
    title: normalized.title,
    course: normalized.course,
    dueDate: normalized.dueDate,
    estimatedDurationMinutes:
      normalized.estimatedDurationMinutes,
    completionState: normalized.completionState,
    ...(normalized.parentEnteredProgress === undefined
      ? {}
      : {
          parentEnteredProgress:
            normalized.parentEnteredProgress,
        }),
    ...(normalized.studentEnteredProgress === undefined
      ? {}
      : {
          studentEnteredProgress:
            normalized.studentEnteredProgress,
        }),
    ...(normalized.linkedManuelAcademyTutoring === undefined
      ? {}
      : {
          linkedManuelAcademyTutoring:
            normalized.linkedManuelAcademyTutoring,
        }),
    lastCheckedAt: normalized.lastCheckedAt,
    sourceMode: normalized.sourceMode,
    resumeNoteAvailable: normalized.resumeNote !== undefined,
  };
}

/**
 * Creates the calendar value for one external assignment. Assignment details
 * that do not belong in the canonical calendar contract (due date, URL,
 * progress reports, link, and resume note) remain on RomeoAssignment.
 */
export function romeoAssignmentToCalendarBlock(
  assignment: RomeoAssignment,
  schedule: RomeoCalendarSchedule,
): CalendarBlock {
  const normalized = normalizeExistingAssignment(assignment);
  assertRecordValue(schedule, "Romeo calendar schedule");
  assertRomeoCredentialFree(schedule);
  return createCalendarBlock({
    internalBlockId: schedule.internalBlockId,
    learnerRef: schedule.learnerRef,
    sourceIdentity: {
      source: "romeo_virtual_academy",
      externalItemId: normalized.externalAssignmentId,
    },
    title: normalized.title,
    subject: normalized.course,
    blockType: "romeo_virtual_academy_activity",
    householdTimeZone: schedule.householdTimeZone,
    scheduledLocalStart: schedule.scheduledLocalStart,
    ...(schedule.scheduledStart === undefined
      ? {}
      : { scheduledStart: schedule.scheduledStart }),
    ...(schedule.intendedLocalDate === undefined
      ? {}
      : { intendedLocalDate: schedule.intendedLocalDate }),
    ...(schedule.localTimeDisambiguation === undefined
      ? {}
      : {
          localTimeDisambiguation:
            schedule.localTimeDisambiguation,
        }),
    createdAt: schedule.createdAt,
    ...(schedule.timerVisibility === undefined
      ? {}
      : { timerVisibility: schedule.timerVisibility }),
    segments: [
      {
        segmentId: "romeo-assignment-work",
        title: "Romeo assignment work",
        estimatedMinutes: normalized.estimatedDurationMinutes,
        required: schedule.required ?? true,
      },
    ],
  });
}

function matchingRootProjection(
  blocks: readonly CalendarBlock[],
  learnerRef: string,
  externalAssignmentId: string,
): CalendarBlock | undefined {
  return blocks.find(
    (block) =>
      block.learnerRef === learnerRef &&
      block.sourceIdentity.source === "romeo_virtual_academy" &&
      block.sourceIdentity.externalItemId === externalAssignmentId &&
      block.lineage.continuationKey === "root",
  );
}

/**
 * Inserts one root calendar block per learner plus stable Romeo assignment ID.
 * A retry returns the first accepted block unchanged, preserving its local ID,
 * local edits, progress, and rescheduling state.
 */
export function projectRomeoAssignmentToCalendar(
  assignment: RomeoAssignment,
  schedule: RomeoCalendarSchedule,
  existingBlocks: readonly CalendarBlock[] = [],
): RomeoCalendarProjection {
  const normalized = normalizeExistingAssignment(assignment);
  assertRecordValue(schedule, "Romeo calendar schedule");
  assertRomeoCredentialFree(schedule);
  const canonicalExisting = mergeCalendarBlocks([], existingBlocks);
  const candidate = romeoAssignmentToCalendarBlock(
    normalized,
    schedule,
  );
  const existing = matchingRootProjection(
    canonicalExisting,
    schedule.learnerRef,
    normalized.externalAssignmentId,
  );
  if (existing) {
    // Validate the retry's local ID against every existing logical identity,
    // while deliberately discarding any refreshed candidate value so a
    // metadata replay cannot overwrite local edits or progress.
    mergeCalendarBlocks(canonicalExisting, [candidate]);
    return {
      blocks: canonicalExisting,
      block: existing,
      hostLaunchRef: normalized.hostLaunchRef,
      action: "idempotent",
      created: false,
    };
  }

  const blocks = mergeCalendarBlocks(canonicalExisting, [candidate]);
  const inserted = matchingRootProjection(
    blocks,
    schedule.learnerRef,
    normalized.externalAssignmentId,
  );
  if (!inserted) {
    throw new RomeoRuntimeError(
      "identity_conflict",
      "The calendar projection could not preserve the Romeo assignment identity.",
    );
  }
  return {
    blocks,
    block: inserted,
    hostLaunchRef: normalized.hostLaunchRef,
    action: "created",
    created: true,
  };
}
