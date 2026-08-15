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

## Integration

Import from `adaptive-tutor/core/v3/provider-policy/index.js`. Build the registry
from separately reviewed host policy evidence, then evaluate a route before any
student/minor data is sent. Any result other than `eligible` must prevent provider
execution; `static-fallback-required` directs Study to reviewed static content.
