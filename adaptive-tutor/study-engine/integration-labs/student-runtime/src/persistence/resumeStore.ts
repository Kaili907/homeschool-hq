import {
  RESUME_ENVELOPE_VERSION,
  STUDENT_RUNTIME_VERSION,
  type ResumeEnvelopeV1,
  type ResumeSummary,
  type RuntimeSubjectId,
  type RuntimeWorkspaceV1,
} from "../runtimeTypes";

export const RESUME_STORAGE_PREFIX =
  "manuel-academy:student-runtime:resume:v2:" as const;
export const RESUME_QUARANTINE_PREFIX =
  "manuel-academy:student-runtime:resume-quarantine:v2:" as const;

const RESUME_QUARANTINE_VERSION =
  "student-runtime.resume-quarantine.v2" as const;
const RESUME_LOCK_NAME = "manuel-academy:student-runtime:resume-store:v2";
const LEGACY_RESUME_STORAGE_PREFIXES = [
  "manuel-academy:student-runtime:resume:v1:",
] as const;
const LEGACY_RESUME_QUARANTINE_PREFIXES = [
  "manuel-academy:student-runtime:resume-quarantine:v1:",
] as const;
const SHA_256_PREFIX = "sha256:";
const SHA_256_HEX_PATTERN = /^sha256:[0-9a-f]{64}$/;

export type ResumeQuarantineReason =
  | "unsupported-version"
  | "invalid-integrity"
  | "invalid-history"
  | "stale-revision"
  | "session-mismatch";

export type ResumeStoreErrorCode =
  | "storage-unavailable"
  | "storage-failure"
  | "crypto-unavailable"
  | "serialization-failed"
  | "invalid-workspace"
  | "invalid-revision"
  | "invalid-integrity"
  | "invalid-history"
  | "stale-revision"
  | "revision-conflict"
  | "session-mismatch"
  | "unsupported-version";

const ERROR_MESSAGES: Readonly<Record<ResumeStoreErrorCode, string>> = {
  "storage-unavailable": "Local resume storage is unavailable.",
  "storage-failure": "The local resume operation could not be completed.",
  "crypto-unavailable": "Resume integrity verification is unavailable.",
  "serialization-failed": "The study session could not be serialized safely.",
  "invalid-workspace": "The study session is not valid for local resume.",
  "invalid-revision": "The study session revision is invalid.",
  "invalid-integrity": "The saved study session could not be verified.",
  "invalid-history": "The saved study session history could not be verified.",
  "stale-revision": "This resume request is stale.",
  "revision-conflict": "A different save already exists at this revision.",
  "session-mismatch":
    "The saved study session does not match the requested session.",
  "unsupported-version":
    "The saved study session uses an unsupported version.",
};

/**
 * All messages are fixed. Deliberately do not attach a cause or offending value:
 * errors can be shown or logged without echoing a learner's entered work.
 */
export class ResumeStoreError extends Error {
  readonly code: ResumeStoreErrorCode;

  constructor(code: ResumeStoreErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "ResumeStoreError";
    this.code = code;
  }
}

export interface ResumeStorage {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export interface ResumeLocator {
  readonly subjectId: RuntimeSubjectId;
  readonly sessionId: string;
}

export interface ResumeLoadRequest extends ResumeLocator {
  /**
   * A resume token supplies this value. Exact matching prevents an old tab or
   * browser history entry from reviving an earlier workspace revision.
   */
  readonly expectedRevision?: number;
}

export interface ResumeIntegrityContext extends ResumeLocator {
  readonly revision: number;
  readonly savedAt: string;
}

/**
 * The SHA-256 digest catches accidental or unsophisticated payload edits.
 * This caller-supplied validator is the authority for canonical event-history
 * invariants (sequence, IDs, legal transitions, and completion evidence).
 */
export type ResumeIntegrityValidator = (
  workspace: RuntimeWorkspaceV1,
  context: ResumeIntegrityContext,
) => boolean | Promise<boolean>;

export interface ResumeStoreOptions {
  readonly storage?: ResumeStorage;
  readonly validateIntegrity: ResumeIntegrityValidator;
  readonly now?: () => string;
}

export interface ResumeSaveResult {
  readonly status: "saved" | "unchanged";
  readonly envelope: ResumeEnvelopeV1;
  readonly summary: ResumeSummary;
}

export interface ResumeLoadedResult {
  readonly status: "loaded";
  readonly envelope: ResumeEnvelopeV1;
  readonly workspace: RuntimeWorkspaceV1;
  readonly summary: ResumeSummary;
}

export interface ResumeMissingResult {
  readonly status: "missing";
}

export interface ResumeRejectedResult {
  readonly status: "rejected";
  readonly reason: Exclude<ResumeQuarantineReason, "unsupported-version">;
  readonly quarantined: boolean;
  readonly error: ResumeStoreError;
}

export interface ResumeQuarantinedResult {
  readonly status: "quarantined";
  readonly reason: "unsupported-version";
  readonly quarantined: true;
  readonly error: ResumeStoreError;
}

export type ResumeLoadResult =
  | ResumeLoadedResult
  | ResumeMissingResult
  | ResumeRejectedResult
  | ResumeQuarantinedResult;

export interface ResumeQuarantineSummary extends ResumeLocator {
  readonly reason: Exclude<ResumeQuarantineReason, "stale-revision">;
  readonly quarantinedAt: string;
}

export interface ResumeStore {
  save(workspace: RuntimeWorkspaceV1): Promise<ResumeSaveResult>;
  load(request: ResumeLoadRequest): Promise<ResumeLoadResult>;
  list(): Promise<readonly ResumeSummary[]>;
  listQuarantined(): Promise<readonly ResumeQuarantineSummary[]>;
  /**
   * With a locator, clears that active save and its quarantine record.
   * Without one, clears only this resume store's active/quarantine namespaces.
   */
  clear(locator?: ResumeLocator): Promise<number>;
}

interface StoredQuarantineRecord {
  readonly version: typeof RESUME_QUARANTINE_VERSION;
  readonly subjectId: RuntimeSubjectId;
  readonly sessionId: string;
  readonly reason: Exclude<ResumeQuarantineReason, "stale-revision">;
  readonly quarantinedAt: string;
  /** Kept device-local and intentionally never returned by the public API. */
  readonly rawEnvelope: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function serializationError(): never {
  throw new ResumeStoreError("serialization-failed");
}

/**
 * Deterministic JSON serialization: object keys are lexical, arrays retain
 * order, and non-JSON values follow JSON's object/array omission rules.
 * Cycles, bigint values, and non-plain objects are rejected.
 */
export function canonicalSerialize(value: unknown): string {
  const ancestors = new Set<object>();

  const visit = (current: unknown, arrayPosition = false): string | undefined => {
    if (current === null) return "null";

    switch (typeof current) {
      case "string":
        return JSON.stringify(current);
      case "boolean":
        return current ? "true" : "false";
      case "number":
        if (!Number.isFinite(current)) return "null";
        return JSON.stringify(current);
      case "undefined":
      case "function":
      case "symbol":
        return arrayPosition ? "null" : undefined;
      case "bigint":
        return serializationError();
      case "object":
        break;
      default:
        return serializationError();
    }

    const objectValue = current as object;
    if (ancestors.has(objectValue)) return serializationError();
    ancestors.add(objectValue);

    try {
      if (Array.isArray(current)) {
        const entries = current.map(
          (entry) => visit(entry, true) ?? "null",
        );
        return `[${entries.join(",")}]`;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        return serializationError();
      }

      const record = current as JsonRecord;
      const entries: string[] = [];
      for (const key of Object.keys(record).sort()) {
        const serialized = visit(record[key]);
        if (serialized !== undefined) {
          entries.push(`${JSON.stringify(key)}:${serialized}`);
        }
      }
      return `{${entries.join(",")}}`;
    } finally {
      ancestors.delete(objectValue);
    }
  };

  const serialized = visit(value);
  if (serialized === undefined) return serializationError();
  return serialized;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function snapshotWorkspace(workspace: RuntimeWorkspaceV1): RuntimeWorkspaceV1 {
  const parsed = safeJsonParse(canonicalSerialize(workspace));
  if (!isRuntimeWorkspaceShape(parsed)) {
    throw new ResumeStoreError("invalid-workspace");
  }
  return parsed;
}

function isRuntimeWorkspaceShape(value: unknown): value is RuntimeWorkspaceV1 {
  if (!isRecord(value)) return false;
  if (value.version !== STUDENT_RUNTIME_VERSION) return false;
  if (!isNonEmptyString(value.subjectId)) return false;
  if (!isRevision(value.resumeRevision)) return false;
  if (!isTimestamp(value.lastSavedAt)) return false;
  if (!isNonEmptyString(value.screen)) return false;
  if (!isNonEmptyString(value.currentSegment)) return false;
  if (!Array.isArray(value.completedSegments)) return false;
  if (!Array.isArray(value.idempotencyRecords)) return false;
  if (!Array.isArray(value.tutorCoreReceipts)) return false;
  if (!isRecord(value.responses)) return false;
  if (!isRecord(value.feedbackReceiptRefs)) return false;
  if (!isRecord(value.durationPolicy)) return false;
  if (
    value.durationPolicy.precedenceVersion !==
      "card5.resolve-duration-policy.v1"
  ) {
    return false;
  }
  if (!isRecord(value.canonicalSession)) return false;
  if (!isNonEmptyString(value.canonicalSession.id)) return false;
  if (!Array.isArray(value.canonicalSession.eventLog)) return false;
  return true;
}

function isEnvelopeShape(value: unknown): value is ResumeEnvelopeV1 {
  return (
    isRecord(value) &&
    value.version === RESUME_ENVELOPE_VERSION &&
    isNonEmptyString(value.subjectId) &&
    isNonEmptyString(value.sessionId) &&
    isRevision(value.revision) &&
    isTimestamp(value.savedAt) &&
    typeof value.integrity === "string" &&
    isRuntimeWorkspaceShape(value.payload)
  );
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value);
}

function decodeKeyPart(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export function getResumeStorageKey(locator: ResumeLocator): string {
  return `${RESUME_STORAGE_PREFIX}${encodeKeyPart(
    String(locator.subjectId),
  )}:${encodeKeyPart(locator.sessionId)}`;
}

export function getResumeQuarantineStorageKey(locator: ResumeLocator): string {
  return `${RESUME_QUARANTINE_PREFIX}${encodeKeyPart(
    String(locator.subjectId),
  )}:${encodeKeyPart(locator.sessionId)}`;
}

function locatorFromStorageKey(key: string): ResumeLocator | undefined {
  return locatorFromPrefixedKey(key, RESUME_STORAGE_PREFIX);
}

function locatorFromPrefixedKey(
  key: string,
  prefix: string,
): ResumeLocator | undefined {
  if (!key.startsWith(prefix)) return undefined;
  const suffix = key.slice(prefix.length);
  const separator = suffix.indexOf(":");
  if (separator < 1) return undefined;
  const subjectId = decodeKeyPart(suffix.slice(0, separator));
  const sessionId = decodeKeyPart(suffix.slice(separator + 1));
  if (!subjectId || !sessionId) return undefined;
  return {
    subjectId: subjectId as RuntimeSubjectId,
    sessionId,
  };
}

function legacyResumeStorageKey(
  prefix: (typeof LEGACY_RESUME_STORAGE_PREFIXES)[number],
  locator: ResumeLocator,
): string {
  return `${prefix}${encodeKeyPart(String(locator.subjectId))}:${encodeKeyPart(
    locator.sessionId,
  )}`;
}

function locatorFromQuarantineKey(key: string): ResumeLocator | undefined {
  if (!key.startsWith(RESUME_QUARANTINE_PREFIX)) return undefined;
  const suffix = key.slice(RESUME_QUARANTINE_PREFIX.length);
  const separator = suffix.indexOf(":");
  if (separator < 1) return undefined;
  const subjectId = decodeKeyPart(suffix.slice(0, separator));
  const sessionId = decodeKeyPart(suffix.slice(separator + 1));
  if (!subjectId || !sessionId) return undefined;
  return {
    subjectId: subjectId as RuntimeSubjectId,
    sessionId,
  };
}

function defaultStorage(): ResumeStorage {
  if (typeof window === "undefined") {
    throw new ResumeStoreError("storage-unavailable");
  }
  try {
    return window.localStorage;
  } catch {
    throw new ResumeStoreError("storage-unavailable");
  }
}

function storageGet(storage: ResumeStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    throw new ResumeStoreError("storage-failure");
  }
}

function storageSet(storage: ResumeStorage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    throw new ResumeStoreError("storage-failure");
  }
}

function storageRemove(storage: ResumeStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    throw new ResumeStoreError("storage-failure");
  }
}

function storageKeys(storage: ResumeStorage): string[] {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null) keys.push(key);
    }
    return keys;
  } catch {
    throw new ResumeStoreError("storage-failure");
  }
}

async function sha256(value: string): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new ResumeStoreError("crypto-unavailable");
  }

  let digest: ArrayBuffer;
  try {
    digest = await cryptoApi.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
  } catch {
    throw new ResumeStoreError("crypto-unavailable");
  }

  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${SHA_256_PREFIX}${hex}`;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (
    !SHA_256_HEX_PATTERN.test(left) ||
    !SHA_256_HEX_PATTERN.test(right) ||
    left.length !== right.length
  ) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function signableEnvelope(
  envelope: ResumeEnvelopeV1,
): Omit<ResumeEnvelopeV1, "integrity"> {
  return {
    version: envelope.version,
    subjectId: envelope.subjectId,
    sessionId: envelope.sessionId,
    revision: envelope.revision,
    savedAt: envelope.savedAt,
    payload: envelope.payload,
  };
}

async function envelopeIntegrity(
  envelope: Omit<ResumeEnvelopeV1, "integrity">,
): Promise<string> {
  return sha256(canonicalSerialize(envelope));
}

function envelopeSummary(envelope: ResumeEnvelopeV1): ResumeSummary {
  return {
    subjectId: envelope.subjectId,
    sessionId: envelope.sessionId,
    screen: envelope.payload.screen,
    currentSegment: envelope.payload.currentSegment,
    completedSegmentCount: envelope.payload.completedSegments.length,
    savedAt: envelope.savedAt,
    revision: envelope.revision,
  };
}

function envelopeBindingIsValid(
  envelope: ResumeEnvelopeV1,
  locator: ResumeLocator,
): boolean {
  return (
    envelope.subjectId === locator.subjectId &&
    envelope.sessionId === locator.sessionId &&
    envelope.payload.subjectId === envelope.subjectId &&
    envelope.payload.canonicalSession.id === envelope.sessionId &&
    envelope.payload.resumeRevision === envelope.revision &&
    envelope.payload.lastSavedAt === envelope.savedAt
  );
}

function validNow(now: () => string): string {
  let value: string;
  try {
    value = now();
  } catch {
    throw new ResumeStoreError("storage-failure");
  }
  if (!isTimestamp(value)) {
    throw new ResumeStoreError("storage-failure");
  }
  return value;
}

let fallbackLockTail: Promise<void> = Promise.resolve();

async function withFallbackLock<T>(operation: () => Promise<T>): Promise<T> {
  const predecessor = fallbackLockTail;
  let release!: () => void;
  fallbackLockTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await predecessor;
  try {
    return await operation();
  } finally {
    release();
  }
}

interface LockManagerLike {
  request<T>(
    name: string,
    options: { readonly mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T>;
}

function browserLockManager(): LockManagerLike | undefined {
  const candidate = (
    globalThis as typeof globalThis & {
      navigator?: { readonly locks?: LockManagerLike };
    }
  ).navigator?.locks;
  return candidate && typeof candidate.request === "function"
    ? candidate
    : undefined;
}

async function withResumeLock<T>(operation: () => Promise<T>): Promise<T> {
  const locks = browserLockManager();
  if (locks) {
    return locks.request(RESUME_LOCK_NAME, { mode: "exclusive" }, operation);
  }
  return withFallbackLock(operation);
}

export function createResumeStore(options: ResumeStoreOptions): ResumeStore {
  const storage = options.storage ?? defaultStorage();
  const now = options.now ?? (() => new Date().toISOString());
  const validateIntegrity = options.validateIntegrity;

  const validateHistory = async (
    envelope: ResumeEnvelopeV1,
  ): Promise<boolean> => {
    try {
      return (
        (await validateIntegrity(envelope.payload, {
          subjectId: envelope.subjectId,
          sessionId: envelope.sessionId,
          revision: envelope.revision,
          savedAt: envelope.savedAt,
        })) === true
      );
    } catch {
      return false;
    }
  };

  const quarantine = (
    locator: ResumeLocator,
    rawEnvelope: string,
    reason: Exclude<ResumeQuarantineReason, "stale-revision">,
    sourceKey = getResumeStorageKey(locator),
  ): void => {
    const record: StoredQuarantineRecord = {
      version: RESUME_QUARANTINE_VERSION,
      subjectId: locator.subjectId,
      sessionId: locator.sessionId,
      reason,
      quarantinedAt: validNow(now),
      rawEnvelope,
    };
    storageSet(
      storage,
      getResumeQuarantineStorageKey(locator),
      canonicalSerialize(record),
    );
    storageRemove(storage, sourceKey);
  };

  const rejected = (
    reason: Exclude<ResumeQuarantineReason, "unsupported-version">,
    quarantined: boolean,
  ): ResumeRejectedResult => ({
    status: "rejected",
    reason,
    quarantined,
    error: new ResumeStoreError(reason),
  });

  const loadRaw = async (
    raw: string,
    request: ResumeLoadRequest,
  ): Promise<Exclude<ResumeLoadResult, ResumeMissingResult>> => {
    const candidate = safeJsonParse(raw);

    if (
      isRecord(candidate) &&
      candidate.version !== RESUME_ENVELOPE_VERSION
    ) {
      quarantine(request, raw, "unsupported-version");
      return {
        status: "quarantined",
        reason: "unsupported-version",
        quarantined: true,
        error: new ResumeStoreError("unsupported-version"),
      };
    }

    if (!isEnvelopeShape(candidate)) {
      quarantine(request, raw, "invalid-integrity");
      return rejected("invalid-integrity", true);
    }

    if (!envelopeBindingIsValid(candidate, request)) {
      quarantine(request, raw, "session-mismatch");
      return rejected("session-mismatch", true);
    }

    const expectedIntegrity = await envelopeIntegrity(
      signableEnvelope(candidate),
    );
    if (!constantTimeEqual(candidate.integrity, expectedIntegrity)) {
      quarantine(request, raw, "invalid-integrity");
      return rejected("invalid-integrity", true);
    }

    if (!(await validateHistory(candidate))) {
      quarantine(request, raw, "invalid-history");
      return rejected("invalid-history", true);
    }

    if (
      request.expectedRevision !== undefined &&
      (!isRevision(request.expectedRevision) ||
        request.expectedRevision !== candidate.revision)
    ) {
      return rejected("stale-revision", false);
    }

    return {
      status: "loaded",
      envelope: candidate,
      workspace: candidate.payload,
      summary: envelopeSummary(candidate),
    };
  };

  const loadUnlocked = async (
    request: ResumeLoadRequest,
  ): Promise<ResumeLoadResult> => {
    if (
      !isNonEmptyString(request.subjectId) ||
      !isNonEmptyString(request.sessionId)
    ) {
      return rejected("session-mismatch", false);
    }
    if (
      request.expectedRevision !== undefined &&
      !isRevision(request.expectedRevision)
    ) {
      return rejected("stale-revision", false);
    }

    const raw = storageGet(storage, getResumeStorageKey(request));
    if (raw === null) {
      for (const prefix of LEGACY_RESUME_STORAGE_PREFIXES) {
        const legacyKey = legacyResumeStorageKey(prefix, request);
        const legacyRaw = storageGet(storage, legacyKey);
        if (legacyRaw === null) continue;
        quarantine(request, legacyRaw, "unsupported-version", legacyKey);
        return {
          status: "quarantined",
          reason: "unsupported-version",
          quarantined: true,
          error: new ResumeStoreError("unsupported-version"),
        };
      }
      return { status: "missing" };
    }
    return loadRaw(raw, request);
  };

  const save = async (
    workspace: RuntimeWorkspaceV1,
  ): Promise<ResumeSaveResult> =>
    withResumeLock(async () => {
      const snapshot = snapshotWorkspace(workspace);
      const sessionId = snapshot.canonicalSession.id;
      const locator: ResumeLocator = {
        subjectId: snapshot.subjectId,
        sessionId,
      };

      if (!isRevision(snapshot.resumeRevision)) {
        throw new ResumeStoreError("invalid-revision");
      }

      const unsigned: Omit<ResumeEnvelopeV1, "integrity"> = {
        version: RESUME_ENVELOPE_VERSION,
        subjectId: snapshot.subjectId,
        sessionId,
        revision: snapshot.resumeRevision,
        savedAt: snapshot.lastSavedAt,
        payload: snapshot,
      };
      const envelope: ResumeEnvelopeV1 = {
        ...unsigned,
        integrity: await envelopeIntegrity(unsigned),
      };

      if (!(await validateHistory(envelope))) {
        throw new ResumeStoreError("invalid-history");
      }

      const key = getResumeStorageKey(locator);
      const existingRaw = storageGet(storage, key);
      if (existingRaw !== null) {
        const existing = await loadRaw(existingRaw, locator);
        if (existing.status !== "loaded") {
          throw existing.error;
        }
        if (existing.envelope.revision > envelope.revision) {
          throw new ResumeStoreError("stale-revision");
        }
        if (existing.envelope.revision === envelope.revision) {
          if (
            constantTimeEqual(
              existing.envelope.integrity,
              envelope.integrity,
            )
          ) {
            return {
              status: "unchanged",
              envelope: existing.envelope,
              summary: existing.summary,
            };
          }
          throw new ResumeStoreError("revision-conflict");
        }
      }

      storageSet(storage, key, canonicalSerialize(envelope));
      return {
        status: "saved",
        envelope,
        summary: envelopeSummary(envelope),
      };
    });

  const load = async (
    request: ResumeLoadRequest,
  ): Promise<ResumeLoadResult> =>
    withResumeLock(() => loadUnlocked(request));

  const list = async (): Promise<readonly ResumeSummary[]> =>
    withResumeLock(async () => {
      const summaries: ResumeSummary[] = [];
      for (const key of storageKeys(storage)) {
        for (const prefix of LEGACY_RESUME_STORAGE_PREFIXES) {
          const locator = locatorFromPrefixedKey(key, prefix);
          if (!locator) continue;
          const raw = storageGet(storage, key);
          if (raw !== null) {
            quarantine(locator, raw, "unsupported-version", key);
          }
        }
      }
      const keys = storageKeys(storage).filter((key) =>
        key.startsWith(RESUME_STORAGE_PREFIX),
      );
      for (const key of keys) {
        const locator = locatorFromStorageKey(key);
        if (!locator) continue;
        const result = await loadUnlocked(locator);
        if (result.status === "loaded") summaries.push(result.summary);
      }
      summaries.sort(
        (left, right) =>
          right.savedAt.localeCompare(left.savedAt) ||
          String(left.subjectId).localeCompare(String(right.subjectId)) ||
          left.sessionId.localeCompare(right.sessionId),
      );
      return summaries;
    });

  const listQuarantined = async (): Promise<
    readonly ResumeQuarantineSummary[]
  > =>
    withResumeLock(async () => {
      const summaries: ResumeQuarantineSummary[] = [];
      for (const key of storageKeys(storage)) {
        const locator = locatorFromQuarantineKey(key);
        if (!locator) continue;
        const raw = storageGet(storage, key);
        if (raw === null) continue;
        const candidate = safeJsonParse(raw);
        if (
          !isRecord(candidate) ||
          candidate.version !== RESUME_QUARANTINE_VERSION ||
          candidate.subjectId !== locator.subjectId ||
          candidate.sessionId !== locator.sessionId ||
          !isTimestamp(candidate.quarantinedAt) ||
          !isNonEmptyString(candidate.reason) ||
          candidate.reason === "stale-revision" ||
          ![
            "unsupported-version",
            "invalid-integrity",
            "invalid-history",
            "session-mismatch",
          ].includes(candidate.reason)
        ) {
          continue;
        }
        summaries.push({
          subjectId: locator.subjectId,
          sessionId: locator.sessionId,
          reason: candidate.reason as ResumeQuarantineSummary["reason"],
          quarantinedAt: candidate.quarantinedAt,
        });
      }
      summaries.sort(
        (left, right) =>
          right.quarantinedAt.localeCompare(left.quarantinedAt) ||
          String(left.subjectId).localeCompare(String(right.subjectId)) ||
          left.sessionId.localeCompare(right.sessionId),
      );
      return summaries;
    });

  const clear = async (locator?: ResumeLocator): Promise<number> =>
    withResumeLock(async () => {
      const keys = locator
        ? [
            getResumeStorageKey(locator),
            getResumeQuarantineStorageKey(locator),
            ...LEGACY_RESUME_STORAGE_PREFIXES.map((prefix) =>
              legacyResumeStorageKey(prefix, locator),
            ),
            ...LEGACY_RESUME_QUARANTINE_PREFIXES.map(
              (prefix) =>
                `${prefix}${encodeKeyPart(
                  String(locator.subjectId),
                )}:${encodeKeyPart(locator.sessionId)}`,
            ),
          ]
        : storageKeys(storage).filter(
            (key) =>
              key.startsWith(RESUME_STORAGE_PREFIX) ||
              key.startsWith(RESUME_QUARANTINE_PREFIX) ||
              LEGACY_RESUME_STORAGE_PREFIXES.some((prefix) =>
                key.startsWith(prefix),
              ) ||
              LEGACY_RESUME_QUARANTINE_PREFIXES.some((prefix) =>
                key.startsWith(prefix),
              ),
          );

      let removed = 0;
      for (const key of keys) {
        if (storageGet(storage, key) !== null) {
          storageRemove(storage, key);
          removed += 1;
        }
      }
      return removed;
    });

  return {
    save,
    load,
    list,
    listQuarantined,
    clear,
  };
}
