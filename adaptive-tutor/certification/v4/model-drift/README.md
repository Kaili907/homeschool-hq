# Tutor V2 model-drift certification policy

This package evaluates recorded certification and drift evidence without making
model, provider, routing, or deployment calls. Its only authority is to return a
deterministic decision. `productionDeploymentAction` is structurally fixed to
`"none"`.

## Exact identity

`computeCertificationIdentityDigest` hashes a canonical object containing, in
fixed order:

1. `providerRef`
2. `modelRef`
3. `modelRevisionRef`
4. `configurationDigest`
5. `providerPolicyRevisionRef`
6. `routingPolicyRevisionRef`
7. `curriculumCorpusRevisionRef`
8. `evalCorpusRevisionRef`
9. `graderRevisionRef`
10. `learnerStageCatalogRevisionRef`

Every field is exact. Alias names do not substitute for a model revision. A
certificate or observation whose stored identity digest does not reproduce is
rejected as invalid input.

The digest proves deterministic identity binding, not record authenticity. The
host must supply certificates from its trusted certification registry; provider
or model output must never construct a `CertificateRecord`.

## Evidence boundary

`evaluateCertification` consumes a certificate (or `null`), one recorded
observation, an explicit evaluation instant, and an optional exactly resolved
rollback candidate. The observation must contain every hard gate exactly once
and the same soft metric catalog as the certificate. Raw prompts and raw
completions are structurally marked as not retained.

Observation alias evidence is timestamped exactly with the observation, a
snapshot cannot predate the certificate it evaluates, and rollback resolution
evidence must be timestamped at `evaluatedAt`. The policy never reads a clock.

The snapshot source may identify recorded future live-campaign evidence, but
this package provides no live runner, adapter, credential handling, network
primitive, or provider SDK.

## Policy

- Any hard-gate failure on the exact certified identity produces `REVOKED` and
  `revocationRequired: true`. Soft scores cannot compensate.
- A hard-gate failure on a different, uncertified identity cannot revoke the
  older exact identity's certificate. The observed identity remains
  quarantined and uncertified.
- A mutable alias resolving to a different `modelRevisionRef` produces
  `DRIFT_DETECTED`, invalidates use of the prior certification through that
  alias, and requires a full commercial recertification campaign.
- Every other identity-field change produces `RECERTIFICATION_REQUIRED` with
  the field-specific scope exported in `RECERTIFICATION_RULES`.
- Soft metrics are independent integer basis-point checks. A score is in bounds
  only when it is at least 7,500 and has dropped no more than 500 points from
  its certified baseline. Improvement in one metric cannot compensate for
  another metric's breach.
- `validUntil` is exclusive: equality is `EXPIRED`.

## Local validation

After dependencies are installed for `adaptive-tutor` or this package:

```sh
npm test
npm run typecheck
```

The tests use only synthetic fixtures in `fixtures/deterministic-fixtures.ts`.
