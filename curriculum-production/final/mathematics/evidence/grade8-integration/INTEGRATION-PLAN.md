# Grade 8 Mathematics — 8.EE.2 Correction, 180-Day Integration Plan

**Integration ID:** `g8-math-8ee2-integration-2026-08-12`
**Integrates:** correction `g8-math-8ee2-2026-08-12`, accepted at commit `e9ead0c`
**Targets:** sealed release `1.0.0`, course `ma-g8-mathematics`
**Result:** **180 days. The preferred target is met and is defensible.**
**State:** planned — not applied. `1.0.0` is not edited.

---

## 1. The decision in one paragraph

The three 8.EE.2 lessons are delivered **where they belong topically** — immediately after
`ma-g8-mathematics-u01-l18`, on course days 19, 20, 21, exactly the `course_day` values the
accepted overlay already carries. A fourth day, 22, administers the accepted 30-point
correction assessment. The four days are **funded** by withdrawing four recycle-phase days
from **Unit 10**, the synthesis unit whose every content standard is instructed for a full
18 days and assessed by its own unit assessment in an earlier dedicated unit. The course
stays at **180 days**, every unit keeps its unit assessment, and **no standard loses the
coverage of the unit that owns it**.

This is not the overlay's Option A as written. It is amended, for a reason given in §4.

---

## 2. Risk rubric applied to all 180 existing days

The Grade 8 Mathematics course is ten units of eighteen days, and every unit runs the same
eighteen-phase cycle. That regularity makes an exhaustive risk classification possible: each
day's substitution risk is a function of its phase and of whether its unit *owns* its
standards.

**Phase tier.** Within a unit, eleven of the eighteen phases carry something that occurs
exactly once:

| Tier | Phases | Why it cannot be substituted |
| --- | --- | --- |
| **0 — protected** | Launch and diagnostic · Concept model A/B/C · Guided practice A/B · Independent application A · Investigation or close reading · Performance task planning · Performance task build · Unit assessment | first and only instruction of a topic, the only build of the unit product, or the unit's only independent mastery evidence |
| **1 — recycle** | Reteach and varied practice · Discussion or problem seminar · Skill consolidation · Transfer challenge · Assessment preparation · Targeted correction · Publication, presentation, or reflection | re-works a topic already instructed earlier in the same unit |

That gives 7 Tier-1 days per unit, 70 across the course. This is the pool the user's brief
names: review, spiral practice, duplicate evidence, reassessment, redundant transfer.

**Ownership tier.** A day is cheaper still when its unit does not own its standards:

| Unit | Standards | Owned here? |
| --- | --- | --- |
| 1 | 8.NS.1, 8.NS.2 | **yes — sole coverage in the course** |
| 2 | 8.EE.1, 8.EE.3, 8.EE.4 | **yes — sole coverage** |
| 3 | 8.EE.7 | yes (Unit 10 also revisits) |
| 4 | 8.EE.5, 8.EE.6 | **yes — sole coverage** |
| 5 | 8.F.1–8.F.5 | yes (Unit 10 revisits 8.F.4) |
| 6 | 8.EE.8 | yes (Unit 10 also revisits) |
| 7 | 8.G.1–8.G.5 | **yes — sole coverage** |
| 8 | 8.G.6, 8.G.7, 8.G.8 | yes (Unit 10 revisits 8.G.7) |
| 9 | 8.G.9, 8.SP.1–8.SP.4 | yes (Unit 10 revisits 8.SP.3) |
| **10** | **8.EE.7, 8.EE.8, 8.F.4, 8.G.7, 8.SP.3, MP.4** | **no — every content standard is instructed for 18 days and assessed in Units 3, 6, 5, 8, 9** |

**Unit 10 is the only unit in the course that introduces no standard of its own.** Its seven
Tier-1 days are therefore the lowest-risk days in all 180: they are recycle days inside a
unit that is itself a revisit.

**Focus balance.** Unit 10's six focus families each occupy three days (one Tier-0
instruction plus two revisits, or two Tier-0 plus one). Withdrawing more than one day from a
family would leave a family with a single touch, so the selection takes **at most one day per
family**. That constraint, plus Tier-1, leaves exactly one admissible four-day set once
`u10-l15` (the review immediately preceding the capstone assessment) and `u10-l18` (the
publication of the capstone product) are preferred for retention:

| Withdrawn | Phase | Focus family | Retained touches of that focus |
| --- | --- | --- | --- |
| `u10-l10` | Discussion or problem seminar | geometry and measurement | `l04`, `l16` — 2 |
| `u10-l13` | Skill consolidation | defining variables and assumptions | `l01`, `l07` — 2 |
| `u10-l14` | Transfer challenge | selecting linear or nonlinear models | `l02`, `l08` — 2 |
| `u10-l17` | Targeted correction | data trends and uncertainty | `l05`, `l11` — 2 |

Two four-day sets satisfy every constraint above: this one, and
`{l08, l10, l13, l17}`, which differs only in taking the reteach day instead of the transfer
challenge. **This set is chosen for one reason: it preserves the unit's re-teaching capacity.**
Taking `l08` *and* `l17` would strip Unit 10 of both its reteach day and its targeted-correction
day, leaving the final unit of the year with no remediation capacity at all — for exactly the
learners most likely to need it. Taking `l14` instead gives up enrichment whose transfer
function is already carried by the performance-task build (`l12`) and the capstone assessment
(`l16`). The per-standard arithmetic is identical either way.

`u10-l17` is the course's last targeted-correction day: it follows the final assessment of the
year and precedes only the publication day, so its remediation has no instructional runway
left, and its revision function folds naturally into the publication day. `u10-l15`, by
contrast, prepares learners for a capstone assessment that is retained, and is kept for that
reason — it also becomes the absorber for both `l13` and `l14`, which is what an assessment
preparation day is already composed of: consolidation plus rehearsal in unfamiliar contexts.

---

## 3. Why the correction block sits at days 19–22 and not later

The withdrawn days are late in the year; the inserted days are early. That separation is
deliberate.

- **8.EE.2 is Unit 1 content.** Unit 1 is *Real Numbers and Irrational Numbers*. The
  standard's third requirement — "know that √2 is irrational" — is the same classification
  work Unit 1 spends eighteen days on. `u01-l21` explicitly connects exact root notation back
  to that classification.
- **Michigan puts 8.EE.1 and 8.EE.2 in one cluster** — "Work with radicals and integer
  exponents". Delivering 8.EE.2 on days 19–21 places it immediately before Unit 2, which
  opens 8.EE.1 on day 23. The cluster is taught contiguously.
- **Unit 8 needs it.** The Pythagorean unit (days 131–148) solves `x² = p` for unknown side
  lengths. Teaching exact root notation on day 19 makes that a retrieval occasion; teaching it
  on day 170 would make it a repair.
- **The accepted overlay already says so.** Its lessons carry `course_day` 19, 20, 21 as
  authored. This plan places them there unchanged — the validator asserts the equality rather
  than describing it.

Day 22 administers the accepted `ma-g8-mathematics-c01-assessment` (30 points, 6 prompts).
It needs a day because in this course an assessment always occupies one: every sealed unit
assessment is delivered on its own lesson day (`…-l16`, phase *Unit assessment*). A new
delivery-day record, `ma-g8-mathematics-u01-l22`, is authored here for that purpose — see §6.

---

## 4. Why the overlay's Option A is amended

`INTEGRATION.md` §3 Option A proposed substituting three **Unit 1** days — `u01-l08`,
`u01-l13`, `u01-l14`. That recommendation is sound in shape and wrong in target, for a reason
visible only once all 180 days are compared:

- **Unit 1 owns 8.NS.1 and 8.NS.2 outright.** They appear nowhere else in the course. Every
  Unit 1 day withdrawn is a day subtracted from the sole coverage of two official standards.
- **Unit 10 owns nothing.** Every content standard it carries has a full 18-day dedicated unit
  and its own unit assessment elsewhere.
- **The specific three cost more than they look.** `u01-l08` and `u01-l14` both carry the focus
  *decimal expansions*, which is instructed once at `u01-l02`. Taking both would reduce that
  focus — the core of 8.NS.1 — from three touches to one.

Funding the same four days from Unit 10 costs strictly less coverage than funding three from
Unit 1, and it lets the block stay contiguous instead of being scattered across `l08`, `l13`,
`l14`. The amendment is recorded in `integration-manifest.json` under
`decision.overlay_option_a_amended` rather than being applied silently.

---

## 5. Why not 183 days — and why the number is not 183

The brief offers a 183-day fallback if 180 is not defensible. Two things are worth stating.

**First, the fallback would be 184 days, not 183.** The accepted overlay is three lessons
*and one 30-point assessment*. Scheduling only the three lessons leaves the correction's own
mastery evidence undelivered, and 8.EE.2 would be instructed but never independently assessed
— which is the weaker half of the same defect the correction exists to fix.

**Second, extension is blocked by the sealed schema, not merely disfavoured.**
`1.0.0/schemas/lesson.schema.json` constrains `course_day` to `maximum: 180`. Any 181st day
produces a lesson record that fails the release's own schema. Extension is therefore not a
scheduling preference but a schema change, and it would also break the sealed
`schedule-covers-every-lesson-once` and `grade-lesson-counts` checks and the 36-week family
calendar that all ten Grade 8 courses share.

**180 is defensible on the merits**, independently of that constraint: after integration every
one of the 28 official content standards is covered, every unit keeps its unit assessment,
every standard retains all 18 days of the unit that owns it, and the only days given up are
recycle days in a unit that introduces nothing. The proof is in `standards-before-after.md`
and is asserted by `validate.py`.

---

## 6. The one artefact this integration authors

`ma-g8-mathematics-u01-l22` — a delivery-day record for the already-accepted correction
assessment. It is a scheduling artefact, not new instruction: its lesson flow administers
`ma-g8-mathematics-c01-assessment` and adds no teaching content. It exists so that the
integrated course keeps the sealed release's structural invariant that **every scheduled day
maps to exactly one lesson record**, which `daily-schedule.csv` and the runtime both rely on.

It satisfies the sealed `lesson.schema.json` pattern and required fields, and collides with
none of the 936 sealed Grade 8 lesson IDs.

---

## 7. Resulting shape

| | Sealed 1.0.0 | Integrated |
| --- | --- | --- |
| Scheduled days | 180 | **180** |
| Unit 1 | 18 days | 22 days (18 sealed + 4 correction) |
| Units 2–9 | 18 days each, days 19–162 | 18 days each, days 23–166 (+4) |
| Unit 10 | 18 days, days 163–180 | 14 days, days 167–180 |
| Math lesson records authored | 180 | 184 (180 sealed + 4 new) |
| …of which on the required path | 180 | 180 (4 sealed records held in reserve) |
| Unit assessments delivered | 10 | 11 (10 sealed + the 8.EE.2 correction assessment) |
| Official content standards covered | 27 / 28 | **28 / 28** |

Exact day-by-day output: `schedule.csv`, `lesson-mapping.csv`, `daily-schedule-grade8.csv`.

---

## 8. Application steps when authorized

1. Re-run `python3 validate.py` in this directory; require `OVERALL: PASS`.
2. Re-verify the seal: `shasum -a 256 -c SHA256SUMS.txt` inside
   `curriculum-content/manuel-academy/1.0.0/` must report 181 of 181 `OK`.
3. Cut a **new release version** (`1.0.1`). Do not edit `1.0.0`.
4. In `1.0.1`, write `ma-g8-mathematics/lessons.jsonl` as the 180 sealed records with the
   `course_day` values in `lesson-mapping.csv`, plus the 3 overlay lessons and
   `lessons.integration.jsonl`, and mark the 4 reserve records `delivery: "reserve"`.
5. Copy `daily-schedule-grade8.csv` over `grades/grade-8/daily-schedule.csv`.
6. Append `ma-g8-mathematics-c01-assessment` to the course `assessments.json`.
7. **Update the derived indexes**, none of which this directory can write:
   - `…/courses/mathematics/units.json` — Unit 1 `days` 18 → 22 and four IDs appended to its
     `lesson_ids`; Unit 10 `days` 18 → 14 and its four reserve IDs marked, not removed;
   - `unit-index.json` — the same two of its unit records;
   - `lesson-index.csv` — 4 new rows, plus the new `course_day` for the 144 shifted Grade 8
     mathematics rows;
   - `…/courses/mathematics/lesson-sequence.md` and `course-guide.md` — the day sequence and
     the unit day counts.
8. Copy `student-work/` into `curriculum-production/student-work/mathematics/` and update
   `corpus-manifest.json`: `totals.lessons` +4, `totals.items` +53, `totals.gradedItems` +47,
   `totals.workedExamples` +6, `totals.keyedAnswers` +47, and
   `answerAuthority.oracleRecomputed` +47.
9. Restate the affected count checks and add the new one — see `standards-before-after.md` §5.
10. Apply `grade9-handoff-note.md` to the upstream Grade 9 derivation document. It also fixes a
    pre-existing error in that document: §3 places the root bridge topic in Grade 9 Unit 2, but
    it is a Unit 1 topic, and §7 of the same document already says so.
11. Reseal `1.0.1` only.
