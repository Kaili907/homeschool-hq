# W2-B9 reteach loop-cap repair validation

Validation date: 2026-08-15

- Session: `STUDY-TUTOR-V2-W2-B9`
- Starting SHA: `22c3734bd436c41ba8d24409dcaa146d35914e2f`
- Branch: `mac/tutor-v2-w2-reteach-cap-repair-r3`
- Final repair SHA: the commit containing this record

## Regression coverage

The in-scope reteach suite covers:

- exactly at the effective repeated-reteach cap;
- above the cap;
- one loop below the cap;
- dependency outage below the cap;
- active assessment at the cap;
- safety hold at the cap; and
- deterministic repeated-call/replay behavior at the cap.

The cap assertions verify withheld status, source `none`, an explicit loop-cap
reason, zero steps, zero reviewed-content refs, a required Study decision, no
authority mutation, no automatic escalation field, and zero calls to both
reteach dependencies. The below-cap outage assertion separately verifies the
reviewed-static fallback remains available.

## Validation results

All commands used Node `v22.23.2`.

| Check | Result |
| --- | --- |
| Strict Tutor V2 TypeScript | PASS |
| Focused reteach suite | 8/8 PASS |
| Complete Wave 2 lane bundle | 192/192 PASS |
| Wave 2 schema inventory check | PASS (2 schemas) |
| Wave 2 release artifact check | PASS (9 artifacts) |
| Tutor Core | 21/21 PASS |
| Tutor Core build | PASS |
| Tutor Core static prototype smoke | PASS |
| `git diff --check` | PASS |
| Tutor V2 convergence bundle | 279/280; one expected reconvergence mismatch |

The sole convergence mismatch is the pre-existing assertion at
`adaptive-tutor/tests/tutor-v2-convergence/wave2-composition.test.ts:133`.
It expects loop-cap source `reviewed-static-fallback`; the repaired terminal
result correctly reports source `none`. That file is outside this repair's
ownership and was not modified. Reconvergence must update that assertion to
the accepted terminal contract and should additionally assert withheld status,
zero step count, and zero reviewed-content refs.

## Ownership and isolation

Tracked changes are confined to:

- `adaptive-tutor/study-engine/tutor-v2/reteach/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b9-reteach-cap/**`

No Wave 1 source, permanent Wave 2 gate/release artifact, production source,
Netlify, Supabase, curriculum release, deployment, or environment
configuration was modified or contacted. No merge or deployment was
performed.
