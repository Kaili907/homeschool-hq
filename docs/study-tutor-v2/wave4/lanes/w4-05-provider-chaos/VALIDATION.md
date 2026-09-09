# W4-05 Provider Chaos Validation

## Classification

`W4_PROVIDER_CHAOS_BLOCKER_FOUND`

The offline deterministic adapter and all 21 requested fault cases are implemented. Sixteen cases meet their expected outcomes. Five cases reproduce two architectural blocker classes at the accepted commercial execution boundary.

## Blocker 1: mutable attempt identity

The transport receives the same mutable `CommercialAttempt` object held by the reservation. TypeScript's `readonly` annotation does not provide a runtime trust boundary. In PC-12 and PC-13, the hostile transport rewrites `modelRevisionRef` or `configurationDigest` on that object, then creates a usage receipt against the now-mutated reservation identity. Post-transport validation compares the result to the already-corrupted object, so the response becomes a Study advisory.

Observed proof for each case:

- expected `static-fallback`, observed `advisory`;
- observed provider-call count `1`;
- `Object.isFrozen(attempt)` was `false` on boundary entry;
- the mutation was applied successfully;
- the returned reservation exposes the provider-forged revision/digest.

This lane does not repair production code because its ownership is limited to the adversarial adapter and lane documentation. Convergence must detach and deep-freeze the trusted attempt/reservation snapshot before invoking untrusted transport code, and validate the response and receipt against the untouched trusted snapshot. A repair must rerun this exact matrix and turn PC-12 and PC-13 into static fallback without weakening any of the 16 passing cases.

## Blocker 2: stale execution eligibility

The reserved route snapshot is used without a fresh trusted dispatch/failover guard:

- PC-18 changes the planned failover's trusted availability to `OUTAGE` after planning. The orchestrator still dispatches it, returning an advisory with two calls instead of static fallback with one.
- PC-20 produces a trusted `deny-commercial-route` decision from an actual open failover circuit after planning. The orchestrator still dispatches it, returning an advisory with two calls instead of static fallback with one.
- PC-21 advances trusted policy evaluation past the provider policy evidence expiry between planning and response acceptance. The orchestrator does not revalidate eligibility and returns an advisory.

The fallback call currently supplies literal `"eligible"` availability and a literal closed circuit to resilience policy. There is no trusted execution-time policy revalidation input. Convergence must add a trusted, deterministic pre-dispatch and pre-acceptance guard without delegating policy authority to the provider, while preserving the already reserved attempt/budget ceiling. PC-18, PC-20, and PC-21 must become static fallback and PC-18/PC-20 must make no second provider call.

## Validation commands

Commands were run from the repository root using Node `v22.23.2` and an existing local TypeScript `5.8.x` installation; no package installation or network access occurred.

```sh
node /existing/local/node_modules/typescript/bin/tsc \
  -p adaptive-tutor/adversarial/v4/provider-chaos/tsconfig.json \
  --typeRoots /existing/local/node_modules/@types

node --test \
  adaptive-tutor/adversarial/v4/provider-chaos/.dist/adversarial/v4/provider-chaos/provider-chaos.test.js

node \
  adaptive-tutor/adversarial/v4/provider-chaos/.dist/adversarial/v4/provider-chaos/print-matrix.js
```

Observed:

- TypeScript strict compile: PASS
- Node tests: `8/8` PASS
- Determinism: PASS, two complete matrix executions were deeply equal
- Matrix classification: `BLOCKER_FOUND`, `16/21` expected outcomes satisfied
- Network/provider credentials/provider SDK: none

The test suite passes because it verifies that the certification runner deterministically reproduces and classifies the current blocker. The matrix's aggregate certification status remains `BLOCKER_FOUND`; a green harness result is not represented as commercial-boundary acceptance.

## Owned artifacts

- `adaptive-tutor/adversarial/v4/provider-chaos/adapter.ts`: deterministic provider-neutral chaos transport and clock
- `adaptive-tutor/adversarial/v4/provider-chaos/matrix.ts`: executable 21-case matrix and invariant classifier
- `adaptive-tutor/adversarial/v4/provider-chaos/provider-chaos.test.ts`: coverage, determinism, invariant, and blocker proof
- `adaptive-tutor/adversarial/v4/provider-chaos/print-matrix.ts`: canonical observable result emitter
- `adaptive-tutor/adversarial/v4/provider-chaos/tsconfig.json`: isolated strict compile
- `docs/study-tutor-v2/wave4/lanes/w4-05-provider-chaos/FAULT-MATRIX.md`: expected/observed outcomes and provider-call counts

No production source, provider SDK, credential path, deployment path, or live-network integration was changed.
