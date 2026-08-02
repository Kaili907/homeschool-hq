# Validation Report

Validation date: 2026-07-28  
Audit status: **PASS WITH BLOCKER**  
Assembly status: **NOT AUTHORIZED**

“Pass with blocker” means the reconciliation package, mappings, traces, probes, and unchanged Wave 1 baselines are internally valid, while the required actual Tutor Core v0.2 compatibility work could not run.

## Reconciliation validation

| Check | Result |
|---|---|
| Machine JSON parse/schema assertions | PASS |
| Required decision topics | 26/26 |
| Required flow traces | 14/14 |
| Allowed issue classifications | PASS |
| Five required specialist reviews recorded | 5/5 |
| Reconciliation executable probes | 7/7 PASS |
| Reconciliation Node tests | 19/19 PASS |
| Wave 1 ZIP SHA-256 recheck inside tests | 4/4 PASS |
| Tutor Core compatibility probes | 0/20 NOT RUN — missing artifact |

The reference probes cover hard-cap-before-hold, accommodation clamping, infeasible constraints, rejected recommendations, unsupported-version quarantine, fixed non-reflective quarantine metadata, command replay, idempotency conflict, contiguous event append, and revision CAS.

Node’s default test-file isolation attempted child-process spawning and received the managed sandbox’s `EPERM`. The same tests were rerun with Node 24’s `--test-isolation=none`; all 19 passed. This was a runner-environment restriction, not a product assertion failure.

## Read-only Wave 1 baseline

| Package/scope | Command class | Result |
|---|---|---|
| Session 1 contracts | Strict TypeScript no-emit | PASS |
| Session 1 schemas | Vitest | 7 files, 116 tests PASS |
| Session 2 engine | Strict TypeScript no-emit | PASS |
| Session 2 engine | Vitest | 21 files, 325 tests PASS |
| Session 3 Study UX | TypeScript no-emit | PASS |
| Session 3 Study UX | Vitest/jsdom | 8 files, 25 tests PASS |
| Session 4 integrations | Vitest | 10 files, 55 tests PASS |

The browser E2E configuration was not run because its configured report/artifact paths are outside Session 5’s exclusive write roots. No output location or Wave 1 config was rewritten to bypass that boundary. Browser dependency compatibility with Tutor Core is also unknowable until the real Core manifest exists.

## Commands

```powershell
node adaptive-tutor/study-engine/reconciliation/probes/run-probes.mjs
node --test --test-isolation=none adaptive-tutor/study-engine/tests/reconciliation/*.test.mjs
node node_modules/typescript/bin/tsc -p adaptive-tutor/study-engine/contracts/tsconfig.json
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/schemas --pool=threads --maxWorkers=1 --no-file-parallelism
node node_modules/typescript/bin/tsc -p adaptive-tutor/study-engine/engine/tsconfig.json
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/engine --pool=threads --maxWorkers=1 --no-file-parallelism
npm run typecheck
npm test -- --pool=threads --maxWorkers=1 --no-file-parallelism
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/integrations --configLoader runner --pool=threads --maxWorkers=1 --no-file-parallelism
```

The two `npm` commands were run from `adaptive-tutor/study-engine/prototype`.

## Unrun Core probes

TC-P00 through TC-P19 are intentionally marked `NOT RUN — BLOCKED BY MISSING ARTIFACT` in the machine compatibility matrix. They include archive/manifest checks, isolated Node and browser builds, exhaustive outcome mapping, safety/media/transcript/adult-evidence boundaries, replay/resume, Romeo support, and dual TypeScript configurations.

## Conclusion

The audit package is structurally valid and reproducible. It must not be interpreted as Tutor Core compatibility approval or permission to integrate/final-assemble.

