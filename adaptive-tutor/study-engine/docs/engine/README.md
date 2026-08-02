# Manuel Academy Study Engine — Session 2

This artifact is a framework-independent TypeScript implementation of adaptive
study timing, breaks, evidence classification, review scheduling, interleaving,
session pacing, and safe Jarvis coaching copy.

## Package map

- `engine/orchestrator/` — ordered session-cycle state machine
- `engine/focus/` — conservative focus-duration recommendations
- `engine/evidence/` — possible-cause evidence classification
- `engine/breaks/` — bounded break and resume recommendations
- `engine/review/` — configurable calendar-date review scheduling
- `engine/interleaving/` — blocked-to-mixed practice scheduling
- `engine/adapters/` — provisional privacy-minimal contract adapters
- `engine/safety/` — coach-language output guard
- `engine/index.ts` — public source barrel
- `prompts/` — twelve Jarvis coaching templates
- `tests/engine/` — focused, boundary, property-style, privacy, safety, trace,
  and adversarial tests
- `docs/engine/` — algorithms, traces, validation, limitations, and contract
  reconciliation

The tutor core remains authoritative for mastery, misconceptions,
prerequisites, and reteaching outcomes. This package consumes those outcomes;
it does not reproduce them.

## Verification

From the repository root:

```text
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/engine
node node_modules/typescript/bin/tsc -p adaptive-tutor/study-engine/engine/tsconfig.json --noEmit
```

The package has no database, authentication, storage, deployment, network, or
runtime service dependency. Canonical Session 1 contracts were unavailable;
read `provisional-adapter-report.md` before integration.
