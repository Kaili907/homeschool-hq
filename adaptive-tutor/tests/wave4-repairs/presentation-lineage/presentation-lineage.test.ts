import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMERCIAL_EXECUTION_SCOPE_VERSION,
  type CommercialExecutionScope,
} from "../../../core/v3/commercial-operation/index.js";
import {
  STUDY_COMMERCIAL_TUTOR_ADVISORY_VERSION,
  type StudyCommercialTutorAdvisory,
} from "../../../core/v3/contracts/index.js";
import {
  MULTIMODAL_CONTRACT_VERSION,
  enforceMultimodalPresentationPolicy,
  projectDurableMultimodalEvidence,
  type MultimodalEvidenceProjectionSource,
  type MultimodalPresentation,
  type TrustedMultimodalPolicyContext,
} from "../../../core/v3/multimodal/index.js";
import {
  PRESENTATION_CONTRACT_VERSION,
  mapTrustedAcceptedIntentToW306PresentationPieces,
  validatePresentationIntent,
  type PresentationIntent,
  type PresentationScopeLineage,
  type ReviewedVisualIntent,
  type TrustedPresentationBoundary,
} from "../../../core/v3/presentation/index.js";

const observedAt = "2026-08-16T16:00:00.000Z";
const digestA = `sha256:${"a".repeat(64)}`;
const digestB = `sha256:${"b".repeat(64)}`;

const scopeA = {
  commercialExecutionScopeRef: "commercial-scope:execution-a",
  householdScopeRef: "household:family-a",
  learnerScopeRef: "learner:child-a",
  sessionRef: "session:current-a",
  interactionRef: "interaction:current-a",
  logicalOperationRef: "logical-operation:current-a",
  conceptRef: "concept:fractions-a",
  opportunityRef: "opportunity:current-a",
  presentationRef: "presentation-fallback:current-a",
} as const satisfies PresentationScopeLineage;

const commercialScopeA: CommercialExecutionScope = {
  scopeVersion: COMMERCIAL_EXECUTION_SCOPE_VERSION,
  scopeKind: "trusted-study-commercial-execution-scope",
  issuedBy: "study-engine",
  scopeRef: scopeA.commercialExecutionScopeRef,
  householdScopeRef: scopeA.householdScopeRef,
  learnerScopeRef: scopeA.learnerScopeRef,
  sessionRef: scopeA.sessionRef,
  interactionRef: scopeA.interactionRef,
  logicalOperationRef: scopeA.logicalOperationRef,
  curriculumReleaseRef: "release-current-a",
  curriculumPackageRef: "package:current-a",
  curriculumCourseRef: "course-current-a",
  curriculumSubjectRef: "subject-current-a",
  curriculumUnitRef: "unit-current-a",
  curriculumLessonRef: "lesson-current-a",
  conceptRef: scopeA.conceptRef,
  opportunityRef: scopeA.opportunityRef,
  learnerStageRef: "learner-stage:current-a",
  presentationRef: scopeA.presentationRef,
  routingRequestRef: "routing-request:current-a",
  routePlanRef: "route-plan:current-a",
  reservationRef: "reservation:current-a",
  physicalAttemptRefs: ["physical-attempt:current-a"],
  allowedRouteRefs: ["route:current-a"],
  telemetryEventRefs: ["telemetry:current-a"],
};

const imageA = {
  kind: "image",
  contentRef: "reviewed-content:image-a",
  contentDigest: digestA,
  provenanceRef: "provenance:image-a",
} as const satisfies ReviewedVisualIntent;

const imageB = {
  kind: "image",
  contentRef: "reviewed-content:image-b",
  contentDigest: digestB,
  provenanceRef: "provenance:image-b",
} as const satisfies ReviewedVisualIntent;

const intentA = {
  contractVersion: PRESENTATION_CONTRACT_VERSION,
  intentKind: "reference-only-presentation-intent",
  reviewedVisual: imageA,
  accessibilityCaptionRef: "caption-metadata:image-a",
  requestedDeliveryChannels: ["visual"],
  fallbackPresentation: {
    presentationRef: scopeA.presentationRef,
    requestedDeliveryChannels: ["text"],
  },
} as const satisfies PresentationIntent;

function reviewedContentRefs(intent: PresentationIntent): string[] {
  return [
    ...(intent.reviewedTextRef === undefined ? [] : [intent.reviewedTextRef]),
    ...(intent.reviewedVisual === undefined ? [] : [intent.reviewedVisual.contentRef]),
    ...(intent.structuredCheckRef === undefined ? [] : [intent.structuredCheckRef]),
  ];
}

function advisoryFor(
  intent: PresentationIntent,
  scope: CommercialExecutionScope = commercialScopeA,
): StudyCommercialTutorAdvisory {
  return {
    contractVersion: STUDY_COMMERCIAL_TUTOR_ADVISORY_VERSION,
    advisoryKind: "study-commercial-tutor-advisory",
    invocationRef: scope.interactionRef,
    commercialScopeRef: scope.scopeRef,
    householdScopeRef: scope.householdScopeRef,
    learnerScopeRef: scope.learnerScopeRef,
    sessionRef: scope.sessionRef,
    interactionRef: scope.interactionRef,
    logicalOperationRef: scope.logicalOperationRef,
    opportunityRef: scope.opportunityRef,
    conceptRef: scope.conceptRef,
    learnerStageRef: scope.learnerStageRef,
    status: "proposed",
    proposedTutorAction: "hint",
    reasonCodes: ["COMMERCIAL_PROPOSAL_READY"],
    reviewedContentRefs: reviewedContentRefs(intent),
    groundingDecision: "sufficient",
    assistanceEvidenceRef: scope.opportunityRef,
    presentationIntent: intent,
    studyDecisionRequired: true,
    studyMutationAllowed: false,
    officialMasteryAuthority: false,
    officialWorkingLevelAuthority: false,
    nominalGradeAuthority: false,
    curriculumAuthority: false,
    segmentCompletionAuthority: false,
  };
}

function acceptance(
  intent: PresentationIntent = intentA,
  scope: PresentationScopeLineage = scopeA,
) {
  return {
    acceptanceKind: "trusted-study-provider-output-acceptance",
    acceptanceRef: "presentation-acceptance:current-a",
    scope,
    presentationIntent: intent,
  } as const;
}

function boundary(
  intent: PresentationIntent = intentA,
  scope: PresentationScopeLineage = scopeA,
): TrustedPresentationBoundary {
  const referenceBindings: TrustedPresentationBoundary["referenceBindings"] = [];
  if (intent.accessibilityCaptionRef !== undefined) {
    referenceBindings.push({
      scope,
      referenceKind: "accessibility-caption",
      referenceRef: intent.accessibilityCaptionRef,
      referenceUse: "neutral-accessibility-metadata",
    });
  }
  if (intent.fallbackPresentation !== undefined) {
    referenceBindings.push({
      scope,
      referenceKind: "fallback-presentation",
      referenceRef: intent.fallbackPresentation.presentationRef,
      referenceUse: "approved-fallback-reference",
    });
  }
  return {
    boundaryKind: "trusted-study-presentation-boundary",
    acceptanceRef: "presentation-acceptance:current-a",
    scope,
    assessmentPhase: "active-protected-assessment",
    referenceBindings,
    reviewedVisualBindings: intent.reviewedVisual === undefined
      ? []
      : [{ scope, reviewedVisual: intent.reviewedVisual, approvalStatus: "approved-content" }],
  };
}

function mapAccepted(
  intent: PresentationIntent = intentA,
  acceptedScope: PresentationScopeLineage = scopeA,
  trustedBoundary: TrustedPresentationBoundary = boundary(intent, acceptedScope),
  trustedCommercialScope: unknown = commercialScopeA,
  advisory: unknown = advisoryFor(intentA),
) {
  return mapTrustedAcceptedIntentToW306PresentationPieces(
    acceptance(intent, acceptedScope),
    trustedBoundary,
    trustedCommercialScope,
    advisory,
  );
}

const reviewedImageA = {
  visualRef: imageA.contentRef,
  visualKind: "image",
  contentDigest: imageA.contentDigest,
  mimeType: "image/png",
  reviewStatus: "approved",
  reviewRef: "review:image-a",
  provenanceRef: imageA.provenanceRef,
  reviewedAt: observedAt,
  learnerSafe: true,
} as const;

function multimodalPresentation(
  presentationScope: PresentationScopeLineage = scopeA,
): MultimodalPresentation {
  return {
    contractVersion: MULTIMODAL_CONTRACT_VERSION,
    envelope: "multimodal-presentation",
    scope: presentationScope,
    interactionRef: presentationScope.interactionRef,
    turnRef: "turn:current-a",
    speaker: "tutor",
    content: { mode: "reviewed-image", visual: reviewedImageA },
    caption: {
      captionRef: intentA.accessibilityCaptionRef,
      text: "A neutral description of the reviewed image is available.",
      locale: "en-US",
      availability: "available",
      persistence: "transient-session-only",
    },
    assessmentDisclosure: {
      phase: "active-assessment",
      antiAnswerPolicy: "required",
      answerExposure: "none",
      appliesToAllModalities: true,
    },
  };
}

function policyContext(): TrustedMultimodalPolicyContext {
  const presentation = multimodalPresentation();
  return {
    contextKind: "trusted-study-multimodal-policy-context",
    commercialExecutionScope: commercialScopeA,
    studyAdvisory: advisoryFor(intentA),
    scope: scopeA,
    captionBinding: {
      scope: scopeA,
      captionRef: presentation.caption.captionRef,
      text: presentation.caption.text,
      locale: presentation.caption.locale,
      use: "neutral-accessibility-metadata",
    },
    reviewedVisualBindings: [{
      scope: scopeA,
      visual: reviewedImageA,
      provenanceStatus: "approved-content",
    }],
  };
}

test("canonical R1 scope and matching Study advisory permit presentation acceptance", () => {
  const result = mapAccepted(intentA, scopeA, boundary(intentA), commercialScopeA, advisoryFor(intentA));
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.presentation.scope.commercialExecutionScopeRef, commercialScopeA.scopeRef);
  assert.equal(result.presentation.scope.logicalOperationRef, commercialScopeA.logicalOperationRef);
  assert.equal(result.presentation.scope.conceptRef, commercialScopeA.conceptRef);
});

test("A learner plus B presentation intent fails before learner-facing acceptance", () => {
  const result = mapAccepted(
    { ...intentA, reviewedVisual: imageB },
    scopeA,
    boundary(intentA),
    commercialScopeA,
    advisoryFor({ ...intentA, reviewedVisual: imageB }),
  );
  assert.deepEqual(result, { status: "rejected", code: "UNTRUSTED_REVIEWED_VISUAL" });
});

test("A household plus B media evidence fails closed", () => {
  const context = policyContext();
  context.reviewedVisualBindings[0]!.scope = {
    ...scopeA,
    householdScopeRef: "household:family-b",
  };
  const result = enforceMultimodalPresentationPolicy(multimodalPresentation(), context);
  assert.equal(result.status, "rejected");
  if (result.status === "rejected") assert.equal(result.code, "UNTRUSTED_REVIEWED_MEDIA");
});

test("same learner presentation from an old session fails current commercial scope", () => {
  const stale = { ...scopeA, sessionRef: "session:old-a" };
  assert.deepEqual(mapAccepted(intentA, stale, boundary(intentA, stale)), {
    status: "rejected",
    code: "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH",
  });
});

test("same learner presentation from another interaction fails current commercial scope", () => {
  const stale = { ...scopeA, interactionRef: "interaction:old-a" };
  assert.deepEqual(mapAccepted(intentA, stale, boundary(intentA, stale)), {
    status: "rejected",
    code: "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH",
  });
});

test("same learner presentation from another logical operation fails current commercial scope", () => {
  const stale = { ...scopeA, logicalOperationRef: "logical-operation:old-a" };
  assert.deepEqual(mapAccepted(intentA, stale, boundary(intentA, stale)), {
    status: "rejected",
    code: "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH",
  });
});

test("same learner presentation from an old opportunity fails current commercial scope", () => {
  const stale = { ...scopeA, opportunityRef: "opportunity:old-a" };
  assert.deepEqual(mapAccepted(intentA, stale, boundary(intentA, stale)), {
    status: "rejected",
    code: "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH",
  });
});

test("different commercialExecutionScopeRef fails even when learner identity matches", () => {
  const foreign = { ...scopeA, commercialExecutionScopeRef: "commercial-scope:execution-b" };
  assert.deepEqual(mapAccepted(intentA, foreign, boundary(intentA, foreign)), {
    status: "rejected",
    code: "PRESENTATION_COMMERCIAL_SCOPE_MISMATCH",
  });
});

test("A commercial scope plus B reviewed image fails its reviewed binding", () => {
  const foreignIntent = { ...intentA, reviewedVisual: imageB };
  assert.deepEqual(
    mapAccepted(foreignIntent, scopeA, boundary(intentA), commercialScopeA, advisoryFor(foreignIntent)),
    { status: "rejected", code: "UNTRUSTED_REVIEWED_VISUAL" },
  );
});

test("A commercial scope plus B diagram fails its reviewed binding", () => {
  const diagramIntent: PresentationIntent = {
    ...intentA,
    reviewedVisual: {
      kind: "diagram",
      contentRef: "reviewed-content:diagram-b",
      contentDigest: digestB,
      provenanceRef: "provenance:diagram-b",
    },
  };
  assert.deepEqual(
    mapAccepted(diagramIntent, scopeA, boundary(intentA), commercialScopeA, advisoryFor(diagramIntent)),
    { status: "rejected", code: "UNTRUSTED_REVIEWED_VISUAL" },
  );
});

test("A commercial scope plus B caption metadata is blocked during active assessment", () => {
  const foreignIntent = { ...intentA, accessibilityCaptionRef: "caption-metadata:answer-b" };
  assert.deepEqual(
    mapAccepted(foreignIntent, scopeA, boundary(intentA), commercialScopeA, advisoryFor(foreignIntent)),
    { status: "rejected", code: "ACTIVE_ASSESSMENT_CAPTION_BLOCKED" },
  );
});

test("A commercial scope plus B fallback intent fails Study presentation reconciliation", () => {
  const foreignIntent: PresentationIntent = {
    ...intentA,
    fallbackPresentation: {
      presentationRef: "presentation-fallback:foreign-b",
      requestedDeliveryChannels: ["text"],
    },
  };
  assert.deepEqual(
    mapAccepted(foreignIntent, scopeA, boundary(foreignIntent), commercialScopeA, advisoryFor(foreignIntent)),
    { status: "rejected", code: "STUDY_ADVISORY_PRESENTATION_MISMATCH" },
  );
});

test("presentation cannot be accepted without the exact trusted R1 scope", () => {
  assert.deepEqual(
    mapTrustedAcceptedIntentToW306PresentationPieces(
      acceptance(intentA),
      boundary(intentA),
      undefined,
      advisoryFor(intentA),
    ),
    {
      status: "rejected",
      code: "TRUSTED_COMMERCIAL_EXECUTION_SCOPE_REQUIRED",
    },
  );
});

test("tutor cannot manufacture Study advisory scope authority", () => {
  const forged = { ...advisoryFor(intentA), commercialScopeRef: "commercial-scope:forged-b" };
  assert.deepEqual(mapAccepted(intentA, scopeA, boundary(intentA), commercialScopeA, forged), {
    status: "rejected",
    code: "STUDY_ADVISORY_SCOPE_MISMATCH",
  });
});

test("provider-shaped presentation intent cannot inject commercial scope", () => {
  assert.equal(validatePresentationIntent({
    ...intentA,
    commercialExecutionScopeRef: "commercial-scope:provider-chosen",
  }).status, "rejected");
});

test("active assessment rejects a reviewed-image substitution before display", () => {
  const candidate = structuredClone(multimodalPresentation());
  if (candidate.content.mode !== "reviewed-image") return;
  candidate.content.visual = {
    ...candidate.content.visual,
    visualRef: imageB.contentRef,
    contentDigest: imageB.contentDigest,
    provenanceRef: imageB.provenanceRef,
  };
  const result = enforceMultimodalPresentationPolicy(candidate, policyContext());
  assert.equal(result.status, "rejected");
  if (result.status === "rejected") assert.equal(result.code, "UNTRUSTED_REVIEWED_MEDIA");
});

test("active assessment rejects answer-bearing caption substitution", () => {
  const candidate = structuredClone(multimodalPresentation());
  candidate.caption.text = "The correct answer is B.";
  const result = enforceMultimodalPresentationPolicy(candidate, policyContext());
  assert.equal(result.status, "rejected");
  if (result.status === "rejected") assert.equal(result.code, "ACTIVE_ASSESSMENT_ANSWER_BLOCKED");
});

test("multimodal presentation from B session cannot enter A policy context", () => {
  const foreign = { ...scopeA, sessionRef: "session:foreign-b" };
  const result = enforceMultimodalPresentationPolicy(multimodalPresentation(foreign), policyContext());
  assert.equal(result.status, "rejected");
  if (result.status === "rejected") assert.equal(result.code, "PRESENTATION_SCOPE_MISMATCH");
});

test("multimodal presentation from B interaction cannot enter A policy context", () => {
  const foreign = { ...scopeA, interactionRef: "interaction:foreign-b" };
  const result = enforceMultimodalPresentationPolicy(multimodalPresentation(foreign), policyContext());
  assert.equal(result.status, "rejected");
  if (result.status === "rejected") assert.equal(result.code, "PRESENTATION_SCOPE_MISMATCH");
});

test("DurableMultimodalEvidence records canonical lineage without raw data", () => {
  const source: MultimodalEvidenceProjectionSource = {
    evidenceRef: "evidence:presentation-current-a",
    sessionRef: scopeA.sessionRef,
    presentation: multimodalPresentation(),
    trustedContext: policyContext(),
    outcome: "inconclusive",
    assistanceLevel: "light-hint",
    observedAt,
    transient: {
      rawLearnerImage: new TextEncoder().encode("RAW_IMAGE_SECRET"),
      captionText: "CAPTION_SECRET",
    },
  };
  const result = projectDurableMultimodalEvidence(source);
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.evidence.commercialExecutionScopeRef, commercialScopeA.scopeRef);
  assert.equal(result.evidence.logicalOperationRef, commercialScopeA.logicalOperationRef);
  assert.equal(result.evidence.conceptRef, commercialScopeA.conceptRef);
  assert.equal(result.evidence.opportunityRef, commercialScopeA.opportunityRef);
  assert.equal(result.evidence.presentationRef, commercialScopeA.presentationRef);
  const serialized = JSON.stringify(result.evidence);
  assert.equal(serialized.includes("RAW_IMAGE_SECRET"), false);
  assert.equal(serialized.includes("CAPTION_SECRET"), false);
});
