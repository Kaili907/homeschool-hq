import { Type } from "../../schema/typebox.js";
import { ContentDigestSchema, OpaqueReferenceSchema, } from "../../v2/contracts/primitives.js";
import { validateExact } from "../../v2/contracts/validation.js";
import { CommercialExecutionScopeSchema, } from "../commercial-operation/index.js";
import { InstructionalMemoryDeltaSchema, InstructionalMemoryScopeSchema, } from "../memory/index.js";
const BoundedLineageIdentifierSchema = Type.String({
    minLength: 1,
    maxLength: 160,
    pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
});
export const RECOVERABLE_MEMORY_PROTOCOL_STATES = [
    "unclaimed",
    "effect-pending",
    "effect-accepted",
    "memory-pending",
    "complete",
    "quarantined",
];
export const MinimizedAcceptedStudyEffectEventSchema = Type.Object({
    eventKind: Type.Literal("minimized-study-effect-accepted"),
    commercialExecutionScopeRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    sourceEventRef: OpaqueReferenceSchema,
    effectRef: OpaqueReferenceSchema,
    effectDigest: ContentDigestSchema,
    conceptRef: OpaqueReferenceSchema,
    curriculumReleaseRef: BoundedLineageIdentifierSchema,
    curriculumPackageRef: OpaqueReferenceSchema,
    curriculumCourseRef: BoundedLineageIdentifierSchema,
    curriculumSubjectRef: BoundedLineageIdentifierSchema,
    curriculumUnitRef: BoundedLineageIdentifierSchema,
    curriculumLessonRef: BoundedLineageIdentifierSchema,
    scope: InstructionalMemoryScopeSchema,
    memoryDelta: InstructionalMemoryDeltaSchema,
    rawTranscriptIncluded: Type.Literal(false),
    officialMasteryAuthority: Type.Literal(false),
    gradeAuthority: Type.Literal(false),
    placementAuthority: Type.Literal(false),
    curriculumAuthority: Type.Literal(false),
}, { additionalProperties: false, $id: "TutorV3MinimizedAcceptedStudyEffectEvent" });
export const RecoverableInstructionalOperationSchema = Type.Object({
    recoveryKind: Type.Literal("recoverable-instructional-operation"),
    commercialExecutionScopeRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    sourceEventRef: OpaqueReferenceSchema,
    effectRef: OpaqueReferenceSchema,
    effectDigest: ContentDigestSchema,
    conceptRef: OpaqueReferenceSchema,
    curriculumReleaseRef: BoundedLineageIdentifierSchema,
    curriculumPackageRef: OpaqueReferenceSchema,
    curriculumCourseRef: BoundedLineageIdentifierSchema,
    curriculumSubjectRef: BoundedLineageIdentifierSchema,
    curriculumUnitRef: BoundedLineageIdentifierSchema,
    curriculumLessonRef: BoundedLineageIdentifierSchema,
    scope: InstructionalMemoryScopeSchema,
    memoryDelta: InstructionalMemoryDeltaSchema,
}, { additionalProperties: false, $id: "TutorV3RecoverableInstructionalOperation" });
function canonicalize(value) {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonicalize).join(",")}]`;
    const record = value;
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
        .join(",")}}`;
}
function fnv1a64(value) {
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= BigInt(value.charCodeAt(index));
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(16).padStart(16, "0");
}
function operationFingerprint(value) {
    return canonicalize(value);
}
function scopesMatch(left, right) {
    return (left.scopeKind === right.scopeKind &&
        left.learnerScopeRef === right.learnerScopeRef &&
        left.sessionRef === right.sessionRef &&
        left.contextRef === right.contextRef &&
        left.opportunityRef === right.opportunityRef);
}
function commercialScopeBindingsMatch(commercialScope, operation) {
    return (operation.commercialExecutionScopeRef === commercialScope.scopeRef &&
        operation.householdScopeRef === commercialScope.householdScopeRef &&
        operation.logicalOperationRef === commercialScope.logicalOperationRef &&
        operation.scope.learnerScopeRef === commercialScope.learnerScopeRef &&
        operation.scope.sessionRef === commercialScope.sessionRef &&
        operation.scope.contextRef === commercialScope.interactionRef &&
        operation.conceptRef === commercialScope.conceptRef &&
        operation.scope.opportunityRef === commercialScope.opportunityRef &&
        operation.curriculumReleaseRef === commercialScope.curriculumReleaseRef &&
        operation.curriculumPackageRef === commercialScope.curriculumPackageRef &&
        operation.curriculumCourseRef === commercialScope.curriculumCourseRef &&
        operation.curriculumSubjectRef === commercialScope.curriculumSubjectRef &&
        operation.curriculumUnitRef === commercialScope.curriculumUnitRef &&
        operation.curriculumLessonRef === commercialScope.curriculumLessonRef);
}
function deltaBindingsMatch(operation, delta) {
    return (delta.commercialExecutionScopeRef === operation.commercialExecutionScopeRef &&
        delta.householdScopeRef === operation.householdScopeRef &&
        delta.logicalOperationRef === operation.logicalOperationRef &&
        delta.sourceEventRef === operation.sourceEventRef &&
        delta.conceptRef === operation.conceptRef &&
        delta.curriculumReleaseRef === operation.curriculumReleaseRef &&
        delta.curriculumPackageRef === operation.curriculumPackageRef &&
        delta.curriculumCourseRef === operation.curriculumCourseRef &&
        delta.curriculumSubjectRef === operation.curriculumSubjectRef &&
        delta.curriculumUnitRef === operation.curriculumUnitRef &&
        delta.curriculumLessonRef === operation.curriculumLessonRef &&
        scopesMatch(delta.scope, operation.scope));
}
function eventBindingsMatch(operation, event) {
    return (event.commercialExecutionScopeRef === operation.commercialExecutionScopeRef &&
        event.householdScopeRef === operation.householdScopeRef &&
        event.logicalOperationRef === operation.logicalOperationRef &&
        event.sourceEventRef === operation.sourceEventRef &&
        event.effectRef === operation.effectRef &&
        event.effectDigest === operation.effectDigest &&
        event.conceptRef === operation.conceptRef &&
        event.curriculumReleaseRef === operation.curriculumReleaseRef &&
        event.curriculumPackageRef === operation.curriculumPackageRef &&
        event.curriculumCourseRef === operation.curriculumCourseRef &&
        event.curriculumSubjectRef === operation.curriculumSubjectRef &&
        event.curriculumUnitRef === operation.curriculumUnitRef &&
        event.curriculumLessonRef === operation.curriculumLessonRef &&
        scopesMatch(event.scope, operation.scope) &&
        operationFingerprint(event.memoryDelta) === operationFingerprint(operation.memoryDelta));
}
function copyRecord(record) {
    return structuredClone(record);
}
export class RecoverableInstructionalOperationCoordinator {
    #effectGateway;
    #memoryPort;
    #records = new Map();
    constructor(effectGateway, memoryPort) {
        this.#effectGateway = effectGateway;
        this.#memoryPort = memoryPort;
    }
    readRecord(logicalOperationRef) {
        const record = this.#records.get(logicalOperationRef);
        return record ? copyRecord(record) : null;
    }
    replay(trustedCommercialScopeCandidate, operationCandidate) {
        const trustedScopeValidation = validateExact(CommercialExecutionScopeSchema, trustedCommercialScopeCandidate);
        if (trustedScopeValidation.status === "rejected") {
            return { status: "rejected", code: "INVALID_TRUSTED_SCOPE" };
        }
        const operationValidation = validateExact(RecoverableInstructionalOperationSchema, operationCandidate);
        if (operationValidation.status === "rejected") {
            return { status: "rejected", code: "INVALID_RECOVERY_REQUEST" };
        }
        const operation = operationValidation.value;
        const requestFingerprint = operationFingerprint(operation);
        const existing = this.#records.get(operation.logicalOperationRef);
        if (existing && existing.requestFingerprint !== requestFingerprint) {
            return this.#quarantine(existing, "CONFLICTING_LOGICAL_OPERATION");
        }
        const record = existing ??
            this.#newRecord(operation.logicalOperationRef, requestFingerprint);
        this.#records.set(operation.logicalOperationRef, record);
        if (record.state === "quarantined") {
            return {
                status: "quarantined",
                record: copyRecord(record),
                code: record.quarantineCode ?? "CONFLICTING_LOGICAL_OPERATION",
            };
        }
        if (!commercialScopeBindingsMatch(trustedScopeValidation.value, operation)) {
            return this.#quarantine(record, "FOREIGN_SCOPE");
        }
        if (!deltaBindingsMatch(operation, operation.memoryDelta)) {
            return this.#quarantine(record, "INCONSISTENT_OPERATION_BINDING");
        }
        if (record.state === "complete" && record.acceptedEvent) {
            let replayedMemory;
            try {
                replayedMemory = this.#memoryPort.apply(record.acceptedEvent.memoryDelta);
            }
            catch {
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
        let acceptedEvent = null;
        let effectDisposition = "reused";
        let acceptedFromLookup = false;
        let lookup;
        try {
            lookup = this.#effectGateway.lookup(identity);
        }
        catch {
            this.#transition(record, "effect-pending");
            return { status: "pending", record: copyRecord(record), retryable: true };
        }
        if (lookup.status === "conflict") {
            return this.#quarantine(record, "CANONICAL_EFFECT_CONFLICT");
        }
        if (lookup.status === "accepted") {
            acceptedEvent = lookup.event;
            acceptedFromLookup = true;
        }
        else {
            this.#transition(record, "effect-pending");
            const ordinal = record.physicalAttempts.length + 1;
            const attempt = {
                physicalAttemptRef: `effect-attempt:${fnv1a64(`${operation.logicalOperationRef}:${ordinal}`)}`,
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
            }
            catch {
                attempt.outcome = "interrupted";
                return { status: "pending", record: copyRecord(record), retryable: true };
            }
        }
        if (validateExact(MinimizedAcceptedStudyEffectEventSchema, acceptedEvent).status ===
            "rejected" ||
            !eventBindingsMatch(operation, acceptedEvent)) {
            return this.#quarantine(record, "INVALID_ACCEPTED_EVENT");
        }
        record.acceptedEvent = structuredClone(acceptedEvent);
        if (record.state !== "memory-pending") {
            this.#transition(record, "effect-accepted");
        }
        this.#transition(record, "memory-pending");
        let memoryResult;
        try {
            // The canonical accepted event, not the retry payload, is the reconstruction source.
            memoryResult = this.#memoryPort.apply(acceptedEvent.memoryDelta);
        }
        catch {
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
    #newRecord(logicalOperationRef, requestFingerprint) {
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
    #transition(record, state) {
        if (record.state === state)
            return;
        record.state = state;
        record.stateHistory.push(state);
    }
    #quarantine(record, code) {
        record.quarantineCode = code;
        this.#transition(record, "quarantined");
        return { status: "quarantined", record: copyRecord(record), code };
    }
    #identity(operation) {
        return {
            commercialExecutionScopeRef: operation.commercialExecutionScopeRef,
            householdScopeRef: operation.householdScopeRef,
            logicalOperationRef: operation.logicalOperationRef,
            sourceEventRef: operation.sourceEventRef,
            effectRef: operation.effectRef,
            effectDigest: operation.effectDigest,
            conceptRef: operation.conceptRef,
            curriculumReleaseRef: operation.curriculumReleaseRef,
            curriculumPackageRef: operation.curriculumPackageRef,
            curriculumCourseRef: operation.curriculumCourseRef,
            curriculumSubjectRef: operation.curriculumSubjectRef,
            curriculumUnitRef: operation.curriculumUnitRef,
            curriculumLessonRef: operation.curriculumLessonRef,
            scope: structuredClone(operation.scope),
        };
    }
    #acceptedEvent(operation) {
        return {
            eventKind: "minimized-study-effect-accepted",
            commercialExecutionScopeRef: operation.commercialExecutionScopeRef,
            householdScopeRef: operation.householdScopeRef,
            logicalOperationRef: operation.logicalOperationRef,
            sourceEventRef: operation.sourceEventRef,
            effectRef: operation.effectRef,
            effectDigest: operation.effectDigest,
            conceptRef: operation.conceptRef,
            curriculumReleaseRef: operation.curriculumReleaseRef,
            curriculumPackageRef: operation.curriculumPackageRef,
            curriculumCourseRef: operation.curriculumCourseRef,
            curriculumSubjectRef: operation.curriculumSubjectRef,
            curriculumUnitRef: operation.curriculumUnitRef,
            curriculumLessonRef: operation.curriculumLessonRef,
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
