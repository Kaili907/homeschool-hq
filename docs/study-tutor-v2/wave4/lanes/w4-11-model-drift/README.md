# W4-11 — Model revision drift and commercial certification policy

## Delivered boundary

W4-11 adds an offline, deterministic certification-policy package at
`adaptive-tutor/certification/v4/model-drift`. It evaluates already-recorded
evidence and returns a versioned state/decision contract. It does not call a
model or provider, change a route, deploy, revoke a stored record, or select a
production fallback.

## Certification identity

A certificate is bound to the exact provider, model alias, resolved model
revision, configuration digest, provider-policy revision, routing-policy
revision, curriculum/corpus revision, eval-corpus revision, grader revision,
and learner-stage catalog revision. The canonical SHA-256 identity digest is
recomputed for every certificate, observation, and rollback candidate.

A provider's mutable alias is evidence, not identity authority. When the same
`providerRef` and `modelRef` resolve to a different `modelRevisionRef`, the old
certificate is not applicable to the new resolution. The decision is
`DRIFT_DETECTED`; the observed candidate is quarantined and requires a full
commercial campaign.

## State precedence

The pure evaluator applies this order:

1. no certificate: `UNCERTIFIED`;
2. stored revocation: `REVOKED`;
3. hard failure on the exact certified identity: `REVOKED` with immediate
   revocation required;
4. mutable-alias revision change: `DRIFT_DETECTED`;
5. any other exact identity change: `RECERTIFICATION_REQUIRED`;
6. exclusive validity-window end: `EXPIRED`;
7. certification not yet valid: `UNCERTIFIED`;
8. out-of-bounds soft metric: `DRIFT_DETECTED`; otherwise
9. exact identity, all hard gates passing, and all soft metrics in bounds:
   `CERTIFIED`.

Hard-gate evidence is assessed before academic quality for the same identity.
A perfect academic score cannot offset a safety, authority, privacy,
grounding, scope, format, content-review, or provider-fault regression.

## Recertification matrix

| Changed field | Required scope |
| --- | --- |
| provider | full commercial campaign |
| model alias | full commercial campaign |
| model revision | full commercial campaign |
| configuration digest | full commercial campaign |
| provider policy | provider eligibility review plus full commercial campaign |
| routing policy | routing integration review plus full commercial campaign |
| curriculum/corpus | curriculum coverage review plus full commercial campaign |
| eval corpus | full campaign on the new eval corpus |
| grader | regrade preserved admissible evidence or rerun under the new grader |
| learner-stage catalog | stage-stratified full commercial campaign |

No field admits semantic equivalence, prefix matching, or alias substitution.
When multiple fields change, the decision returns every changed field and the
deduplicated union of required scopes.

## Commercial restriction

This lane establishes policy behavior, not commercial certification evidence.
Its fixtures are synthetic and `sourceKind: "recorded-offline-evidence"`.
Nothing in this lane authorizes production use.
