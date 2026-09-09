# W4-R1 commercial integrity repair

Session: `STUDY-TUTOR-V2-W4-R1`

## Outcome

This repair closes the provider-boundary, provider-chaos, policy-resource, and
dispatch-replay defects from W4-03, W4-05, and W4-06. One Study-issued
`CommercialExecutionScope` is now the authority root for a commercial
operation. Routing requests, route plans, physical attempts, budget
reservations, usage receipts, advisories, and telemetry reconcile to that
scope before they can influence a learner.

The branch is not ready for Wave 4 reconvergence because complete accepted-
effect and instructional-memory lineage needs a change in the existing Study
Engine commercial integration, outside this repair's ownership. Independent
presentation-acceptance lineage also belongs to the presentation lane, which
this session explicitly forbids modifying. Those dependencies are recorded in
`VALIDATION.md`; no partial or misleading effect/memory contract was shipped.

## Canonical commercial scope

`CommercialExecutionScope` is issued by Study and binds:

- household, learner, session, interaction, and logical operation;
- curriculum release, package, course, subject, unit, and lesson;
- concept, opportunity, learner stage, and presentation;
- routing request, route plan, reservation, and physical attempts; and
- the allowed route and telemetry-event identities.

The commercial orchestrator validates the exact scope before routing and then
reconciles each derived object against its opaque `scopeRef`. Independently
well-formed sibling objects are insufficient. A mismatch produces reviewed
static fallback before provider dispatch, receipt settlement, or telemetry.

## Execution identity and current state

Usage receipts now repeat the immutable planned provider, model, model
revision, configuration digest, capability-profile revision/digest, and
provider-policy revision/evidence. Every field must equal the planned attempt.

The injected `CommercialExecutionEligibilityResolver` supplies trusted current
state immediately before every physical dispatch and again before a provider
response is accepted. Its exact scope, reservation, attempt, route, provider,
model, capability, policy, availability, circuit, action-family, and modality
identity must reconcile. Provider responses cannot supply this evidence.

## Single-use dispatch

The injected `PhysicalAttemptDispatchClaimPort` claims the tuple of canonical
scope, reservation, logical operation, and physical attempt immediately before
transport execution. `CLAIMED` permits one boundary call;
`ALREADY_CLAIMED` and `CONFLICT` fail closed. The reference in-memory store is
an explicit caller-owned instance and contains no module-global mutable state.
A distinct preplanned physical attempt in the same logical operation can still
be claimed exactly once.

## Resource bounds

Commercial provider-policy inputs now reject before catalog traversal when
they exceed deterministic maxima or contain duplicate requirement identities:

- provider policy requirements: 64;
- allowed retention classes per requirement: 3;
- trusted provider profiles: 64; and
- approved regions per trusted provider profile: 32.

Exact maxima remain accepted. Max-plus-one, 4096-element outer/nested inputs,
duplicate provider profiles, duplicate regions, and duplicate policy
requirements fail closed.
