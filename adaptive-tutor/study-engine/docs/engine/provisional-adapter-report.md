# Provisional adapter report

## Discovery result

At the start of Session 2, the workspace did not contain an
`adaptive-tutor/` tree, Session 1 study-engine contracts, study-engine schemas,
or an adaptive tutor core package. Existing application files were not used as
a substitute contract because they belong to a different package and are
outside this session's ownership.

The allowed fallback was therefore used. Local adapters live in
`engine/adapters/` and no file was created in `study-engine/contracts/` or
`study-engine/schemas/`.

## Provisional contracts

Two versioned, privacy-minimal shapes are defined:

1. `provisional.study-engine.session-context.v1`
   - opaque `sessionRef`
   - `gradeBand`: `elementary | middle | high`
   - opaque `subjectKey`
   - opaque `taskTypeKey`
   - IANA `timeZone`
2. `provisional.tutor-core.instruction-outcome.v1`
   - opaque `sessionRef`
   - offset-qualified `occurredAt`
   - core-authored `instructionDirective`: `correct | reteach`

Adapters validate the version and required fields, verify that a tutor-core
outcome belongs to the expected session, return fixed non-echoing errors, and
copy only allowlisted fields. Unknown input fields—including accidental direct
identifiers, transcripts, or misconception detail—are dropped.

## Contract assumptions

- Session references are pseudonymous and are safe to place in deterministic
  traces.
- Subject and task-type comparability is based on stable opaque keys.
- Grade band is available without birthdate or exact age.
- A learner time zone is supplied as an IANA identifier.
- Instants cross boundaries as ISO 8601 timestamps with an explicit offset.
- Review due dates cross boundaries as `YYYY-MM-DD` calendar dates.
- The tutor core can emit an authoritative `correct` or `reteach` routing
  directive after the confidence check.
- The core, not this engine, owns mastery and misconception meaning.
- Parent overrides and caps are already authorized configuration; the engine
  does not authenticate or mutate them.

## Exact reconciliation needed

Before integration, the dispatch/integration session must:

1. Replace the two provisional version strings with the canonical contract
   versions and map canonical field names without weakening runtime checks.
2. Confirm the canonical grade-band values and whether band is supplied
   directly or derived upstream.
3. Map canonical subject and task-type identifiers to the exact-comparability
   keys expected by the focus engine.
4. Confirm the tutor-core directive enum and the lifecycle point at which the
   directive is final. Do not map a study-engine heuristic to that field.
5. Reconcile the focus-session success signal with the core's authoritative
   outcome contract. Preserve the four-of-five increase rule.
6. Reconcile parent override and duration-cap precedence with the canonical
   policy contract.
7. Map approved-break, break-refusal, and break-resume events to the canonical
   event names while preserving the rule that an approved break is not failure.
8. Confirm whether review dates are local calendar dates or zoned instants. If
   zoned instants are required, retain learner-zone calendar arithmetic before
   serialization.
9. Replace local type guards with canonical schema parsers when available, then
   run adapter parity tests against valid and invalid Session 1 fixtures.
10. Remove provisional adapters only after canonical contract integration
    tests demonstrate equivalent safety, privacy, and determinism.

No assumption above authorizes database, authentication, identity, storage,
deployment, or external-service changes.
