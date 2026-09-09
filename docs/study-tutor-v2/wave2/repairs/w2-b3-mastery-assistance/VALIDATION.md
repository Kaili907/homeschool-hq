# W2-B3 validation

Validation date: 2026-08-14

Starting SHA: `8d618502a16a3d4d169143b539286a3b6fb5b925`

Branch: `mac/tutor-v2-w2-mastery-assistance-repair-r1`

## Focused repair checks

| Check | Result |
| --- | --- |
| Strict Tutor V2 TypeScript (`tsc -p scripts/tutor-v2/tsconfig.json --noEmit`) | PASS |
| Complete mastery lane | 28/28 PASS |
| Authority mutation attacks | PASS within mastery lane |
| Grade/working-level mutation attacks | PASS within mastery lane |
| Answer key/raw response/transcript attacks | PASS within mastery lane |
| Exact duplicate and conflicting replay cases | PASS within mastery lane |
| Duplicate opportunity inflation | PASS within mastery lane |
| Cross-learner/concept/session/context cases | PASS within mastery lane |
| W2-10 concept-cue laundering reproduction | PASS: rejected with `assistance-binding-conflict` |
| Guided-as-independent attack | PASS: rejected with `assistance-binding-conflict` |
| Guided-as-guided behavior | PASS: accepted as guided, not independent |
| Historical independent + current guided | PASS: 3 samples preserved; historical pair supports; current remains guided |
| Whitespace validation (`git diff --check`) | PASS |

The canonical ordering matrix exercised all 16 actual/claimed combinations.
Every claimed level below the Study-bound actual level rejected; equal or more
assisted claims were accepted for normal bounded summarization.

## Wave 1 and Tutor Core regression

`npm run tutor-v2:wave1-gate` was run with an ignored temporary dependency link
to an existing repository install; the link was removed after the run.

| Check | Result |
| --- | --- |
| Provider authority hard-gate family | PASS (5 member checks) |
| Structural active-assessment anti-answer family | PASS (12 member checks) |
| Reviewed-content privacy/provenance family | PASS (9 member checks) |
| Approval-decision structural-validation family | PASS (19 member checks) |
| Cross-slice Wave 1 convergence | 253/253 PASS |
| Repaired Wave 1 bridge regression | 209/209 PASS |
| Regex-neutralized privacy hard gate | 78/78 PASS |
| Evaluation harness self-tests | 8/8 PASS |
| Foundation evaluation | 128/128 PASS; `FOUNDATION_GATE_PASS` |
| Frozen Tutor Core 0.2 typecheck | PASS |
| Frozen Tutor Core 0.2 tests | 21/21 PASS |
| Frozen Tutor Core isolated build/smoke | PASS / PASS |
| Study Core bridge | 35/36 PASS; one external-archive checksum test skipped |

The aggregate Wave 1 command exits nonzero for two expected comparisons that
are not repair regressions: its release checksum detects the intentionally
changed mastery files while this session cannot update out-of-scope release
artifacts, and its W1-09R5 ownership check compares the already-integrated Wave
2 tree to the older Wave 1 B4 baseline. It also reports the inherited W1-05
18/19 broad-validator finding and unavailable external SESSION6 archives. All
four non-compensable Wave 1 hard-gate families and their executable regressions
passed.

## Expected R2 composition state

The unchanged R1 Wave 2 fixture was passed to the compiled composition after
the repair. It returned:

```json
{
  "status": "reviewed-static-fallback",
  "reasonCode": "invalid-composition-request",
  "failedFeature": null
}
```

This is the intended fail-closed temporary state. The existing orchestrator and
fixture do not yet supply the runtime-required opportunity/assistance binding,
and neither was modified in this repair.

`EXPECTED_R2_CONVERGENCE_ASSISTANCE_BINDING_UPDATE_REQUIRED`

## Ownership

Only these owned roots contain repair changes:

- `adaptive-tutor/core/v2/mastery/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b3-mastery-assistance/**`

No adaptive orchestrator, hint, intervention, adaptive lane, or Wave 1 source
file was modified.
