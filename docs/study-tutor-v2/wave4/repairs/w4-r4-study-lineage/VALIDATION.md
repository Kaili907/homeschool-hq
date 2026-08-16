# W4-R4 validation record

Date: 2026-08-16

## Identity and ownership

- Session: `STUDY-TUTOR-V2-W4-R4`
- Starting R1 SHA: `ef672ba2e65e83e17f84057782d8005cc1a03016`
- Branch: `mac/tutor-v2-w4-study-lineage-repair-r1`
- Production `src/**`, Netlify, Supabase, presentation, multimodal, provider
  routing, release, deployment, and external Study authority artifacts are
  unchanged.

## Validation results

| Validation | Result |
| --- | --- |
| Disposable starting-SHA reproduction | RED reproduced, 6/6 substitutions accepted |
| Focused W4-R4 Study lineage suite | PASS, 9/9 |
| W4-R1 commercial-integrity regression | PASS, 27/27 |
| Wave 3 memory/recovery focused regression | PASS, 28/28 |
| All compiled V3 core tests | PASS, 203/203 |
| Wave 3 commercial convergence | PASS, 33/33 |
| Wave 3 hard gates | PASS, 18/18 |
| Study Tutor bridge | PASS, 209/209 |
| Tutor V3 strict TypeScript | PASS |
| Tutor V2 strict TypeScript | PASS |
| Adaptive Tutor strict TypeScript | PASS |
| Repository-root TypeScript | INCONCLUSIVE: no local dependency tree or generated curriculum raw assets; cross-worktree dependency fallback produced environment/module diagnostics outside this repair |
| `git diff --check` | PASS |

The worktree has no local `node_modules`; validation used the existing
TypeScript CLI and Node type declarations from another repository worktree,
as prior Wave 3/W4 validation records permit. Generated test output remains in
ignored `.dist`/`.test-dist` directories.

## Schema convergence requirement

The runtime schema parity suite passes when the generator creates disposable
current schemas. Per session scope, generator output was restored immediately
after the test and is not included in this repair. Wave 4 convergence must
regenerate and review schemas, schema inventory hashes, and release evidence
for `StudyCommercialEffectReceipt` v2, `InstructionalMemoryDelta`, and
`MinimizedAcceptedStudyEffectEvent`.

## Final checks pending at documentation time

Repository-root typecheck, final focused rerun, `git diff --check`, clean
post-commit status, and remote SHA are recorded in the session return rather
than hard-coding a pre-commit result here.
