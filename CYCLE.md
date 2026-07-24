# CYCLE — MJ (HS Voice Assistant / "Jarvis mode")

**Session:** SESSION A (MJ)
**Branch:** `mj-hs-assistant`  ·  **Worktree:** `../hq-mj`  ·  **Dev port:** 5186
**Base:** `master` @ 021aa46 (17 tags)
**Spec:** `Homeschool-HQ-HS-Assistant-Addendum-v2-9.md`

## Scope (claimed)
Milestone **MJ** — a voice assistant on the **teen** home (grades 10/12 only):
tap-and-hold orb (no wake word) + typed input; per-turn **read-only** context
from HER profile only (mission, deadlines, courses, unit stats, assessment
status — never item content/answers, never another profile, never journal,
never keys); **hardcoded system prompt** with the full must-not list (no
submittable work / no assessment answers / no data change without confirm / no
person-pretense); three **confirmable + logged** actions (check mission item,
mark college task done, start a unit/quiz/reading session); per-girl name +
persona line + new `assistant` voice slot; replies 2–4 sentences, spoken via the
MT-V adapter with text always shown; daily cap 40 (Dad-editable) + month meter,
transcripts logged with 60-day prune; keyless/offline → orb disabled, nothing
else breaks. Reuses MT-2 (Anthropic client + key/model), MT-3 (push-to-talk),
MT-V (voice slots).

## Out of scope (do NOT touch)
**MP** (Session B owns the Grown-Ups rework) — keep config additions to a
**single small tutor-adjacent block**. Also: `src/missions.ts`, the littles'
surfaces, assessment internals.

## Rules
Claim-by-push (origin is live). Own worktree. Additive optional Profile field
(no `schemaVersion` bump). Functional state writes (`patchProfile(prev=>next)`).
The must-nots are hardcoded child-safety / academic-integrity rules, not
suggestions. Master auto-deploys — **no merge without authorization**. End at a
report.
