# W3-11 deterministic learner-stage policy

## Outcome

W3-11 adds a closed learner-stage policy registry and evaluator in
`adaptive-tutor/core/v3/learner-stage-policy`. Study supplies an exact trusted
binding to one approved profile, measures the actual Tutor turn, and enforces
the selected profile. Tutor and its provider do not select, relax, or replace
the profile.

The policy is a constraint on teaching shape. It is not authority to assign a
stage, change placement, make a learning decision, contact a parent, or mutate
Study state.

## Trusted selection boundary

`TrustedStudyLearnerStageBindingSchema` accepts only:

- the fixed `learner-stage-policy.v1` contract version;
- the fixed trusted Study binding kind and source;
- an opaque policy-profile reference;
- an opaque learner-stage reference; and
- an opaque Study approval reference.

All three references must exactly match one installed Study-approved profile.
The contract has no learner age, birth date, grade, identity, prose, behavior,
voice, appearance, emotion, personality, or diagnosis field. Unknown fields
fail exact validation. This prevents any of those inputs from becoming a stage
selection surface.

The provider is outside this trust boundary. Provider/model output is never
accepted as the trusted binding, and provider-supplied policy overrides are not
part of either the binding or measured-turn contract.

## Deterministic bounds

Each profile supplies all eight required dimensions:

| Dimension | Deterministic enforcement |
| --- | --- |
| Response length | Actual Study-measured word count cannot exceed the maximum. |
| Step count | Actual Study-measured instructional steps cannot exceed the maximum. |
| Hint depth | `none < nudge < concept-cue < guided-step`; the actual depth cannot cross the ceiling. |
| Instructional density | `sparse < moderate < dense`; the actual density cannot cross the ceiling. |
| Visual-step complexity | `none < single-focus < linked-elements < multi-part`; the actual complexity cannot cross the ceiling. |
| Break suggestion | Disabled or bounded by completed turns, cooldown turns, and per-session suggestion count. |
| Multimodal allowance | Every used modality must be allowed and the modality-count cap must hold. |
| Parent-review threshold | Either explicit unresolved-attempt or consecutive-unresolved-turn limit requires a Study parent-review route. |

The evaluator emits issue codes in the table order. Break issues are ordered as
too early, cooldown active, and session limit reached. The function uses no
clock, random source, provider, storage, learner prose, or mutable global state.

## Study-measured turn

The enforcement input is marked `study-measured-tutor-turn`. Study, rather than
the provider, computes the actual response word count, step count, hint depth,
density, visual complexity, and modalities. Study also supplies neutral
structured counters for break cadence and unresolved work.

Measurements are exact, closed JSON. Duplicate modalities, a visual-complexity
claim without a visual modality, a visual modality without a complexity claim,
and inconsistent break-history counters reject the turn as invalid. Extra
provider policy fields also reject the turn.

## Parent-review boundary

Reaching either configured threshold requires a route back to Study. A
`requestsParentReview` measurement records only that the candidate turn asks
Study to consider the route. Every result fixes:

```text
policyEffect = constraint-only
studyDecisionRequired = true
tutorAuthorityGranted = false
providerOverrideAllowed = false
parentContactAuthorized = false
```

The module has no parent-contact integration and makes no diagnosis, emotion,
personality, or psychological judgment.

## Unknown-stage fallback

Registry construction requires a Study-reviewed static fallback descriptor.
An invalid, unknown, or profile/stage/approval-mismatched binding returns only
that descriptor and fixes:

```text
adaptiveTutorAllowed = false
providerInvocationAllowed = false
tutorMayProceed = false
```

The registry does not guess a nearest profile or apply a provider default. The
static content itself remains behind an opaque reviewed-content reference; this
lane does not author learner-facing fallback prose.

## Integration boundary

This lane intentionally changes only its new V3 module and lane documentation.
A convergence lane can import `core/v3/learner-stage-policy/index.ts`, install
the Study-approved profiles and reviewed static fallback, construct the trusted
binding on the Study side, and invoke evaluation both before display and after
actual-turn measurement. No successful result should be interpreted as Tutor
authority or as permission to skip existing safety, grounding, anti-answer,
curriculum, or Study authorization checks.
