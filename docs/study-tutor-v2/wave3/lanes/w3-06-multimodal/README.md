# W3-06 transient multimodal foundation

This lane defines provider-independent contracts for text, speech, reviewed
image, reviewed diagram, caption, and optional visual-step Tutor interaction.
It does not select or implement capture, speech, TTS, image, or browser
providers.

## Boundary

The public surface is `adaptive-tutor/core/v3/multimodal/index.ts`.

- `MultimodalPresentationSchema` is the transient turn envelope. Captions are
  mandatory for every mode and remain available for the session.
- `TransientMediaDescriptorSchema` describes raw audio or learner images but
  cannot contain bytes. `TransientMediaPayload` keeps bytes as an in-memory
  `Uint8Array` capability with no serializable schema.
- Speech transcripts are transient and have literal `persistence: "disabled"`.
- Learner images must pass through `TransientLearnerImageReviewRequestSchema`.
  A presentation can contain only an approved, learner-safe visual reference.
- All media descriptors prohibit biometric, emotion, face-identity,
  personality, and diagnostic inference.
- `AssessmentDisclosurePolicySchema` applies after modality selection. Active
  assessment allows only no answer exposure or a bounded hint in every mode.
- `MultimodalDeliveryOutcomeSchema` requires a nonblocking text/caption
  fallback when media is unavailable, so the lesson continues.

## Durable minimization

`projectDurableMultimodalEvidence` is a whitelist projection. It copies only:

- evidence/session/interaction/turn references;
- mode, outcome, assistance, time, and caption availability metadata;
- optional approved visual review/digest references;
- optional visual-step reference.

It never spreads source objects. Raw bytes, transcript text, caption text, and
instructional/learner content are unreachable from the durable result. The
closed `DurableMultimodalEvidenceSchema` rejects extra properties, while the
reference grammar rejects `data:` or other raw-payload-shaped values.

## Integration rules

1. Hold `TransientMediaPayload` only in turn-scoped memory and release it at
   turn completion, cancellation, timeout, or failure.
2. Run learner images through the review boundary before constructing a
   `reviewed-image` or `reviewed-diagram` presentation.
3. Classify answer exposure under Study authority, then call
   `enforceMultimodalPresentationPolicy` for all modes.
4. On any media failure, select the required continuation fallback; never make
   media availability a lesson precondition.
5. Persist only accepted output from `projectDurableMultimodalEvidence`.

The contracts intentionally leave provider adapters, capture lifecycles,
rendering, playback, synthesis, transcription, and visual review engines to
later integration lanes.
