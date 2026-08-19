# Adaptive Tutor Core v0.2 — Generated Validation Report

**Overall result:** FAIL

- Checks: 19
- Passed: 18
- Failed: 1
- Generated: 2026-08-16T14:42:26.061Z

| Check | Result | Details |
|---|---|---|
| math-program-runtime-schema | PASS | Valid |
| english-program-runtime-schema | PASS | Valid |
| narration-caption-transcript-runtime-schema | PASS | Valid |
| first-response-contract | PASS | assessment |
| diagnostic-transition | PASS | assessment |
| identify-transition | PASS | identify-missing-concept |
| parent-teacher-review-contract | PASS | Empty-evidence review remains explicit about uncertainty. |
| platform-boundary | FAIL | .test-dist/core/v2/policy/authority/authority.test.js, .test-dist/core/v2/policy/authority/index.js, .test-dist/tests/tutor-v2-convergence/global-adaptive-safety-authority.test.js, core/v2/policy/authority/authority.test.ts, core/v2/policy/authority/index.ts, json-schema/v2/study-authority-context.schema.json, scripts/tutor-v2/.dist/core/v2/policy/authority/authority.test.js, scripts/tutor-v2/.dist/core/v2/policy/authority/index.js, scripts/tutor-v2/.dist/tests/tutor-v2-convergence/global-adaptive-safety-authority.test.js, study-engine/docs/final-assembly/authority-matrix.md, study-engine/docs/tutor-core-bridge/authority-boundary-matrix.md, study-engine/tests/tutor-v2-bridge/.test-dist/core/v2/policy/authority/index.js, tests/tutor-v2-convergence/global-adaptive-safety-authority.test.ts |
| no-unauthorized-subject-packages | PASS | Only demonstration fixtures under examples/ and the authorized subjects/math package exist. |
| required-file:core/contracts/index.ts | PASS | core/contracts/index.ts |
| required-file:core/engine/adaptive-tutor-engine.ts | PASS | core/engine/adaptive-tutor-engine.ts |
| required-file:core/prompts/templates.ts | PASS | core/prompts/templates.ts |
| required-file:core/safety/rules.ts | PASS | core/safety/rules.ts |
| required-file:prototype/main.ts | PASS | prototype/main.ts |
| required-file:examples/math-interaction.ts | PASS | examples/math-interaction.ts |
| required-file:examples/english-interaction.ts | PASS | examples/english-interaction.ts |
| required-file:docs/integration-guide.md | PASS | docs/integration-guide.md |
| required-file:docs/director-handoff.md | PASS | docs/director-handoff.md |
| package-version | PASS | 0.2.0 |

## Boundary Confirmation

- No GitHub repository was modified.
- No Supabase, Netlify, Lovable, database, storage, identity, authentication, or progress-synchronization integration was created.
- English materials are demonstration fixtures only; the Math R1 package under subjects/math is the sole authorized final subject package.
- The prototype is local-first and remains usable without audio or external media.
