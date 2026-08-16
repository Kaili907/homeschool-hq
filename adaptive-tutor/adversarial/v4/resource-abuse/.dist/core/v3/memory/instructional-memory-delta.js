import { Type } from "../../schema/typebox.js";
import { AssistanceLevelSchema, HintLevelSchema, OpaqueReferenceSchema, PolicyCodeSchema, } from "../../v2/contracts/primitives.js";
import { validateExact } from "../../v2/contracts/validation.js";
import { InstructionalMemoryContentSchema, InstructionalMemoryScopeSchema, StudyApprovedInstructionalStateSchema, } from "./bounded-instructional-memory.js";
export const MAXIMUM_INSTRUCTIONAL_MEMORY_DELTA_OPERATIONS = 16;
const MemoryArrayFieldSchema = Type.Union([
    Type.Literal("conceptRefs"),
    Type.Literal("reviewedContentRefs"),
    Type.Literal("recentActionReasonCodes"),
]);
const MemoryReplaceFieldSchema = Type.Union([
    MemoryArrayFieldSchema,
    Type.Literal("lastAssistanceLevel"),
    Type.Literal("lastHintLevel"),
    Type.Literal("studyApprovedState"),
]);
const MemoryArrayValueSchema = Type.Union([OpaqueReferenceSchema, PolicyCodeSchema]);
const MemoryReplaceValueSchema = Type.Union([
    Type.Array(OpaqueReferenceSchema, { maxItems: 12 }),
    Type.Array(PolicyCodeSchema, { maxItems: 8 }),
    AssistanceLevelSchema,
    HintLevelSchema,
    StudyApprovedInstructionalStateSchema,
    Type.Null(),
]);
export const InstructionalMemoryAddOperationSchema = Type.Object({
    operationKind: Type.Literal("add"),
    field: MemoryArrayFieldSchema,
    value: MemoryArrayValueSchema,
}, { additionalProperties: false });
export const InstructionalMemoryRemoveOperationSchema = Type.Object({
    operationKind: Type.Literal("remove"),
    field: MemoryArrayFieldSchema,
    value: MemoryArrayValueSchema,
}, { additionalProperties: false });
export const InstructionalMemoryReplaceOperationSchema = Type.Object({
    operationKind: Type.Literal("replace"),
    field: MemoryReplaceFieldSchema,
    value: MemoryReplaceValueSchema,
}, { additionalProperties: false });
export const InstructionalMemoryDeltaOperationSchema = Type.Union([
    InstructionalMemoryAddOperationSchema,
    InstructionalMemoryRemoveOperationSchema,
    InstructionalMemoryReplaceOperationSchema,
]);
const NullableOpaqueReferenceSchema = Type.Union([OpaqueReferenceSchema, Type.Null()]);
const MemoryDigestSchema = Type.String({ pattern: "^memory-digest:[a-f0-9]{64}$" });
export const InstructionalMemoryDeltaSchema = Type.Object({
    deltaKind: Type.Literal("bounded-instructional-memory-delta"),
    logicalOperationRef: OpaqueReferenceSchema,
    sourceEventRef: OpaqueReferenceSchema,
    memoryDeltaRef: OpaqueReferenceSchema,
    memoryRef: OpaqueReferenceSchema,
    scope: InstructionalMemoryScopeSchema,
    expectedPriorRevisionRef: NullableOpaqueReferenceSchema,
    expectedPriorDigest: Type.Union([MemoryDigestSchema, Type.Null()]),
    operations: Type.Array(InstructionalMemoryDeltaOperationSchema, {
        minItems: 1,
        maxItems: MAXIMUM_INSTRUCTIONAL_MEMORY_DELTA_OPERATIONS,
    }),
    resultingRevisionRef: OpaqueReferenceSchema,
    resultingDigest: MemoryDigestSchema,
    persistenceAllowed: Type.Literal(false),
    officialMasteryAuthority: Type.Literal(false),
    studyMutationAllowed: Type.Literal(false),
    gradeMutationAllowed: Type.Literal(false),
    placementMutationAllowed: Type.Literal(false),
    curriculumMutationAllowed: Type.Literal(false),
}, { additionalProperties: false, $id: "TutorV3InstructionalMemoryDelta" });
export const InstructionalMemoryProjectionSchema = Type.Object({
    projectionKind: Type.Literal("bounded-instructional-memory-projection"),
    memoryRef: OpaqueReferenceSchema,
    scope: InstructionalMemoryScopeSchema,
    instructionalState: InstructionalMemoryContentSchema,
    revisionRef: OpaqueReferenceSchema,
    digest: MemoryDigestSchema,
    lastLogicalOperationRef: OpaqueReferenceSchema,
    lastSourceEventRef: OpaqueReferenceSchema,
    lastMemoryDeltaRef: OpaqueReferenceSchema,
    persistenceAllowed: Type.Literal(false),
    officialMasteryAuthority: Type.Literal(false),
    studyMutationAllowed: Type.Literal(false),
    gradeMutationAllowed: Type.Literal(false),
    placementMutationAllowed: Type.Literal(false),
    curriculumMutationAllowed: Type.Literal(false),
}, { additionalProperties: false, $id: "TutorV3InstructionalMemoryProjection" });
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
function fingerprint(value) {
    const canonical = canonicalize(value);
    return [0, 1, 2, 3].map((part) => fnv1a64(`${part}:${canonical}`)).join("");
}
function memoryDigest(memoryRef, scope, instructionalState) {
    return `memory-digest:${fingerprint({ memoryRef, scope, instructionalState })}`;
}
function scopesMatch(left, right) {
    return (left.scopeKind === right.scopeKind &&
        left.learnerScopeRef === right.learnerScopeRef &&
        left.sessionRef === right.sessionRef &&
        left.contextRef === right.contextRef &&
        left.opportunityRef === right.opportunityRef);
}
function unique(items) {
    return new Set(items).size === items.length;
}
function validContent(content) {
    return (validateExact(InstructionalMemoryContentSchema, content).status === "accepted" &&
        unique(content.conceptRefs) &&
        unique(content.reviewedContentRefs) &&
        unique(content.recentActionReasonCodes));
}
function isArrayField(field) {
    return (field === "conceptRefs" ||
        field === "reviewedContentRefs" ||
        field === "recentActionReasonCodes");
}
function validArrayValue(field, value) {
    if (typeof value !== "string")
        return false;
    if (field === "recentActionReasonCodes") {
        return validateExact(PolicyCodeSchema, value).status === "accepted";
    }
    return validateExact(OpaqueReferenceSchema, value).status === "accepted";
}
function validReplaceValue(field, value) {
    if (isArrayField(field)) {
        return Array.isArray(value) && value.every((item) => validArrayValue(field, item));
    }
    if (field === "lastAssistanceLevel") {
        return value === null || validateExact(AssistanceLevelSchema, value).status === "accepted";
    }
    if (field === "lastHintLevel") {
        return validateExact(HintLevelSchema, value).status === "accepted";
    }
    if (field === "studyApprovedState") {
        return (value === null ||
            validateExact(StudyApprovedInstructionalStateSchema, value).status === "accepted");
    }
    return false;
}
function applyOperations(prior, operations) {
    const state = structuredClone(prior ?? {
        conceptRefs: [],
        lastAssistanceLevel: null,
        lastHintLevel: "none",
        reviewedContentRefs: [],
        studyApprovedState: null,
        recentActionReasonCodes: [],
    });
    for (const operation of operations) {
        if (operation.operationKind === "add" || operation.operationKind === "remove") {
            if (!isArrayField(operation.field) || !validArrayValue(operation.field, operation.value)) {
                return null;
            }
            const values = state[operation.field];
            if (operation.operationKind === "add") {
                if (!values.includes(operation.value))
                    values.push(operation.value);
            }
            else {
                const index = values.indexOf(operation.value);
                if (index >= 0)
                    values.splice(index, 1);
            }
            continue;
        }
        if (!validReplaceValue(operation.field, operation.value))
            return null;
        if (isArrayField(operation.field)) {
            state[operation.field] = structuredClone(operation.value);
        }
        else if (operation.field === "lastAssistanceLevel") {
            state.lastAssistanceLevel = operation.value;
        }
        else if (operation.field === "lastHintLevel") {
            state.lastHintLevel = operation.value;
        }
        else {
            state.studyApprovedState = structuredClone(operation.value);
        }
    }
    return validContent(state) ? state : null;
}
function deriveResult(input) {
    const state = applyOperations(input.priorState, input.operations);
    if (!state)
        return null;
    const digest = memoryDigest(input.memoryRef, input.scope, state);
    const revision = `memory-revision:${fingerprint({
        logicalOperationRef: input.logicalOperationRef,
        sourceEventRef: input.sourceEventRef,
        memoryDeltaRef: input.memoryDeltaRef,
        memoryRef: input.memoryRef,
        scope: input.scope,
        expectedPriorRevisionRef: input.priorRevisionRef,
        expectedPriorDigest: input.priorDigest,
        operations: input.operations,
        resultingDigest: digest,
    })}`;
    return { state, digest, revision };
}
export function createInstructionalMemoryDelta(input) {
    if (input.prior && !scopesMatch(input.prior.scope, input.scope)) {
        throw new RangeError("prior memory projection scope does not match delta scope");
    }
    const result = deriveResult({
        ...input,
        priorRevisionRef: input.prior?.revisionRef ?? null,
        priorDigest: input.prior?.digest ?? null,
        priorState: input.prior?.instructionalState ?? null,
    });
    if (!result)
        throw new RangeError("memory delta operations do not produce valid bounded state");
    return {
        deltaKind: "bounded-instructional-memory-delta",
        logicalOperationRef: input.logicalOperationRef,
        sourceEventRef: input.sourceEventRef,
        memoryDeltaRef: input.memoryDeltaRef,
        memoryRef: input.memoryRef,
        scope: structuredClone(input.scope),
        expectedPriorRevisionRef: input.prior?.revisionRef ?? null,
        expectedPriorDigest: input.prior?.digest ?? null,
        operations: input.operations.map((operation) => structuredClone(operation)),
        resultingRevisionRef: result.revision,
        resultingDigest: result.digest,
        persistenceAllowed: false,
        officialMasteryAuthority: false,
        studyMutationAllowed: false,
        gradeMutationAllowed: false,
        placementMutationAllowed: false,
        curriculumMutationAllowed: false,
    };
}
function rejected(code) {
    return { status: "rejected", code, tutorMayUseMemory: false };
}
export class InstructionalMemoryProjectionStore {
    #projections = new Map();
    #logicalOperations = new Map();
    #deltas = new Map();
    get projectionCount() {
        return this.#projections.size;
    }
    read(memoryRef, scope) {
        const projection = this.#projections.get(memoryRef);
        if (!projection || !scopesMatch(projection.scope, scope))
            return null;
        return structuredClone(projection);
    }
    apply(candidate) {
        const validation = validateExact(InstructionalMemoryDeltaSchema, candidate);
        if (validation.status === "rejected")
            return rejected("INVALID_MEMORY_DELTA");
        const delta = validation.value;
        const deltaFingerprint = canonicalize(delta);
        const logicalIdentity = this.#logicalOperations.get(delta.logicalOperationRef);
        if (logicalIdentity) {
            if (logicalIdentity.fingerprint !== deltaFingerprint) {
                return rejected("CONFLICTING_LOGICAL_OPERATION");
            }
            const projection = this.#projections.get(logicalIdentity.memoryRef);
            return projection
                ? { status: "duplicate", projection: structuredClone(projection) }
                : rejected("STALE_MEMORY_REVISION");
        }
        const deltaIdentity = this.#deltas.get(delta.memoryDeltaRef);
        if (deltaIdentity) {
            return deltaIdentity.fingerprint === deltaFingerprint
                ? rejected("CONFLICTING_LOGICAL_OPERATION")
                : rejected("CONFLICTING_MEMORY_DELTA");
        }
        const prior = this.#projections.get(delta.memoryRef) ?? null;
        if (prior && !scopesMatch(prior.scope, delta.scope)) {
            return rejected("MEMORY_SCOPE_MISMATCH");
        }
        if ((prior?.revisionRef ?? null) !== delta.expectedPriorRevisionRef ||
            (prior?.digest ?? null) !== delta.expectedPriorDigest) {
            return rejected("STALE_MEMORY_REVISION");
        }
        const result = deriveResult({
            logicalOperationRef: delta.logicalOperationRef,
            sourceEventRef: delta.sourceEventRef,
            memoryDeltaRef: delta.memoryDeltaRef,
            memoryRef: delta.memoryRef,
            scope: delta.scope,
            operations: delta.operations,
            priorRevisionRef: delta.expectedPriorRevisionRef,
            priorDigest: delta.expectedPriorDigest,
            priorState: prior?.instructionalState ?? null,
        });
        if (!result ||
            result.revision !== delta.resultingRevisionRef ||
            result.digest !== delta.resultingDigest) {
            return rejected("RESULT_MISMATCH");
        }
        const projection = {
            projectionKind: "bounded-instructional-memory-projection",
            memoryRef: delta.memoryRef,
            scope: structuredClone(delta.scope),
            instructionalState: result.state,
            revisionRef: result.revision,
            digest: result.digest,
            lastLogicalOperationRef: delta.logicalOperationRef,
            lastSourceEventRef: delta.sourceEventRef,
            lastMemoryDeltaRef: delta.memoryDeltaRef,
            persistenceAllowed: false,
            officialMasteryAuthority: false,
            studyMutationAllowed: false,
            gradeMutationAllowed: false,
            placementMutationAllowed: false,
            curriculumMutationAllowed: false,
        };
        if (validateExact(InstructionalMemoryProjectionSchema, projection).status === "rejected") {
            return rejected("RESULT_MISMATCH");
        }
        const identity = {
            fingerprint: deltaFingerprint,
            memoryRef: delta.memoryRef,
            revisionRef: projection.revisionRef,
        };
        this.#projections.set(delta.memoryRef, projection);
        this.#logicalOperations.set(delta.logicalOperationRef, identity);
        this.#deltas.set(delta.memoryDeltaRef, identity);
        return { status: "applied", projection: structuredClone(projection) };
    }
}
