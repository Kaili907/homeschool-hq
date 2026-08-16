import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "../../schema/value.js";
import { DurableMultimodalEvidenceSchema, LearnerImageReviewDecisionSchema, MULTIMODAL_CONTRACT_VERSION, MULTIMODAL_MODES, MultimodalDeliveryOutcomeSchema, MultimodalPresentationSchema, TRANSIENT_MEDIA_INFERENCE_RESTRICTIONS, TransientLearnerImageReviewRequestSchema, TransientMediaDescriptorSchema, enforceMultimodalPresentationPolicy, projectDurableMultimodalEvidence, } from "./index.js";
const observedAt = "2026-08-15T14:30:00.000Z";
const digest = `sha256:${"a".repeat(64)}`;
const restrictions = TRANSIENT_MEDIA_INFERENCE_RESTRICTIONS;
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
    reviewStatus: "approved",
    reviewRef: "review:image-001",
    reviewedAt: observedAt,
    learnerSafe: true,
};
const reviewedDiagram = {
    visualRef: "visual:approved-diagram-001",
    visualKind: "diagram",
    contentDigest: digest,
    reviewStatus: "approved",
    reviewRef: "review:diagram-001",
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
        assert.equal(enforceMultimodalPresentationPolicy(presentationFor(mode)).status, "accepted");
        const invalid = clone(presentationFor(mode));
        invalid.assessmentDisclosure = {
            phase: "active-assessment",
            antiAnswerPolicy: "required",
            answerExposure: "reviewed-answer",
            appliesToAllModalities: true,
        };
        const result = enforceMultimodalPresentationPolicy(invalid);
        assert.equal(result.status, "rejected", mode);
        if (result.status === "rejected") {
            assert.equal(result.code, "ACTIVE_ASSESSMENT_ANSWER_BLOCKED", mode);
        }
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
        "contractVersion",
        "envelope",
        "evidenceRef",
        "interactionRef",
        "mode",
        "observedAt",
        "outcome",
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
