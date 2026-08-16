# W3-08 Provider Privacy Eligibility Policy

This lane defines a deterministic, provider-neutral eligibility boundary for
minor/student data. It contains no real provider configuration, credentials,
network calls, or vendor adapters.

## Authority boundary

Only a host-owned `TrustedProviderProfileRegistry` may supply provider policy
evidence. `evaluateProviderEligibility` looks up the requested `providerRef` in
that immutable registry; it has no parameter for provider output and never
accepts a provider-declared eligibility value. Registry construction is an
administrative trust operation and must never receive model or transport output.

Each trusted profile records:

- training use (`prohibited`, `allowed`, or `unknown`);
- retention class and maximum duration in hours;
- minor-data eligibility;
- approved data-residency regions;
- deletion capability;
- multimodal approval;
- the joint contract/privacy-policy revision;
- the host-owned policy evidence reference;
- policy-evidence expiration; and
- provider status.

There are no implicit defaults. Unknown required information cannot authorize a
provider.

## Decisions

| Decision | Meaning |
| --- | --- |
| `eligible` | Current trusted evidence satisfies every supplied requirement. |
| `ineligible` | Current trusted evidence explicitly violates a requirement. |
| `static-fallback-required` | Required evidence is missing, unknown, invalid, expired, or revision-incompatible. |

Static fallback takes precedence when evidence cannot safely establish which
policy applies. Explicit violations include training use, inactive status,
unapproved retention, excessive retention duration, unsupported minor data,
wrong residency region, missing deletion support, and unapproved requested
multimodal use.

Evaluation is replayable: the caller supplies a canonical `evaluatedAt` instant,
and the policy never reads the system clock. The expiration instant is exclusive;
evidence is expired when `evaluatedAt` is equal to or later than
`policyEvidenceValidUntil`.

Every decision records the provider, evaluated instant, policy revision, and
policy evidence reference it evaluated. Eligible decisions therefore carry the
exact evidence W3-01 binds into each route attempt. Missing evidence references
fail closed just like missing revisions or expirations.

## Integration

Import from `adaptive-tutor/core/v3/provider-policy/index.js`. Build the registry
from separately reviewed host policy evidence. W3-01 performs the per-provider
evaluation while constructing its trusted eligible-route catalog. Any result
other than `eligible` prevents that provider from entering the catalog.
