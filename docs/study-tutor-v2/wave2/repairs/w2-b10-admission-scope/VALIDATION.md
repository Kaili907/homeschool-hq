# W2-B10 adaptive admission scope repair validation

Date: 2026-08-15

- Session: `STUDY-TUTOR-V2-W2-B10`
- Starting SHA: `22c3734bd436c41ba8d24409dcaa146d35914e2f`
- Branch: `mac/tutor-v2-w2-admission-scope-repair-r3`
- Final repair SHA: the commit containing this record

## Required reproductions

| Scenario | Result |
| --- | --- |
| Learner A envelope reused for learner B | Refused: `scope-binding-mismatch` |
| Same learner, wrong session | Refused: `scope-binding-mismatch` |
| Same learner/session, wrong instructional context | Refused: `scope-binding-mismatch` |
| Different household scope | Refused: `scope-binding-mismatch` |
| Any required scope field missing from request or envelope | Refused: `insufficient-capability-metadata` |
| Non-opaque scope value | Refused: `insufficient-capability-metadata` |
| Legacy v1 request or capability envelope | Refused: `insufficient-capability-metadata` |
| Exact Study scope with all other capability conditions passing | Admitted |

## Validation results

- [VERIFIED] Isolated strict TypeScript compilation of the admission lane: PASS.
- [VERIFIED] Isolated admission suite: 61/61 passed.
- [VERIFIED] Node runtime: v22.23.2.
- [VERIFIED] `npm ci --ignore-scripts`: completed from the pinned lockfile;
  npm reported three existing high-severity audit advisories. Dependency
  manifests and lockfiles remain unchanged.
- [VERIFIED] Tutor Core build and static prototype smoke: PASS.
- [VERIFIED] `git diff --check`: PASS.
- [VERIFIED] Changed-path ownership check: PASS; every tracked change is under
  an authorized root.

## Expected R4 convergence stop

The aggregate `npm --prefix adaptive-tutor run typecheck` and
`npm --prefix adaptive-tutor test` commands currently stop at
`tests/tutor-v2-convergence/wave2-fixtures.ts:78`. That out-of-scope fixture
still emits `study-tutor-v2.adaptive-capabilities.v1`, which is intentionally
not assignable to the new v2 contract. R4 must complete the adapter steps in
the accompanying README before aggregate convergence can pass.

`EXPECTED_R4_CONVERGENCE_ADAPTER_UPDATE_REQUIRED`

## Ownership and isolation

Tracked changes are confined to:

- `adaptive-tutor/core/v2/admission/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b10-admission-scope/**`

No adaptive orchestrator, Study authority source, convergence fixture,
generated schema, release artifact, production service, curriculum, database,
or deployment configuration was modified or contacted.
