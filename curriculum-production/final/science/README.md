# Science — final production corpus

Status: **FINAL_SCIENCE_PRODUCTION_READY**.

This is the canonical 972-lesson Science production corpus: 108 lessons each for Grade 3,
Grade 4, Grade 5, Grade 7, Grade 8, High School Biology, High School Chemistry, High School
Physics, and High School Earth/Space/Environmental Science.

Each lesson has:

| Path | Audience | Contents |
| --- | --- | --- |
| `packages/<course>/student-sheets/<lesson>.md` | learner | Complete science brief, bound case/evidence, exact task, student-visible safety, blank records, delivered equal-credit route, analysis, rubric, remediation, extension |
| `packages/<course>/scoring/<lesson>.md` | adult | Scientific correctness key, reasoning criteria, non-negotiables, remediation, and guardian safety record |
| `packages/<course>/work-packages.jsonl` | application | Canonical machine record behind both rendered sheets |

## Pinned curriculum sources

| Coverage | Source | Exact commit |
| --- | --- | --- |
| Grade 3/4 | `mac/g34-science-social-r1` | `4c6ca4ef904c0b79dc81f85e3cfed946c20c98d6` |
| Grade 5/7/8 | canonical release 1.0.0 | `4056e31d8beb36622be5ac27ea7f20145266343b` |
| High School | `mac/hs912-science-h4` | `a86780a315b5a6ba4f134f35b7033f35707b0e52` |

High School production reads H4 only. H3, H2, and the failed base candidate are recorded as
superseded evidence but supply no High School lesson, safety, policy, or resource blob in the
final corpus. `MANIFEST.json` records every source blob actually read and its SHA-256.
`SOURCE_LEDGER.json` records the exact reconciliation inputs and correctness repin basis.

## Correctness authority

The accepted authority from `mac/science-correctness-r2` is preserved: 486 topic keys cover all
972 lessons. Every adult sheet states accepted relationships, fixed facts where applicable,
acceptable alternative framings, disqualifying scientific errors, and the course-level boundary.
Learner sheets do not expose the key.

The 432 High School lessons were repinned from H3 to H4 only after independently comparing every
field the keys are keyed on or authored against:

- `unit_ref`
- `focus`
- `phase`
- `title`
- `essential_question`
- `learning_objectives`
- `success_criteria`

All seven fields are byte-identical on all 432 lessons. H4 changed only `materials` in 38 records,
`lesson_flow` in 4, `extensions` in 4, and `safety_privacy` in 2. The safety gate re-derives the
H3-to-H4 comparison from both pinned commits rather than trusting this statement.

## H4 reconciliation

The three prior final-production blockers are closed at the source and on both rendered surfaces:

- B1: apron, tray, and dropper are declared and rendered for Earth/Space/Environmental Unit 5
  lessons 7 and 9.
- B2: Chemistry Unit 6 lessons 7 and 9 state no expected temperature direction or size; the
  equal-credit route records measurements and uses published data for the excluded processes.
- B3: the calcium-chloride route names the disposable double cup, and the other trials name the
  insulated drinking cup, in the safe order and adult record.

`h4-b1-b2-b3-closed-on-rendered-sheets` verifies the exact package, learner-sheet, and adult-sheet
closures. `reports/blockers.md` records the evidence.

## Non-negotiable production rules

- Every lesson is package-alone executable: the learner receives the actual science brief, case,
  evidence or model input, and exact steps the work requires.
- Every lesson carries student-visible safety and an equal-credit safe alternative.
- Materials, hazards, mitigations, required PPE, safe order, stop conditions, and disposal agree.
- Recording fields ship blank; supplied reference/model inputs are labelled and never presented as
  learner observations or as an expected physical-investigation result.
- Every numerical alternative is a deterministic instructional model with its equation or rule,
  provenance, limitations prompt, and a system distinct from the physical route.
- Investigation correctness constrains methods and conclusions, never a learner's observations.
- Remediation and extension are present on every lesson.

## Build and verification

```bash
python3 curriculum-production/final/science/tools/build_student_work.py
node curriculum-production/final/science/validation/validate-learner-content.mjs
node curriculum-production/final/science/validation/validate-safety.mjs
node curriculum-production/final/science/validation/run-production-quality-gate.mjs
node curriculum-production/final/science/validation/mutation-test.mjs
node curriculum-production/final/science/validation/verify-checksums.mjs
```

The build is deterministic: no clock, no randomness, and sorted iteration. Rebuilding from the
pinned sources reproduces the package tree and checksum ledger byte for byte. The source H4 package
is separately rebuilt and validated with its own contract, 63 mission checks, and 44 mutation tests.

## Canonical evidence

- `MANIFEST.json` — course coverage, exact source lineage, input SHAs, and source-blob hashes
- `SOURCE_LEDGER.json` — reconciliation inputs and H3-to-H4 correctness repin proof
- `SHA256SUMS.txt` — checksum ledger for the committed corpus
- `reports/coverage.md` — 972-lesson course breakdown
- `reports/learner-content-gate.md` — zero-shell/input/material/alternative proof and 36/36 High School investigation matrix
- `reports/safety-gate.md` — rendered safety, correctness, fabrication, and reconciliation checks
- `reports/production-quality-gate.md` — Production Gate H3 readiness over all 972 lessons
- `reports/blockers.md` — B1/B2/B3 closure record
