# High-School PE Transfer Authority Correction R1

**Status:** complete and validated on `mac/pe-transfer-authority-fix-r1`.

## Result

| Reviewed outcome | Before | After |
| --- | ---: | ---: |
| Scoring-authority conflicts | 60 | 0 |
| Content-transfer conflicts | 36 | 0 |
| Total real conflicts | 96 | 0 |
| Reviewed false positives | 120 | 120 preserved |

The repair changes the 16 independently adjudicated unit-level second-pass
families at the canonical HS PE source boundary. Each repaired family now
defines both the transfer condition and the evidence that an equal-credit
performed, adapted, solo, simulated, diagrammed, or described route must
preserve. `build-courses.mjs` carries that same authored evidence requirement
into the learner activity, source success criterion, alternate route, and adult
scoring guidance before any final artifact is emitted.

No emitted lesson package or scoring guide was hand-edited. The canonical
builder regenerated 432 HS PE lessons and the final Health/PE generator rebuilt
learner packages, paired adult guides, corpus manifest, and checksums. The
structured learner projection was then rebuilt from the admitted bindings.

## Semantic guard

`curriculum-production/final/health-physical-education/src/lib/transferConsistency.mjs`
compares actual learner task text, the authored transfer requirement, completion
and equal-credit evidence expectations, and paired adult RUBRIC authority. It
does not inspect grade, unit, lesson number, or the former `l07`–`l12`
positional heuristic.

The negative controls prove that a genuine scoring conflict and a genuine
content-transfer mismatch fail, while the independently reviewed false-positive
pattern, a valid equal-credit lesson, and a valid transfer lesson pass. A
semantic conflict now produces `TRANSFER_AUTHORITY_CONFLICT` and prevents the
final H3 status from becoming `READY`.

## Boundaries preserved

- Study remains learner-authority and completion-based; no progression or
  scoring engine was changed.
- Tutor V2 was not modified.
- Movement safety, stop/rest authority, accessible alternatives, guardian
  boundaries, privacy rules, and no-body-scoring policy were retained.
- The 120 false-positive cases retain the same learner task, completion,
  equal-credit, adult rubric, adaptive-route, and safety semantics.

## Evidence files

- `findings.jsonl`: all 216 reviewed cases mapped from original classification
  to final outcome, with before/after gate results and artifact hashes.
- `summary.json`: exact counts, repair boundary, semantic-gate contract, Study
  boundary, and safety result.
- `run-fix-validation.mjs`: deterministic validator that reproduces the
  `60/36/120` baseline from content, validates `0/0` after repair, and checks
  false-positive and safety preservation.
- `VALIDATION.md`: commands and recorded results.

`PE_TRANSFER_AUTHORITY_FIX_VALIDATED`
