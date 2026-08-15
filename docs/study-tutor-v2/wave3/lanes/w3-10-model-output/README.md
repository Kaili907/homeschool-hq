# W3-10 untrusted model output validation boundary

## Ruling

Provider/model output is data, never authority. This lane accepts an
already-decoded `unknown` value and performs no model, provider, tool, Study,
guardian, safety, or curriculum action.

The only accepted proposal is a closed, reference-only request containing:

- response kind;
- reviewed-content references;
- grounding references;
- closed reason codes;
- one requested Tutor action;
- one instructional display mode; and
- refusal state.

There is no learner-facing prose field. Every object rejects additional
properties, every reference and string is bounded, and every array has a fixed
maximum. A refusal is a separate closed shape with empty content/grounding
references, no requested action, display mode `none`, and refusal state
`refused`.

## Trusted validation context

The caller supplies trusted, non-model policy inputs:

- current assessment phase;
- admitted reviewed-content references;
- admitted grounding references;
- allowed Tutor actions; and
- allowed instructional display modes.

An otherwise well-formed proposal is not accepted unless every content and
grounding reference is in those allowlists and its requested action and display
mode are allowed. The provider's action is only a proposal; this boundary does
not execute it.

## Normalized outcomes

`validateProviderModelOutput` returns exactly one outcome family:

- `accepted-proposal` — a detached, frozen reference-only snapshot;
- `refused` — a detached, frozen closed refusal and static fallback signal;
- `malformed` — generic non-JSON, wrong-shape, wrong-enum, over-bounded, or
  unknown-field rejection without echoing provider data; or
- `static-fallback-required` — a closed policy reason for authority injection,
  active-assessment answer risk, unreviewed/unknown references, or disallowed
  action/display requests.

No rejected outcome carries the untrusted provider value.

## Authority exclusion

Hazard inspection and exact-schema validation fail closed when output attempts
to change or authorize:

- mastery;
- working level;
- nominal grade;
- curriculum assignment;
- safety clearance;
- guardian action; or
- tool invocation.

The scanner examines own property descriptors without invoking provider-defined
getters. Even without a recognized authority name, every added field is still
rejected by the closed envelope.

## Active-assessment anti-answer rule

During `active-graded-or-mastery-check`, answer-bearing field names,
unrestricted tutoring/prose field names, and obvious answer-disclosure strings
require deterministic static fallback before a proposal can be admitted. A
valid active-assessment proposal can only select trusted reviewed-content and
grounding references; it cannot return provider-authored tutoring prose.

## Integration boundary

The lane is intentionally isolated at
`adaptive-tutor/core/v3/model-output/index.ts`. It adds no provider/model call,
shared root export, Study bridge wiring, release artifact, deployment change,
or authority mutation. A convergence lane can import the boundary after review.
