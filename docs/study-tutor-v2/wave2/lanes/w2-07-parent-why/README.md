# W2-07 Parent “Why” explanation layer

Status: implementation foundation for Parent Hub only.

This lane answers “Why did Tutor recommend this?” with a closed reason code and reviewed deterministic copy. It explains a recommendation that Study Engine has already produced. It does not create, approve, rank, deliver, or mutate a recommendation and is not a learning authority.

## Boundary

The entrypoint is `explainTutorRecommendationForParentHub` in `adaptive-tutor/study-engine/tutor-v2/parent-explanations`.

The caller supplies:

- a server-derived authorized learner reference and the currently selected learner reference;
- the learner reference bound to the existing recommendation;
- an opaque recommendation reference and a closed reason code; and
- Study Engine provenance: event reference, policy reference, and production time.

All three learner references must match. A mismatch fails closed and returns no learner identifiers. The accepted projection omits learner identity, event and policy references, evidence details, provider details, and every input field not required for reviewed copy selection.

## Reviewed reason codes

| Code | Parent Hub meaning |
| --- | --- |
| `prerequisite-review-suggested` | An earlier skill may help with the current work. |
| `hint-level-changed` | The amount of help offered changed. |
| `reteach-suggested` | Another explanation was suggested before continuing. |
| `break-suggested` | A brief pause was suggested. |
| `adult-review-requested` | An authorized adult review was requested. |
| `evidence-not-yet-strong-enough` | Approved evidence does not yet support moving ahead with less help. |
| `independent-practice-requested` | Another opportunity for independent work was requested. |
| `tutor-unavailable-static-fallback-used` | Study used reviewed static guidance because Tutor was unavailable. |

Unknown codes and malformed requests fail closed. Copy is selected only from the reviewed in-code table; no provider or learner text is interpolated.

## Privacy and authority rules

The exact-field input schema rejects raw answers, transcripts, provider prompts or responses, sibling or household data, credentials, emotional labels, personality judgments, diagnostic inferences, answer keys, raw evidence, and delivery instructions. Rejection responses contain only a stable error code and never reflect submitted content.

Every accepted explanation includes this authority disclaimer:

> This explains an existing recommendation. It does not make or change a learning decision.

This foundation has no email, SMS, push, provider, database, or notification integration.

## Validation

The colocated test suite covers all eight classes, deterministic copy, non-authority wording, raw answer/transcript/provider rejection, diagnostic/emotional/personality rejection, sibling and household rejection, credential rejection, answer-key rejection, cross-child isolation, malformed and unknown reasons, required Study provenance, exact-field rejection, and minimized output evidence.
