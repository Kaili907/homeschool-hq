# Validation report

Report date: 2026-07-28  
Contract schema version: 1  
Root runtime/JSON Schema count: 7

## Scope verified

- TypeScript contract surface for plans, focus, all study-session states,
  learning evidence, review scheduling, adult controls, and separate adult
  private records.
- Seven strict runtime validators accepting `unknown`.
- Seven deterministic JSON Schema Draft 2020-12 artifacts.
- Fifteen valid synthetic fixture payloads, including all eight study-session
  states and both focus-estimate states.
- Twenty-two focused invalid mutation fixtures.
- JSON serialization/runtime-validation round trips.
- Identifier byte stability and legacy adapters.
- Version inspection and non-mutating initial migration gate.
- Sequence, reference, chronology, state/result, timing, percentage, interval,
  parent-cap, privacy, and child-safety refinements.
- JSON-safety and bounded-input defenses.

## Recorded commands and results

```text
node node_modules/typescript/bin/tsc -p adaptive-tutor/study-engine/contracts/tsconfig.json --noEmit
PASS

node adaptive-tutor/study-engine/schemas/generate-json-schemas.ts --check
PASS

node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/schemas --reporter=verbose
PASS — 7 files, 116 tests
```

The first sandboxed Vitest attempt could not spawn Vite’s esbuild worker
(`spawn EPERM`). The exact targeted command was rerun with process-spawn
permission and passed. No network access or external service was used.

## Safety results

- The low-accuracy example (20%) validates with high self-reported effort,
  independent work, ordinary response latency, zero redirections, no random
  response indicator, and `engagementSupport.status: 'no-concern'`.
- Changing that result to `support-may-help` with only `accuracy` as evidence is
  rejected with a stable `safety` issue.
- Generated schemas expose no permanent/fixed attention-span property.
- Insufficient-data profiles reject personalized baseline/target/maximum
  duration fields.
- Break and technical-interruption fixtures contain no shaming, failure, or
  engagement labels.
- Student-safe aggregates reject embedded private-note bodies.
- The synthetic private sentinel occurs only in the adult-private fixture and
  invalid privacy cases.

## Limitations

1. The named `manuel-academy-adaptive-tutor-core-v0.2` artifact was unavailable,
   so exact API/validator parity with that release is unverified.
2. No independent JSON Schema evaluator such as Ajv is installed. Tests prove
   deterministic generation and runtime-fixture parity; cross-engine JSON
   Schema parity is not claimed.
3. Cross-aggregate references (for example, a session plan ID resolving to an
   existing plan) require a repository/integration layer. Each aggregate
   validates its internal references.
4. Version 1 has no predecessor migration. Older/future versions are safely
   quarantined until an explicit lossless migration exists.
5. The package is not integrated into storage, UI, engine, parent surfaces,
   identity, or deployment by design.

