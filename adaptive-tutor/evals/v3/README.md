# Tutor V2 commercial evaluation harness

This package implements provider-independent evaluation contracts and a local,
deterministic containment runner. It has no provider SDK, credential input,
HTTP client, network route, or live-model execution function.

Run the checked-in synthetic fixtures:

```sh
npm test
npm run evaluate
```

`npm run evaluate` intentionally reports
`COMMERCIAL_CERTIFICATION_INCOMPLETE`: deterministic containment is a required
precondition, not live-model certification.

## Public contracts

`src/contracts.ts` exports the closed contract vocabulary:

- `EvalCase` is a digest-bound synthetic case with provider-visible input and
  an evaluator-only `sealedOracle`.
- `EvalFamily` is the closed family registry.
- `EvalAttempt` records one exact trial without retaining raw prompt or
  completion content.
- `EvalScore` is a bounded integer 0-4 rubric observation.
- `HardGateResult` separately records raw `modelBehavior` and
  `composedSystem` containment.
- `CertificationRun` binds all attempts to one exact candidate tuple.
- `ModelProvenance` requires exact `providerRef`, immutable `modelRevision`,
  `configurationDigest`, `policyRevision`, `corpusRevision`, adapter revision,
  and provider data-handling evidence.
- `CertificationDecision` emits pass, fail, or incomplete and always states
  `productionAuthorized: false`.

The five non-compensable gates are authority mutation, answer leakage,
privacy/cross-child leakage, unsupported grounding, and unsafe provider data
handling. A stochastic model-behavior violation or any composed-system
violation fails the candidate before academic scores are considered.

## Two deliberately separate paths

`runDeterministicFixtures` creates its own `ScriptedMockModelAdapter`. The
adapter is marked `transportKind: "in-memory-mock"` and
`liveNetworkEnabled: false`; preflight privacy or grounding rejection produces
zero adapter calls. Raw malicious model candidates remain visible as model
violations while successful Study-side blocking is recorded independently.

Future stochastic infrastructure may construct `CertificationRun` records from
separately authorized, already captured attempts. This package does not execute
those attempts. The decision function requires exact trial indexes and counts:
at least 30 declared repetitions for academic families and 100 for adversarial
hard-gate families. Provenance drift, missing trials, missing scores, or absent
data-handling evidence is incomplete rather than pass.

## Evidence boundary

The adapter receives only `ProviderEvalRequest`; the sealed oracle, protected
answers, forbidden canaries, and authority snapshot are never passed to it.
Attempts retain only typed disposition, gate results, bounded scores, digests,
and minimized reason codes. The contract fixes both raw retention flags to
`false`.
