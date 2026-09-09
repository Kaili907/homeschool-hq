# W3-R7 canonical presentation compatibility repair

Session: `STUDY-TUTOR-V2-W3-R7`

## Ruling

`PresentationIntent` is the single canonical vocabulary between validated
commercial model output, learner-stage delivery constraints, routing, and the
W3-06 presentation layer. It is closed and reference-only. It can carry:

- an optional reviewed text reference;
- an optional reviewed image or diagram reference with its digest and review
  provenance reference;
- an optional structured-check reference;
- an optional accessibility-caption reference;
- requested `text`, `visual`, and `speech-after-acceptance` delivery channels;
  and
- an optional reference to a fallback presentation.

At least one instructional content reference is required. Caption metadata
does not satisfy that requirement, does not imply a text channel, and never
becomes learner-facing instructional prose.

## Deterministic W3-10 mapping

The accepted W3-10 `reviewedContentRefs` array has closed positional semantics
at this bridge. Any other arity fails closed.

| W3-10 display mode | Reviewed reference positions | PresentationIntent |
| --- | --- | --- |
| `reviewed-text` | `[text]` | `reviewedTextRef`, channel `text` |
| `reviewed-visual` | `[visual]` | trusted visual binding, channel `visual` |
| `reviewed-text-and-visual` | `[text, visual]` | both independent slots, channels `text`, `visual` |
| `structured-check` | `[check]` | `structuredCheckRef`, channel `text` |

A visual reference must match one trusted binding containing kind, digest, and
provenance. The bridge cannot manufacture those facts. Speech may be requested
only when reviewed text or a structured check supplies its source. It is not a
provider audio output mode.

## Commercial response wrapper

`CommercialModelResponse` carries exactly one W3-10 normalized proposal or
refusal, a reference-only grounding-claim sidecar, and either a consistent
`PresentationIntent` or `null` for refusal. The wrapper rejects unknown fields,
grounding/reference mismatches, display/intent mismatches, free-form claim
text, and authority fields. It grants no Study, curriculum, mastery, grade,
safety, guardian, tool, or rendering authority.

## Learner stage and routing

`constrainPresentationByLearnerStageAllowance` accepts only the modality
allowance already resolved by W3-11. It receives no learner facts or stage
selector, does not infer learner stage or content, and can only allow or deny
the explicit delivery modalities.

An allowed result derives one existing W3-01 capability requirement:

- no reviewed visual: `TEXT_ONLY`;
- reviewed image or diagram: `REVIEWED_IMAGE`.

Only that capability requirement is copied into routing. Caption metadata and
post-acceptance speech do not widen provider capabilities. A route without the
derived capability fails under the existing W3-01 `MULTIMODAL_MISMATCH` rule.

## W3-06 adapter and raw-media boundary

The adapter accepts a closed
`trusted-study-provider-output-acceptance` envelope and emits distinct W3-06
reference pieces in deterministic order: reviewed text, reviewed visual,
structured check, accessibility caption, speech delivery, and fallback.
Text-and-visual is never collapsed.

Speech output contains only its reviewed source reference and literal gates
requiring prior acceptance; it contains no audio. Raw audio, raw image bytes,
video, provider raw media, data URLs, and provider-authored prose have no field
in the contract and are rejected at the exact-schema boundary. Reference
resolution, pixel rendering, and speech synthesis remain Study-owned actions.

## Ownership

The repair is isolated under `adaptive-tutor/core/v3/presentation/`. The
assembled W3-01, W3-06, W3-10, and W3-11 lane contracts are not weakened or
expanded.
