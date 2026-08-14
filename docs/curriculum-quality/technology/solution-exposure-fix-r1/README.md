# Technology solution-exposure fix R1

Status: **REPAIRED — semantic gate required**

Authoritative review: `15633ad5677dd5a966adf0fc83b22dca93e6bf1e`

Web R3 base: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

## Result

The canonical Technology activity generator is phase-aware. The 19 `MODEL` fixtures remain labelled, non-penalty instructional worked examples. The other 68 reviewed code/debug fixtures no longer carry `passing_change` or an equivalent exact-repair signature in learner material. Their exact repairs and validation tests live in `trusted_solution_reference` inside the adult scoring guide, with review restricted until protected evidence exists.

| Boundary | Before | After |
| --- | ---: | ---: |
| Legitimate worked examples | 19 | 19 preserved |
| Non-summative pre-attempt solution exposures | 56 | 0 |
| Summative pre-evidence solution exposures | 12 | 0 |
| Total violations | 68 | 0 |
| Formal adult-key leaks | 0 | 0 |

No Tutor V2 behavior is introduced. Static learner packages carry symptom-level guidance, conceptual questions, or partial debugging scaffolds appropriate to their existing work mode.

## Evidence

- `case-mapping.json` and `case-mapping.csv` map all 87 authoritative review rows to their regenerated learner package, adult guide, after-state classification, custody result, and SHA-256 hashes.
- `semantic-gate-report.json` records the aggregate before/after result across all 336 Technology lessons.
- `curriculum-production/student-work/technology-arts-lessons/tests/solution-exposure-audit.mjs` enforces the inventory, exact `passing_change` custody, six semantic exact-repair signatures, learner projection safety, adult authority completeness, and worked-example preservation.

Generate or refresh deterministic evidence:

```sh
node curriculum-production/student-work/technology-arts-lessons/tests/solution-exposure-audit.mjs --write
```

Verify checked-in evidence without rewriting it:

```sh
node curriculum-production/student-work/technology-arts-lessons/tests/solution-exposure-audit.mjs
```

Detailed solutions for independent and summative fixtures remain adult-only. A learner-facing post-submission review surface is future work and must not reveal them until the existing curriculum runtime can prove protected evidence was durably collected.
