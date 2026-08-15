import { Type, type Static } from "../../schema/typebox.js";
import {
  AssistanceLevelSchema,
  HintLevelSchema,
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
} from "../../v2/contracts/primitives.js";
import { validateExact } from "../../v2/contracts/validation.js";

export const MAXIMUM_INSTRUCTIONAL_MEMORY_ENTRIES = 24;
export const MAXIMUM_MEMORY_CONCEPT_REFERENCES = 8;
export const MAXIMUM_REVIEWED_CONTENT_REFERENCES = 12;
export const MAXIMUM_RECENT_ACTION_REASON_CODES = 8;
export const DEFAULT_INSTRUCTIONAL_MEMORY_TTL_MS = 30 * 60 * 1000;
export const MAXIMUM_INSTRUCTIONAL_MEMORY_TTL_MS = 4 * 60 * 60 * 1000;

export const InstructionalMemoryScopeSchema = Type.Object(
  {
    scopeKind: Type.Literal("trusted-study-instructional-memory-scope"),
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    contextRef: OpaqueReferenceSchema,
    opportunityRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV3InstructionalMemoryScope" },
);
export type InstructionalMemoryScope = Static<typeof InstructionalMemoryScopeSchema>;

export const StudyApprovedInstructionalStateSchema = Type.Object(
  {
    approvalKind: Type.Literal("study-approved-instructional-state"),
    stateRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV3StudyApprovedInstructionalState" },
);
export type StudyApprovedInstructionalState = Static<
  typeof StudyApprovedInstructionalStateSchema
>;

const NullableAssistanceLevelSchema = Type.Union([AssistanceLevelSchema, Type.Null()]);
const NullableStudyApprovedStateSchema = Type.Union([
  StudyApprovedInstructionalStateSchema,
  Type.Null(),
]);

export const InstructionalMemoryContentSchema = Type.Object(
  {
    conceptRefs: Type.Array(OpaqueReferenceSchema, {
      maxItems: MAXIMUM_MEMORY_CONCEPT_REFERENCES,
    }),
    lastAssistanceLevel: NullableAssistanceLevelSchema,
    lastHintLevel: HintLevelSchema,
    reviewedContentRefs: Type.Array(OpaqueReferenceSchema, {
      maxItems: MAXIMUM_REVIEWED_CONTENT_REFERENCES,
    }),
    studyApprovedState: NullableStudyApprovedStateSchema,
    recentActionReasonCodes: Type.Array(PolicyCodeSchema, {
      maxItems: MAXIMUM_RECENT_ACTION_REASON_CODES,
    }),
  },
  { additionalProperties: false, $id: "TutorV3InstructionalMemoryContent" },
);
export type InstructionalMemoryContent = Static<typeof InstructionalMemoryContentSchema>;

export const InstructionalMemoryEntrySchema = Type.Object(
  {
    memoryKind: Type.Literal("bounded-ephemeral-instructional-memory"),
    memoryRef: OpaqueReferenceSchema,
    scope: InstructionalMemoryScopeSchema,
    instructionalState: InstructionalMemoryContentSchema,
    createdAt: ISODateTimeSchema,
    updatedAt: ISODateTimeSchema,
    expiresAt: ISODateTimeSchema,
    expiresAtOpportunityEnd: Type.Literal(true),
    persistenceAllowed: Type.Literal(false),
    officialMasteryAuthority: Type.Literal(false),
    studyMutationAllowed: Type.Literal(false),
    gradeMutationAllowed: Type.Literal(false),
    workingLevelMutationAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV3InstructionalMemoryEntry" },
);
export type InstructionalMemoryEntry = Static<typeof InstructionalMemoryEntrySchema>;

const RememberInstructionalMemoryRequestSchema = Type.Object(
  {
    memoryRef: OpaqueReferenceSchema,
    scope: InstructionalMemoryScopeSchema,
    instructionalState: InstructionalMemoryContentSchema,
    ttlMs: Type.Optional(
      Type.Integer({ minimum: 1, maximum: MAXIMUM_INSTRUCTIONAL_MEMORY_TTL_MS }),
    ),
  },
  { additionalProperties: false },
);

const ScopedInstructionalMemoryRequestSchema = Type.Object(
  {
    memoryRef: OpaqueReferenceSchema,
    scope: InstructionalMemoryScopeSchema,
  },
  { additionalProperties: false },
);

export const MinimizedInstructionalMemorySnapshotSchema = Type.Object(
  {
    snapshotKind: Type.Literal("minimized-ephemeral-instructional-memory"),
    scope: InstructionalMemoryScopeSchema,
    instructionalState: InstructionalMemoryContentSchema,
    capturedAt: ISODateTimeSchema,
    persistenceAllowed: Type.Literal(false),
    officialMasteryAuthority: Type.Literal(false),
    studyMutationAllowed: Type.Literal(false),
    gradeMutationAllowed: Type.Literal(false),
    workingLevelMutationAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV3MinimizedInstructionalMemorySnapshot" },
);
export type MinimizedInstructionalMemorySnapshot = Static<
  typeof MinimizedInstructionalMemorySnapshotSchema
>;

export type InstructionalMemoryFailureCode =
  | "INVALID_MEMORY_REQUEST"
  | "INVALID_MEMORY_STATE"
  | "MEMORY_NOT_FOUND"
  | "MEMORY_SCOPE_MISMATCH"
  | "MEMORY_EXPIRED";

export interface InstructionalMemoryRejectedResult {
  readonly status: "rejected";
  readonly code: InstructionalMemoryFailureCode;
  readonly tutorMayUseMemory: false;
}

export type RememberInstructionalMemoryResult =
  | {
      readonly status: "accepted";
      readonly state: InstructionalMemoryEntry;
      readonly evictionOccurred: boolean;
    }
  | InstructionalMemoryRejectedResult;

export type ReadInstructionalMemoryResult =
  | { readonly status: "accepted"; readonly state: InstructionalMemoryEntry }
  | InstructionalMemoryRejectedResult;

export type SnapshotInstructionalMemoryResult =
  | { readonly status: "snapshotted"; readonly snapshot: MinimizedInstructionalMemorySnapshot }
  | InstructionalMemoryRejectedResult;

export type ClearInstructionalMemoryResult =
  | { readonly status: "cleared" }
  | InstructionalMemoryRejectedResult;

export interface InstructionalMemoryScopeResetResult {
  readonly status: "reset";
  readonly removedCount: number;
}

export interface InstructionalMemoryOpportunityExpiredResult {
  readonly status: "opportunity-expired";
  readonly removedCount: number;
}

export interface BoundedInstructionalMemoryStoreOptions {
  readonly now?: () => number;
  readonly maximumEntries?: number;
  readonly defaultTtlMs?: number;
}

interface StoredEntry {
  readonly state: InstructionalMemoryEntry;
  readonly writeSequence: number;
}

function rejected(code: InstructionalMemoryFailureCode): InstructionalMemoryRejectedResult {
  return { status: "rejected", code, tutorMayUseMemory: false };
}

function scopesMatch(left: InstructionalMemoryScope, right: InstructionalMemoryScope): boolean {
  return (
    left.scopeKind === right.scopeKind &&
    left.learnerScopeRef === right.learnerScopeRef &&
    left.sessionRef === right.sessionRef &&
    left.contextRef === right.contextRef &&
    left.opportunityRef === right.opportunityRef
  );
}

function hasUniqueItems(items: readonly string[]): boolean {
  return new Set(items).size === items.length;
}

function isSemanticallyValidContent(content: InstructionalMemoryContent): boolean {
  return (
    hasUniqueItems(content.conceptRefs) &&
    hasUniqueItems(content.reviewedContentRefs) &&
    hasUniqueItems(content.recentActionReasonCodes)
  );
}

function isSemanticallyValidEntry(entry: InstructionalMemoryEntry): boolean {
  return (
    isSemanticallyValidContent(entry.instructionalState) &&
    Date.parse(entry.createdAt) <= Date.parse(entry.updatedAt) &&
    Date.parse(entry.updatedAt) < Date.parse(entry.expiresAt)
  );
}

function copyEntry(entry: InstructionalMemoryEntry): InstructionalMemoryEntry {
  return structuredClone(entry);
}

export class BoundedInstructionalMemoryStore {
  readonly maximumEntries: number;
  readonly defaultTtlMs: number;

  readonly #now: () => number;
  readonly #entries = new Map<string, StoredEntry>();
  #writeSequence = 0;

  constructor(options: BoundedInstructionalMemoryStoreOptions = {}) {
    const maximumEntries = options.maximumEntries ?? MAXIMUM_INSTRUCTIONAL_MEMORY_ENTRIES;
    const defaultTtlMs = options.defaultTtlMs ?? DEFAULT_INSTRUCTIONAL_MEMORY_TTL_MS;
    if (
      !Number.isInteger(maximumEntries) ||
      maximumEntries < 1 ||
      maximumEntries > MAXIMUM_INSTRUCTIONAL_MEMORY_ENTRIES
    ) {
      throw new RangeError(
        `maximumEntries must be an integer from 1 to ${MAXIMUM_INSTRUCTIONAL_MEMORY_ENTRIES}`,
      );
    }
    if (
      !Number.isInteger(defaultTtlMs) ||
      defaultTtlMs < 1 ||
      defaultTtlMs > MAXIMUM_INSTRUCTIONAL_MEMORY_TTL_MS
    ) {
      throw new RangeError(
        `defaultTtlMs must be an integer from 1 to ${MAXIMUM_INSTRUCTIONAL_MEMORY_TTL_MS}`,
      );
    }
    this.maximumEntries = maximumEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.#now = options.now ?? Date.now;
  }

  get activeEntryCount(): number {
    this.purgeExpired();
    return this.#entries.size;
  }

  remember(requestCandidate: unknown): RememberInstructionalMemoryResult {
    const validation = validateExact(RememberInstructionalMemoryRequestSchema, requestCandidate);
    if (validation.status === "rejected") return rejected("INVALID_MEMORY_REQUEST");
    if (!isSemanticallyValidContent(validation.value.instructionalState)) {
      return rejected("INVALID_MEMORY_STATE");
    }

    const now = this.#readNow();
    this.#purgeExpiredAt(now);
    const existing = this.#entries.get(validation.value.memoryRef);
    if (existing && !scopesMatch(existing.state.scope, validation.value.scope)) {
      return rejected("MEMORY_SCOPE_MISMATCH");
    }

    let evictionOccurred = false;
    if (!existing && this.#entries.size >= this.maximumEntries) {
      this.#evictLeastRecentWrite();
      evictionOccurred = true;
    }

    const timestamp = new Date(now).toISOString();
    const ttlMs = validation.value.ttlMs ?? this.defaultTtlMs;
    const state: InstructionalMemoryEntry = {
      memoryKind: "bounded-ephemeral-instructional-memory",
      memoryRef: validation.value.memoryRef,
      scope: structuredClone(validation.value.scope),
      instructionalState: structuredClone(validation.value.instructionalState),
      createdAt: existing?.state.createdAt ?? timestamp,
      updatedAt: timestamp,
      expiresAt: new Date(now + ttlMs).toISOString(),
      expiresAtOpportunityEnd: true,
      persistenceAllowed: false,
      officialMasteryAuthority: false,
      studyMutationAllowed: false,
      gradeMutationAllowed: false,
      workingLevelMutationAllowed: false,
    };
    if (
      validateExact(InstructionalMemoryEntrySchema, state).status === "rejected" ||
      !isSemanticallyValidEntry(state)
    ) {
      return rejected("INVALID_MEMORY_STATE");
    }
    this.#writeSequence += 1;
    this.#entries.set(state.memoryRef, { state, writeSequence: this.#writeSequence });
    return { status: "accepted", state: copyEntry(state), evictionOccurred };
  }

  read(requestCandidate: unknown): ReadInstructionalMemoryResult {
    const access = this.#resolveAccess(requestCandidate);
    return "state" in access
      ? { status: "accepted", state: copyEntry(access.state) }
      : access;
  }

  snapshot(requestCandidate: unknown): SnapshotInstructionalMemoryResult {
    const access = this.#resolveAccess(requestCandidate);
    if (!("state" in access)) return access;
    const snapshot: MinimizedInstructionalMemorySnapshot = {
      snapshotKind: "minimized-ephemeral-instructional-memory",
      scope: structuredClone(access.state.scope),
      instructionalState: structuredClone(access.state.instructionalState),
      capturedAt: new Date(access.accessedAt).toISOString(),
      persistenceAllowed: false,
      officialMasteryAuthority: false,
      studyMutationAllowed: false,
      gradeMutationAllowed: false,
      workingLevelMutationAllowed: false,
    };
    return { status: "snapshotted", snapshot };
  }

  clear(requestCandidate: unknown): ClearInstructionalMemoryResult {
    const access = this.#resolveAccess(requestCandidate);
    if (!("state" in access)) return access;
    this.#entries.delete(access.state.memoryRef);
    return { status: "cleared" };
  }

  resetScope(
    scopeCandidate: unknown,
  ): InstructionalMemoryScopeResetResult | InstructionalMemoryRejectedResult {
    const validation = validateExact(InstructionalMemoryScopeSchema, scopeCandidate);
    if (validation.status === "rejected") return rejected("INVALID_MEMORY_REQUEST");
    return { status: "reset", removedCount: this.#removeScope(validation.value) };
  }

  expireOpportunity(
    scopeCandidate: unknown,
  ): InstructionalMemoryOpportunityExpiredResult | InstructionalMemoryRejectedResult {
    const validation = validateExact(InstructionalMemoryScopeSchema, scopeCandidate);
    if (validation.status === "rejected") return rejected("INVALID_MEMORY_REQUEST");
    return {
      status: "opportunity-expired",
      removedCount: this.#removeScope(validation.value),
    };
  }

  purgeExpired(): number {
    return this.#purgeExpiredAt(this.#readNow());
  }

  #resolveAccess(
    requestCandidate: unknown,
  ):
    | { readonly state: InstructionalMemoryEntry; readonly accessedAt: number }
    | InstructionalMemoryRejectedResult {
    const validation = validateExact(ScopedInstructionalMemoryRequestSchema, requestCandidate);
    if (validation.status === "rejected") return rejected("INVALID_MEMORY_REQUEST");
    const stored = this.#entries.get(validation.value.memoryRef);
    if (!stored) return rejected("MEMORY_NOT_FOUND");
    if (!scopesMatch(stored.state.scope, validation.value.scope)) {
      return rejected("MEMORY_SCOPE_MISMATCH");
    }
    const accessedAt = this.#readNow();
    if (Date.parse(stored.state.expiresAt) <= accessedAt) {
      this.#entries.delete(validation.value.memoryRef);
      return rejected("MEMORY_EXPIRED");
    }
    return { state: stored.state, accessedAt };
  }

  #removeScope(scope: InstructionalMemoryScope): number {
    let removedCount = 0;
    for (const [memoryRef, stored] of this.#entries) {
      if (scopesMatch(stored.state.scope, scope)) {
        this.#entries.delete(memoryRef);
        removedCount += 1;
      }
    }
    return removedCount;
  }

  #purgeExpiredAt(now: number): number {
    let removedCount = 0;
    for (const [memoryRef, stored] of this.#entries) {
      if (Date.parse(stored.state.expiresAt) <= now) {
        this.#entries.delete(memoryRef);
        removedCount += 1;
      }
    }
    return removedCount;
  }

  #evictLeastRecentWrite(): void {
    let candidate: [string, StoredEntry] | undefined;
    for (const entry of this.#entries) {
      if (
        !candidate ||
        entry[1].writeSequence < candidate[1].writeSequence ||
        (entry[1].writeSequence === candidate[1].writeSequence && entry[0] < candidate[0])
      ) {
        candidate = entry;
      }
    }
    if (candidate) this.#entries.delete(candidate[0]);
  }

  #readNow(): number {
    const now = this.#now();
    if (!Number.isFinite(now)) {
      throw new RangeError("now() must return a finite epoch millisecond");
    }
    return now;
  }
}
