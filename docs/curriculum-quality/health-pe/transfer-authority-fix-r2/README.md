# High-School PE Transfer Authority Permanent Gate R2

**Status:** validated on `mac/pe-transfer-authority-fix-r2`.

## Result

| Reviewed outcome | Historical | R2 final |
| --- | ---: | ---: |
| Scoring-authority conflicts | 60 | 0 |
| Content-transfer conflicts | 36 | 0 |
| Reviewed false positives | 120 | 120 preserved |
| Unexplained cases | — | 0 |

All 216 reviewed second-pass lessons have matching canonical, learner, and adult
`manuel-academy.pe-transfer-authority.v2` records. R2 adds structured authority
metadata only. Removing that metadata and comparing every reviewed canonical
source lesson, learner package, and adult guide byte-for-byte with R1 proves:

`CURRICULUM_SEMANTICS_CHANGED = NO`

No R1 learner/adult wording was rewritten and no further curriculum repair was
needed.

## R1 acceptance failure

R1's `transferConsistency` implementation used a finite table of demand and
authority regexes, followed by verbatim substring checks for repaired evidence.
An unlisted paraphrase therefore failed open even when it expressed the same
contradiction. Lesson position was correctly removed, but prose recognition was
still acting as the semantic authority.

R1 also committed a stale checksum entry for
`tooling/transfer-consistency.test.mjs`: the manifest recorded
`d797832be24c...`, while the committed R1 file hashed to `588ac476d730...`.
The failure mode was regeneration order: the generator is the canonical
checksum writer, so changing an inventoried test after the final generator run
left the committed manifest stale.

## Structured semantic model

Canonical HS PE authoring now generates one normalized record per second-pass
lesson. The record represents:

- learner action and focus identity;
- required duration/span and continuity;
- stop, rest, and interruption credit authority;
- transfer requirement identity;
- completion mode and required evidence;
- equal-credit routes and their evidence requirement;
- adult RUBRIC criteria, including no body or participant-count scoring;
- adaptive-route, guardian, and safe-reduction expectations.

The source validator requires exactly 216 valid records and retains the 96 R1
authored-unit-evidence markers. The final generator projects the same record into
the paired learner task card and adult guide. The permanent gate normalizes and
compares those fields, fails closed for missing structure, and uses zero phrase
patterns. Grade, unit, lesson number, prose labels, and prose wording are not
semantic inputs.

The JSON contract is committed as
`curriculum-production/final/health-physical-education/schema/transfer-authority.schema.json`.

## Paraphrase resistance and controls

Permanent tests vary visible wording while holding the structured semantics
constant. Three uninterrupted-performance/rest-credit variants fail, and three
seven-day-execution/one-day-hypothetical variants fail. The suite also pins:

- true scoring mismatch → fail;
- true transfer mismatch → fail;
- valid equal-credit lesson → pass;
- valid transfer lesson → pass;
- reviewed false-positive pattern → pass;
- missing structured authority → fail closed;
- lesson location mutation → unchanged.

## Checksum correction

`src/generate.mjs` remains the canonical deterministic checksum workflow; no
digest was hand-edited. It was run twice after all corpus, schema, README, and
test changes. Both runs produced the same final tree and manifest digest:

```text
checksum_manifest 1dfc6282f04c3b6132238278ea59fc2cae9a93b6ad981adbcb495c840b7eaf22
entries           2883
checksum_gate      PASS
double_regeneration STABLE
```

The current semantic-test entry and file both hash to
`34c465dc7b5d5dc3f463157fefbea3bfb1e1c651f5d9db76f75024c6e3ccbb65`.

## Boundaries

Study remains completion-based. All 216 reviewed admitted bindings remain
`LEARNER_AUTHORITY`; no scoring engine, Study runtime, or Tutor V2 source was
changed. Stop/rest authority, accessible and equal-credit routes, guardian
boundaries, privacy, and no-body-scoring remain intact for all 216 reviewed
cases.

See `summary.json` for exact counts, `findings.jsonl` for per-case results,
`run-r2-validation.mjs` for the deterministic reconciliation, and
`VALIDATION.md` for commands and recorded results.

`PE_TRANSFER_AUTHORITY_R2_VALIDATED`
