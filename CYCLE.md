# CYCLE — MM (Mindset Module) · SESSION B (MM)

**Spec:** `Homeschool-HQ-Mindset-Module-Addendum-v2-4.md`
**Content:** `Mindset-Lessons-Q1.md` (Weeks 1–9, transcribed verbatim)
**Branch:** `mm-mindset` · **Worktree:** `../hq-mm` · **Dev port:** 5184
**Base:** master @ 3eece14 (14 tags)

## Scope
Weekly self-guided mindset lesson, delivered in-app, completed alone by each girl.
One lesson per week, weekly unlock from a Dad-set school-start date, surfaced as a
Morning Mission item ("🧠 Mindset lesson") that auto-checks on completion.

- Typed content bank (core / littles / teensExtra / habit / reflect variants), count-verified = 9.
- Weekly unlock math from a Dad-set start date; earlier weeks revisitable, future locked (no binging).
- Littles (playful): large type + auto-offered read-aloud (MT-V speak adapter, slot "mindset") + emoji/one-word reflection.
- 6th+ / teens: read (+ extension for teens) then journal with autosave.
- Habit card persists on Home all week (untracked).
- Completion = viewed to end + reflection submitted (emoji counts) → fires mission auto-check.
- **PRIVACY (load-bearing):** journal text is private to the profile. Grown-Ups shows
  COMPLETION STATUS ONLY. No code path exposes journal text to the panel or the
  standard export-all. A separate in-session "export MY journal" button lives inside
  the girl's own signed-in view.
- No confetti in this module for any theme.

## Out of scope (owned by other sessions)
`missions.ts` auto-check ownership stays minimal (Session C owns missions.ts deep changes):
ship the lesson card openable from Home, defer auto-check plumbing beyond the item flip.
MR, SE-B, MP, assessments untouched.

## Gates
typecheck · full vitest (incl. unlock-date math, locked-week inaccessibility, and a
test asserting NO code path exposes journal text to the panel or the standard export) ·
content count = 9 · build.

No merge — end at report.
