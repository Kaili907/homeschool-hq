import assert from "node:assert/strict";
import test from "node:test";
import {
  MODEL_CAPABILITY_PROFILE_VERSION,
  PROVIDER_AVAILABILITY_STATE_VERSION,
  PROVIDER_CAPABILITY_PROFILE_VERSION,
  ROUTING_REQUEST_VERSION,
  createEligibleRouteCatalog,
  routeProviderModel,
  type ModelCapabilityProfile,
  type ProviderCapabilityProfile,
  type RoutingRequest,
} from "../routing/provider-routing/index.js";
import {
  createTrustedProviderProfileRegistry,
  type ProviderEligibilityRequirements,
  type TrustedProviderProfile,
} from "../provider-policy/index.js";
import {
  validateProviderModelOutput,
  type InstructionalDisplayMode,
  type ModelOutputValidationContext,
  type NormalizedModelOutputResult,
} from "../model-output/index.js";
import {
  COMMERCIAL_RESPONSE_CONTRACT_VERSION,
  PRESENTATION_CONTRACT_VERSION,
  constrainPresentationByLearnerStageAllowance,
  mapTrustedAcceptedIntentToW306PresentationPieces,
  mapValidatedModelOutputToCommercialResponse,
  validateCommercialModelResponse,
  validatePresentationIntent,
  type CommercialProposalResponse,
  type PresentationIntent,
  type PresentationMappingContext,
  type TrustedPresentationBoundary,
} from "./index.js";

const textRef = "reviewed-content:text-one";
const visualRef = "reviewed-content:visual-one";
const checkRef = "reviewed-content:check-one";
const groundingRef = "grounding:lesson-one";
const digest = `sha256:${"a".repeat(64)}`;
const presentationScope = {
  householdScopeRef: "household:family-one",
  learnerScopeRef: "learner:learner-one",
  sessionRef: "session:lesson-one",
  interactionRef: "interaction:turn-one",
  opportunityRef: "opportunity:lesson-one",
} as const;

const reviewedImage = {
  kind: "image",
  contentRef: visualRef,
  contentDigest: digest,
  provenanceRef: "visual-review:image-one",
} as const;

const mappingContext: PresentationMappingContext = {
  reviewedVisuals: [reviewedImage],
  accessibilityCaptionRef: "caption-metadata:visual-one",
  requestSpeechAfterAcceptance: false,
  fallbackPresentation: {
    presentationRef: "presentation-fallback:lesson-one",
    requestedDeliveryChannels: ["text"],
  },
};

function acceptedProposal(
  instructionalDisplayMode: InstructionalDisplayMode,
  reviewedContentRefs: readonly string[],
): Extract<NormalizedModelOutputResult, { status: "accepted-proposal" }> {
  const context: ModelOutputValidationContext = {
    assessmentPhase: "instruction-or-practice",
    reviewedContentRefs: [...reviewedContentRefs],
    groundingRefs: [groundingRef],
    allowedTutorActions: ["hint"],
    allowedInstructionalDisplayModes: [instructionalDisplayMode],
  };
  const result = validateProviderModelOutput(
    {
      responseKind: "proposal",
      reviewedContentRefs: [...reviewedContentRefs],
      groundingRefs: [groundingRef],
      reasonCodes: ["needs-hint"],
      requestedTutorAction: "hint",
      instructionalDisplayMode,
      refusalState: "not-refused",
    },
    context,
  );
  assert.equal(result.status, "accepted-proposal");
  if (result.status !== "accepted-proposal") throw new Error("fixture was not accepted");
  return result;
}

function mappedProposal(
  displayMode: InstructionalDisplayMode,
  refs: readonly string[],
  context: PresentationMappingContext = mappingContext,
): CommercialProposalResponse {
  const result = mapValidatedModelOutputToCommercialResponse(
    acceptedProposal(displayMode, refs),
    context,
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted" || result.response.validationStatus !== "accepted-proposal") {
    throw new Error("proposal mapping failed");
  }
  return result.response;
}

function acceptance(intent: PresentationIntent) {
  return {
    acceptanceKind: "trusted-study-provider-output-acceptance",
    acceptanceRef: "presentation-acceptance:turn-one",
    scope: presentationScope,
    presentationIntent: intent,
  } as const;
}

function boundaryFor(intent: PresentationIntent): TrustedPresentationBoundary {
  const referenceBindings: TrustedPresentationBoundary["referenceBindings"] = [];
  if (intent.reviewedTextRef !== undefined) {
    referenceBindings.push({
      scope: presentationScope,
      referenceKind: "reviewed-text",
      referenceRef: intent.reviewedTextRef,
      referenceUse: "approved-instructional-reference",
    });
  }
  if (intent.structuredCheckRef !== undefined) {
    referenceBindings.push({
      scope: presentationScope,
      referenceKind: "structured-check",
      referenceRef: intent.structuredCheckRef,
      referenceUse: "approved-instructional-reference",
    });
  }
  if (intent.accessibilityCaptionRef !== undefined) {
    referenceBindings.push({
      scope: presentationScope,
      referenceKind: "accessibility-caption",
      referenceRef: intent.accessibilityCaptionRef,
      referenceUse: "neutral-accessibility-metadata",
    });
  }
  if (intent.fallbackPresentation !== undefined) {
    referenceBindings.push({
      scope: presentationScope,
      referenceKind: "fallback-presentation",
      referenceRef: intent.fallbackPresentation.presentationRef,
      referenceUse: "approved-fallback-reference",
    });
  }
  return {
    boundaryKind: "trusted-study-presentation-boundary",
    acceptanceRef: "presentation-acceptance:turn-one",
    scope: presentationScope,
    assessmentPhase: "not-active-protected-assessment",
    referenceBindings,
    reviewedVisualBindings: intent.reviewedVisual === undefined
      ? []
      : [{
          scope: presentationScope,
          reviewedVisual: intent.reviewedVisual,
          approvalStatus: "approved-content",
        }],
  };
}

test("maps reviewed-text to text-only presentation intent", () => {
  const response = mappedProposal("reviewed-text", [textRef]);
  assert.equal(response.presentationIntent.reviewedTextRef, textRef);
  assert.equal(response.presentationIntent.reviewedVisual, undefined);
  assert.deepEqual(response.presentationIntent.requestedDeliveryChannels, ["text"]);
  assert.deepEqual(response.groundingClaim.groundingRefs, [groundingRef]);
  assert.equal(Object.isFrozen(response), true);
  assert.equal(Object.isFrozen(response.validatedOutput), true);
  assert.equal(Object.isFrozen(response.groundingClaim.groundingRefs), true);
});

test("maps reviewed-visual without manufacturing instructional text", () => {
  const response = mappedProposal("reviewed-visual", [visualRef]);
  assert.equal(response.presentationIntent.reviewedTextRef, undefined);
  assert.deepEqual(response.presentationIntent.reviewedVisual, reviewedImage);
  assert.deepEqual(response.presentationIntent.requestedDeliveryChannels, ["visual"]);
});

test("preserves distinct text and visual pieces for reviewed-text-and-visual", () => {
  const response = mappedProposal("reviewed-text-and-visual", [textRef, visualRef]);
  const result = mapTrustedAcceptedIntentToW306PresentationPieces(
    acceptance(response.presentationIntent),
    boundaryFor(response.presentationIntent),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.deepEqual(
    result.presentation.pieces.map((piece) => piece.pieceKind),
    [
      "reviewed-text-reference",
      "reviewed-image-reference",
      "accessibility-caption-metadata",
      "fallback-presentation-reference",
    ],
  );
  assert.equal(result.presentation.pieces[0]?.pieceKind, "reviewed-text-reference");
  assert.equal(result.presentation.pieces[1]?.pieceKind, "reviewed-image-reference");
  assert.deepEqual(
    mapValidatedModelOutputToCommercialResponse(
      acceptedProposal("reviewed-text", [textRef, visualRef]),
      mappingContext,
    ),
    { status: "rejected", code: "DISPLAY_CONTENT_ARITY_MISMATCH" },
  );
});

test("keeps diagram kind through the W3-06 adapter", () => {
  const diagramContext: PresentationMappingContext = {
    reviewedVisuals: [{
      kind: "diagram",
      contentRef: visualRef,
      contentDigest: digest,
      provenanceRef: "visual-review:diagram-one",
    }],
    requestSpeechAfterAcceptance: false,
  };
  const response = mappedProposal("reviewed-visual", [visualRef], diagramContext);
  const result = mapTrustedAcceptedIntentToW306PresentationPieces(
    acceptance(response.presentationIntent),
    boundaryFor(response.presentationIntent),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.presentation.pieces[0]?.pieceKind, "reviewed-diagram-reference");
});

test("maps structured-check to its own reference slot", () => {
  const response = mappedProposal("structured-check", [checkRef]);
  assert.equal(response.presentationIntent.structuredCheckRef, checkRef);
  assert.equal(response.presentationIntent.reviewedTextRef, undefined);
  const result = mapTrustedAcceptedIntentToW306PresentationPieces(
    acceptance(response.presentationIntent),
    boundaryFor(response.presentationIntent),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.presentation.pieces[0]?.pieceKind, "structured-check-reference");
});

test("caption remains accessibility metadata and cannot become instructional text", () => {
  const response = mappedProposal("reviewed-visual", [visualRef]);
  const result = mapTrustedAcceptedIntentToW306PresentationPieces(
    acceptance(response.presentationIntent),
    boundaryFor(response.presentationIntent),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  const caption = result.presentation.pieces.find(
    (piece) => piece.pieceKind === "accessibility-caption-metadata",
  );
  assert.deepEqual(caption, {
    pieceKind: "accessibility-caption-metadata",
    captionRef: "caption-metadata:visual-one",
    instructionalText: false,
  });
  assert.equal(
    result.presentation.pieces.some((piece) => piece.pieceKind === "reviewed-text-reference"),
    false,
  );
  assert.equal(validatePresentationIntent({
    contractVersion: PRESENTATION_CONTRACT_VERSION,
    intentKind: "reference-only-presentation-intent",
    accessibilityCaptionRef: "caption-metadata:caption-only",
    requestedDeliveryChannels: ["text"],
  }).status, "rejected");
});

test("speech is emitted only as a post-acceptance delivery piece", () => {
  const response = mappedProposal("reviewed-text", [textRef], {
    reviewedVisuals: [],
    requestSpeechAfterAcceptance: true,
  });
  const allowed = constrainPresentationByLearnerStageAllowance(
    response.presentationIntent,
    { allowedModalities: ["text", "audio"], maximumModalitiesPerResponse: 2 },
  );
  assert.equal(allowed.status, "allowed");
  const beforeAcceptance = mapTrustedAcceptedIntentToW306PresentationPieces(
    response.presentationIntent,
  );
  assert.deepEqual(beforeAcceptance, {
    status: "rejected",
    code: "TRUSTED_ACCEPTANCE_REQUIRED",
  });
  const result = mapTrustedAcceptedIntentToW306PresentationPieces(
    acceptance(response.presentationIntent),
    boundaryFor(response.presentationIntent),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.deepEqual(result.presentation.pieces[1], {
    pieceKind: "speech-delivery",
    deliveryChannel: "speech-after-acceptance",
    sourceContentRef: textRef,
    acceptanceRequired: true,
    rawAudioAuthorityGranted: false,
  });
  assert.equal(Object.hasOwn(result.presentation.pieces[1] ?? {}, "audio"), false);
});

test("resolved learner-stage allowance can deny but cannot infer modality or content", () => {
  const response = mappedProposal("reviewed-visual", [visualRef]);
  const denied = constrainPresentationByLearnerStageAllowance(
    response.presentationIntent,
    { allowedModalities: ["text"], maximumModalitiesPerResponse: 1 },
  );
  assert.deepEqual(denied, {
    status: "denied",
    code: "LEARNER_STAGE_DENIES_MODALITY",
    deniedModalities: ["image"],
  });
  assert.equal(Object.hasOwn(denied, "learnerStage"), false);
  assert.equal(Object.hasOwn(denied, "reviewedTextRef"), false);
});

function provider(): ProviderCapabilityProfile {
  return {
    profileVersion: PROVIDER_CAPABILITY_PROFILE_VERSION,
    providerRef: "provider-profile:text-only",
    providerClass: "ZERO_RETENTION",
    lifecycle: "ACTIVE",
    modelRefs: ["model-profile:text-only"],
    minimumTimeoutMs: 100,
    maximumTimeoutMs: 2_000,
  };
}

function textOnlyModel(): ModelCapabilityProfile {
  return {
    profileVersion: MODEL_CAPABILITY_PROFILE_VERSION,
    modelRef: "model-profile:text-only",
    modelRevisionRef: "model-revision:text-only-r1",
    configurationDigest: `sha256:${"b".repeat(64)}`,
    capabilityProfileRevisionRef: "capability-profile:text-only-r1",
    capabilityProfileDigest: `sha256:${"c".repeat(64)}`,
    modelClass: "BALANCED_TEXT",
    providerRef: "provider-profile:text-only",
    routeRef: "route-profile:text-only",
    lifecycle: "ACTIVE",
    actionFamilies: ["HINT"],
    subjectCapabilities: ["SPATIAL_VISUAL_INTERPRETATION"],
    learnerStages: ["MIDDLE_GRADES"],
    safetyCapabilities: ["MINOR_STANDARD"],
    multimodalCapabilities: ["TEXT_ONLY"],
    reviewedContentSupport: "PROVIDED_REVIEWED_GROUNDING",
    maximumContextTokens: 4_096,
    maximumOutputTokens: 256,
    estimatedLatencyMs: 300,
    attemptTimeoutMs: 700,
    worstCaseCostMicros: "900",
  };
}

test("routing receives only the derived requirement and fails when modality is absent", () => {
  const response = mappedProposal("reviewed-visual", [visualRef]);
  const constrained = constrainPresentationByLearnerStageAllowance(
    response.presentationIntent,
    { allowedModalities: ["image"], maximumModalitiesPerResponse: 1 },
  );
  assert.equal(constrained.status, "allowed");
  if (constrained.status !== "allowed") return;
  assert.equal(constrained.routingCapabilityRequirement, "REVIEWED_IMAGE");

  const request: RoutingRequest = {
    requestVersion: ROUTING_REQUEST_VERSION,
    requestRef: "routing-request:presentation-one",
    routePlanRef: "route-plan:presentation-one",
    logicalOperationRef: "logical-operation:presentation-one",
    physicalAttemptRefs: ["physical-attempt:presentation-one"],
    actionFamily: "HINT",
    subjectCapability: "SPATIAL_VISUAL_INTERPRETATION",
    learnerStage: "MIDDLE_GRADES",
    contextSizeRequirement: { inputTokens: 500, requiredOutputTokens: 100 },
    safetyRequirement: "MINOR_STANDARD",
    latencyCeilingMs: 2_000,
    costCeilingMicros: "2000",
    reviewedContentRequirement: "PROVIDER_REVIEWED_GROUNDING_REQUIRED",
    multimodalRequirement: constrained.routingCapabilityRequirement,
    providerAvailability: [{
      stateVersion: PROVIDER_AVAILABILITY_STATE_VERSION,
      availabilityRef: "availability:presentation-one",
      providerRef: "provider-profile:text-only",
      modelRef: "model-profile:text-only",
      modelRevisionRef: "model-revision:text-only-r1",
      state: "AVAILABLE",
    }],
    studyPermissionBoundary: {
      permissionRef: "study-permission:presentation-one",
      authorizedActionFamily: "HINT",
      routingMayWidenPermissions: false,
      routingMayChangeMastery: false,
      routingMayChangeGrade: false,
      routingMayChangeWorkingLevel: false,
      routingMayChangeCurriculum: false,
    },
    staticFallbackPolicyRef: "fallback-policy:presentation-one",
  };
  const policyProfile: TrustedProviderProfile = {
    providerRef: "provider-profile:text-only",
    trainingUse: "prohibited",
    retention: { class: "none", maximumDurationHours: 0 },
    minorDataEligibility: "supported",
    dataResidency: { approvedRegions: ["us-east"] },
    dataDeletionCapability: "supported",
    multimodalEligibility: "approved",
    contractPolicyRevision: "provider-policy-revision:presentation-r1",
    policyEvidenceRef: "provider-policy-evidence:presentation-r1",
    policyEvidenceValidUntil: "2027-01-01T00:00:00.000Z",
    status: "active",
  };
  const requirements: ProviderEligibilityRequirements = {
    providerRef: policyProfile.providerRef,
    allowedRetentionClasses: ["none"],
    maximumRetentionHours: 0,
    requiredRegion: "us-east",
    modality: "multimodal",
    requiredContractPolicyRevision: "provider-policy-revision:presentation-r1",
    evaluatedAt: "2026-08-15T16:00:00.000Z",
  };
  const catalog = createEligibleRouteCatalog({
    providerProfiles: [provider()],
    modelProfiles: [textOnlyModel()],
    providerPolicyRegistry: createTrustedProviderProfileRegistry([policyProfile]),
    providerPolicyRequirements: [requirements],
  });
  assert.ok(catalog);
  const decision = routeProviderModel(request, catalog);
  assert.equal(decision.status, "NO_ELIGIBLE_PROVIDER_ROUTE");
  assert.equal(decision.reasonCodes.includes("MULTIMODAL_MISMATCH"), true);
});

test("raw audio, raw image bytes, and provider raw media are rejected", () => {
  const base = mappedProposal("reviewed-text", [textRef]).presentationIntent;
  assert.equal(validatePresentationIntent({ ...base, rawAudio: new Uint8Array([1]) }).status, "rejected");
  assert.equal(validatePresentationIntent({ ...base, rawImageBytes: "data:image/png;base64,AA==" }).status, "rejected");
  assert.equal(validatePresentationIntent({
    ...base,
    requestedDeliveryChannels: ["video"],
  }).status, "rejected");
  assert.equal(
    mapValidatedModelOutputToCommercialResponse(
      acceptedProposal("reviewed-text", [textRef]),
      { reviewedVisuals: [], requestSpeechAfterAcceptance: false, providerRawMedia: true },
    ).status,
    "rejected",
  );
});

test("unknown display mode remains rejected by W3-10", () => {
  const result = validateProviderModelOutput(
    {
      responseKind: "proposal",
      reviewedContentRefs: [textRef],
      groundingRefs: [groundingRef],
      reasonCodes: ["needs-hint"],
      requestedTutorAction: "hint",
      instructionalDisplayMode: "provider-custom-rich-media",
      refusalState: "not-refused",
    },
    {
      assessmentPhase: "instruction-or-practice",
      reviewedContentRefs: [textRef],
      groundingRefs: [groundingRef],
      allowedTutorActions: ["hint"],
      allowedInstructionalDisplayModes: ["reviewed-text"],
    },
  );
  assert.equal(result.status, "malformed");
});

test("commercial wrapper carries a closed validated refusal", () => {
  const refusal = validateProviderModelOutput(
    {
      responseKind: "refusal",
      reviewedContentRefs: [],
      groundingRefs: [],
      reasonCodes: ["insufficient-grounding"],
      requestedTutorAction: null,
      instructionalDisplayMode: "none",
      refusalState: "refused",
    },
    {
      assessmentPhase: "instruction-or-practice",
      reviewedContentRefs: [textRef],
      groundingRefs: [groundingRef],
      allowedTutorActions: ["hint"],
      allowedInstructionalDisplayModes: ["reviewed-text"],
    },
  );
  const mapped = mapValidatedModelOutputToCommercialResponse(refusal, {});
  assert.equal(mapped.status, "accepted");
  if (mapped.status !== "accepted") return;
  assert.equal(mapped.response.validationStatus, "refused");
  assert.equal(mapped.response.presentationIntent, null);
  assert.deepEqual(mapped.response.groundingClaim.groundingRefs, []);
});

test("authority fields are rejected from intent and commercial wrapper", () => {
  const response = mappedProposal("reviewed-text", [textRef]);
  assert.equal(validatePresentationIntent({
    ...response.presentationIntent,
    mastery: "provider-selected",
  }).status, "rejected");
  assert.equal(validateCommercialModelResponse({
    ...response,
    studyAuthority: { changeGrade: true },
  }).status, "rejected");
  assert.equal(validateCommercialModelResponse({
    ...response,
    contractVersion: COMMERCIAL_RESPONSE_CONTRACT_VERSION,
    groundingClaim: {
      ...response.groundingClaim,
      claimText: "The provider says this is grounded.",
    },
  }).status, "rejected");
  assert.equal(validateCommercialModelResponse({
    ...response,
    presentationIntent: {
      contractVersion: PRESENTATION_CONTRACT_VERSION,
      intentKind: "reference-only-presentation-intent",
      reviewedVisual: reviewedImage,
      requestedDeliveryChannels: ["visual"],
    },
  }).status, "rejected");
});
