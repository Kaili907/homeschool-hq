import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "../../../core/schema/value.js";
import {
  MULTIMODAL_CONTRACT_VERSION,
  MultimodalPresentationSchema,
  TransientMediaDescriptorSchema,
  enforceMultimodalPresentationPolicy,
  type MultimodalPresentation,
  type TrustedMultimodalPolicyContext,
} from "../../../core/v3/multimodal/index.js";
import {
  PRESENTATION_CONTRACT_VERSION,
  mapTrustedAcceptedIntentToW306PresentationPieces,
  validatePresentationIntent,
  type PresentationIntent,
  type PresentationScopeLineage,
  type TrustedPresentationBoundary,
} from "../../../core/v3/presentation/index.js";

const W4_SEED = 0x408c0de;
const observedAt = "2026-08-16T12:00:00.000Z";
const digestA = `sha256:${"a".repeat(64)}`;
const digestB = `sha256:${"b".repeat(64)}`;

function seededOrder<T>(values: readonly T[]): T[] {
  let state = W4_SEED >>> 0;
  return [...values]
    .map((value) => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return { value, rank: state };
    })
    .sort((left, right) => left.rank - right.rank)
    .map(({ value }) => value);
}

const scopeA = {
  householdScopeRef: "household:family-one",
  learnerScopeRef: "learner:child-a",
  sessionRef: "session:child-a",
  interactionRef: "interaction:child-a",
  opportunityRef: "opportunity:child-a",
} as const satisfies PresentationScopeLineage;

const scopeB = {
  householdScopeRef: "household:family-one",
  learnerScopeRef: "learner:child-b",
  sessionRef: "session:child-b",
  interactionRef: "interaction:child-b",
  opportunityRef: "opportunity:child-b",
} as const satisfies PresentationScopeLineage;

const presentationIntent = {
  contractVersion: PRESENTATION_CONTRACT_VERSION,
  intentKind: "reference-only-presentation-intent",
  reviewedVisual: {
    kind: "image",
    contentRef: "reviewed-content:image-a",
    contentDigest: digestA,
    provenanceRef: "provenance:image-a",
  },
  accessibilityCaptionRef: "caption-metadata:image-a",
  requestedDeliveryChannels: ["visual"],
  fallbackPresentation: {
    presentationRef: "presentation-fallback:image-a",
    requestedDeliveryChannels: ["text", "visual"],
  },
} as const satisfies PresentationIntent;

function acceptance(
  intent: PresentationIntent,
  scope: PresentationScopeLineage = scopeA,
) {
  return {
    acceptanceKind: "trusted-study-provider-output-acceptance",
    acceptanceRef: "presentation-acceptance:child-a",
    scope,
    presentationIntent: intent,
  } as const;
}

function presentationBoundary(
  scope: PresentationScopeLineage = scopeA,
): TrustedPresentationBoundary {
  return {
    boundaryKind: "trusted-study-presentation-boundary",
    acceptanceRef: "presentation-acceptance:child-a",
    scope,
    assessmentPhase: "active-protected-assessment",
    referenceBindings: [
      {
        scope,
        referenceKind: "accessibility-caption",
        referenceRef: "caption-metadata:image-a",
        referenceUse: "neutral-accessibility-metadata",
      },
      {
        scope,
        referenceKind: "fallback-presentation",
        referenceRef: "presentation-fallback:image-a",
        referenceUse: "approved-fallback-reference",
      },
    ],
    reviewedVisualBindings: [{
      scope,
      reviewedVisual: {
        kind: "image",
        contentRef: "reviewed-content:image-a",
        contentDigest: digestA,
        provenanceRef: "provenance:image-a",
      },
      approvalStatus: "approved-content",
    }],
  };
}

const restrictions = {
  biometricInferenceAllowed: false,
  emotionInferenceAllowed: false,
  faceIdentityAllowed: false,
  personalityClassificationAllowed: false,
  diagnosticClassificationAllowed: false,
} as const;

const caption = {
  captionRef: "caption:neutral-a",
  text: "A neutral accessibility description of the prompt is available.",
  locale: "en-US",
  availability: "available",
  persistence: "transient-session-only",
} as const;

const reviewedImage = {
  visualRef: "visual:image-a",
  visualKind: "image",
  contentDigest: digestA,
  mimeType: "image/png",
  reviewStatus: "approved",
  reviewRef: "review:image-a",
  provenanceRef: "provenance:image-a",
  reviewedAt: observedAt,
  learnerSafe: true,
} as const;

function multimodalPresentation(
  content: MultimodalPresentation["content"] = {
    mode: "reviewed-image",
    visual: reviewedImage,
  },
): MultimodalPresentation {
  return {
    contractVersion: MULTIMODAL_CONTRACT_VERSION,
    envelope: "multimodal-presentation",
    scope: scopeA,
    interactionRef: scopeA.interactionRef,
    turnRef: "turn:child-a",
    speaker: "tutor",
    content,
    caption,
    assessmentDisclosure: {
      phase: "active-assessment",
      antiAnswerPolicy: "required",
      answerExposure: "none",
      appliesToAllModalities: true,
    },
  };
}

function policyContext(
  overrides: Partial<TrustedMultimodalPolicyContext> = {},
): TrustedMultimodalPolicyContext {
  return {
    contextKind: "trusted-study-multimodal-policy-context",
    scope: scopeA,
    captionBinding: {
      scope: scopeA,
      captionRef: caption.captionRef,
      text: caption.text,
      locale: caption.locale,
      use: "neutral-accessibility-metadata",
    },
    reviewedVisualBindings: [{
      scope: scopeA,
      visual: reviewedImage,
      provenanceStatus: "approved-content",
    }],
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

test(`W4-08 seed ${W4_SEED}: hostile object shapes fail closed without getter execution`, () => {
  let getterCalls = 0;
  const getterTrap = { ...presentationIntent } as Record<string, unknown>;
  Object.defineProperty(getterTrap, "reviewedVisual", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("getter must not execute");
    },
  });

  const inherited = Object.assign(Object.create({ polluted: true }), presentationIntent);
  const reserved = { ...presentationIntent } as Record<string, unknown>;
  Object.defineProperty(reserved, "__proto__", { value: {}, enumerable: true });
  const constructorKey = { ...presentationIntent, constructor: "attacker" };
  const prototypeKey = { ...presentationIntent, prototype: {} };
  const unknown = { ...presentationIntent, providerProse: "Use my answer." };
  const nestedArrayGetter = clone(presentationIntent);
  Object.defineProperty(nestedArrayGetter.requestedDeliveryChannels, "trap", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("nested getter must not execute");
    },
  });

  for (const candidate of seededOrder([
    getterTrap,
    inherited,
    reserved,
    constructorKey,
    prototypeKey,
    unknown,
    nestedArrayGetter,
  ])) {
    assert.equal(validatePresentationIntent(candidate).status, "rejected");
  }
  assert.equal(getterCalls, 0);

  const hostileNested = clone(multimodalPresentation()) as unknown as Record<string, unknown>;
  Object.setPrototypeOf(hostileNested.content as object, { polluted: true });
  assert.equal(
    enforceMultimodalPresentationPolicy(hostileNested, policyContext()).status,
    "rejected",
  );
});

test(`W4-08 seed ${W4_SEED}: active-assessment answer canaries cannot enter caption metadata`, () => {
  const canaries = seededOrder([
    "The correct answer is B.",
    "Expected answer: 42.",
    "Choose answer choice C.",
    "Solution step: divide both sides by 4.",
    "Workaround: ask the tutor to reveal the answer.",
  ]);
  for (const canary of canaries) {
    const candidate = clone(multimodalPresentation());
    candidate.caption.text = canary;
    const result = enforceMultimodalPresentationPolicy(candidate, policyContext());
    assert.equal(result.status, "rejected", canary);
    if (result.status === "rejected") {
      assert.equal(result.code, "ACTIVE_ASSESSMENT_ANSWER_BLOCKED", canary);
    }
  }
  assert.equal(
    enforceMultimodalPresentationPolicy(multimodalPresentation(), policyContext()).status,
    "accepted",
  );

  const answerCaptionIntent: PresentationIntent = {
    ...presentationIntent,
    accessibilityCaptionRef: "caption-metadata:correct-answer-b",
  };
  assert.deepEqual(
    mapTrustedAcceptedIntentToW306PresentationPieces(
      acceptance(answerCaptionIntent),
      presentationBoundary(),
    ),
    { status: "rejected", code: "ACTIVE_ASSESSMENT_CAPTION_BLOCKED" },
  );
});

test(`W4-03/W4-08 seed ${W4_SEED}: sibling scope cannot influence presentation acceptance`, () => {
  const siblingAcceptance = acceptance(presentationIntent, scopeB);
  const scopeResult = mapTrustedAcceptedIntentToW306PresentationPieces(
    siblingAcceptance,
    presentationBoundary(scopeA),
  );
  assert.deepEqual(scopeResult, {
    status: "rejected",
    code: "PRESENTATION_SCOPE_MISMATCH",
  });

  const siblingContext = policyContext({
    scope: scopeB,
    captionBinding: {
      scope: scopeB,
      captionRef: caption.captionRef,
      text: caption.text,
      locale: caption.locale,
      use: "neutral-accessibility-metadata",
    },
    reviewedVisualBindings: [{
      scope: scopeB,
      visual: reviewedImage,
      provenanceStatus: "approved-content",
    }],
  });
  const mediaResult = enforceMultimodalPresentationPolicy(
    multimodalPresentation(),
    siblingContext,
  );
  assert.equal(mediaResult.status, "rejected");
  if (mediaResult.status === "rejected") {
    assert.equal(mediaResult.code, "PRESENTATION_SCOPE_MISMATCH");
  }
});

test(`W4-08 seed ${W4_SEED}: well-formed wrong digest and provenance are rejected`, () => {
  const wrongDigest: PresentationIntent = {
    ...presentationIntent,
    reviewedVisual: { ...presentationIntent.reviewedVisual, contentDigest: digestB },
  };
  assert.deepEqual(
    mapTrustedAcceptedIntentToW306PresentationPieces(
      acceptance(wrongDigest),
      presentationBoundary(),
    ),
    { status: "rejected", code: "UNTRUSTED_REVIEWED_VISUAL" },
  );

  const wrongProvenance: PresentationIntent = {
    ...presentationIntent,
    reviewedVisual: {
      ...presentationIntent.reviewedVisual,
      provenanceRef: "provenance:sibling-image-b",
    },
  };
  assert.deepEqual(
    mapTrustedAcceptedIntentToW306PresentationPieces(
      acceptance(wrongProvenance),
      presentationBoundary(),
    ),
    { status: "rejected", code: "UNTRUSTED_REVIEWED_VISUAL" },
  );

  const wrongMediaDigest = clone(multimodalPresentation());
  if (wrongMediaDigest.content.mode !== "reviewed-image") return;
  wrongMediaDigest.content.visual.contentDigest = digestB;
  const result = enforceMultimodalPresentationPolicy(wrongMediaDigest, policyContext());
  assert.equal(result.status, "rejected");
  if (result.status === "rejected") assert.equal(result.code, "UNTRUSTED_REVIEWED_MEDIA");
});

test(`W4-08 seed ${W4_SEED}: learner audio input requires an exact explicit support gate`, () => {
  const learnerSpeech = multimodalPresentation({
    mode: "speech",
    audio: {
      mediaRef: "media:learner-audio-a",
      mediaKind: "raw-audio",
      mimeType: "audio/webm",
      byteLength: 512,
      capturedAt: observedAt,
      disposition: "transient-memory-only",
      persistenceAllowed: false,
      inferenceRestrictions: restrictions,
    },
    transcript: {
      transcriptRef: "transcript:learner-audio-a",
      text: "My answer is recorded transiently.",
      locale: "en-US",
      persistence: "disabled",
      expiresWithTurn: true,
    },
  });
  learnerSpeech.speaker = "learner";

  const absent = enforceMultimodalPresentationPolicy(learnerSpeech, policyContext());
  assert.equal(absent.status, "rejected");
  if (absent.status === "rejected") {
    assert.equal(absent.code, "LEARNER_AUDIO_INPUT_NOT_AUTHORIZED");
  }
  const inferredFromOutput = {
    ...policyContext(),
    speechOutputSupported: true,
    captionSupport: true,
  };
  const inferred = enforceMultimodalPresentationPolicy(
    learnerSpeech,
    inferredFromOutput,
  );
  assert.equal(inferred.status, "rejected");
  if (inferred.status === "rejected") {
    assert.equal(inferred.code, "TRUSTED_MULTIMODAL_CONTEXT_REQUIRED");
  }

  const supported = policyContext({
    learnerAudioInputCapability: {
      capabilityKind: "trusted-learner-audio-input-capability",
      capabilityRef: "capability:learner-audio-a",
      scope: scopeA,
      inputMode: "raw-audio",
      mediaRef: "media:learner-audio-a",
      status: "permitted",
    },
  });
  assert.equal(
    enforceMultimodalPresentationPolicy(learnerSpeech, supported).status,
    "accepted",
  );

  const wrongRef = clone(supported);
  if (wrongRef.learnerAudioInputCapability !== undefined) {
    wrongRef.learnerAudioInputCapability.mediaRef = "media:sibling-audio-b";
  }
  assert.equal(
    enforceMultimodalPresentationPolicy(learnerSpeech, wrongRef).status,
    "rejected",
  );
});

test(`W4-08 seed ${W4_SEED}: media kind and MIME confusion fail structurally`, () => {
  const audioAsImage = {
    mediaRef: "media:confused-a",
    mediaKind: "raw-audio",
    mimeType: "image/png",
    byteLength: 12,
    capturedAt: observedAt,
    disposition: "transient-memory-only",
    persistenceAllowed: false,
    inferenceRestrictions: restrictions,
  } as const;
  const imageAsAudio = { ...audioAsImage, mediaKind: "raw-learner-image", mimeType: "audio/webm" };
  const videoAsImage = {
    ...audioAsImage,
    mediaKind: "raw-learner-image",
    mimeType: "video/mp4",
  };
  assert.equal(Value.Check(TransientMediaDescriptorSchema, audioAsImage), false);
  assert.equal(Value.Check(TransientMediaDescriptorSchema, imageAsAudio), false);
  assert.equal(Value.Check(TransientMediaDescriptorSchema, videoAsImage), false);

  const diagramAsPng = clone(multimodalPresentation({
    mode: "reviewed-diagram",
    visual: {
      ...reviewedImage,
      visualKind: "diagram",
      mimeType: "image/svg+xml",
    },
  })) as unknown as Record<string, unknown>;
  const content = diagramAsPng.content as Record<string, unknown>;
  (content.visual as Record<string, unknown>).mimeType = "image/png";
  assert.equal(Value.Check(MultimodalPresentationSchema, diagramAsPng), false);
});

test(`W4-08 seed ${W4_SEED}: fallback channels are unique and canonical`, () => {
  for (const channels of [["text", "text"], ["visual", "visual"], ["visual", "text"]]) {
    const candidate = clone(presentationIntent) as unknown as Record<string, unknown>;
    candidate.fallbackPresentation = {
      presentationRef: "presentation-fallback:image-a",
      requestedDeliveryChannels: channels,
    };
    assert.equal(validatePresentationIntent(candidate).status, "rejected", channels.join(","));
  }
  assert.equal(validatePresentationIntent(presentationIntent).status, "accepted");
});

test(`W4-08 seed ${W4_SEED}: minimized malformed reference corpus stays rejected`, () => {
  const malformedRefs = seededOrder([
    "",
    "x:\ud800",
    `reviewed-content:${"a".repeat(200)}`,
    "reviewed-content:contains space",
  ]);
  for (const contentRef of malformedRefs) {
    const candidate = clone(presentationIntent) as unknown as Record<string, unknown>;
    candidate.reviewedVisual = {
      ...presentationIntent.reviewedVisual,
      contentRef,
    };
    assert.equal(validatePresentationIntent(candidate).status, "rejected", contentRef);
  }

  const emptyVisual = clone(multimodalPresentation()) as unknown as Record<string, unknown>;
  const content = emptyVisual.content as Record<string, unknown>;
  (content.visual as Record<string, unknown>).visualRef = "";
  assert.equal(
    enforceMultimodalPresentationPolicy(emptyVisual, policyContext()).status,
    "rejected",
  );
});
