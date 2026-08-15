# W3-03 grounding and refusal core

## Ruling

This lane establishes the deterministic grounding boundary that must run before
a live model proposal can be trusted. A factual or instructional claim is
eligible only when every Study-declared required reference resolves to one
unique, valid, in-scope, Study-reviewed instructional context item with the
exact expected digest.

Every failure returns the normative refusal code:

`INSUFFICIENT_GROUNDED_CONTEXT`

Grounding permission is Tutor-proposal permission only. It cannot mutate Study,
expose answer authority, clear assessment policy, or be upgraded by a provider.

## Trust split

Study supplies two trusted inputs:

- `GroundedContextBundle`: opaque references, scope and digest bindings,
  review/validity state, assessment phase, and an optional static fallback
  reference;
- `GroundingRequirement[]`: the material claims and exact context references
  and digests each claim requires.

The provider supplies only `GroundedClaim[]`: a claim reference and opaque
support references. The provider claim contract contains no review authority,
validity, digest, confidence, answer, or Study-authority fields. Exact schema
validation rejects attempts to add them.

The call site remains responsible for sourcing bundles and requirements from
the trusted Study side. A literal `source` label is not accepted as proof when
provider output crosses that boundary.

## Privacy and authority

The boundary needs no raw transcript, learner prose, context prose, answer key,
identity, grade, or subject-specific content. Context is represented by opaque
references and SHA-256 bindings. Returned issues reflect only opaque
identifiers and closed codes.

There is no unrestricted confidence number. The evaluator derives exactly one
closed class:

- `sufficient`: all material claims resolve and no policy issue exists;
- `partial`: at least one material claim resolves but the proposal still has a
  grounding or anti-answer issue;
- `insufficient`: no material claim is eligible or the boundary is malformed.

Neither `partial` nor `insufficient` permits the proposal.

## Fail-closed rules

The pure evaluator refuses:

- a missing claim required for factual or instructional material;
- an unknown or unexpected claim/context reference;
- ambiguous duplicate claim/context/reference metadata;
- a bundle, requirement, or context scope mismatch;
- context that is not Study-reviewed;
- stale or invalid context;
- a digest mismatch;
- provider review or confidence self-attestation;
- open, malformed, hostile, or non-JSON input; and
- every material claim during an active graded or mastery assessment, even
  when its grounding is otherwise exact.

The last rule preserves anti-answer precedence: grounding is necessary but is
never sufficient to authorize assessment-time tutoring.

## Refusal fallback

A refusal may carry only metadata for the bundle's named fallback when that
reference uniquely resolves to material classified as `static-fallback` that
is in scope, valid, and Study-reviewed. Stale, invalid, cross-scope,
instructional, ambiguous, or unreviewed material is never selected as the
fallback. When no eligible fallback exists, `fallback` is `null`; the caller
must remain refused.

## Integration boundary

This lane intentionally changes only `adaptive-tutor/core/v3/grounding/**` and
its lane documentation. It adds no provider, bridge, live-model, release, or
root export wiring. Convergence may import the lane-local `index.ts` after
review.
