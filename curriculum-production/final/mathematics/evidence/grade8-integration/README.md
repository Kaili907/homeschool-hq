# Grade 8 Mathematics — 8.EE.2 Correction, 180-Day Integration

**Integration ID:** `g8-math-8ee2-integration-2026-08-12`
**Integrates:** correction `g8-math-8ee2-2026-08-12` (commit `e9ead0c`) into release `1.0.0`
**State:** planned and validated — **not applied**. `1.0.0` is untouched.

## Answer to the question asked

**180 days, and it is defensible.** The 183-day fallback is not needed — and would in any case
be 184 days, because the accepted correction is three lessons *and* a 30-point assessment that
needs its own delivery day.

The three 8.EE.2 lessons are delivered where they belong topically — course days 19, 20, 21,
exactly the `course_day` values the overlay already carries — with the correction assessment on
day 22. Those four days are funded by withdrawing four **recycle-phase days from Unit 10**, the
only unit in the course that introduces no standard of its own: every content standard it
carries is instructed for a full 18 days and assessed in an earlier dedicated unit.

Result: 28/28 official Michigan Grade 8 content standards covered, all ten unit assessments
retained, every standard keeping all 18 days of the unit that owns it, no ID changed, and no
sealed file edited.

## Contents

| File | Purpose |
| --- | --- |
| `INTEGRATION-PLAN.md` | The decision, the risk rubric applied to all 180 days, why the overlay's Option A is amended, and why 180 rather than 184 |
| `schedule.csv` | The exact resulting 180-day course schedule |
| `lesson-mapping.csv` | Sealed course_day → integrated course_day for all 180 sealed lessons, plus the 4 new ones |
| `daily-schedule-grade8.csv` | The Grade 8 family schedule with period_1 re-sequenced; every other column byte-identical |
| `displaced-lessons.md` | Treatment of the four withdrawn days — retained, compressed, tutor-routable |
| `standards-before-after.md` | Per-standard before/after proof, the 28/28 mathematics expectation, and the validation-suite changes 1.0.1 requires |
| `grade9-handoff-note.md` | Exact replacement text for the two stale sections of the Grade 9 derivation document |
| `lessons.integration.jsonl` | The one record this integration authors: `u01-l22`, the delivery day for the accepted assessment |
| `integration-manifest.json` | Machine-readable descriptor |
| `student-work/` | Production work and answer authority for the new days — 4 packages, 4 answer keys |
| `build.py` | Regenerates the schedule artefacts from sealed data + overlay |
| `build_student_work.py` | Authors the student-work corpus; carries the answer oracle |
| `validate.py` | 43-check runnable validator |

## Verification

```bash
python3 validate.py
```

Expect `43/43 checks passed` / `OVERALL: PASS`. Among other things it proves the sealed release
is untouched (181/181 checksums, clean git), that the accepted overlay is untouched and still
passes its own 14 checks, that the schedule is 180 contiguous days with no duplicate IDs, that
no standard loses the coverage of its owning unit, that 28/28 are covered after integration
(with `before-27-of-28` as the negative control), and that every keyed answer in the new
student-work corpus is reproduced by an independent oracle from the item's own parameters.

Both build scripts are deterministic and idempotent:

```bash
python3 build.py && python3 build_student_work.py
```

## Production work and answer authority

Four days of student-facing material and separately-stored answer keys, in the shipped
`curriculum-production/student-work/mathematics` schema — 53 items, 47 keyed answers, no answer
in any learner-facing file.

Every fixed answer is established twice on independent code paths: the item is constructed from
a chosen root, and `oracle()` recovers the answer from the item's recorded parameters alone by
integer search and exact rational arithmetic. Generation raises if they disagree.

The strength of that gate is stated rather than overclaimed. For the 26 numeric multiple-choice
items the oracle's output must **equal** the keyed option and must select exactly one option, so
the gate pins the answer *index*: neither a wrong value nor a mis-keyed index can reach the
corpus. For the 12 prose classification items the option carries a classification plus a reason;
the oracle verifies the classification and the invariant the answer asserts, and `validate.py`
covers the remaining gap by requiring every distractor that states the same classification to
carry a stated invalid reason. Every key records `verification.method: "recomputed"` with the
oracle path and the parameters, so a reviewer can re-derive any answer without running the code,
and each answer's `solutionReasoning` is a derivation in that item's own numbers.

## Status boundary

This is a plan, validated but not applied. It does not edit, delete, or reseal any file in
`1.0.0`; it does not rewrite Grade 8 Mathematics; it does not modify the Grade 9 course or any
host application; and it is not a claim of state approval, accreditation, licensure, or
automatic credit. Application requires director authorization and should produce a new release
version (`1.0.1`) — see `INTEGRATION-PLAN.md` §8.
