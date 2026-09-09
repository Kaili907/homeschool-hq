# W3-01 provider-independent routing core

The router is pure and performs no provider call, catalog discovery, pricing
lookup, credential access, or Study mutation. It selects only from an
`EligibleRouteCatalog` created by `createEligibleRouteCatalog`.

Catalog construction invokes W3-08 separately for every provider. Only an
`eligible` decision produced from a branded host-owned
`TrustedProviderProfileRegistry` is snapshotted. Missing evaluation, expired or
unknown evidence, policy-revision mismatch, and caller-shaped `eligible`
objects cannot enter the catalog.

Every selected decision carries one canonical `routeAttemptPlan` with one
primary and at most one preplanned failover. Each physical attempt pins:

- logical-operation, physical-attempt, route, provider, and model references;
- the immutable model revision and configuration digest;
- the capability-profile revision and digest;
- the provider-policy revision and evidence reference;
- its own canonical decimal-string reserved cost and timeout; and
- a contiguous index and `primary` or `failover` role.

The catalog and plan are immutable snapshots. A later catalog mutation, model
alias revision, pricing change, or policy change cannot rewrite an already
constructed attempt. Provider availability is also matched to the immutable
model revision.

Candidate filtering still enforces action/capability, learner stage, context,
safety, modality, reviewed grounding, availability, latency, timeout, exact
integer-micro cost, and the Study permission boundary. `STATIC_REVIEWED_ONLY`
and every unproved condition fail closed to `NO_ELIGIBLE_PROVIDER_ROUTE`.
