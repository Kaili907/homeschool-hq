# Integration Contract — Grade 8 Mathematics 8.EE.2 Correction

**Correction ID:** `g8-math-8ee2-2026-08-12`
**State:** authored, validated, **not integrated**
**Targets:** `curriculum-content/manuel-academy/1.0.0` — course `ma-g8-mathematics`

This overlay is deliberately staged rather than merged. Release `1.0.0` is sealed by
`SHA256SUMS.txt` (181 files) and `MANIFEST.json`; nothing in it has been touched.

## 1. What this correction adds

| Artifact | ID | Standard |
| --- | --- | --- |
| Lesson | `ma-g8-mathematics-u01-l19` | `8.EE.2` — root symbols as exact solutions to `x² = p`, `x³ = p` |
| Lesson | `ma-g8-mathematics-u01-l20` | `8.EE.2` — evaluating small perfect squares and perfect cubes |
| Lesson | `ma-g8-mathematics-u01-l21` | `8.EE.2` — `√2` is irrational; consolidation and transfer |
| Assessment | `ma-g8-mathematics-c01-assessment` | `8.EE.2` — 30 points, 6 prompts |

Together the three lessons cover all three requirements of `8.EE.2`. Nothing else is added.

## 2. ID stability guarantee

- **Zero** existing lesson, unit, or assessment IDs change.
- Unit 1 in `1.0.0` ends at `l18`; the new lessons continue the same unit at `l19`–`l21`.
- All four new IDs are collision-free against all 936 Grade 8 IDs in the sealed release.
- The three lesson IDs satisfy the sealed pattern
  `^ma-g(5|7|8)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$` in `1.0.0/schemas/lesson.schema.json`, and the
  lesson records validate against that schema unchanged.
- The assessment uses a `c01` (correction) segment rather than a `u..` segment so it cannot
  be mistaken for, or collide with, the sealed unit assessments.

## 3. The one decision integration must make

The overlay lessons carry `course_day` **19, 20, 21** — the intended insertion position,
immediately after `ma-g8-mathematics-u01-l18`. Those day numbers are **currently occupied**
by `ma-g8-mathematics-u02-l01..l03` in the sealed release.

This is stated explicitly rather than silently resolved. A naive merge would double-book
three days and would break the sealed release's `schedule-covers-every-lesson-once` check.
Choose one:

### Option A — Substitution in place (recommended)

Deliver the three correction lessons in place of three generic-recycle Unit 1 days:
`u01-l08` (reteach and varied practice), `u01-l13` (skill consolidation), and `u01-l14`
(transfer challenge). Each of those recycles a topic already taught earlier in the unit, so
the instructional loss is small and the gain is a standard that is otherwise absent.

- Preserves the 180-day model and the 936-lesson count.
- Changes no IDs and edits no sealed file — this is a delivery-sequencing decision recorded
  in the schedule layer, not a content edit.
- Requires renumbering nothing.

### Option B — Extension

Schedule the three lessons as additional instructional days, shifting sealed `course_day`
19–180 to 22–183.

- Displaces no sealed lesson.
- Breaks the 180-day / 36-week model and the sealed `lesson-count` and
  `schedule-covers-every-lesson-once` expectations, so it requires a new release version
  rather than an overlay.

**Recommendation: Option A.** It closes the standards gap inside the existing calendar and
keeps the correction genuinely additive at the content layer. **The decision belongs to the
director and is not made here.**

## 4. Integration steps when authorized

1. Choose Option A or Option B and record the choice.
2. Re-run `validate.py` in this directory; require `PASS`.
3. Re-verify the sealed release is untouched:
   `shasum -a 256 -c SHA256SUMS.txt` inside `curriculum-content/manuel-academy/1.0.0/`
   must report 181 of 181 `OK`.
4. Produce the merged course as a **new release version** (for example `1.0.1`) rather than
   editing `1.0.0` in place. Reseal only the new version.
5. Add a standards-domain completeness check to the validation suite so this class of gap
   cannot recur (see `standards-custody.md` §5).
6. Update the Grade 9 bridge note in
   `curriculum-authoring/full-family-highschool-9-12/subjects/mathematics/sequence-derivation.md`
   §3 and §7: once `8.EE.2` is delivered in Grade 8, Grade 9 Unit 2 no longer needs to carry
   it as a gap repair, though it may still legitimately revisit it as review.

## 5. What this correction does not do

- Does not edit, delete, or reseal any file in `1.0.0`.
- Does not rewrite Grade 8 Mathematics.
- Does not add inequality content — Michigan Grade 8 has no inequality standard
  (see `standards-custody.md` §4).
- Does not change the Grade 9 course, the HS math package, or any host application.
- Does not claim state approval, accreditation, licensure, or automatic credit.
