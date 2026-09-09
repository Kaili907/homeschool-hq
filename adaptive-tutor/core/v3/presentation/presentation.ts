import { validateExact } from "../../v2/contracts/validation.js";
import {
  CommercialExecutionScopeSchema,
  type CommercialExecutionScope,
} from "../commercial-operation/contracts.js";
import {
  StudyCommercialTutorAdvisorySchema,
  type StudyCommercialTutorAdvisory,
} from "../contracts/commercial.js";
import { validateExactSnapshot } from "../multimodal/runtime-snapshot.js";
import {
  MultimodalAllowanceSchema,
  type TutorModality,
} from "../learner-stage-policy/policy.js";
import type { NormalizedModelOutputResult } from "../model-output/contracts.js";
import type { MultimodalRequirement } from "../routing/provider-routing/contracts.js";
import {
  COMMERCIAL_RESPONSE_CONTRACT_VERSION,
  CommercialModelResponseSchema,
  PRESENTATION_CONTRACT_VERSION,
  PresentationIntentSchema,
  PresentationMappingContextSchema,
  TrustedPresentationAcceptanceSchema,
  TrustedPresentationBoundarySchema,
  W306PresentationPiecesSchema,
  type CommercialModelResponse,
  type CommercialProposalResponse,
  type PresentationDeliveryChannel,
  type PresentationIntent,
  type PresentationMappingContext,
  type PresentationScopeLineage,
  type ReviewedVisualIntent,
  type TrustedPresentationAcceptance,
  type TrustedPresentationBoundary,
  type W306PresentationPiece,
  type W306PresentationPieces,
} from "./contracts.js";

export type PresentationIntentValidation =
  | { readonly status: "accepted"; readonly intent: PresentationIntent }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_PRESENTATION_INTENT"
        | "PRESENTATION_CONTENT_REQUIRED"
        | "PRESENTATION_CHANNEL_MISMATCH"
        | "SPEECH_SOURCE_REQUIRED";
    };

function equalStringArrays(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function expectedBaseChannels(intent: PresentationIntent): PresentationDeliveryChannel[] {
  const channels: PresentationDeliveryChannel[] = [];
  if (intent.reviewedTextRef !== undefined || intent.structuredCheckRef !== undefined) {
    channels.push("text");
  }
  if (intent.reviewedVisual !== undefined) channels.push("visual");
  return channels;
}

function normalizedIntent(intent: PresentationIntent): PresentationIntent {
  const normalized: PresentationIntent = {
    contractVersion: intent.contractVersion,
    intentKind: intent.intentKind,
    ...(intent.reviewedTextRef === undefined
      ? {}
      : { reviewedTextRef: intent.reviewedTextRef }),
    ...(intent.reviewedVisual === undefined
      ? {}
      : { reviewedVisual: Object.freeze({ ...intent.reviewedVisual }) }),
    ...(intent.structuredCheckRef === undefined
      ? {}
      : { structuredCheckRef: intent.structuredCheckRef }),
    ...(intent.accessibilityCaptionRef === undefined
      ? {}
      : { accessibilityCaptionRef: intent.accessibilityCaptionRef }),
    requestedDeliveryChannels: [...intent.requestedDeliveryChannels],
    ...(intent.fallbackPresentation === undefined
      ? {}
      : {
          fallbackPresentation: {
            presentationRef: intent.fallbackPresentation.presentationRef,
            requestedDeliveryChannels: [
              ...intent.fallbackPresentation.requestedDeliveryChannels,
            ],
          },
        }),
  };
  if (normalized.reviewedVisual !== undefined) Object.freeze(normalized.reviewedVisual);
  Object.freeze(normalized.requestedDeliveryChannels);
  if (normalized.fallbackPresentation !== undefined) {
    Object.freeze(normalized.fallbackPresentation.requestedDeliveryChannels);
    Object.freeze(normalized.fallbackPresentation);
  }
  return Object.freeze(normalized);
}

export function validatePresentationIntent(candidate: unknown): PresentationIntentValidation {
  const validation = validateExactSnapshot(PresentationIntentSchema, candidate);
  if (validation.status === "rejected") {
    return { status: "rejected", code: "INVALID_PRESENTATION_INTENT" };
  }

  const intent = validation.value;
  const contentCount = Number(intent.reviewedTextRef !== undefined)
    + Number(intent.reviewedVisual !== undefined)
    + Number(intent.structuredCheckRef !== undefined);
  if (contentCount === 0 || (intent.reviewedTextRef !== undefined && intent.structuredCheckRef !== undefined)) {
    return { status: "rejected", code: "PRESENTATION_CONTENT_REQUIRED" };
  }

  const channels = intent.requestedDeliveryChannels;
  const fallbackChannels = intent.fallbackPresentation?.requestedDeliveryChannels;
  if (
    fallbackChannels !== undefined
    && !(
      equalStringArrays(fallbackChannels, ["text"])
      || equalStringArrays(fallbackChannels, ["visual"])
      || equalStringArrays(fallbackChannels, ["text", "visual"])
    )
  ) {
    return { status: "rejected", code: "PRESENTATION_CHANNEL_MISMATCH" };
  }
  const speechRequested = channels.includes("speech-after-acceptance");
  if (
    speechRequested
    && intent.reviewedTextRef === undefined
    && intent.structuredCheckRef === undefined
  ) {
    return { status: "rejected", code: "SPEECH_SOURCE_REQUIRED" };
  }

  const expected = expectedBaseChannels(intent);
  if (speechRequested) expected.push("speech-after-acceptance");
  if (!equalStringArrays(channels, expected)) {
    return { status: "rejected", code: "PRESENTATION_CHANNEL_MISMATCH" };
  }

  return { status: "accepted", intent: normalizedIntent(intent) };
}

export type CommercialResponseMappingResult =
  | { readonly status: "accepted"; readonly response: CommercialModelResponse }
  | {
      readonly status: "rejected";
      readonly code:
        | "VALIDATED_OUTPUT_REQUIRED"
        | "INVALID_PRESENTATION_MAPPING_CONTEXT"
        | "DISPLAY_CONTENT_ARITY_MISMATCH"
        | "REVIEWED_VISUAL_BINDING_REQUIRED"
        | "DUPLICATE_REVIEWED_VISUAL_BINDING"
        | "SPEECH_SOURCE_REQUIRED"
        | "INVALID_PRESENTATION_INTENT";
    };

function visualFor(
  contentRef: string,
  context: PresentationMappingContext,
): ReviewedVisualIntent | undefined {
  return context.reviewedVisuals.find((visual) => visual.contentRef === contentRef);
}

function mappedIntent(
  proposal: Extract<NormalizedModelOutputResult, { status: "accepted-proposal" }>["proposal"],
  context: PresentationMappingContext,
): PresentationIntent | null {
  const refs = proposal.reviewedContentRefs;
  const common = {
    contractVersion: PRESENTATION_CONTRACT_VERSION,
    intentKind: "reference-only-presentation-intent" as const,
    ...(context.accessibilityCaptionRef === undefined
      ? {}
      : { accessibilityCaptionRef: context.accessibilityCaptionRef }),
    ...(context.fallbackPresentation === undefined
      ? {}
      : { fallbackPresentation: context.fallbackPresentation }),
  };

  const withSpeech = (
    channels: readonly ("text" | "visual")[],
  ): PresentationDeliveryChannel[] => [
    ...channels,
    ...(context.requestSpeechAfterAcceptance
      ? (["speech-after-acceptance"] as const)
      : []),
  ];

  switch (proposal.instructionalDisplayMode) {
    case "reviewed-text":
      return refs.length === 1 && refs[0] !== undefined
        ? {
            ...common,
            reviewedTextRef: refs[0],
            requestedDeliveryChannels: withSpeech(["text"]),
          }
        : null;
    case "reviewed-visual": {
      if (refs.length !== 1 || refs[0] === undefined) return null;
      const visual = visualFor(refs[0], context);
      if (visual === undefined || context.requestSpeechAfterAcceptance) return null;
      return {
        ...common,
        reviewedVisual: visual,
        requestedDeliveryChannels: ["visual"],
      };
    }
    case "reviewed-text-and-visual": {
      if (refs.length !== 2 || refs[0] === undefined || refs[1] === undefined) return null;
      const visual = visualFor(refs[1], context);
      return visual === undefined
        ? null
        : {
            ...common,
            reviewedTextRef: refs[0],
            reviewedVisual: visual,
            requestedDeliveryChannels: withSpeech(["text", "visual"]),
          };
    }
    case "structured-check":
      return refs.length === 1 && refs[0] !== undefined
        ? {
            ...common,
            structuredCheckRef: refs[0],
            requestedDeliveryChannels: withSpeech(["text"]),
          }
        : null;
  }
}

export function mapValidatedModelOutputToCommercialResponse(
  result: NormalizedModelOutputResult,
  contextCandidate: unknown,
): CommercialResponseMappingResult {
  if (result.status === "refused") {
    const validatedOutput = {
      responseKind: "refusal" as const,
      reviewedContentRefs: [],
      groundingRefs: [],
      reasonCodes: [...result.refusal.reasonCodes],
      requestedTutorAction: null,
      instructionalDisplayMode: "none" as const,
      refusalState: "refused" as const,
    };
    Object.freeze(validatedOutput.reviewedContentRefs);
    Object.freeze(validatedOutput.groundingRefs);
    Object.freeze(validatedOutput.reasonCodes);
    Object.freeze(validatedOutput);
    const groundingClaim = {
      claimKind: "reference-only-grounding-claim" as const,
      claimScope: "references-only" as const,
      groundingRefs: [],
    };
    Object.freeze(groundingClaim.groundingRefs);
    Object.freeze(groundingClaim);
    const response: CommercialModelResponse = {
      contractVersion: COMMERCIAL_RESPONSE_CONTRACT_VERSION,
      envelope: "commercial-model-response",
      validationStatus: "refused",
      validatedOutput,
      groundingClaim,
      presentationIntent: null,
    };
    Object.freeze(response);
    if (validateCommercialModelResponse(response).status === "rejected") {
      return { status: "rejected", code: "VALIDATED_OUTPUT_REQUIRED" };
    }
    return { status: "accepted", response };
  }
  if (result.status !== "accepted-proposal") {
    return { status: "rejected", code: "VALIDATED_OUTPUT_REQUIRED" };
  }

  const contextValidation = validateExactSnapshot(
    PresentationMappingContextSchema,
    contextCandidate,
  );
  if (contextValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_PRESENTATION_MAPPING_CONTEXT" };
  }
  const context = contextValidation.value;
  const visualRefs = context.reviewedVisuals.map((visual) => visual.contentRef);
  if (new Set(visualRefs).size !== visualRefs.length) {
    return { status: "rejected", code: "DUPLICATE_REVIEWED_VISUAL_BINDING" };
  }
  if (
    result.proposal.instructionalDisplayMode === "reviewed-visual"
    && context.requestSpeechAfterAcceptance
  ) {
    return { status: "rejected", code: "SPEECH_SOURCE_REQUIRED" };
  }

  const intentCandidate = mappedIntent(result.proposal, context);
  if (intentCandidate === null) {
    const mode = result.proposal.instructionalDisplayMode;
    const expectedArity = mode === "reviewed-text-and-visual" ? 2 : 1;
    if (result.proposal.reviewedContentRefs.length !== expectedArity) {
      return { status: "rejected", code: "DISPLAY_CONTENT_ARITY_MISMATCH" };
    }
    return { status: "rejected", code: "REVIEWED_VISUAL_BINDING_REQUIRED" };
  }
  const intentValidation = validatePresentationIntent(intentCandidate);
  if (intentValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_PRESENTATION_INTENT" };
  }

  const validatedOutput = {
    responseKind: "proposal" as const,
    reviewedContentRefs: [...result.proposal.reviewedContentRefs],
    groundingRefs: [...result.proposal.groundingRefs],
    reasonCodes: [...result.proposal.reasonCodes],
    requestedTutorAction: result.proposal.requestedTutorAction,
    instructionalDisplayMode: result.proposal.instructionalDisplayMode,
    refusalState: "not-refused" as const,
  };
  Object.freeze(validatedOutput.reviewedContentRefs);
  Object.freeze(validatedOutput.groundingRefs);
  Object.freeze(validatedOutput.reasonCodes);
  Object.freeze(validatedOutput);
  const groundingClaim = {
    claimKind: "reference-only-grounding-claim" as const,
    claimScope: "references-only" as const,
    groundingRefs: [...result.proposal.groundingRefs],
  };
  Object.freeze(groundingClaim.groundingRefs);
  Object.freeze(groundingClaim);
  const response: CommercialProposalResponse = {
    contractVersion: COMMERCIAL_RESPONSE_CONTRACT_VERSION,
    envelope: "commercial-model-response",
    validationStatus: "accepted-proposal",
    validatedOutput,
    groundingClaim,
    presentationIntent: intentValidation.intent,
  };
  Object.freeze(response);
  if (validateCommercialModelResponse(response).status === "rejected") {
    return { status: "rejected", code: "VALIDATED_OUTPUT_REQUIRED" };
  }
  return { status: "accepted", response };
}

export type CommercialResponseValidation =
  | { readonly status: "accepted"; readonly response: CommercialModelResponse }
  | { readonly status: "rejected"; readonly code: "INVALID_COMMERCIAL_MODEL_RESPONSE" };

function proposalMatchesIntent(response: CommercialProposalResponse): boolean {
  const output = response.validatedOutput;
  const intent = response.presentationIntent;
  const refs = output.reviewedContentRefs;
  switch (output.instructionalDisplayMode) {
    case "reviewed-text":
      return refs.length === 1
        && intent.reviewedTextRef === refs[0]
        && intent.reviewedVisual === undefined
        && intent.structuredCheckRef === undefined;
    case "reviewed-visual":
      return refs.length === 1
        && intent.reviewedTextRef === undefined
        && intent.reviewedVisual?.contentRef === refs[0]
        && intent.structuredCheckRef === undefined;
    case "reviewed-text-and-visual":
      return refs.length === 2
        && intent.reviewedTextRef === refs[0]
        && intent.reviewedVisual?.contentRef === refs[1]
        && intent.structuredCheckRef === undefined;
    case "structured-check":
      return refs.length === 1
        && intent.reviewedTextRef === undefined
        && intent.reviewedVisual === undefined
        && intent.structuredCheckRef === refs[0];
  }
}

export function validateCommercialModelResponse(
  candidate: unknown,
): CommercialResponseValidation {
  const validation = validateExactSnapshot(CommercialModelResponseSchema, candidate);
  if (validation.status === "rejected") {
    return { status: "rejected", code: "INVALID_COMMERCIAL_MODEL_RESPONSE" };
  }
  const response = validation.value;
  if (
    !equalStringArrays(
      response.groundingClaim.groundingRefs,
      response.validatedOutput.groundingRefs,
    )
  ) {
    return { status: "rejected", code: "INVALID_COMMERCIAL_MODEL_RESPONSE" };
  }
  if (response.validationStatus === "accepted-proposal") {
    const intentValidation = validatePresentationIntent(response.presentationIntent);
    if (intentValidation.status === "rejected" || !proposalMatchesIntent(response)) {
      return { status: "rejected", code: "INVALID_COMMERCIAL_MODEL_RESPONSE" };
    }
  }
  return { status: "accepted", response };
}

export type LearnerStagePresentationConstraint =
  | {
      readonly status: "allowed";
      readonly intent: PresentationIntent;
      readonly routingCapabilityRequirement: MultimodalRequirement;
    }
  | {
      readonly status: "denied";
      readonly code: "LEARNER_STAGE_DENIES_MODALITY" | "LEARNER_STAGE_DENIES_MODALITY_COUNT";
      readonly deniedModalities: readonly TutorModality[];
    }
  | {
      readonly status: "rejected";
      readonly code: "INVALID_PRESENTATION_INTENT" | "INVALID_MODALITY_ALLOWANCE";
    };

function deliveryModalities(intent: PresentationIntent): TutorModality[] {
  const modalities: TutorModality[] = [];
  if (intent.requestedDeliveryChannels.includes("text")) modalities.push("text");
  if (intent.reviewedVisual !== undefined) modalities.push(intent.reviewedVisual.kind);
  if (intent.requestedDeliveryChannels.includes("speech-after-acceptance")) {
    modalities.push("audio");
  }
  return modalities;
}

/**
 * Applies only an already-resolved W3-11 allowance. It receives no learner
 * facts or stage selector, cannot infer content, and can only allow or deny the
 * intent's explicit delivery modalities.
 */
export function constrainPresentationByLearnerStageAllowance(
  intentCandidate: unknown,
  allowanceCandidate: unknown,
): LearnerStagePresentationConstraint {
  const intentValidation = validatePresentationIntent(intentCandidate);
  if (intentValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_PRESENTATION_INTENT" };
  }
  const allowanceValidation = validateExact(MultimodalAllowanceSchema, allowanceCandidate);
  if (allowanceValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_MODALITY_ALLOWANCE" };
  }

  const allowance = allowanceValidation.value;
  if (
    new Set(allowance.allowedModalities).size !== allowance.allowedModalities.length
    || allowance.maximumModalitiesPerResponse > allowance.allowedModalities.length
  ) {
    return { status: "rejected", code: "INVALID_MODALITY_ALLOWANCE" };
  }
  const modalities = deliveryModalities(intentValidation.intent);
  const denied = modalities.filter(
    (modality) => !allowance.allowedModalities.includes(modality),
  );
  if (denied.length > 0) {
    return {
      status: "denied",
      code: "LEARNER_STAGE_DENIES_MODALITY",
      deniedModalities: Object.freeze(denied),
    };
  }
  if (modalities.length > allowance.maximumModalitiesPerResponse) {
    return {
      status: "denied",
      code: "LEARNER_STAGE_DENIES_MODALITY_COUNT",
      deniedModalities: Object.freeze([]),
    };
  }

  return {
    status: "allowed",
    intent: intentValidation.intent,
    routingCapabilityRequirement:
      intentValidation.intent.reviewedVisual === undefined ? "TEXT_ONLY" : "REVIEWED_IMAGE",
  };
}

export type W306PresentationMappingResult =
  | { readonly status: "accepted"; readonly presentation: W306PresentationPieces }
  | {
      readonly status: "rejected";
      readonly code:
        | "TRUSTED_ACCEPTANCE_REQUIRED"
        | "TRUSTED_PRESENTATION_BOUNDARY_REQUIRED"
        | "TRUSTED_COMMERCIAL_EXECUTION_SCOPE_REQUIRED"
        | "TRUSTED_STUDY_ADVISORY_REQUIRED"
        | "PRESENTATION_SCOPE_MISMATCH"
        | "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH"
        | "STUDY_ADVISORY_SCOPE_MISMATCH"
        | "STUDY_ADVISORY_PRESENTATION_MISMATCH"
        | "UNTRUSTED_PRESENTATION_REFERENCE"
        | "UNTRUSTED_REVIEWED_VISUAL"
        | "ACTIVE_ASSESSMENT_CAPTION_BLOCKED"
        | "INVALID_PRESENTATION_INTENT";
    };

function samePresentationScope(
  left: PresentationScopeLineage,
  right: PresentationScopeLineage,
): boolean {
  return left.householdScopeRef === right.householdScopeRef
    && left.commercialExecutionScopeRef === right.commercialExecutionScopeRef
    && left.learnerScopeRef === right.learnerScopeRef
    && left.sessionRef === right.sessionRef
    && left.interactionRef === right.interactionRef
    && left.logicalOperationRef === right.logicalOperationRef
    && left.conceptRef === right.conceptRef
    && left.opportunityRef === right.opportunityRef
    && left.presentationRef === right.presentationRef;
}

function scopeMatchesCommercialExecution(
  scope: PresentationScopeLineage,
  commercialScope: CommercialExecutionScope,
): boolean {
  return scope.commercialExecutionScopeRef === commercialScope.scopeRef
    && scope.householdScopeRef === commercialScope.householdScopeRef
    && scope.learnerScopeRef === commercialScope.learnerScopeRef
    && scope.sessionRef === commercialScope.sessionRef
    && scope.interactionRef === commercialScope.interactionRef
    && scope.logicalOperationRef === commercialScope.logicalOperationRef
    && scope.conceptRef === commercialScope.conceptRef
    && scope.opportunityRef === commercialScope.opportunityRef
    && scope.presentationRef === commercialScope.presentationRef;
}

function sameReviewedVisual(
  left: ReviewedVisualIntent | undefined,
  right: ReviewedVisualIntent | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.kind === right.kind
    && left.contentRef === right.contentRef
    && left.contentDigest === right.contentDigest
    && left.provenanceRef === right.provenanceRef;
}

function samePresentationIntent(
  left: PresentationIntent,
  right: PresentationIntent,
): boolean {
  const leftFallback = left.fallbackPresentation;
  const rightFallback = right.fallbackPresentation;
  return left.contractVersion === right.contractVersion
    && left.intentKind === right.intentKind
    && left.reviewedTextRef === right.reviewedTextRef
    && sameReviewedVisual(left.reviewedVisual, right.reviewedVisual)
    && left.structuredCheckRef === right.structuredCheckRef
    && left.accessibilityCaptionRef === right.accessibilityCaptionRef
    && equalStringArrays(left.requestedDeliveryChannels, right.requestedDeliveryChannels)
    && (
      leftFallback === undefined || rightFallback === undefined
        ? leftFallback === rightFallback
        : leftFallback.presentationRef === rightFallback.presentationRef
          && equalStringArrays(
            leftFallback.requestedDeliveryChannels,
            rightFallback.requestedDeliveryChannels,
          )
    );
}

function reviewedContentRefsFor(intent: PresentationIntent): string[] {
  return [
    ...(intent.reviewedTextRef === undefined ? [] : [intent.reviewedTextRef]),
    ...(intent.reviewedVisual === undefined ? [] : [intent.reviewedVisual.contentRef]),
    ...(intent.structuredCheckRef === undefined ? [] : [intent.structuredCheckRef]),
  ];
}

function advisoryMatchesCommercialExecution(
  advisory: StudyCommercialTutorAdvisory,
  commercialScope: CommercialExecutionScope,
): boolean {
  return advisory.commercialScopeRef === commercialScope.scopeRef
    && advisory.invocationRef === commercialScope.interactionRef
    && advisory.householdScopeRef === commercialScope.householdScopeRef
    && advisory.learnerScopeRef === commercialScope.learnerScopeRef
    && advisory.sessionRef === commercialScope.sessionRef
    && advisory.interactionRef === commercialScope.interactionRef
    && advisory.logicalOperationRef === commercialScope.logicalOperationRef
    && advisory.conceptRef === commercialScope.conceptRef
    && advisory.opportunityRef === commercialScope.opportunityRef
    && advisory.learnerStageRef === commercialScope.learnerStageRef;
}

function hasTrustedReference(
  boundary: TrustedPresentationBoundary,
  scope: PresentationScopeLineage,
  referenceKind: "reviewed-text" | "structured-check" | "accessibility-caption" | "fallback-presentation",
  referenceRef: string,
): boolean {
  const expectedUse = referenceKind === "accessibility-caption"
    ? "neutral-accessibility-metadata"
    : referenceKind === "fallback-presentation"
      ? "approved-fallback-reference"
      : "approved-instructional-reference";
  return boundary.referenceBindings.some(
    (binding) => binding.referenceKind === referenceKind
      && binding.referenceRef === referenceRef
      && binding.referenceUse === expectedUse
      && samePresentationScope(binding.scope, scope),
  );
}

function hasTrustedVisual(
  boundary: TrustedPresentationBoundary,
  scope: PresentationScopeLineage,
  visual: ReviewedVisualIntent,
): boolean {
  return boundary.reviewedVisualBindings.some((binding) =>
    binding.approvalStatus === "approved-content"
    && samePresentationScope(binding.scope, scope)
    && binding.reviewedVisual.kind === visual.kind
    && binding.reviewedVisual.contentRef === visual.contentRef
    && binding.reviewedVisual.contentDigest === visual.contentDigest
    && binding.reviewedVisual.provenanceRef === visual.provenanceRef
  );
}

/**
 * Produces reference-only pieces for the W3-06 presentation layer. Resolution
 * into text, pixels, or synthesized speech stays behind Study-owned renderers.
 */
export function mapTrustedAcceptedIntentToW306PresentationPieces(
  acceptanceCandidate: unknown,
  trustedBoundaryCandidate?: unknown,
  trustedCommercialExecutionScopeCandidate?: unknown,
  trustedStudyAdvisoryCandidate?: unknown,
): W306PresentationMappingResult {
  const acceptanceValidation = validateExactSnapshot(
    TrustedPresentationAcceptanceSchema,
    acceptanceCandidate,
  );
  if (acceptanceValidation.status === "rejected") {
    return { status: "rejected", code: "TRUSTED_ACCEPTANCE_REQUIRED" };
  }
  const acceptance: TrustedPresentationAcceptance = acceptanceValidation.value;
  const boundaryValidation = validateExactSnapshot(
    TrustedPresentationBoundarySchema,
    trustedBoundaryCandidate,
  );
  if (boundaryValidation.status === "rejected") {
    return { status: "rejected", code: "TRUSTED_PRESENTATION_BOUNDARY_REQUIRED" };
  }
  const boundary = boundaryValidation.value;
  const commercialScopeValidation = validateExactSnapshot(
    CommercialExecutionScopeSchema,
    trustedCommercialExecutionScopeCandidate,
  );
  if (commercialScopeValidation.status === "rejected") {
    return { status: "rejected", code: "TRUSTED_COMMERCIAL_EXECUTION_SCOPE_REQUIRED" };
  }
  const commercialScope = commercialScopeValidation.value;
  const advisoryValidation = validateExactSnapshot(
    StudyCommercialTutorAdvisorySchema,
    trustedStudyAdvisoryCandidate,
  );
  if (advisoryValidation.status === "rejected") {
    return { status: "rejected", code: "TRUSTED_STUDY_ADVISORY_REQUIRED" };
  }
  const advisory = advisoryValidation.value;
  if (
    acceptance.acceptanceRef !== boundary.acceptanceRef
    || !samePresentationScope(acceptance.scope, boundary.scope)
  ) {
    return { status: "rejected", code: "PRESENTATION_SCOPE_MISMATCH" };
  }
  if (
    !scopeMatchesCommercialExecution(acceptance.scope, commercialScope)
    || !scopeMatchesCommercialExecution(boundary.scope, commercialScope)
  ) {
    return { status: "rejected", code: "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH" };
  }
  if (!advisoryMatchesCommercialExecution(advisory, commercialScope)) {
    return { status: "rejected", code: "STUDY_ADVISORY_SCOPE_MISMATCH" };
  }
  const intentValidation = validatePresentationIntent(acceptance.presentationIntent);
  if (intentValidation.status === "rejected") {
    return { status: "rejected", code: "INVALID_PRESENTATION_INTENT" };
  }
  const intent = intentValidation.intent;
  if (
    advisory.status !== "proposed"
    || advisory.presentationIntent === null
    || !samePresentationIntent(advisory.presentationIntent, intent)
    || !equalStringArrays(advisory.reviewedContentRefs, reviewedContentRefsFor(intent))
    || intent.fallbackPresentation?.presentationRef !== commercialScope.presentationRef
  ) {
    return { status: "rejected", code: "STUDY_ADVISORY_PRESENTATION_MISMATCH" };
  }
  if (
    (intent.reviewedTextRef !== undefined
      && !hasTrustedReference(
        boundary,
        acceptance.scope,
        "reviewed-text",
        intent.reviewedTextRef,
      ))
    || (intent.structuredCheckRef !== undefined
      && !hasTrustedReference(
        boundary,
        acceptance.scope,
        "structured-check",
        intent.structuredCheckRef,
      ))
    || (intent.fallbackPresentation !== undefined
      && !hasTrustedReference(
        boundary,
        acceptance.scope,
        "fallback-presentation",
        intent.fallbackPresentation.presentationRef,
      ))
  ) {
    return { status: "rejected", code: "UNTRUSTED_PRESENTATION_REFERENCE" };
  }
  if (
    intent.reviewedVisual !== undefined
    && !hasTrustedVisual(boundary, acceptance.scope, intent.reviewedVisual)
  ) {
    return { status: "rejected", code: "UNTRUSTED_REVIEWED_VISUAL" };
  }
  if (
    intent.accessibilityCaptionRef !== undefined
    && !hasTrustedReference(
      boundary,
      acceptance.scope,
      "accessibility-caption",
      intent.accessibilityCaptionRef,
    )
  ) {
    return {
      status: "rejected",
      code: boundary.assessmentPhase === "active-protected-assessment"
        ? "ACTIVE_ASSESSMENT_CAPTION_BLOCKED"
        : "UNTRUSTED_PRESENTATION_REFERENCE",
    };
  }
  const pieces: W306PresentationPiece[] = [];

  if (intent.reviewedTextRef !== undefined) {
    pieces.push({ pieceKind: "reviewed-text-reference", contentRef: intent.reviewedTextRef });
  }
  if (intent.reviewedVisual !== undefined) {
    pieces.push({
      pieceKind: intent.reviewedVisual.kind === "image"
        ? "reviewed-image-reference"
        : "reviewed-diagram-reference",
      contentRef: intent.reviewedVisual.contentRef,
      contentDigest: intent.reviewedVisual.contentDigest,
      provenanceRef: intent.reviewedVisual.provenanceRef,
    });
  }
  if (intent.structuredCheckRef !== undefined) {
    pieces.push({
      pieceKind: "structured-check-reference",
      contentRef: intent.structuredCheckRef,
    });
  }
  if (intent.accessibilityCaptionRef !== undefined) {
    pieces.push({
      pieceKind: "accessibility-caption-metadata",
      captionRef: intent.accessibilityCaptionRef,
      instructionalText: false,
    });
  }
  if (intent.requestedDeliveryChannels.includes("speech-after-acceptance")) {
    const sourceContentRef = intent.reviewedTextRef ?? intent.structuredCheckRef;
    if (sourceContentRef === undefined) {
      return { status: "rejected", code: "INVALID_PRESENTATION_INTENT" };
    }
    pieces.push({
      pieceKind: "speech-delivery",
      deliveryChannel: "speech-after-acceptance",
      sourceContentRef,
      acceptanceRequired: true,
      rawAudioAuthorityGranted: false,
    });
  }
  if (intent.fallbackPresentation !== undefined) {
    pieces.push({
      pieceKind: "fallback-presentation-reference",
      presentationRef: intent.fallbackPresentation.presentationRef,
      requestedDeliveryChannels: [...intent.fallbackPresentation.requestedDeliveryChannels],
    });
  }

  const presentation: W306PresentationPieces = {
    adapterKind: "w3-06-reference-presentation-pieces",
    acceptanceRef: acceptance.acceptanceRef,
    scope: acceptance.scope,
    pieces,
    rawAudioAccepted: false,
    rawImageBytesAccepted: false,
    providerRawMediaAccepted: false,
  };
  if (validateExact(W306PresentationPiecesSchema, presentation).status === "rejected") {
    return { status: "rejected", code: "INVALID_PRESENTATION_INTENT" };
  }
  for (const piece of pieces) Object.freeze(piece);
  Object.freeze(pieces);
  return { status: "accepted", presentation: Object.freeze(presentation) };
}
