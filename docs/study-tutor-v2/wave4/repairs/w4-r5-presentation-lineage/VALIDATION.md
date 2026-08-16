# W4-R5 validation record

Date: 2026-08-16

## Source assembly

- R1 baseline: `ef672ba2e65e83e17f84057782d8005cc1a03016`
- R2 source: `25dbebebf44770d1fb4fa5a32cf832e8476bbbf0`
- R2 source stable patch ID: `82073e8be1e81a530c0cbb69f9f476c4486ab25e`
- Assembled R2 commit: `b0720b1d3243f6587a6538c7225849ce88d953ef`
- Assembled R2 stable patch ID: `82073e8be1e81a530c0cbb69f9f476c4486ab25e`
- Starting assembled HEAD: `b0720b1d3243f6587a6538c7225849ce88d953ef`

The worktree was clean before editing. R1 is the assembled R2 commit's parent,
and the branch contained exactly one patch-equivalent R2 application.

## Executed results

| Validation | Result |
| --- | --- |
| W4-R5 focused presentation-lineage attacks | PASS, 20/20 |
| R2 presentation + multimodal + seeded regression | PASS, 30/30 |
| Presentation and multimodal unit tests | PASS, 22/22 |
| R1 commercial-integrity focused regression | PASS, 27/27 |
| Wave 3 convergence excluding intentional schema parity | PASS, 28/28 |
| Wave 3 hard-gate runtime and adequacy | PASS, 18/18 |
| Active-assessment and approval structural regressions | PASS, 120/120 |
| Adaptive Tutor strict TypeScript | PASS |
| Adaptive Tutor test TypeScript | PASS |
| Tutor V2 strict TypeScript | PASS |
| Tutor V3 strict TypeScript | PASS |
| `git diff --check` | PASS |

The focused suite includes the required learner, household, session,
interaction, logical-operation, opportunity, commercial-scope, reviewed-image,
diagram, caption, fallback, provider-injection, and durable-evidence attacks.

## R2 regression ruling

The deterministic R2 seed `67682526` remains green. Hostile prototype/getter
defense, active-assessment caption defense, exact digest/provenance checks,
learner audio-input gating, media-kind/MIME consistency, fallback uniqueness,
reference minimization, and durable raw-data exclusion all remain intact.

## Schema check

The canonical schema check intentionally reports pending drift beginning with:

```text
Wave 3 schema drift detected: study-commercial-tutor-advisory.schema.json
```

That advisory drift belongs to the assembled R1 baseline. W4-R5 additionally
changes the durable multimodal evidence schema. Global schema and release
regeneration is deliberately deferred to convergence as required by session
ownership; this is documented repair debt, not an unexecuted behavioral gate.

## Isolation

No `src/**`, `netlify/**`, `supabase/**`, production configuration, provider
policy, commercial routing/execution semantics, Study effect/memory
integration, Parent reporting, or release artifact was changed.
