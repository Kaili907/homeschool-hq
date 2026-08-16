import { Type, type Static } from "../../schema/typebox.js";
import { OpaqueReferenceSchema } from "../../v2/contracts/primitives.js";
import { validateExact } from "../../v2/contracts/validation.js";
import { ImmutableDigestSchema, type CommercialAttempt } from "./contracts.js";

export const COMMERCIAL_EXECUTION_ELIGIBILITY_VERSION =
  "study-tutor-v3.current-execution-eligibility.v1" as const;

export const CurrentCommercialExecutionEligibilitySchema = Type.Object(
  {
    contractVersion: Type.Literal(COMMERCIAL_EXECUTION_ELIGIBILITY_VERSION),
    evidenceKind: Type.Literal("trusted-current-commercial-execution-eligibility"),
    issuedBy: Type.Literal("study-runtime"),
    phase: Type.Union([
      Type.Literal("before-dispatch"),
      Type.Literal("before-response-acceptance"),
    ]),
    commercialScopeRef: OpaqueReferenceSchema,
    reservationRef: OpaqueReferenceSchema,
    logicalOperationRef: OpaqueReferenceSchema,
    physicalAttemptRef: OpaqueReferenceSchema,
    routeRef: OpaqueReferenceSchema,
    providerRef: OpaqueReferenceSchema,
    modelRef: OpaqueReferenceSchema,
    modelRevisionRef: OpaqueReferenceSchema,
    configurationDigest: ImmutableDigestSchema,
    capabilityProfileRevisionRef: OpaqueReferenceSchema,
    capabilityProfileDigest: ImmutableDigestSchema,
    providerPolicyRevisionRef: OpaqueReferenceSchema,
    providerPolicyEvidenceRef: OpaqueReferenceSchema,
    providerPolicyState: Type.Literal("active"),
    availabilityRef: OpaqueReferenceSchema,
    availabilityState: Type.Literal("AVAILABLE"),
    circuitState: Type.Literal("closed"),
    actionFamily: Type.Union([
      Type.Literal("EXPLANATION"),
      Type.Literal("HINT"),
      Type.Literal("GUIDING_QUESTION"),
      Type.Literal("GROUNDED_EXAMPLE"),
      Type.Literal("PREREQUISITE_RECOMMENDATION"),
      Type.Literal("PARENT_SAFE_DRAFT"),
    ]),
    modalityRequirement: Type.Union([
      Type.Literal("TEXT_ONLY"),
      Type.Literal("REVIEWED_IMAGE"),
    ]),
    eligibilityEvidenceRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV3CurrentCommercialExecutionEligibility" },
);
export type CurrentCommercialExecutionEligibility = Static<
  typeof CurrentCommercialExecutionEligibilitySchema
>;

export interface CurrentCommercialExecutionEligibilityRequest {
  readonly phase: CurrentCommercialExecutionEligibility["phase"];
  readonly commercialScopeRef: string;
  readonly reservationRef: string;
  readonly actionFamily: CurrentCommercialExecutionEligibility["actionFamily"];
  readonly modalityRequirement: CurrentCommercialExecutionEligibility["modalityRequirement"];
  readonly attempt: CommercialAttempt;
}

/** Trusted, provider-neutral current-state resolver owned by the Study runtime. */
export interface CommercialExecutionEligibilityResolver {
  resolve(request: CurrentCommercialExecutionEligibilityRequest): unknown;
}

export function validateCurrentCommercialExecutionEligibility(
  candidate: unknown,
  request: CurrentCommercialExecutionEligibilityRequest,
): CurrentCommercialExecutionEligibility | null {
  const validation = validateExact(CurrentCommercialExecutionEligibilitySchema, candidate);
  if (validation.status === "rejected") return null;
  const evidence = validation.value;
  const attempt = request.attempt;
  return evidence.phase === request.phase &&
      evidence.commercialScopeRef === request.commercialScopeRef &&
      evidence.reservationRef === request.reservationRef &&
      evidence.logicalOperationRef === attempt.logicalOperationRef &&
      evidence.physicalAttemptRef === attempt.physicalAttemptRef &&
      evidence.routeRef === attempt.routeRef &&
      evidence.providerRef === attempt.providerRef &&
      evidence.modelRef === attempt.modelRef &&
      evidence.modelRevisionRef === attempt.modelRevisionRef &&
      evidence.configurationDigest === attempt.configurationDigest &&
      evidence.capabilityProfileRevisionRef === attempt.capabilityProfileRevisionRef &&
      evidence.capabilityProfileDigest === attempt.capabilityProfileDigest &&
      evidence.providerPolicyRevisionRef === attempt.providerPolicyRevisionRef &&
      evidence.providerPolicyEvidenceRef === attempt.providerPolicyEvidenceRef &&
      evidence.actionFamily === request.actionFamily &&
      evidence.modalityRequirement === request.modalityRequirement
    ? evidence
    : null;
}

export const PHYSICAL_ATTEMPT_DISPATCH_CLAIM_VERSION =
  "study-tutor-v3.physical-attempt-dispatch-claim.v1" as const;

export interface PhysicalAttemptDispatchClaim {
  readonly claimVersion: typeof PHYSICAL_ATTEMPT_DISPATCH_CLAIM_VERSION;
  readonly commercialScopeRef: string;
  readonly reservationRef: string;
  readonly logicalOperationRef: string;
  readonly physicalAttemptRef: string;
}

export type PhysicalAttemptDispatchClaimResult = "CLAIMED" | "ALREADY_CLAIMED" | "CONFLICT";

export interface PhysicalAttemptDispatchClaimPort {
  claimPhysicalAttemptDispatch(
    claim: PhysicalAttemptDispatchClaim,
  ): PhysicalAttemptDispatchClaimResult;
}

function dispatchIdentity(claim: PhysicalAttemptDispatchClaim): string {
  return [
    claim.commercialScopeRef,
    claim.reservationRef,
    claim.logicalOperationRef,
    claim.physicalAttemptRef,
  ].join("\u0000");
}

/** Explicit caller-owned reference store. It contains no module-global state. */
export class InMemoryPhysicalAttemptDispatchClaimStore
implements PhysicalAttemptDispatchClaimPort {
  readonly #claimsByPhysicalAttempt = new Map<string, string>();

  claimPhysicalAttemptDispatch(
    claim: PhysicalAttemptDispatchClaim,
  ): PhysicalAttemptDispatchClaimResult {
    if (
      claim.claimVersion !== PHYSICAL_ATTEMPT_DISPATCH_CLAIM_VERSION ||
      validateExact(OpaqueReferenceSchema, claim.commercialScopeRef).status === "rejected" ||
      validateExact(OpaqueReferenceSchema, claim.reservationRef).status === "rejected" ||
      validateExact(OpaqueReferenceSchema, claim.logicalOperationRef).status === "rejected" ||
      validateExact(OpaqueReferenceSchema, claim.physicalAttemptRef).status === "rejected"
    ) {
      return "CONFLICT";
    }
    const identity = dispatchIdentity(claim);
    const existing = this.#claimsByPhysicalAttempt.get(claim.physicalAttemptRef);
    if (existing === identity) return "ALREADY_CLAIMED";
    if (existing !== undefined) return "CONFLICT";
    this.#claimsByPhysicalAttempt.set(claim.physicalAttemptRef, identity);
    return "CLAIMED";
  }
}
