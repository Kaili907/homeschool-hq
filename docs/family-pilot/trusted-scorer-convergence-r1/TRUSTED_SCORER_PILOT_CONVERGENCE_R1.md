# Trusted Scorer Current Pilot Convergence R1

## Authority and input

- Product base: `a7c6edee867e0d3f546aaa6e0442fac434b75c84`
- Trusted production item scoring contract input: `1d594411fc969f523b76f340fa388a4c24a0b5a2`
- Study Engine remains the deterministic progression authority.
- The trusted scorer evaluates protected production item responses and records
  minimized evidence through its server-side Study evidence port. The browser
  stores only the returned trusted receipt projection.

## Integration method

`createFamilyPilotTrustedScorer` adapts the current durable
`LearnerResponseRecord` to the existing `ProductionItemAssessmentRequest`.
It sends only release, bound assignment/session, lesson, section, item, attempt,
and learner-response fields. A staging composition must inject the opaque
transport and may inject a verified attempt-binding function. Server authority
still verifies the learner, capability, exact Study session, release, lesson,
section, item, and production package.

The current pilot encodes generated choice ordinals as `choice:N`; the trusted
contract encodes the same learner-safe ordinal as `choice-N`. The adapter changes
only that stable opaque ordinal syntax. It never receives a correct option,
answer key, scoring rubric, resolver payload, or authority locator.

Trusted results are parsed with the exact R1 result contract and must match all
request identity fields. Browser IndexedDB applies a valid receipt with an
atomic compare-and-swap. The first matching result is accepted, an identical
result is idempotent, and a result for a replaced response is stale and cannot
overwrite newer learner work.

## Default and activation locks

The default remains disabled. Browser composition requires both:

1. exact `VITE_FAMILY_PILOT_TRUSTED_SCORER_ENABLED=true`; and
2. an injected scorer configuration whose environment is `local`, `test`, or
   `staging` (never `production`).

The server endpoint independently requires all of:

1. `ACADEMY_STUDY_ENABLED=true`;
2. exact `ACADEMY_FAMILY_PILOT_TRUSTED_SCORER_ENABLED=true`; and
3. `ACADEMY_DEPLOYMENT_ENV=local|test|staging`.

Missing locks and production-scoped configuration return `503 gateway_disabled`.
No configuration in this change activates either lock.

## Fail-closed behavior

The learner response is durably saved as `PENDING_ASSESSMENT` before any scorer
call. Disabled/503, timeout, network interruption, malformed result, wrong
result identity, wrong learner/session authorization, and stale result all
leave a truthful pending record with no assessment receipt. Duplicate trusted
results are idempotent and never cause a second progression action.

The friendly current-pilot waiting message and pending count remain in the
Lesson Player. Study segment progression continues to use its existing
required-response contract; the scorer adapter contains no completion, mastery,
or progression operation.

## Assessment Review Center boundary

`FamilyPilotTrustedScoreReviewCenterPort` and
`FamilyPilotTrustedScoreReviewItem` expose only three UI-neutral states:

- `PENDING_TRUSTED_SCORE`
- `TRUSTED_RESULT_AVAILABLE`
- `PARENT_ACTION_REQUIRED`

The projection includes stable identity, update time, optional receipt ref, and
an allowed outcome. It excludes learner response bodies, answer authority,
rubrics, resolver payloads, session bearers, and secrets. Session 17 can
implement its own reader/UI against this port without coupling the scorer to
that implementation.

## Local-only proof

The convergence integration test runs the real server handler and scoring
service in process with injected test authority, resolver, and Study evidence
ports. It proves the allowed request, trusted server evaluation, minimized
browser result, server-side Study evidence, and unchanged Study progression
contract. Error simulations are local mocks only. No hosted Supabase, live
scorer, production service, deploy, Tutor V2, or curriculum mutation is used.
