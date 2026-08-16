import {
  InstructionalMemoryProjectionStore,
  type ApplyInstructionalMemoryDeltaResult,
  type InstructionalMemoryDelta,
} from "../../../core/v3/memory/index.js";

export const REPLAY_CRASH_BOUNDARIES = [
  "before-routing",
  "after-route-plan",
  "after-reservation",
  "before-provider-dispatch",
  "after-provider-dispatch-before-receipt",
  "after-provider-response-before-validation",
  "after-advisory-construction",
  "before-study-effect",
  "after-study-effect-accepted",
  "before-memory-delta",
  "during-memory-delta",
  "after-memory",
  "before-telemetry",
  "after-telemetry",
  "before-parent-projection",
] as const;

export type ReplayCrashBoundary = (typeof REPLAY_CRASH_BOUNDARIES)[number];

export type ReplayCrashPipelineState =
  | "received"
  | "route-planned"
  | "reserved"
  | "dispatch-ready"
  | "dispatch-unknown"
  | "response-received"
  | "response-validated"
  | "advisory-constructed"
  | "study-pending"
  | "study-accepted"
  | "memory-pending"
  | "memory-applied"
  | "telemetry-pending"
  | "telemetry-emitted"
  | "parent-pending"
  | "complete"
  | "quarantined";

export interface CertificationRouteAttempt {
  readonly physicalAttemptRef: string;
  readonly attemptIndex: number;
  readonly role: "primary" | "failover";
  readonly routeRef: string;
  readonly providerRef: string;
  readonly modelRef: string;
  readonly reservedCostMicros: string;
}

export interface CertificationRoutePlan {
  readonly routePlanRef: string;
  readonly logicalOperationRef: string;
  readonly attempts: readonly CertificationRouteAttempt[];
}

export interface ReplayCrashRequest {
  readonly logicalOperationRef: string;
  readonly payload: {
    readonly learnerScopeRef: string;
    readonly sessionRef: string;
    readonly interactionRef: string;
    readonly opportunityRef: string;
    readonly contentRef: string;
    readonly requestedAction: "hint" | "guided-question";
  };
  readonly routePlan: CertificationRoutePlan;
  readonly reservationRef: string;
  readonly advisoryRef: string;
  readonly effectRef: string;
  readonly effectDigest: string;
  readonly studyReceiptRef: string;
  readonly memoryDelta: InstructionalMemoryDelta;
  readonly telemetryEventRef: string;
  readonly parentProjectionRef: string;
}

export interface ProviderResponseEnvelope {
  readonly responseRef: string;
  readonly physicalAttemptRef: string;
  readonly payloadDigest: string;
  readonly outputDigest: string;
  readonly usageReceiptRef: string;
}

export type ProviderBehavior = "response" | "confirmed-not-dispatched" | "timeout-unknown";

export interface ProviderDispatchResult {
  readonly status: "response" | "confirmed-not-dispatched" | "timeout-unknown";
  readonly disposition: "executed" | "reused";
  readonly envelope: ProviderResponseEnvelope | null;
}

interface StoredProviderDispatch {
  readonly payloadDigest: string;
  result: Omit<ProviderDispatchResult, "disposition">;
}

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

function digest(value: unknown): string {
  const canonical = canonicalize(value);
  return [0, 1, 2, 3].map((part) => fnv1a64(`${part}:${canonical}`)).join("");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function plansAreValid(plan: CertificationRoutePlan, logicalOperationRef: string): boolean {
  return (
    plan.logicalOperationRef === logicalOperationRef &&
    plan.attempts.length >= 1 &&
    plan.attempts.length <= 2 &&
    new Set(plan.attempts.map((attempt) => attempt.physicalAttemptRef)).size ===
      plan.attempts.length &&
    plan.attempts.every(
      (attempt, index) =>
        attempt.attemptIndex === index &&
        attempt.role === (index === 0 ? "primary" : "failover") &&
        /^(0|[1-9][0-9]*)$/.test(attempt.reservedCostMicros),
    )
  );
}

export class DeterministicProvider {
  readonly #behaviors = new Map<string, ProviderBehavior>();
  readonly #dispatches = new Map<string, StoredProviderDispatch>();
  readonly #physicalExecutions = new Map<string, number>();
  readonly dispatchLog: string[] = [];

  setBehavior(physicalAttemptRef: string, behavior: ProviderBehavior): void {
    if (this.#dispatches.has(physicalAttemptRef)) {
      throw new Error("cannot mutate behavior after a physical attempt has been observed");
    }
    this.#behaviors.set(physicalAttemptRef, behavior);
  }

  dispatch(attempt: CertificationRouteAttempt, payloadDigest: string): ProviderDispatchResult {
    this.dispatchLog.push(attempt.physicalAttemptRef);
    const existing = this.#dispatches.get(attempt.physicalAttemptRef);
    if (existing) {
      if (existing.payloadDigest !== payloadDigest) {
        throw new Error("physical attempt reference was rebound to a different payload");
      }
      return { ...structuredClone(existing.result), disposition: "reused" };
    }

    const behavior = this.#behaviors.get(attempt.physicalAttemptRef) ?? "response";
    if (behavior !== "confirmed-not-dispatched") {
      this.#physicalExecutions.set(
        attempt.physicalAttemptRef,
        (this.#physicalExecutions.get(attempt.physicalAttemptRef) ?? 0) + 1,
      );
    }
    const envelope =
      behavior === "response"
        ? deepFreeze({
            responseRef: `provider-response:${fnv1a64(attempt.physicalAttemptRef)}`,
            physicalAttemptRef: attempt.physicalAttemptRef,
            payloadDigest,
            outputDigest: `provider-output:${fnv1a64(`${payloadDigest}:output`)}`,
            usageReceiptRef: `usage-receipt:${fnv1a64(attempt.physicalAttemptRef)}`,
          })
        : null;
    const result = {
      status: behavior,
      envelope,
    } as const;
    this.#dispatches.set(attempt.physicalAttemptRef, {
      payloadDigest,
      result: structuredClone(result),
    });
    return { ...structuredClone(result), disposition: "executed" };
  }

  deliverLateResponse(
    physicalAttemptRef: string,
    outputDigest = `provider-output:${fnv1a64(`${physicalAttemptRef}:late`)}`,
  ): ProviderResponseEnvelope {
    const existing = this.#dispatches.get(physicalAttemptRef);
    if (!existing || existing.result.status !== "timeout-unknown") {
      throw new Error("late response requires an indeterminate dispatched attempt");
    }
    const envelope = deepFreeze({
      responseRef: `provider-response:${fnv1a64(physicalAttemptRef)}`,
      physicalAttemptRef,
      payloadDigest: existing.payloadDigest,
      outputDigest,
      usageReceiptRef: `usage-receipt:${fnv1a64(physicalAttemptRef)}`,
    });
    existing.result = { status: "response", envelope };
    return structuredClone(envelope);
  }

  physicalExecutionCount(physicalAttemptRef?: string): number {
    if (physicalAttemptRef) return this.#physicalExecutions.get(physicalAttemptRef) ?? 0;
    return [...this.#physicalExecutions.values()].reduce((total, count) => total + count, 0);
  }
}

export interface StudyEffectReceipt {
  readonly receiptRef: string;
  readonly logicalOperationRef: string;
  readonly advisoryDigest: string;
  readonly effectRef: string;
  readonly effectDigest: string;
  readonly decision: "accepted";
  readonly studyProgressCommitted: true;
}

export class IdempotentStudyEffectLedger {
  readonly #accepted = new Map<string, StudyEffectReceipt>();
  #executionCount = 0;

  accept(input: Omit<StudyEffectReceipt, "decision" | "studyProgressCommitted">):
    | { readonly status: "accepted" | "duplicate"; readonly receipt: StudyEffectReceipt }
    | { readonly status: "conflict" } {
    const candidate = deepFreeze({
      ...structuredClone(input),
      decision: "accepted" as const,
      studyProgressCommitted: true as const,
    });
    const existing = this.#accepted.get(input.logicalOperationRef);
    if (existing) {
      return canonicalize(existing) === canonicalize(candidate)
        ? { status: "duplicate", receipt: structuredClone(existing) }
        : { status: "conflict" };
    }
    this.#executionCount += 1;
    this.#accepted.set(input.logicalOperationRef, candidate);
    return { status: "accepted", receipt: structuredClone(candidate) };
  }

  read(logicalOperationRef: string): StudyEffectReceipt | null {
    const receipt = this.#accepted.get(logicalOperationRef);
    return receipt ? structuredClone(receipt) : null;
  }

  get executionCount(): number {
    return this.#executionCount;
  }
}

export interface AuthorityFreeTelemetryEvent {
  readonly eventRef: string;
  readonly logicalOperationRef: string;
  readonly physicalAttemptRef: string;
  readonly studyAuthority: false;
  readonly studyMutationAllowed: false;
  readonly instructionalUseAllowed: false;
}

export class IdempotentTelemetrySink {
  readonly #events = new Map<string, AuthorityFreeTelemetryEvent>();

  emit(candidate: AuthorityFreeTelemetryEvent):
    | { readonly status: "emitted" | "duplicate"; readonly event: AuthorityFreeTelemetryEvent }
    | { readonly status: "rejected-authority" | "conflict" } {
    if (
      candidate.studyAuthority !== false ||
      candidate.studyMutationAllowed !== false ||
      candidate.instructionalUseAllowed !== false
    ) {
      return { status: "rejected-authority" };
    }
    const existing = this.#events.get(candidate.eventRef);
    if (existing) {
      return canonicalize(existing) === canonicalize(candidate)
        ? { status: "duplicate", event: structuredClone(existing) }
        : { status: "conflict" };
    }
    const event = deepFreeze(structuredClone(candidate));
    this.#events.set(candidate.eventRef, event);
    return { status: "emitted", event: structuredClone(event) };
  }

  get eventCount(): number {
    return this.#events.size;
  }
}

export interface ParentAcceptedStateProjection {
  readonly projectionRef: string;
  readonly logicalOperationRef: string;
  readonly acceptedStudyReceiptRef: string;
  readonly effectRef: string;
  readonly memoryRevisionRef: string;
  readonly status: "accepted-state";
}

export class AcceptedStateParentProjectionSink {
  readonly #projections = new Map<string, ParentAcceptedStateProjection>();

  derive(
    projectionRef: string,
    receipt: StudyEffectReceipt,
    memoryRevisionRef: string,
  ): { readonly status: "projected" | "duplicate"; readonly projection: ParentAcceptedStateProjection } {
    const candidate = deepFreeze({
      projectionRef,
      logicalOperationRef: receipt.logicalOperationRef,
      acceptedStudyReceiptRef: receipt.receiptRef,
      effectRef: receipt.effectRef,
      memoryRevisionRef,
      status: "accepted-state" as const,
    });
    const existing = this.#projections.get(projectionRef);
    if (existing) {
      if (canonicalize(existing) !== canonicalize(candidate)) {
        throw new Error("parent projection identity conflict");
      }
      return { status: "duplicate", projection: structuredClone(existing) };
    }
    this.#projections.set(projectionRef, candidate);
    return { status: "projected", projection: structuredClone(candidate) };
  }

  read(projectionRef: string): ParentAcceptedStateProjection | null {
    const projection = this.#projections.get(projectionRef);
    return projection ? structuredClone(projection) : null;
  }

  get projectionCount(): number {
    return this.#projections.size;
  }
}

export interface ReplayCrashTransition {
  readonly sequence: number;
  readonly eventKind:
    | "record-created"
    | "boundary-entered"
    | "state-transition"
    | "failure-injected"
    | "idempotent-reuse"
    | "physical-attempt-observed"
    | "late-response-ignored"
    | "quarantined";
  readonly stateBefore: ReplayCrashPipelineState;
  readonly stateAfter: ReplayCrashPipelineState;
  readonly boundary: ReplayCrashBoundary | null;
  readonly physicalAttemptRef: string | null;
  readonly detail: string;
}

export type ReplayCrashQuarantineCode =
  | "INVALID_ROUTE_PLAN"
  | "CONFLICTING_REPLAY"
  | "IMMUTABLE_PLAN_CONFLICT"
  | "PROVIDER_RESPONSE_CONFLICT"
  | "STUDY_EFFECT_CONFLICT"
  | "MEMORY_DELTA_REJECTED"
  | "TELEMETRY_REJECTED";

export interface ReplayCrashOperationRecord {
  readonly logicalOperationRef: string;
  readonly requestFingerprint: string;
  readonly payloadFingerprint: string;
  readonly planFingerprint: string;
  readonly request: ReplayCrashRequest;
  state: ReplayCrashPipelineState;
  readonly transitions: ReplayCrashTransition[];
  pinnedPlan: CertificationRoutePlan | null;
  reservationRef: string | null;
  activeAttemptIndex: number;
  readonly indeterminateAttemptRefs: string[];
  providerEnvelope: ProviderResponseEnvelope | null;
  advisoryDigest: string | null;
  studyReceipt: StudyEffectReceipt | null;
  memoryRevisionRef: string | null;
  telemetryDisposition: "emitted" | "duplicate" | null;
  parentProjection: ParentAcceptedStateProjection | null;
  quarantineCode: ReplayCrashQuarantineCode | null;
}

export class EphemeralReplayCrashCertificationState {
  readonly records = new Map<string, ReplayCrashOperationRecord>();
  readonly provider = new DeterministicProvider();
  readonly study = new IdempotentStudyEffectLedger();
  readonly memory = new InstructionalMemoryProjectionStore();
  readonly telemetry = new IdempotentTelemetrySink();
  readonly parent = new AcceptedStateParentProjectionSink();
  nextTransitionSequence = 1;
}

export class DeterministicFailureInjector {
  #triggered = false;

  constructor(readonly crashAt: ReplayCrashBoundary | null) {}

  hit(boundary: ReplayCrashBoundary): boolean {
    if (!this.#triggered && this.crashAt === boundary) {
      this.#triggered = true;
      return true;
    }
    return false;
  }
}

class InjectedCrash extends Error {
  constructor(readonly boundary: ReplayCrashBoundary) {
    super(`deterministic crash at ${boundary}`);
  }
}

export type ReplayCrashRunResult =
  | {
      readonly status: "complete";
      readonly record: ReplayCrashOperationRecord;
      readonly summary: ReplayCrashFinalSummary;
    }
  | {
      readonly status: "crashed";
      readonly boundary: ReplayCrashBoundary;
      readonly record: ReplayCrashOperationRecord;
    }
  | {
      readonly status: "pending-dispatch-reconciliation";
      readonly record: ReplayCrashOperationRecord;
    }
  | {
      readonly status: "quarantined";
      readonly code: ReplayCrashQuarantineCode;
      readonly record: ReplayCrashOperationRecord;
    };

export interface ReplayCrashFinalSummary {
  readonly logicalOperationRef: string;
  readonly selectedPhysicalAttemptRef: string;
  readonly providerOutputDigest: string;
  readonly studyReceiptRef: string;
  readonly memoryRevisionRef: string;
  readonly telemetryEventRef: string;
  readonly parentProjectionRef: string;
}

export class ReplayCrashCertificationMachine {
  constructor(readonly certificationState: EphemeralReplayCrashCertificationState) {}

  run(
    requestCandidate: ReplayCrashRequest,
    injector = new DeterministicFailureInjector(null),
  ): ReplayCrashRunResult {
    const accepted = this.#acceptRequest(requestCandidate);
    if ("result" in accepted) return accepted.result;
    const record = accepted.record;
    try {
      for (;;) {
        switch (record.state) {
          case "received": {
            this.#checkpoint(record, "before-routing", injector);
            record.pinnedPlan = deepFreeze(structuredClone(record.request.routePlan));
            this.#transition(record, "route-planned", "immutable route plan pinned");
            this.#checkpoint(record, "after-route-plan", injector);
            break;
          }
          case "route-planned": {
            record.reservationRef = record.request.reservationRef;
            this.#transition(record, "reserved", "all planned physical attempts reserved");
            this.#checkpoint(record, "after-reservation", injector);
            break;
          }
          case "reserved": {
            this.#checkpoint(record, "before-provider-dispatch", injector);
            this.#transition(record, "dispatch-ready", "reservation verified before dispatch");
            break;
          }
          case "dispatch-ready": {
            const attempt = record.pinnedPlan?.attempts[record.activeAttemptIndex];
            if (!attempt) {
              this.#transition(record, "dispatch-unknown", "no response and dispatch remains indeterminate");
              return { status: "pending-dispatch-reconciliation", record: this.#copy(record) };
            }
            const dispatched = this.certificationState.provider.dispatch(
              attempt,
              record.payloadFingerprint,
            );
            this.#event(
              record,
              dispatched.disposition === "reused" ? "idempotent-reuse" : "physical-attempt-observed",
              `${dispatched.status} provider dispatch`,
              null,
              attempt.physicalAttemptRef,
            );
            this.#checkpoint(record, "after-provider-dispatch-before-receipt", injector);
            if (dispatched.status === "confirmed-not-dispatched") {
              record.activeAttemptIndex += 1;
              this.#event(
                record,
                "physical-attempt-observed",
                "advance to next immutable planned attempt after confirmed non-dispatch",
                null,
                attempt.physicalAttemptRef,
              );
              this.#transition(record, "reserved", "next planned attempt requires reservation recheck");
              break;
            }
            if (dispatched.status === "timeout-unknown") {
              if (!record.indeterminateAttemptRefs.includes(attempt.physicalAttemptRef)) {
                record.indeterminateAttemptRefs.push(attempt.physicalAttemptRef);
              }
              record.activeAttemptIndex += 1;
              if (record.pinnedPlan?.attempts[record.activeAttemptIndex]) {
                this.#transition(
                  record,
                  "reserved",
                  "indeterminate reserve retained; advance only to next pre-reserved attempt",
                );
                break;
              }
              this.#transition(record, "dispatch-unknown", "unknown dispatch has no planned failover");
              return { status: "pending-dispatch-reconciliation", record: this.#copy(record) };
            }
            record.providerEnvelope = structuredClone(dispatched.envelope);
            this.#transition(record, "response-received", "bounded provider response and receipt captured");
            this.#checkpoint(record, "after-provider-response-before-validation", injector);
            break;
          }
          case "dispatch-unknown":
            return { status: "pending-dispatch-reconciliation", record: this.#copy(record) };
          case "response-received": {
            const envelope = record.providerEnvelope;
            if (
              !envelope ||
              envelope.payloadDigest !== record.payloadFingerprint ||
              !record.pinnedPlan?.attempts.some(
                (attempt) => attempt.physicalAttemptRef === envelope.physicalAttemptRef,
              )
            ) {
              return this.#quarantine(record, "PROVIDER_RESPONSE_CONFLICT");
            }
            this.#transition(record, "response-validated", "response bound to payload and pinned attempt");
            break;
          }
          case "response-validated": {
            record.advisoryDigest = `advisory-digest:${digest({
              advisoryRef: record.request.advisoryRef,
              logicalOperationRef: record.logicalOperationRef,
              providerEnvelope: record.providerEnvelope,
              studyMutationAllowed: false,
            })}`;
            this.#transition(record, "advisory-constructed", "authority-free advisory constructed");
            this.#checkpoint(record, "after-advisory-construction", injector);
            break;
          }
          case "advisory-constructed": {
            this.#checkpoint(record, "before-study-effect", injector);
            this.#transition(record, "study-pending", "Study effect boundary entered");
            break;
          }
          case "study-pending": {
            const advisoryDigest = record.advisoryDigest;
            if (!advisoryDigest) return this.#quarantine(record, "STUDY_EFFECT_CONFLICT");
            const accepted = this.certificationState.study.accept({
              receiptRef: record.request.studyReceiptRef,
              logicalOperationRef: record.logicalOperationRef,
              advisoryDigest,
              effectRef: record.request.effectRef,
              effectDigest: record.request.effectDigest,
            });
            if (accepted.status === "conflict") {
              return this.#quarantine(record, "STUDY_EFFECT_CONFLICT");
            }
            if (accepted.status === "duplicate") {
              this.#event(record, "idempotent-reuse", "duplicate Study effect receipt reused");
            }
            record.studyReceipt = accepted.receipt;
            this.#transition(record, "study-accepted", "canonical Study effect accepted");
            this.#checkpoint(record, "after-study-effect-accepted", injector);
            break;
          }
          case "study-accepted": {
            this.#checkpoint(record, "before-memory-delta", injector);
            this.#transition(record, "memory-pending", "accepted event is memory reconstruction source");
            break;
          }
          case "memory-pending": {
            const memoryResult = this.certificationState.memory.apply(record.request.memoryDelta);
            this.#checkpoint(record, "during-memory-delta", injector);
            if (memoryResult.status === "rejected") {
              return this.#quarantine(record, "MEMORY_DELTA_REJECTED");
            }
            if (memoryResult.status === "duplicate") {
              this.#event(record, "idempotent-reuse", "duplicate memory delta reused");
            }
            record.memoryRevisionRef = memoryResult.projection.revisionRef;
            this.#transition(record, "memory-applied", "bounded instructional memory advanced");
            this.#checkpoint(record, "after-memory", injector);
            break;
          }
          case "memory-applied": {
            this.#checkpoint(record, "before-telemetry", injector);
            this.#transition(record, "telemetry-pending", "authority-free telemetry boundary entered");
            break;
          }
          case "telemetry-pending": {
            const telemetry = this.certificationState.telemetry.emit(this.#telemetryEvent(record));
            if (telemetry.status === "conflict" || telemetry.status === "rejected-authority") {
              return this.#quarantine(record, "TELEMETRY_REJECTED");
            }
            record.telemetryDisposition = telemetry.status;
            if (telemetry.status === "duplicate") {
              this.#event(record, "idempotent-reuse", "duplicate telemetry event reused");
            }
            this.#transition(record, "telemetry-emitted", "operational telemetry recorded");
            this.#checkpoint(record, "after-telemetry", injector);
            break;
          }
          case "telemetry-emitted": {
            this.#checkpoint(record, "before-parent-projection", injector);
            this.#transition(record, "parent-pending", "derive parent view from accepted state");
            break;
          }
          case "parent-pending": {
            const receipt = this.certificationState.study.read(record.logicalOperationRef);
            if (!receipt || !record.memoryRevisionRef) {
              return this.#quarantine(record, "STUDY_EFFECT_CONFLICT");
            }
            const projected = this.certificationState.parent.derive(
              record.request.parentProjectionRef,
              receipt,
              record.memoryRevisionRef,
            );
            if (projected.status === "duplicate") {
              this.#event(record, "idempotent-reuse", "duplicate parent projection reused");
            }
            record.parentProjection = projected.projection;
            this.#transition(record, "complete", "accepted-state parent projection complete");
            break;
          }
          case "complete":
            return {
              status: "complete",
              record: this.#copy(record),
              summary: this.#summary(record),
            };
          case "quarantined":
            return {
              status: "quarantined",
              code: record.quarantineCode ?? "CONFLICTING_REPLAY",
              record: this.#copy(record),
            };
        }
      }
    } catch (error) {
      if (!(error instanceof InjectedCrash)) throw error;
      return { status: "crashed", boundary: error.boundary, record: this.#copy(record) };
    }
  }

  readRecord(logicalOperationRef: string): ReplayCrashOperationRecord | null {
    const record = this.certificationState.records.get(logicalOperationRef);
    return record ? this.#copy(record) : null;
  }

  ingestProviderResponse(
    logicalOperationRef: string,
    envelope: ProviderResponseEnvelope,
  ): "duplicate" | "ignored-late" | "conflict" {
    const record = this.certificationState.records.get(logicalOperationRef);
    if (
      !record ||
      envelope.payloadDigest !== record.payloadFingerprint ||
      !record.pinnedPlan?.attempts.some(
        (attempt) => attempt.physicalAttemptRef === envelope.physicalAttemptRef,
      )
    ) {
      if (record) this.#quarantine(record, "PROVIDER_RESPONSE_CONFLICT");
      return "conflict";
    }
    if (!record.providerEnvelope) {
      record.providerEnvelope = structuredClone(envelope);
      record.state = "response-received";
      return "duplicate";
    }
    if (canonicalize(record.providerEnvelope) === canonicalize(envelope)) {
      this.#event(
        record,
        "idempotent-reuse",
        "duplicate physical provider response ignored",
        null,
        envelope.physicalAttemptRef,
      );
      return "duplicate";
    }
    if (record.providerEnvelope.physicalAttemptRef !== envelope.physicalAttemptRef) {
      this.#event(
        record,
        "late-response-ignored",
        "late response from indeterminate planned attempt cannot replace selected response",
        null,
        envelope.physicalAttemptRef,
      );
      return "ignored-late";
    }
    this.#quarantine(record, "PROVIDER_RESPONSE_CONFLICT");
    return "conflict";
  }

  replayStudyEffectReceipt(logicalOperationRef: string): "duplicate" | "conflict" {
    const record = this.certificationState.records.get(logicalOperationRef);
    if (!record?.studyReceipt) return "conflict";
    const receipt = record.studyReceipt;
    const result = this.certificationState.study.accept({
      receiptRef: receipt.receiptRef,
      logicalOperationRef: receipt.logicalOperationRef,
      advisoryDigest: receipt.advisoryDigest,
      effectRef: receipt.effectRef,
      effectDigest: receipt.effectDigest,
    });
    if (result.status === "duplicate") {
      this.#event(record, "idempotent-reuse", "duplicate Study effect receipt ignored");
      return "duplicate";
    }
    return "conflict";
  }

  replayMemoryDelta(logicalOperationRef: string): ApplyInstructionalMemoryDeltaResult {
    const record = this.certificationState.records.get(logicalOperationRef);
    if (!record) return { status: "rejected", code: "INVALID_MEMORY_DELTA", tutorMayUseMemory: false };
    const result = this.certificationState.memory.apply(record.request.memoryDelta);
    if (result.status === "duplicate") {
      this.#event(record, "idempotent-reuse", "duplicate memory delta ignored");
    }
    return result;
  }

  replayTelemetry(logicalOperationRef: string): "duplicate" | "conflict" {
    const record = this.certificationState.records.get(logicalOperationRef);
    if (!record?.providerEnvelope) return "conflict";
    const result = this.certificationState.telemetry.emit(this.#telemetryEvent(record));
    if (result.status === "duplicate") {
      this.#event(record, "idempotent-reuse", "duplicate telemetry event ignored");
      return "duplicate";
    }
    return "conflict";
  }

  #acceptRequest(request: ReplayCrashRequest):
    | { readonly record: ReplayCrashOperationRecord }
    | { readonly result: ReplayCrashRunResult } {
    const existing = this.certificationState.records.get(request.logicalOperationRef);
    const payloadFingerprint = digest({
      logicalOperationRef: request.logicalOperationRef,
      payload: request.payload,
      advisoryRef: request.advisoryRef,
      effectRef: request.effectRef,
      effectDigest: request.effectDigest,
      studyReceiptRef: request.studyReceiptRef,
      memoryDelta: request.memoryDelta,
      telemetryEventRef: request.telemetryEventRef,
      parentProjectionRef: request.parentProjectionRef,
    });
    const planFingerprint = digest({
      routePlan: request.routePlan,
      reservationRef: request.reservationRef,
    });
    const requestFingerprint = digest(request);
    if (existing) {
      if (existing.payloadFingerprint !== payloadFingerprint) {
        return { result: this.#quarantine(existing, "CONFLICTING_REPLAY") };
      }
      if (existing.planFingerprint !== planFingerprint) {
        return { result: this.#quarantine(existing, "IMMUTABLE_PLAN_CONFLICT") };
      }
      this.#event(existing, "idempotent-reuse", "exact logical request replay accepted");
      if (existing.state === "quarantined") {
        return {
          result: {
            status: "quarantined",
            code: existing.quarantineCode ?? "CONFLICTING_REPLAY",
            record: this.#copy(existing),
          },
        };
      }
      return { record: existing };
    }
    const requestCopy = deepFreeze(structuredClone(request));
    const record: ReplayCrashOperationRecord = {
      logicalOperationRef: request.logicalOperationRef,
      requestFingerprint,
      payloadFingerprint,
      planFingerprint,
      request: requestCopy,
      state: "received",
      transitions: [],
      pinnedPlan: null,
      reservationRef: null,
      activeAttemptIndex: 0,
      indeterminateAttemptRefs: [],
      providerEnvelope: null,
      advisoryDigest: null,
      studyReceipt: null,
      memoryRevisionRef: null,
      telemetryDisposition: null,
      parentProjection: null,
      quarantineCode: null,
    };
    this.certificationState.records.set(request.logicalOperationRef, record);
    this.#event(record, "record-created", "logical operation claimed");
    if (
      !plansAreValid(request.routePlan, request.logicalOperationRef) ||
      request.memoryDelta.logicalOperationRef !== request.logicalOperationRef ||
      request.memoryDelta.sourceEventRef !== request.studyReceiptRef
    ) {
      return { result: this.#quarantine(record, "INVALID_ROUTE_PLAN") };
    }
    return { record };
  }

  #telemetryEvent(record: ReplayCrashOperationRecord): AuthorityFreeTelemetryEvent {
    const physicalAttemptRef = record.providerEnvelope?.physicalAttemptRef;
    if (!physicalAttemptRef) throw new Error("telemetry requires a selected physical attempt");
    return {
      eventRef: record.request.telemetryEventRef,
      logicalOperationRef: record.logicalOperationRef,
      physicalAttemptRef,
      studyAuthority: false,
      studyMutationAllowed: false,
      instructionalUseAllowed: false,
    };
  }

  #checkpoint(
    record: ReplayCrashOperationRecord,
    boundary: ReplayCrashBoundary,
    injector: DeterministicFailureInjector,
  ): void {
    this.#event(record, "boundary-entered", boundary, boundary);
    if (injector.hit(boundary)) {
      this.#event(record, "failure-injected", `deterministic failure at ${boundary}`, boundary);
      throw new InjectedCrash(boundary);
    }
  }

  #transition(
    record: ReplayCrashOperationRecord,
    stateAfter: ReplayCrashPipelineState,
    detail: string,
  ): void {
    const stateBefore = record.state;
    record.state = stateAfter;
    record.transitions.push({
      sequence: this.certificationState.nextTransitionSequence++,
      eventKind: "state-transition",
      stateBefore,
      stateAfter,
      boundary: null,
      physicalAttemptRef: null,
      detail,
    });
  }

  #event(
    record: ReplayCrashOperationRecord,
    eventKind: ReplayCrashTransition["eventKind"],
    detail: string,
    boundary: ReplayCrashBoundary | null = null,
    physicalAttemptRef: string | null = null,
  ): void {
    record.transitions.push({
      sequence: this.certificationState.nextTransitionSequence++,
      eventKind,
      stateBefore: record.state,
      stateAfter: record.state,
      boundary,
      physicalAttemptRef,
      detail,
    });
  }

  #quarantine(
    record: ReplayCrashOperationRecord,
    code: ReplayCrashQuarantineCode,
  ): Extract<ReplayCrashRunResult, { readonly status: "quarantined" }> {
    const stateBefore = record.state;
    record.state = "quarantined";
    record.quarantineCode = code;
    record.transitions.push({
      sequence: this.certificationState.nextTransitionSequence++,
      eventKind: "quarantined",
      stateBefore,
      stateAfter: "quarantined",
      boundary: null,
      physicalAttemptRef: null,
      detail: code,
    });
    return { status: "quarantined", code, record: this.#copy(record) };
  }

  #summary(record: ReplayCrashOperationRecord): ReplayCrashFinalSummary {
    if (
      !record.providerEnvelope ||
      !record.studyReceipt ||
      !record.memoryRevisionRef ||
      !record.parentProjection
    ) {
      throw new Error("complete operation is missing final state");
    }
    return {
      logicalOperationRef: record.logicalOperationRef,
      selectedPhysicalAttemptRef: record.providerEnvelope.physicalAttemptRef,
      providerOutputDigest: record.providerEnvelope.outputDigest,
      studyReceiptRef: record.studyReceipt.receiptRef,
      memoryRevisionRef: record.memoryRevisionRef,
      telemetryEventRef: record.request.telemetryEventRef,
      parentProjectionRef: record.parentProjection.projectionRef,
    };
  }

  #copy(record: ReplayCrashOperationRecord): ReplayCrashOperationRecord {
    return structuredClone(record);
  }
}
