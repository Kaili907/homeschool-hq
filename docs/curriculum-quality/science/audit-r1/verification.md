# Verification evidence

Run from the requested worktree on base
`56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`.

| Check | Result |
| --- | --- |
| Audit extractor and admitted/package set equality | PASS — 972 active lessons; 81 linked assessments |
| Science executable learner-content gate | PASS — 972/972 lessons; 0 placeholders, missing data, missing materials, or nonfunctional alternatives; 36/36 High School investigations executable |
| Science safety gate | PASS — 37/37 checks over 972 lessons |
| Existing production-quality gate | PASS — 972 ready, 0 needs-human-review, 0 not-ready |
| Science checksum ledger | PASS — 1,981 files match `SHA256SUMS.txt` |
| Admitted Family Pilot release validation | PASS |
| Audit CSV/JSON parse and expected row counts | PASS — lesson 972, assessment 81, course 9, generator family 4 |
| Changes outside `docs/curriculum-quality/science/audit-r1/` | NONE |

The existing production-quality result is recorded as integrity evidence, not
adopted as the learner-depth conclusion. Its contract checks production
structure and readiness fields; this audit separately checks the instructional
substance described in `README.md`.
