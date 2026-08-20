# Displaced and Compressed Lesson Treatment

Four sealed lesson days leave the required 180-day path. **None is deleted.** This document
records what happens to each, and is deliberately careful about the difference between what is
*preserved* and what is *absorbed*.

## 1. What "withdrawn" means here

| Layer | Treatment |
| --- | --- |
| Lesson record | **Retained verbatim.** ID, standards, objectives, flow, and text are unchanged. Nothing in `1.0.0` is edited; in `1.0.1` the record carries `delivery: "reserve"`. |
| Required schedule | Removed. `daily-schedule.csv` no longer books the day. |
| Availability | **Reserve material.** Offered on the adaptive tutor's `prerequisite gap` and `repeated error pattern` routes, and available to any family that has time for it. |
| Instructional function | Named absorber on the required path — see §2, and read §3 before relying on it. |
| Standards | Every code stays covered — see `standards-before-after.md` §3. |

The record surviving with a stable ID matters: the sealed release guarantees that no existing
lesson, unit, or assessment ID changes, and a reserve record keeps that guarantee true.

## 2. The four days

### `ma-g8-mathematics-u10-l10` — Discussion or problem seminar
- **Sealed day 172** · focus *geometry and measurement*
- **Recycles** `u10-l04` (Independent application A), same focus.
- **Absorber** `ma-g8-mathematics-u10-l11` (Performance task planning, the next day) — a
  planning session is conducted as a discussion, so the seminar protocol has a natural home.
- **Focus after withdrawal:** taught at `l04`, assessed at `l16` — 2 touches.
- Nine other seminar days remain, one in each of Units 1–9, so the modality is not lost.

### `ma-g8-mathematics-u10-l13` — Skill consolidation
- **Sealed day 175** · focus *defining variables and assumptions*
- **Recycles** `u10-l01` (Launch and diagnostic) and `u10-l07` (Investigation), same focus.
- **Absorber** `ma-g8-mathematics-u10-l15` (Assessment preparation) — the fluency half of an
  assessment preparation day *is* skill consolidation.
- **Focus after withdrawal:** `l01`, `l07` — 2 touches.

### `ma-g8-mathematics-u10-l14` — Transfer challenge
- **Sealed day 176** · focus *selecting linear or nonlinear models*
- **Recycles** `u10-l02` (Concept model A) and is reworked at `u10-l08` (Reteach), same focus.
- **Absorber** `ma-g8-mathematics-u10-l15` (Assessment preparation, the next day) — the
  unfamiliar-context half of assessment preparation. Unit 10's transfer function is in any case
  already carried by the performance task build (`l12`) and the capstone assessment (`l16`),
  both retained; Unit 10 is itself a transfer unit.
- **Focus after withdrawal:** `l02`, `l08` — 2 touches.

### `ma-g8-mathematics-u10-l17` — Targeted correction
- **Sealed day 179** · focus *data trends and uncertainty*
- **Recycles** `u10-l05` (Concept model B) and `u10-l11` (Performance task planning).
- **Absorber** `ma-g8-mathematics-u10-l18` (Publication, presentation, or reflection, the next
  day) — correction folds into the revision step that day already runs before publication.
- **Focus after withdrawal:** `l05`, `l11` — 2 touches.
- This is the only reduction in the course's correction loop. It is the **last** correction day
  of the year: it follows the final assessment and precedes only the publication day, so its
  remediation has no instructional runway. The nine correction days in Units 1–9, which do have
  runway, are untouched.

### Why the reteach day was kept

An alternative admissible set replaces `l14` with `l08` (Reteach and varied practice). It was
rejected: withdrawing `l08` *and* `l17` would leave the final unit of the year with neither a
reteach day nor a correction day — no remediation capacity at all, for the learners most likely
to need it. Giving up enrichment instead of remediation is the safer trade, and the per-standard
arithmetic is identical either way.

## 3. Honest limits of the word "absorbed"

The absorbers named in §2 are where each withdrawn day's *function* lands on the required path.
They are **not** claims that any retained lesson record now contains the withdrawn day's
material: sealed records are explicitly unchanged, so no absorbing lesson's `lesson_flow` was
edited, and none will be. Two of the four absorptions cross focus families (`l10` geometry →
`l11` data trends; `l13` defining variables → `l15` systems), which makes them a teaching
suggestion rather than a merge.

**The load-bearing treatment is the one in §1: the records are preserved, tutor-routable, and
available.** The absorber column tells a teaching parent where the function goes if they want
it; it is not what keeps the standards covered. What keeps the standards covered is that all
four days were revisits inside a unit that introduces nothing — proved per standard in
`standards-before-after.md` §3.

## 4. Unit 10 after compression

Retained, in order: `l01 l02 l03 l04 l05 l06 l07 l08 l09 l11 l12 l15 l16 l18` — **14 days**,
course days 167–180.

The unit keeps a complete arc: launch, three concept models, two guided practices, an
independent application, an investigation, a reteach day, performance-task planning and build,
assessment preparation, the capstone unit assessment, and publication.

All six focus families survive with at least two touches:

| Focus | Retained days |
| --- | --- |
| defining variables and assumptions | `l01`, `l07` |
| selecting linear or nonlinear models | `l02`, `l08` |
| systems and constraints | `l03`, `l09`, `l15` |
| geometry and measurement | `l04`, `l16` |
| data trends and uncertainty | `l05`, `l11` |
| mathematical communication | `l06`, `l12`, `l18` |

## 5. What was displaced *into* the calendar

Nothing was displaced to make room for the correction block in Unit 1. Days 1–18 are
unchanged, and days 19–22 are new. Sealed days 19–162 shift by exactly +4 to days 23–166; no
sealed lesson changes unit, phase, focus, standards, or ID. `lesson-mapping.csv` records the
shift for all 180 sealed lessons individually.
