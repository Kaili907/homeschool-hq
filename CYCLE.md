# CYCLE — MP (Parent Hub) · SESSION B (MP)

**Spec:** `Homeschool-HQ-Parent-Hub-Addendum-v2-6.md` (SUPERSEDES Build-Spec-v2 §M5)
**Branch:** `mp-parent-hub` · **Worktree:** `../hq-mp` · **Dev port:** 5187
**Base:** master @ 021aa46 (17 tags)

## Scope
The Grown-Ups panel graduates to a parent-PIN-gated hub with four views:
**Today · Calendar · Plans · Status**. Reads and plans only — never grades.

- **Pacing engine (built first):** `SchoolYear` (startDate, 36 weeks, quarter breaks
  after 9/18/27, off-weeks); per-girl per-subject `weekPointer` (defaults to the
  calendar-derived non-off week; Dad nudges ± with logged reason). Off-weeks shift
  every subsequent week's expectation. Pointers are the truth the hub renders from.
- **Curriculum pipeline:** `src/curriculum/plans/*.md` with `## Week N` convention +
  a light front-matter (subject/grades). Build-time parser → {grade → subject →
  week → items[]}. ✋ = Dad-taught. Ship what genuinely exists per-week:
  Competitor's-Mind schedule (Wks 1–9), Personal Finance (Wks 1–36), AI Literacy
  (Wks 1–9). Missing core scopes (4th/6th core, HS math/English post-placement) →
  "awaiting placement results" placeholders, never errors.
- **Today** — five columns (one/girl): live mission status + today's derived teaching
  items (weekPointer × day-of-week), ✋ vs auto, Travel-week 🧳 badge.
- **Calendar** — 36 scope weeks over real dates, quarter breaks, off-week toggle,
  pointer-drift ± badges, today highlighted; tap a week → per-girl summary.
- **Plans** — girl → subject → week-by-week, current pointer week highlighted,
  prev/next, pointer nudge (reason, logged), printable per week.
- **Status** — absorbs SE-B attendance + streaks + mastery heat map (90/75) +
  last-7-days + Needs-Dad flags + manual mastery snapshot entry.

## Out of scope
MJ (Session A owns teen home + assistant config); missions.ts behavior changes;
kid-facing screens beyond zero-impact reads. All new fields optional, no schema bump.
Off-weeks affect expectations only — never mutate student data.

## Gates
typecheck · full vitest (off-week pacing math across quarter boundaries · pointer
nudge scoping + logging · parser round-trip with per-doc count verification ·
missing-scope placeholder rendering) · build.

No merge — end at report.
