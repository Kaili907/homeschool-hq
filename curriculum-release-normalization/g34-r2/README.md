# Manuel Academy - Grades 3/4 Normalized Release

`manuel-academy-grades-3-4-r2-normalized` - **status `G34_NORMALIZED_RELEASE_READY`**

The Grades 3/4 candidate at `curriculum-release-candidates/g34-r1`, normalized into a shape a
promotion session can consume. No lesson was rewritten.

| | |
| --- | --- |
| Grades | 3, 4 |
| Courses | 20 |
| Units | 154 |
| Lessons | 1800 |
| Unit assessments | 154 |
| Scheduled sessions | 1800 (every lesson exactly once, every course weeks 1-36) |
| Release-contract conformance | **PASS** - against this release's schema; 216 lessons still fail the lane's unmodified subject enum, reported as its own check |
| Normalization integrity | **PASS** |
| Preservation | **PASS** |

## The five blockers, and how each is resolved

| Blocker at the candidate | Resolution | Lessons edited |
| --- | --- | ---: |
| `standards` plain strings vs the release schema's mapping objects | projection into `{code_or_strand, source, mapping_status}` with the citation string kept verbatim; `mapping_status` derived by published, evidence-cited rules | 0 rewritten, 1800 projected |
| ELA `schema_version` `1.1` vs the contract's `const: "1.0"` | release-wide pin with the authored value preserved in `authored_schema_version` | 0 |
| canonical vs matrix subject slugs | release schema canonicalized + bidirectional alias map + both slugs in the normalized matrix | 0 |
| 8 of 20 courses ship no standalone standards artifact | one standalone artifact per course; the 8 are projected from their own lesson citations and labelled as such | 0 |
| stale release course matrix and cadence metadata | `release/course-matrix.normalized.json` with real counts, real per-course cadence, authored course ids, release paths | 0 |

Details: [`provenance/normalization-ledger.json`](provenance/normalization-ledger.json),
[`schemas/schema-delta.md`](schemas/schema-delta.md),
[`standards/standards-custody-addendum.md`](standards/standards-custody-addendum.md).

## What is proven

- **1800 of 1800** lessons: applying the documented inverse
  reproduces the candidate's own JSONL line **byte for byte**.
- **1800 of 1800** lessons: SHA256 over every field outside
  the 3 normalized ones is identical to the candidate's.
- **175 of 175** non-lesson files are
  byte-identical to the candidate's.
- `lesson-index.csv` is byte-identical to the candidate's, fixing every id in one hash.
- All counts, ids, schedules and assessments preserved.

Full argument: [`provenance/content-equivalence-report.md`](provenance/content-equivalence-report.md).

## Layout

```
g34-r2/
  MANIFEST.json                       release identity, counts, the five normalizations, boundaries
  course-index.json                   20 courses, canonical + matrix slugs, cadence, standards artifact
  unit-index.json                     154 units
  lesson-index.csv                    1800 lessons - byte-identical to the candidate's
  SHA256SUMS.txt
  grades/grade-{3,4}/courses/<subject>/
                                      lessons.jsonl (normalized) plus every other lane file verbatim
  schedules/<course_id>.csv           verbatim
  adapters/                           subject-slug-map, schema-version-policy, standards-mapping-policy
  schemas/lesson.release.v1.json      the release schema + schema-delta.md
  release/course-matrix.normalized.json
  standards/courses/<course_id>.standards.json    20 standalone artifacts
  standards/standards-index.json, standards-rollup.json, standards-custody-addendum.md
  standards/sources/**                every lane standards artifact, verbatim
  provenance/                         inputs, normalization ledger, content-equivalence proofs
  validation/                         this release's report
  upstream/g34-r1/**                  every remaining candidate file, verbatim, at the candidate's
                                      own paths - including its SHA256SUMS.txt, its custody report,
                                      its validation report, its schema candidate, its assembler
                                      and the pinned source-branch ledger
  tools/normalize.py                  regenerates everything above from the candidate
```

## Reproducing

```bash
python3 curriculum-release-normalization/g34-r2/tools/normalize.py
```

It verifies `g34-r1` against its own `SHA256SUMS.txt` before reading a byte, refuses to run if the
candidate does not match, and writes only under `curriculum-release-normalization/g34-r2/`. Same
input produces a byte-identical tree.

## Read before promoting

- **Standards mapping status: 1210 canonical, 2850
  unverified, 697 human-review** of 4757 citations. The contract
  requires this rollup to be reported so convergence can judge the ratio. The ratio is not yet
  acceptable - 3547 citations need a human.
  No citation is marked `canonical` without a lane catalog recording that the codes were read from
  the published document; the derivation rule and its caveats are in
  [`adapters/standards-mapping-policy.json`](adapters/standards-mapping-policy.json).
- **`canonical` ELA codes are printed in transposed order.** MDE prints
  `<strand>.<grade>.<number>` (`RL.3.1`); this corpus prints `<grade>.<strand>.<number>` (`3.RL.1`),
  the house order the sealed 1.0.0 package already uses for Grade 5. Same standards, different
  strings - **transpose before joining against an MDE or Common Core namespace.** The ELA codes were
  read from a district-hosted mirror because michigan.gov blocks automated retrieval of its own
  copy. Both facts are carried on rule R1 and in the `code_format` block of every standards
  artifact. `canonical` never means an educator reviewed anything.
- **Health and Physical Education (4 courses, 288 lessons) remain
  `PENDING_FINAL_HEALTH_REVIEW`** - an explicit external gate. They ship complete, not hidden.
- **The release lane's own artifacts are still stale.** `release/course-matrix.json` and
  `release/lesson-schema.json` are carried verbatim under `standards/sources/release/` and are
  superseded here, not edited - they belong to `mac/g34-release-standards-r1`. The validation report
  runs both schemas so the residual gap stays visible.
- **Grades 3 and 4 still do not exist in the runtime**: not in `AcademyGrade`, not in
  `PILOT_GRADES`, not in `scripts/build-curriculum.mjs`. Promotion needs a new release version.
  1.0.0 stays frozen and is untouched here.
