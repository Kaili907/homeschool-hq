import { Type, type Static } from "../../schema/typebox.js";
import {
  HintLevelSchema,
  ISODateTimeSchema,
  OpaqueReferenceSchema,
  TutorActionKindSchema,
} from "../contracts/primitives.js";
import { validateExact } from "../contracts/validation.js";

export const MAXIMUM_TUTOR_MEMORY_ENTRIES = 32;
export const MAXIMUM_STRATEGY_REFERENCES = 8;
export const MAXIMUM_UNDERSTOOD_STEP_REFERENCES = 12;
export const MAXIMUM_INTERVENTION_COUNT = 24;
export const DEFAULT_TUTOR_MEMORY_TTL_MS = 30 * 60 * 1000;
export const MAXIMUM_TUTOR_MEMORY_TTL_MS = 2 * 60 * 60 * 1000;

export const TutorMemoryScopeSchema = Type.Object(
  {
    scopeKind: Type.Literal("trusted-study-tutor-scope"),
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    lessonRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV2MemoryScope" },
);
export type TutorMemoryScope = Static<typeof TutorMemoryScopeSchema>;

const NullableOpaqueReferenceSchema = Type.Union([OpaqueReferenceSchema, Type.Null()]);

export const TutorSessionMemoryStateSchema = Type.Object(
  {
    memoryKind: Type.Literal("bounded-ephemeral-tutor-session"),
    memoryRef: OpaqueReferenceSchema,
    scope: TutorMemoryScopeSchema,
    strategiesTried: Type.Array(OpaqueReferenceSchema, {
      maxItems: MAXIMUM_STRATEGY_REFERENCES,
    }),
    visualExplanationTried: Type.Boolean(),
    hintLevelUsed: HintLevelSchema,
    currentConceptRef: NullableOpaqueReferenceSchema,
    currentMisconceptionHypothesisRef: NullableOpaqueReferenceSchema,
    understoodStepRefs: Type.Array(OpaqueReferenceSchema, {
      maxItems: MAXIMUM_UNDERSTOOD_STEP_REFERENCES,
    }),
    lastTutorAction: Type.Union([TutorActionKindSchema, Type.Null()]),
    interventionCount: Type.Integer({ minimum: 0, maximum: MAXIMUM_INTERVENTION_COUNT }),
    createdAt: ISODateTimeSchema,
    updatedAt: ISODateTimeSchema,
    expiresAt: ISODateTimeSchema,
    persistenceAllowed: Type.Literal(false),
    authoritativeStudyHistory: Type.Literal(false),
    rawProseStored: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV2SessionMemoryState" },
);
export type TutorSessionMemoryState = Static<typeof TutorSessionMemoryStateSchema>;

export const TutorSessionMemoryPatchSchema = Type.Object(
  {
    strategiesTried: Type.Optional(
      Type.Array(OpaqueReferenceSchema, { maxItems: MAXIMUM_STRATEGY_REFERENCES }),
    ),
    visualExplanationTried: Type.Optional(Type.Boolean()),
    hintLevelUsed: Type.Optional(
      Type.Union([
        Type.Literal("none"),
        Type.Literal("nudge"),
        Type.Literal("concept-cue"),
        Type.Literal("guided-step"),
      ]),
    ),
    currentConceptRef: Type.Optional(Type.Union([OpaqueReferenceSchema, Type.Null()])),
    currentMisconceptionHypothesisRef: Type.Optional(
      Type.Union([OpaqueReferenceSchema, Type.Null()]),
    ),
    understoodStepRefs: Type.Optional(
      Type.Array(OpaqueReferenceSchema, { maxItems: MAXIMUM_UNDERSTOOD_STEP_REFERENCES }),
    ),
    lastTutorAction: Type.Optional(
      Type.Union([
        Type.Literal("explain"),
        Type.Literal("hint"),
        Type.Literal("ask-check"),
        Type.Literal("show-example"),
        Type.Literal("reteach"),
        Type.Literal("check-prerequisite"),
        Type.Literal("suggest-break"),
        Type.Literal("escalate"),
        Type.Literal("return-to-lesson"),
        Type.Null(),
      ]),
    ),
    interventionCount: Type.Optional(
      Type.Integer({ minimum: 0, maximum: MAXIMUM_INTERVENTION_COUNT }),
    ),
  },
  { additionalProperties: false, $id: "TutorV2SessionMemoryPatch" },
);
export type TutorSessionMemoryPatch = Static<typeof TutorSessionMemoryPatchSchema>;

const OpenMemoryRequestSchema = Type.Object(
  {
    memoryRef: OpaqueReferenceSchema,
    scope: TutorMemoryScopeSchema,
    ttlMs: Type.Optional(
      Type.Integer({ minimum: 1, maximum: MAXIMUM_TUTOR_MEMORY_TTL_MS }),
    ),
  },
  { additionalProperties: false },
);

const ScopedMemoryRequestSchema = Type.Object(
  {
    memoryRef: OpaqueReferenceSchema,
    scope: TutorMemoryScopeSchema,
  },
  { additionalProperties: false },
);

const UpdateMemoryRequestSchema = Type.Object(
  {
    memoryRef: OpaqueReferenceSchema,
    scope: TutorMemoryScopeSchema,
    patch: TutorSessionMemoryPatchSchema,
  },
  { additionalProperties: false },
);

export const MinimizedTutorSessionEndSchema = Type.Object(
  {
    checkpointKind: Type.Literal("non-durable-minimized-session-end"),
    memoryRef: OpaqueReferenceSchema,
    interactionRef: OpaqueReferenceSchema,
    lessonRef: OpaqueReferenceSchema,
    currentConceptRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
    understoodStepRefs: Type.Array(OpaqueReferenceSchema, {
      maxItems: MAXIMUM_UNDERSTOOD_STEP_REFERENCES,
    }),
    interventionCount: Type.Integer({ minimum: 0, maximum: MAXIMUM_INTERVENTION_COUNT }),
    endedAt: ISODateTimeSchema,
    persistenceAllowed: Type.Literal(false),
    authoritativeStudyHistory: Type.Literal(false),
    rawProseStored: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV2MinimizedSessionEnd" },
);
export type MinimizedTutorSessionEnd = Static<typeof MinimizedTutorSessionEndSchema>;

export type TutorMemoryFailureCode =
  | "INVALID_MEMORY_REQUEST"
  | "INVALID_MEMORY_PATCH"
  | "INVALID_MEMORY_STATE"
  | "MEMORY_ALREADY_EXISTS"
  | "MEMORY_CAPACITY_EXCEEDED"
  | "MEMORY_NOT_FOUND"
  | "MEMORY_SCOPE_MISMATCH"
  | "MEMORY_EXPIRED";

export interface TutorMemoryRejectedResult {
  readonly status: "rejected";
  readonly code: TutorMemoryFailureCode;
  readonly tutorMayUseMemory: false;
}

export type TutorMemoryStateResult =
  | { readonly status: "accepted"; readonly state: TutorSessionMemoryState }
  | TutorMemoryRejectedResult;

export type TutorMemoryResetResult =
  | { readonly status: "reset" }
  | TutorMemoryRejectedResult;

export type TutorMemoryEndResult =
  | { readonly status: "ended"; readonly checkpoint: MinimizedTutorSessionEnd }
  | TutorMemoryRejectedResult;

export interface TutorSessionMemoryStoreOptions {
  readonly now?: () => number;
  readonly maximumEntries?: number;
  readonly defaultTtlMs?: number;
}

function rejected(code: TutorMemoryFailureCode): TutorMemoryRejectedResult {
  return { status: "rejected", code, tutorMayUseMemory: false };
}

function scopesMatch(left: TutorMemoryScope, right: TutorMemoryScope): boolean {
  return (
    left.scopeKind === right.scopeKind &&
    left.householdScopeRef === right.householdScopeRef &&
    left.learnerScopeRef === right.learnerScopeRef &&
    left.sessionRef === right.sessionRef &&
    left.interactionRef === right.interactionRef &&
    left.lessonRef === right.lessonRef
  );
}

function hasUniqueItems(items: readonly string[]): boolean {
  return new Set(items).size === items.length;
}

function isSemanticallyValidState(state: TutorSessionMemoryState): boolean {
  return (
    hasUniqueItems(state.strategiesTried) &&
    hasUniqueItems(state.understoodStepRefs) &&
    Date.parse(state.createdAt) <= Date.parse(state.updatedAt) &&
    Date.parse(state.updatedAt) <= Date.parse(state.expiresAt)
  );
}

function copyState(state: TutorSessionMemoryState): TutorSessionMemoryState {
  return structuredClone(state);
}

export class TutorSessionMemoryStore {
  readonly maximumEntries: number;
  readonly defaultTtlMs: number;

  readonly #now: () => number;
  readonly #entries = new Map<string, TutorSessionMemoryState>();

  constructor(options: TutorSessionMemoryStoreOptions = {}) {
    const maximumEntries = options.maximumEntries ?? MAXIMUM_TUTOR_MEMORY_ENTRIES;
    const defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TUTOR_MEMORY_TTL_MS;
    if (
      !Number.isInteger(maximumEntries) ||
      maximumEntries < 1 ||
      maximumEntries > MAXIMUM_TUTOR_MEMORY_ENTRIES
    ) {
      throw new RangeError(
        `maximumEntries must be an integer from 1 to ${MAXIMUM_TUTOR_MEMORY_ENTRIES}`,
      );
    }
    if (
      !Number.isInteger(defaultTtlMs) ||
      defaultTtlMs < 1 ||
      defaultTtlMs > MAXIMUM_TUTOR_MEMORY_TTL_MS
    ) {
      throw new RangeError(
        `defaultTtlMs must be an integer from 1 to ${MAXIMUM_TUTOR_MEMORY_TTL_MS}`,
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

  open(requestCandidate: unknown): TutorMemoryStateResult {
    const validation = validateExact(OpenMemoryRequestSchema, requestCandidate);
    if (validation.status === "rejected") return rejected("INVALID_MEMORY_REQUEST");
    this.purgeExpired();
    if (this.#entries.has(validation.value.memoryRef)) {
      return rejected("MEMORY_ALREADY_EXISTS");
    }
    if (this.#entries.size >= this.maximumEntries) {
      return rejected("MEMORY_CAPACITY_EXCEEDED");
    }

    const now = this.#readNow();
    const ttlMs = validation.value.ttlMs ?? this.defaultTtlMs;
    const timestamp = new Date(now).toISOString();
    const state: TutorSessionMemoryState = {
      memoryKind: "bounded-ephemeral-tutor-session",
      memoryRef: validation.value.memoryRef,
      scope: structuredClone(validation.value.scope),
      strategiesTried: [],
      visualExplanationTried: false,
      hintLevelUsed: "none",
      currentConceptRef: null,
      currentMisconceptionHypothesisRef: null,
      understoodStepRefs: [],
      lastTutorAction: null,
      interventionCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: new Date(now + ttlMs).toISOString(),
      persistenceAllowed: false,
      authoritativeStudyHistory: false,
      rawProseStored: false,
    };
    this.#entries.set(state.memoryRef, state);
    return { status: "accepted", state: copyState(state) };
  }

  read(requestCandidate: unknown): TutorMemoryStateResult {
    const access = this.#resolveAccess(requestCandidate);
    return "state" in access
      ? { status: "accepted", state: copyState(access.state) }
      : access;
  }

  update(requestCandidate: unknown): TutorMemoryStateResult {
    const validation = validateExact(UpdateMemoryRequestSchema, requestCandidate);
    if (validation.status === "rejected") return rejected("INVALID_MEMORY_PATCH");
    const access = this.#resolveValidatedAccess(validation.value.memoryRef, validation.value.scope);
    if (!("state" in access)) return access;

    const nextState: TutorSessionMemoryState = {
      ...access.state,
      ...structuredClone(validation.value.patch),
      updatedAt: new Date(this.#readNow()).toISOString(),
    };
    const stateValidation = validateExact(TutorSessionMemoryStateSchema, nextState);
    if (
      stateValidation.status === "rejected" ||
      !isSemanticallyValidState(stateValidation.value)
    ) {
      return rejected("INVALID_MEMORY_STATE");
    }
    this.#entries.set(nextState.memoryRef, nextState);
    return { status: "accepted", state: copyState(nextState) };
  }

  reset(requestCandidate: unknown): TutorMemoryResetResult {
    const access = this.#resolveAccess(requestCandidate);
    if (!("state" in access)) return access;
    this.#entries.delete(access.state.memoryRef);
    return { status: "reset" };
  }

  endSession(requestCandidate: unknown): TutorMemoryEndResult {
    const access = this.#resolveAccess(requestCandidate);
    if (!("state" in access)) return access;
    const state = access.state;
    const checkpoint: MinimizedTutorSessionEnd = {
      checkpointKind: "non-durable-minimized-session-end",
      memoryRef: state.memoryRef,
      interactionRef: state.scope.interactionRef,
      lessonRef: state.scope.lessonRef,
      currentConceptRef: state.currentConceptRef,
      understoodStepRefs: [...state.understoodStepRefs],
      interventionCount: state.interventionCount,
      endedAt: new Date(this.#readNow()).toISOString(),
      persistenceAllowed: false,
      authoritativeStudyHistory: false,
      rawProseStored: false,
    };
    this.#entries.delete(state.memoryRef);
    return { status: "ended", checkpoint };
  }

  purgeExpired(): number {
    const now = this.#readNow();
    let removed = 0;
    for (const [memoryRef, state] of this.#entries) {
      if (Date.parse(state.expiresAt) <= now) {
        this.#entries.delete(memoryRef);
        removed += 1;
      }
    }
    return removed;
  }

  #resolveAccess(requestCandidate: unknown):
    | { readonly state: TutorSessionMemoryState }
    | TutorMemoryRejectedResult {
    const validation = validateExact(ScopedMemoryRequestSchema, requestCandidate);
    if (validation.status === "rejected") return rejected("INVALID_MEMORY_REQUEST");
    return this.#resolveValidatedAccess(validation.value.memoryRef, validation.value.scope);
  }

  #resolveValidatedAccess(
    memoryRef: string,
    scope: TutorMemoryScope,
  ):
    | { readonly state: TutorSessionMemoryState }
    | TutorMemoryRejectedResult {
    const state = this.#entries.get(memoryRef);
    if (!state) return rejected("MEMORY_NOT_FOUND");
    if (!scopesMatch(state.scope, scope)) return rejected("MEMORY_SCOPE_MISMATCH");
    if (Date.parse(state.expiresAt) <= this.#readNow()) {
      this.#entries.delete(memoryRef);
      return rejected("MEMORY_EXPIRED");
    }
    return { state };
  }

  #readNow(): number {
    const now = this.#now();
    if (!Number.isFinite(now)) throw new RangeError("now() must return a finite epoch millisecond");
    return now;
  }
}
