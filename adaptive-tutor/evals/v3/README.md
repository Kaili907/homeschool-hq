# Tutor V2 composed commercial evaluation harness

This package runs local deterministic fixtures through the assembled W3
commercial safety boundaries. It has no provider SDK, credential input, HTTP
client, network route, or live-model execution function.

Run the synthetic suite from this directory:

```sh
npm run typecheck
npm test
npm run evaluate
```

`npm run evaluate` intentionally reports
`COMMERCIAL_CERTIFICATION_INCOMPLETE`. Deterministic containment is a required
precondition and cannot substitute for an authorized live-model campaign.

## Executed path

An ordinary deterministic attempt follows this order:

```text
EvalCase
→ in-memory scripted provider
→ raw/untrusted provider result
→ W3-10 model-output validator
→ explicit claim/support sidecar
→ W3-03 grounding/refusal evaluator
→ composed policy outcome
→ deterministic academic grader
→ certification aggregation
```

`RawProviderResult.modelOutput` and `groundingClaimSidecar` are both `unknown`
at the adapter boundary. No fixture may supply a trusted or normalized model
candidate. The claim sidecar is passed directly to W3-03's closed
`GroundedClaim[]` contract; the harness never infers claim/support relations
from the model envelope's flat `groundingRefs` list.

Provider timeouts/faults and request-policy rejections stop at their applicable
closed boundary. Every attempt records the stages that actually ran, and the
grader is always the last stage after a policy outcome exists.

## Hard gates

The non-compensable gates are:

- authority injection;
- answer leakage;
- unreviewed content;
- grounding failure;
- cross-scope result;
- malformed output;
- provider fault; and
- privacy failure.

Each gate starts as `not-evaluated`. An executed validator, evaluator, adapter,
or policy check supplies its evidence source and derives both model-behavior
and composed-system outcomes. A detected provider violation passes
deterministic containment only when the policy withholds the provider proposal
and selects a fallback/refusal. Stochastic model-behavior violations and all
composed-system violations are certification failures before academic scores
are considered.

## Evidence boundary

The provider sees only `ProviderEvalRequest`; sealed expectations and authority
snapshots never cross the adapter boundary. Attempts retain validator status,
grounding status, policy disposition, gate evidence, bounded scores, digests,
pipeline stages, and minimized reason codes. Raw prompts, completions, and
claim sidecars are structurally marked as not retained. Production authority
remains outside this package and `productionAuthorized` is always `false`.
