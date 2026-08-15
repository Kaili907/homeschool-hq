# W2-01 adaptive admission gate

## Ruling

This lane adds a deterministic, subject-neutral permission gate for one
Study-authorized Tutor invocation and one requested adaptive feature. Study is
the sole authority. An `admitted` result permits only the named Tutor feature
and action family for the exact invocation, subject, and curriculum bindings in
the input.

The gate does not assign work, select or change a working level, declare
mastery, change official grade or curriculum, alter permissions, clear safety,
grant guardian authority, or reveal answer authority.

## Input model

`StudyAdaptiveAdmissionInputSchema` accepts only closed, structured metadata:

- an exact admission contract version and Study request kind;
- an opaque invocation binding, subject reference, and curriculum binding;
- one feature and one subject-neutral action-family code;
- the Study decision on reviewed-content admission; and
- a versioned `study-authority` capability record bound to that same context,
  including curriculum and safety admission states.

There is no learner prose, age, grade, answer, identity, or provider-generated
authority field in the contract. Extra fields are rejected. The trust claim is
a boundary requirement: callers must supply the metadata from the trusted
Study side; Tutor or provider output is not an admission input.

## Capability vocabulary

- `concept-prerequisite-graph`
- `misconception-analysis`
- `hint-ladder`
- `intervention-ladder`
- `mastery-evidence`
- `prerequisite-repair`
- `reteach`
- `parent-explanation`

Subjects and action families are opaque structured references/codes. No
subject names or subject-specific fallbacks are embedded in the gate.

## Decision model

The result is either:

- `admitted` / `admitted` / `allowed`; or
- `refused` / a closed refusal reason / `denied`.

Closed refusal reasons are:

- `insufficient-capability-metadata`
- `unsupported-subject-capability`
- `unsupported-action-family`
- `safety-restricted`
- `curriculum-not-admitted`
- `reviewed-content-required`
- `adaptive-feature-not-admitted`

Every result explicitly sets all Study-authority and answer-authority powers to
`false` and declares its scope as `tutor-feature-permission-only`.

## Fail-closed precedence

The pure evaluator applies this deterministic order:

1. Reject non-JSON, open, malformed, or wrong-version contracts.
2. Reject duplicate capability records or duplicate action-family entries.
3. Reject cross-invocation reuse.
4. Enforce Study safety restriction.
5. Enforce curriculum admission and the exact curriculum binding.
6. Enforce the exact subject binding.
7. Require an exact capability record and its affirmative feature admission.
8. Require the requested action family in that record.
9. Require reviewed-content admission when that record says it is required.

Unknown feature, action family, version, safety state, or curriculum state never
defaults to permission. Missing or ambiguous capability metadata never defaults
to permission.

## Integration boundary

This lane intentionally has no shared-export, provider, bridge, schema-artifact,
release-artifact, or production wiring changes. A later convergence lane may
import `adaptive-tutor/core/v2/admission/index.ts` directly after review.
