# W4-10 Parent Guardian Authorization and Reporting Abuse Certification

## Result

`W4_PARENT_GUARDIAN_BLOCKER_FOUND`

The Wave 3 Parent reporting implementation is not changed by this lane. The
owned adversarial suite attacks the existing serialized boundary and keeps a
failed invariant red when an abuse is accepted.

## Confirmed defenses

The campaign confirmed fail-closed behavior for:

- missing authorization;
- wrong guardian, household, learner, session, reporting period, or
  visibility;
- stale-revision and revoked authorization;
- absent required consent;
- an otherwise valid sibling authorization;
- an otherwise valid authorization from a prior reporting period;
- Tutor advisory, provider response, telemetry, memory, curriculum admission,
  and Parent request objects used as confused-deputy authorization;
- sibling evidence;
- raw Tutor transcript, raw provider response, and provider prose fields; and
- reflection of the private sentinel in rejection results.

The reviewed pending copy also remained truthful. `Tutor proposed` says Study
has not approved or applied the proposal. `Study approved` says approval does
not mean application. Neither pending row claims completion.

## Blocking escapes

### PG-01: consent identity and requirement are not independently bound

The authorization accepts consent as only a requirement/state pair plus an
opaque reference when required. There is no consent subject, guardian,
household, learner, policy, or report-scope binding available for comparison.

Two attacks were accepted:

1. replacing the granted consent reference with a sibling/foreign consent
   reference; and
2. replacing a required-and-granted consent branch with the exact
   `not-required` branch.

The latter lets submitted authorization data redefine whether the report
policy requires consent. An exact schema is not an independent policy check.

### PG-02: guardian authorization is replayable

The same authorization reference and revision generated one report and then a
second report with a different report reference and generation timestamp. Both
were accepted. The authorization has no report binding, bounded issue/expiry
window, one-time nonce, or consumed-use receipt, and this pure builder receives
no trusted replay state.

### PG-03: evidence decision state is mutable caller data

The report builder verifies closed literals but does not verify an immutable
Study decision receipt or reconcile the submitted state with its source event.
Two transformations were accepted:

1. a `tutor-proposed` prerequisite-review record was relabeled
   `study-applied`; and
2. a `study-approved` reteach record was reclassified as a null-status
   `practice-completed` observation.

Both retained syntactically exact `producer: study-engine` and
`reportingApproval: study-approved-for-parent-reporting` fields. Those literals
are caller-controlled in this boundary and therefore do not prove the claimed
Study transition.

## Convergence requirements

Convergence should remain blocked until the shared implementation, in its own
ownership lane, supplies independently verifiable bindings for:

- required consent and the consent subject/scope;
- authorization freshness and replay/use;
- report identity or an explicitly documented reusable-grant policy with a
  trusted current-revision lookup; and
- decision/observation state tied to immutable Study evidence rather than
  submitted literals.

The five red probes should turn green without weakening any of the 25 passing
authorization, confused-deputy, wording, or privacy probes.
