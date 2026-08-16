import { Type, type Static } from "../../schema/typebox.js";
import {
  ContentDigestSchema,
  OpaqueReferenceSchema,
} from "../../v2/contracts/primitives.js";
import { validateExact } from "../../v2/contracts/validation.js";
import {
  InstructionalMemoryDeltaSchema,
  InstructionalMemoryScopeSchema,
  type ApplyInstructionalMemoryDeltaResult,
  type InstructionalMemoryDelta,
  type InstructionalMemoryProjection,
  type InstructionalMemoryScope,
} from "../memory/index.js";

export const RECOVERABLE_MEMORY_PROTOCOL_STATES = [
  "unclaimed",
  "effect-pending",
  "effect-accepted",
  "memory-pending",
  "complete",
  "quarantined",
] as const;
export type RecoverableMemoryProtocolState =
  (typeof RECOVERABLE_MEMORY_PROTOCOL_STATES)[number];

export const MinimizedAcceptedStudyEffectEventSchema = Type.Object(
  {
    eventKind: Type.Literal("minimized-study-effect-accepted"),
    logicalOperationRef: OpaqueReferenceSchema,
    sourceEventRef: OpaqueReferenceSchema,
    effectRef: OpaqueReferenceSchema,
    effectDigest: ContentDigestSchema,
    scope: InstructionalMemoryScopeSchema,
    memoryDelta: InstructionalMemoryDeltaSchema,
    rawTranscriptIncluded: Type.Literal(false),
    officialMasteryAuthority: Type.Literal(false),
    gradeAuthority: Type.Literal(false),
    placementAuthority: Type.Literal(false),
    curriculumAuthority: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV3MinimizedAcceptedStudyEffectEvent" },
);
export type MinimizedAcceptedStudyEffectEvent = Static<
  typeof MinimizedAcceptedStudyEffectEventSchema
>;

export const RecoverableInstructionalOperationSchema = Type.Object(
  {
    recoveryKind: Type.Literal("recoverable-instructional-operation"),
    logicalOperationRef: OpaqueReferenceSchema,
    sourceEventRef: OpaqueReferenceSchema,
    effectRef: OpaqueReferenceSchema,
    effectDigest: ContentDigestSchema,
    scope: InstructionalMemoryScopeSchema,
    memoryDelta: InstructionalMemoryDeltaSchema,
  },
  { additionalProperties: false, $id: "TutorV3RecoverableInstructionalOperation" },
);
export type RecoverableInstructionalOperation = Static<
  typeof RecoverableInstructionalOperationSchema
>;

export interface CanonicalStudyEffectIdentity {
  readonly logicalOperationRef: string;
  readonly sourceEventRef: string;
  readonly effectRef: string;
  readonly effectDigest: string;
  readonly scope: InstructionalMemoryScope;
}

export interface CanonicalStudyEffectAcceptCommand extends CanonicalStudyEffectIdentity {
  readonly physicalAttemptRef: string;
  readonly acceptedEvent: MinimizedAcceptedStudyEffectEvent;
}

export type CanonicalStudyEffectLookupResult =
  | { readonly status: "missing" }
  | { readonly status: "accepted"; readonly event: MinimizedAcceptedStudyEffectEvent }
  | { readonly status: "conflict" };

export type CanonicalStudyEffectAcceptResult =
  | { readonly status: "accepted"; readonly event: MinimizedAcceptedStudyEffectEvent }
  | { readonly status: "rejected"; readonly code: string; readonly retryable: boolean };

/**
 * Provider adapters sit behind this port. A lookup resolves one logical Study
 * effect; accept is a physical attempt and is called only while lookup is missing.
 */
export interface CanonicalStudyEffectGateway {
  lookup(identity: CanonicalStudyEffectIdentity): CanonicalStudyEffectLookupResult;
  accept(command: CanonicalStudyEffectAcceptCommand): CanonicalStudyEffectAcceptResult;
}

export interface InstructionalMemoryDeltaPort {
  apply(candidate: unknown): ApplyInstructionalMemoryDeltaResult;
}

export interface PhysicalEffectAttemptRecord {
  readonly physicalAttemptRef: string;
  readonly ordinal: number;
  outcome: "started" | "accepted" | "interrupted" | "rejected";
}

export interface RecoverableMemoryProtocolRecord {
  readonly logicalOperationRef: string;
  readonly requestFingerprint: string;
  state: RecoverableMemoryProtocolState;
  readonly stateHistory: RecoverableMemoryProtocolState[];
  readonly physicalAttempts: PhysicalEffectAttemptRecord[];
  acceptedEvent: MinimizedAcceptedStudyEffectEvent | null;
  quarantineCode: RecoveryQuarantineCode | null;
}

export type RecoveryQuarantineCode =
  | "FOREIGN_SCOPE"
  | "INCONSISTENT_OPERATION_BINDING"
  | "CONFLICTING_LOGICAL_OPERATION"
  | "CANONICAL_EFFECT_CONFLICT"
  | "INVALID_ACCEPTED_EVENT"
  | "MEMORY_DELTA_REJECTED"
  | "EFFECT_REJECTED";

export type RecoverableInstructionalOperationResult =
  | {
      readonly status: "complete";
      readonly record: RecoverableMemoryProtocolRecord;
      readonly projection: InstructionalMemoryProjection;
      readonly effectDisposition: "executed" | "reused";
      readonly memoryDisposition: "applied" | "duplicate";
      readonly recoveredMemory: boolean;
    }
  | {
      readonly status: "pending";
      readonly record: RecoverableMemoryProtocolRecord;
      readonly retryable: true;
    }
  | {
      readonly status: "quarantined";
      readonly record: RecoverableMemoryProtocolRecord;
      readonly code: RecoveryQuarantineCode;
    }
  | {
      readonly status: "rejected";
      readonly code: "INVALID_RECOVERY_REQUEST" | "INVALID_TRUSTED_SCOPE";
    };

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function operationFingerprint(value: unknown): string {
  return canonicalize(value);
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

function deltaBindingsMatch(
  operation: RecoverableInstructionalOperation,
  delta: InstructionalMemoryDelta,
): boolean {
  return (
    delta.logicalOperationRef === operation.logicalOperationRef &&
    delta.sourceEventRef === operation.sourceEventRef &&
    scopesMatch(delta.scope, operation.scope)
  );
}

function eventBindingsMatch(
  operation: RecoverableInstructionalOperation,
  event: MinimizedAcceptedStudyEffectEvent,
): boolean {
  return (
    event.logicalOperationRef === operation.logicalOperationRef &&
    event.sourceEventRef === operation.sourceEventRef &&
    event.effectRef === operation.effectRef &&
    event.effectDigest === operation.effectDigest &&
    scopesMatch(event.scope, operation.scope) &&
    operationFingerprint(event.memoryDelta) === operationFingerprint(operation.memoryDelta)
  );
}

function copyRecord(record: RecoverableMemoryProtocolRecord): RecoverableMemoryProtocolRecord {
  return structuredClone(record);
}

export class RecoverableInstructionalOperationCoordinator {
  readonly #effectGateway: CanonicalStudyEffectGateway;
  readonly #memoryPort: InstructionalMemoryDeltaPort;
  readonly #records = new Map<string, RecoverableMemoryProtocolRecord>();

  constructor(effectGateway: CanonicalStudyEffectGateway, memoryPort: InstructionalMemoryDeltaPort) {
    this.#effectGateway = effectGateway;
    this.#memoryPort = memoryPort;
  }

  readRecord(logicalOperationRef: string): RecoverableMemoryProtocolRecord | null {
    const record = this.#records.get(logicalOperationRef);
    return record ? copyRecord(record) : null;
  }

  replay(
    trustedScopeCandidate: unknown,
    operationCandidate: unknown,
  ): RecoverableInstructionalOperationResult {
    const trustedScopeValidation = validateExact(
      InstructionalMemoryScopeSchema,
      trustedScopeCandidate,
    );
    if (trustedScopeValidation.status === "rejected") {
      return { status: "rejected", code: "INVALID_TRUSTED_SCOPE" };
    }
    const operationValidation = validateExact(
      RecoverableInstructionalOperationSchema,
      operationCandidate,
    );
    if (operationValidation.status === "rejected") {
      return { status: "rejected", code: "INVALID_RECOVERY_REQUEST" };
    }
    const operation = operationValidation.value;
    const requestFingerprint = operationFingerprint(operation);
    const existing = this.#records.get(operation.logicalOperationRef);
    if (existing && existing.requestFingerprint !== requestFingerprint) {
      return this.#quarantine(existing, "CONFLICTING_LOGICAL_OPERATION");
    }

    const record =
      existing ??
      this.#newRecord(operation.logicalOperationRef, requestFingerprint);
    this.#records.set(operation.logicalOperationRef, record);

    if (record.state === "quarantined") {
      return {
        status: "quarantined",
        record: copyRecord(record),
        code: record.quarantineCode ?? "CONFLICTING_LOGICAL_OPERATION",
      };
    }
    if (!scopesMatch(trustedScopeValidation.value, operation.scope)) {
      return this.#quarantine(record, "FOREIGN_SCOPE");
    }
    if (!deltaBindingsMatch(operation, operation.memoryDelta)) {
      return this.#quarantine(record, "INCONSISTENT_OPERATION_BINDING");
    }
    if (record.state === "complete" && record.acceptedEvent) {
      let replayedMemory: ApplyInstructionalMemoryDeltaResult;
      try {
        replayedMemory = this.#memoryPort.apply(record.acceptedEvent.memoryDelta);
      } catch {
        this.#transition(record, "memory-pending");
        return { status: "pending", record: copyRecord(record), retryable: true };
      }
      if (replayedMemory.status === "rejected") {
        return this.#quarantine(record, "MEMORY_DELTA_REJECTED");
      }
      return {
        status: "complete",
        record: copyRecord(record),
        projection: replayedMemory.projection,
        effectDisposition: "reused",
        memoryDisposition: replayedMemory.status,
        recoveredMemory: replayedMemory.status === "applied",
      };
    }

    const identity = this.#identity(operation);
    let acceptedEvent: MinimizedAcceptedStudyEffectEvent | null = null;
    let effectDisposition: "executed" | "reused" = "reused";
    let acceptedFromLookup = false;

    let lookup: CanonicalStudyEffectLookupResult;
    try {
      lookup = this.#effectGateway.lookup(identity);
    } catch {
      this.#transition(record, "effect-pending");
      return { status: "pending", record: copyRecord(record), retryable: true };
    }
    if (lookup.status === "conflict") {
      return this.#quarantine(record, "CANONICAL_EFFECT_CONFLICT");
    }
    if (lookup.status === "accepted") {
      acceptedEvent = lookup.event;
      acceptedFromLookup = true;
    } else {
      this.#transition(record, "effect-pending");
      const ordinal = record.physicalAttempts.length + 1;
      const attempt: PhysicalEffectAttemptRecord = {
        physicalAttemptRef: `effect-attempt:${fnv1a64(
          `${operation.logicalOperationRef}:${ordinal}`,
        )}`,
        ordinal,
        outcome: "started",
      };
      record.physicalAttempts.push(attempt);
      effectDisposition = "executed";
      try {
        const accepted = this.#effectGateway.accept({
          ...identity,
          physicalAttemptRef: attempt.physicalAttemptRef,
          acceptedEvent: this.#acceptedEvent(operation),
        });
        if (accepted.status === "rejected") {
          attempt.outcome = "rejected";
          if (accepted.retryable) {
            return { status: "pending", record: copyRecord(record), retryable: true };
          }
          return this.#quarantine(record, "EFFECT_REJECTED");
        }
        attempt.outcome = "accepted";
        acceptedEvent = accepted.event;
      } catch {
        attempt.outcome = "interrupted";
        return { status: "pending", record: copyRecord(record), retryable: true };
      }
    }

    if (
      validateExact(MinimizedAcceptedStudyEffectEventSchema, acceptedEvent).status ===
        "rejected" ||
      !eventBindingsMatch(operation, acceptedEvent)
    ) {
      return this.#quarantine(record, "INVALID_ACCEPTED_EVENT");
    }
    record.acceptedEvent = structuredClone(acceptedEvent);
    if (record.state !== "memory-pending") {
      this.#transition(record, "effect-accepted");
    }
    this.#transition(record, "memory-pending");

    let memoryResult: ApplyInstructionalMemoryDeltaResult;
    try {
      // The canonical accepted event, not the retry payload, is the reconstruction source.
      memoryResult = this.#memoryPort.apply(acceptedEvent.memoryDelta);
    } catch {
      return { status: "pending", record: copyRecord(record), retryable: true };
    }
    if (memoryResult.status === "rejected") {
      return this.#quarantine(record, "MEMORY_DELTA_REJECTED");
    }

    this.#transition(record, "complete");
    return {
      status: "complete",
      record: copyRecord(record),
      projection: memoryResult.projection,
      effectDisposition,
      memoryDisposition: memoryResult.status,
      recoveredMemory: acceptedFromLookup && memoryResult.status === "applied",
    };
  }

  #newRecord(
    logicalOperationRef: string,
    requestFingerprint: string,
  ): RecoverableMemoryProtocolRecord {
    return {
      logicalOperationRef,
      requestFingerprint,
      state: "unclaimed",
      stateHistory: ["unclaimed"],
      physicalAttempts: [],
      acceptedEvent: null,
      quarantineCode: null,
    };
  }

  #transition(
    record: RecoverableMemoryProtocolRecord,
    state: RecoverableMemoryProtocolState,
  ): void {
    if (record.state === state) return;
    record.state = state;
    record.stateHistory.push(state);
  }

  #quarantine(
    record: RecoverableMemoryProtocolRecord,
    code: RecoveryQuarantineCode,
  ): RecoverableInstructionalOperationResult {
    record.quarantineCode = code;
    this.#transition(record, "quarantined");
    return { status: "quarantined", record: copyRecord(record), code };
  }

  #identity(operation: RecoverableInstructionalOperation): CanonicalStudyEffectIdentity {
    return {
      logicalOperationRef: operation.logicalOperationRef,
      sourceEventRef: operation.sourceEventRef,
      effectRef: operation.effectRef,
      effectDigest: operation.effectDigest,
      scope: structuredClone(operation.scope),
    };
  }

  #acceptedEvent(
    operation: RecoverableInstructionalOperation,
  ): MinimizedAcceptedStudyEffectEvent {
    return {
      eventKind: "minimized-study-effect-accepted",
      logicalOperationRef: operation.logicalOperationRef,
      sourceEventRef: operation.sourceEventRef,
      effectRef: operation.effectRef,
      effectDigest: operation.effectDigest,
      scope: structuredClone(operation.scope),
      memoryDelta: structuredClone(operation.memoryDelta),
      rawTranscriptIncluded: false,
      officialMasteryAuthority: false,
      gradeAuthority: false,
      placementAuthority: false,
      curriculumAuthority: false,
    };
  }
}
