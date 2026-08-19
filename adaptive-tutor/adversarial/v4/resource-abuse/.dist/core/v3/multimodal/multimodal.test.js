import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "../../schema/value.js";
import { COMMERCIAL_EXECUTION_SCOPE_VERSION, } from "../commercial-operation/index.js";
import { STUDY_COMMERCIAL_TUTOR_ADVISORY_VERSION, } from "../contracts/index.js";
import { PRESENTATION_CONTRACT_VERSION } from "../presentation/index.js";
import { DurableMultimodalEvidenceSchema, LearnerImageReviewDecisionSchema, MULTIMODAL_CONTRACT_VERSION, MULTIMODAL_MODES, MultimodalDeliveryOutcomeSchema, MultimodalPresentationSchema, TRANSIENT_MEDIA_INFERENCE_RESTRICTIONS, TransientLearnerImageReviewRequestSchema, TransientMediaDescriptorSchema, enforceMultimodalPresentationPolicy, projectDurableMultimodalEvidence, } from "./index.js";
const observedAt = "2026-08-15T14:30:00.000Z";
const digest = `sha256:${"a".repeat(64)}`;
const restrictions = TRANSIENT_MEDIA_INFERENCE_RESTRICTIONS;
const scope = {
    commercialExecutionScopeRef: "commercial-scope:multimodal-001",
    householdScopeRef: "household:family-one",
    learnerScopeRef: "learner:learner-one",
    sessionRef: "session:study-001",
    interactionRef: "interaction:multimodal-001",
    logicalOperationRef: "logical-operation:multimodal-001",
    conceptRef: "concept:lesson-one",
    opportunityRef: "opportunity:lesson-one",
    presentationRef: "presentation-fallback:lesson-one",
};
const commercialExecutionScope = {
    scopeVersion: COMMERCIAL_EXECUTION_SCOPE_VERSION,
    scopeKind: "trusted-study-commercial-execution-scope",
    issuedBy: "study-engine",
    scopeRef: scope.commercialExecutionScopeRef,
    householdScopeRef: scope.householdScopeRef,
    learnerScopeRef: scope.learnerScopeRef,
    sessionRef: scope.sessionRef,
    interactionRef: scope.interactionRef,
    logicalOperationRef: scope.logicalOperationRef,
    curriculumReleaseRef: "release-multimodal-001",
    curriculumPackageRef: "package:multimodal-001",
    curriculumCourseRef: "course-multimodal-001",
    curriculumSubjectRef: "subject-multimodal-001",
    curriculumUnitRef: "unit-multimodal-001",
    curriculumLessonRef: "lesson-multimodal-001",
    conceptRef: scope.conceptRef,
    opportunityRef: scope.opportunityRef,
    learnerStageRef: "learner-stage:multimodal-001",
    presentationRef: scope.presentationRef,
    routingRequestRef: "routing-request:multimodal-001",
    routePlanRef: "route-plan:multimodal-001",
    reservationRef: "reservation:multimodal-001",
    physicalAttemptRefs: ["physical-attempt:multimodal-001"],
    allowedRouteRefs: ["route:multimodal-001"],
    telemetryEventRefs: ["telemetry:multimodal-001"],
};
const audio = {
    mediaRef: "media:audio-turn-001",
    mediaKind: "raw-audio",
    mimeType: "audio/webm",
    byteLength: 1_024,
    capturedAt: observedAt,
    disposition: "transient-memory-only",
    persistenceAllowed: false,
    inferenceRestrictions: restrictions,
};
const learnerImage = {
    mediaRef: "media:learner-image-001",
    mediaKind: "raw-learner-image",
    mimeType: "image/png",
    byteLength: 4_096,
    capturedAt: observedAt,
    disposition: "transient-memory-only",
    persistenceAllowed: false,
    inferenceRestrictions: restrictions,
};
const caption = {
    captionRef: "caption:turn-001",
    text: "A caption remains available for this turn.",
    locale: "en-US",
    availability: "available",
    persistence: "transient-session-only",
};
const reviewedImage = {
    visualRef: "visual:approved-image-001",
    visualKind: "image",
    contentDigest: digest,
    mimeType: "image/png",
    reviewStatus: "approved",
    reviewRef: "review:image-001",
    provenanceRef: "provenance:image-001",
    reviewedAt: observedAt,
    learnerSafe: true,
};
const reviewedDiagram = {
    visualRef: "visual:approved-diagram-001",
    visualKind: "diagram",
    contentDigest: digest,
    mimeType: "image/svg+xml",
    reviewStatus: "approved",
    reviewRef: "review:diagram-001",
    provenanceRef: "provenance:diagram-001",
    reviewedAt: observedAt,
    learnerSafe: true,
};
const activeAssessment = {
    phase: "active-assessment",
    antiAnswerPolicy: "required",
    answerExposure: "bounded-hint",
    appliesToAllModalities: true,
};
const contentByMode = {
    text: { mode: "text", text: "Try identifying the known quantities first." },
    speech: {
        mode: "speech",
        audio,
        transcript: {
            transcriptRef: "transcript:turn-001",
            text: "Try identifying the known quantities first.",
            locale: "en-US",
            persistence: "disabled",
            expiresWithTurn: true,
        },
    },
    "reviewed-image": { mode: "reviewed-image", visual: reviewedImage },
    "reviewed-diagram": { mode: "reviewed-diagram", visual: reviewedDiagram },
    caption: { mode: "caption", captionRef: caption.captionRef },
};
function presentationFor(mode) {
    return {
        contractVersion: MULTIMODAL_CONTRACT_VERSION,
        envelope: "multimodal-presentation",
        scope,
        interactionRef: "interaction:multimodal-001",
        turnRef: `turn:${mode}`,
        speaker: "tutor",
        content: contentByMode[mode],
        caption,
        visualStep: {
            visualStepRef: "visual-step:worked-example-001",
            stepIndex: 2,
        },
        assessmentDisclosure: activeAssessment,
    };
}
function trustedContextFor(presentation) {
    const content = presentation.content;
    const presentationIntent = content.mode === "reviewed-image" || content.mode === "reviewed-diagram"
        ? {
            contractVersion: PRESENTATION_CONTRACT_VERSION,
            intentKind: "reference-only-presentation-intent",
            reviewedVisual: {
                kind: content.visual.visualKind,
                contentRef: content.visual.visualRef,
                contentDigest: content.visual.contentDigest,
                provenanceRef: content.visual.provenanceRef,
            },
            accessibilityCaptionRef: presentation.caption.captionRef,
            requestedDeliveryChannels: ["visual"],
            fallbackPresentation: {
                presentationRef: scope.presentationRef,
                requestedDeliveryChannels: ["text"],
            },
        }
        : {
            contractVersion: PRESENTATION_CONTRACT_VERSION,
            intentKind: "reference-only-presentation-intent",
            reviewedTextRef: "reviewed-content:multimodal-text-001",
            accessibilityCaptionRef: presentation.caption.captionRef,
            requestedDeliveryChannels: ["text"],
            fallbackPresentation: {
                presentationRef: scope.presentationRef,
                requestedDeliveryChannels: ["text"],
            },
        };
    const studyAdvisory = {
        contractVersion: STUDY_COMMERCIAL_TUTOR_ADVISORY_VERSION,
        advisoryKind: "study-commercial-tutor-advisory",
        invocationRef: commercialExecutionScope.interactionRef,
        commercialScopeRef: commercialExecutionScope.scopeRef,
        householdScopeRef: commercialExecutionScope.householdScopeRef,
        learnerScopeRef: commercialExecutionScope.learnerScopeRef,
        sessionRef: commercialExecutionScope.sessionRef,
        interactionRef: commercialExecutionScope.interactionRef,
        logicalOperationRef: commercialExecutionScope.logicalOperationRef,
        opportunityRef: commercialExecutionScope.opportunityRef,
        conceptRef: commercialExecutionScope.conceptRef,
        learnerStageRef: commercialExecutionScope.learnerStageRef,
        status: "proposed",
        proposedTutorAction: "hint",
        reasonCodes: ["COMMERCIAL_PROPOSAL_READY"],
        reviewedContentRefs: content.mode === "reviewed-image" || content.mode === "reviewed-diagram"
            ? [content.visual.visualRef]
            : ["reviewed-content:multimodal-text-001"],
        groundingDecision: "sufficient",
        assistanceEvidenceRef: commercialExecutionScope.opportunityRef,
        presentationIntent,
        studyDecisionRequired: true,
        studyMutationAllowed: false,
        officialMasteryAuthority: false,
        officialWorkingLevelAuthority: false,
        nominalGradeAuthority: false,
        curriculumAuthority: false,
        segmentCompletionAuthority: false,
    };
    return {
        contextKind: "trusted-study-multimodal-policy-context",
        commercialExecutionScope,
        studyAdvisory,
        scope,
        captionBinding: {
            scope,
            captionRef: presentation.caption.captionRef,
            text: presentation.caption.text,
            locale: presentation.caption.locale,
            use: "neutral-accessibility-metadata",
        },
        reviewedVisualBindings: [
            { scope, visual: reviewedImage, provenanceStatus: "approved-content" },
            { scope, visual: reviewedDiagram, provenanceStatus: "approved-content" },
        ],
    };
}
function clone(value) {
    return structuredClone(value);
}
test("accepts the complete structured mode vocabulary with captions", () => {
    assert.deepEqual(Object.keys(contentByMode), MULTIMODAL_MODES);
    for (const mode of MULTIMODAL_MODES) {
        const presentation = presentationFor(mode);
        assert.equal(Value.Check(MultimodalPresentationSchema, presentation), true, mode);
        assert.equal(presentation.caption.availability, "available");
    }
});
test("requires captions for every modality", () => {
    for (const mode of MULTIMODAL_MODES) {
        const invalid = clone(presentationFor(mode));
        delete invalid.caption;
        assert.equal(Value.Check(MultimodalPresentationSchema, invalid), false, mode);
    }
});
test("keeps raw audio and learner image descriptors transient and inference-free", () => {
    assert.equal(Value.Check(TransientMediaDescriptorSchema, audio), true);
    assert.equal(Value.Check(TransientMediaDescriptorSchema, learnerImage), true);
    for (const field of [
        "biometricInferenceAllowed",
        "emotionInferenceAllowed",
        "faceIdentityAllowed",
        "personalityClassificationAllowed",
        "diagnosticClassificationAllowed",
    ]) {
        const invalid = clone(audio);
        invalid.inferenceRestrictions = { ...restrictions, [field]: true };
        assert.equal(Value.Check(TransientMediaDescriptorSchema, invalid), false, field);
    }
    const embeddedBytes = { ...audio, base64: "RAW_AUDIO_SECRET" };
    assert.equal(Value.Check(TransientMediaDescriptorSchema, embeddedBytes), false);
});
test("disables transcript persistence structurally", () => {
    const invalid = clone(presentationFor("speech"));
    const content = invalid.content;
    const transcript = content.transcript;
    transcript.persistence = "enabled";
    assert.equal(Value.Check(MultimodalPresentationSchema, invalid), false);
});
test("admits learner images only through a transient review request and approved ref", () => {
    const request = {
        requestRef: "request:image-review-001",
        image: learnerImage,
        reviewPurpose: "learner-safe-curricular-content",
        outputMayContainRawImage: false,
    };
    assert.equal(Value.Check(TransientLearnerImageReviewRequestSchema, request), true);
    const rawContaminated = { ...request, rawImage: "RAW_IMAGE_SECRET" };
    assert.equal(Value.Check(TransientLearnerImageReviewRequestSchema, rawContaminated), false);
    const approved = {
        status: "approved",
        requestRef: request.requestRef,
        reviewedVisual: reviewedImage,
    };
    assert.equal(Value.Check(LearnerImageReviewDecisionSchema, approved), true);
    const unreviewed = clone(presentationFor("reviewed-image"));
    const visual = unreviewed.content.visual;
    visual.reviewStatus = "pending";
    assert.equal(Value.Check(MultimodalPresentationSchema, unreviewed), false);
});
test("applies active-assessment anti-answer policy identically to every mode", () => {
    for (const mode of MULTIMODAL_MODES) {
        const presentation = presentationFor(mode);
        assert.equal(enforceMultimodalPresentationPolicy(presentation, trustedContextFor(presentation)).status, "accepted");
        const invalid = clone(presentationFor(mode));
        invalid.assessmentDisclosure = {
            phase: "active-assessment",
            antiAnswerPolicy: "required",
            answerExposure: "reviewed-answer",
            appliesToAllModalities: true,
        };
        const result = enforceMultimodalPresentationPolicy(invalid, trustedContextFor(presentation));
        assert.equal(result.status, "rejected", mode);
    }
});
test("makes media failure nonblocking with a captioned continuation fallback", () => {
    const failure = {
        status: "media-unavailable",
        interactionRef: "interaction:multimodal-001",
        turnRef: "turn:speech",
        failedMode: "speech",
        reasonCode: "media-timeout",
        fallback: {
            mode: "caption",
            contentRef: "fallback:caption-001",
            caption,
            lessonContinuation: "required",
            blocking: false,
        },
    };
    assert.equal(Value.Check(MultimodalDeliveryOutcomeSchema, failure), true);
    const blocking = clone(failure);
    blocking.fallback.blocking = true;
    assert.equal(Value.Check(MultimodalDeliveryOutcomeSchema, blocking), false);
});
test("minimization projection cannot carry raw media, transcript, caption, or content", () => {
    const speech = clone(presentationFor("speech"));
    assert.equal(speech.content.mode, "speech");
    if (speech.content.mode !== "speech")
        return;
    speech.content.transcript.text = "TRANSCRIPT_SECRET";
    speech.caption.text = "CAPTION_SECRET";
    const source = {
        evidenceRef: "evidence:multimodal-001",
        sessionRef: "session:study-001",
        presentation: speech,
        trustedContext: trustedContextFor(speech),
        outcome: "demonstrated",
        assistanceLevel: "light-hint",
        observedAt,
        transient: {
            rawAudio: new TextEncoder().encode("RAW_AUDIO_SECRET"),
            rawLearnerImage: new TextEncoder().encode("RAW_IMAGE_SECRET"),
            transcriptText: "TRANSIENT_TRANSCRIPT_SECRET",
            captionText: "TRANSIENT_CAPTION_SECRET",
        },
    };
    const result = projectDurableMultimodalEvidence(source);
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted")
        return;
    assert.equal(Value.Check(DurableMultimodalEvidenceSchema, result.evidence), true);
    const serialized = JSON.stringify(result.evidence);
    for (const forbidden of [
        "RAW_AUDIO_SECRET",
        "RAW_IMAGE_SECRET",
        "TRANSCRIPT_SECRET",
        "CAPTION_SECRET",
        "TRANSIENT_TRANSCRIPT_SECRET",
        "TRANSIENT_CAPTION_SECRET",
        "Try identifying",
        "transcriptText",
        "captionText",
        "rawAudio",
        "rawLearnerImage",
    ]) {
        assert.equal(serialized.includes(forbidden), false, forbidden);
    }
    assert.deepEqual(Object.keys(result.evidence).sort(), [
        "assistanceLevel",
        "captionAvailability",
        "captionRef",
        "commercialExecutionScopeRef",
        "conceptRef",
        "contractVersion",
        "envelope",
        "evidenceRef",
        "householdScopeRef",
        "interactionRef",
        "learnerScopeRef",
        "logicalOperationRef",
        "mode",
        "observedAt",
        "opportunityRef",
        "outcome",
        "presentationRef",
        "rawMediaPersisted",
        "sessionRef",
        "transcriptPersisted",
        "turnRef",
        "visualStep",
    ]);
});
test("durable evidence schema rejects raw fields and raw-like ref smuggling", () => {
    const source = {
        evidenceRef: "evidence:multimodal-002",
        sessionRef: "session:study-001",
        presentation: presentationFor("reviewed-image"),
        trustedContext: trustedContextFor(presentationFor("reviewed-image")),
        outcome: "inconclusive",
        assistanceLevel: "guided",
        observedAt,
    };
    const result = projectDurableMultimodalEvidence(source);
    assert.equal(result.status, "accepted");
    if (result.status !== "accepted")
        return;
    assert.equal(result.evidence.reviewedVisual?.reviewStatus, "approved");
    const contaminated = { ...result.evidence, rawImage: "data:image/png;base64,SECRET" };
    assert.equal(Value.Check(DurableMultimodalEvidenceSchema, contaminated), false);
    const smuggled = projectDurableMultimodalEvidence({
        ...source,
        evidenceRef: "data:image/png;base64,SECRET",
    });
    assert.equal(smuggled.status, "rejected");
    const unreviewedPresentation = clone(source.presentation);
    const unreviewedContent = unreviewedPresentation.content;
    const unreviewedVisual = unreviewedContent.visual;
    unreviewedVisual.reviewStatus = "pending";
    const unreviewedProjection = projectDurableMultimodalEvidence({
        ...source,
        presentation: unreviewedPresentation,
    });
    assert.equal(unreviewedProjection.status, "rejected");
    if (unreviewedProjection.status === "rejected") {
        assert.equal(unreviewedProjection.code, "INVALID_MULTIMODAL_EVIDENCE_SOURCE");
    }
});
