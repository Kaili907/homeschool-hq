# CYCLE — MR (Reading Fluency)

**Session:** SESSION A (MR)
**Branch:** `mr-reading`
**Worktree:** `../hq-mr`  ·  **Dev port:** 5183
**Base:** `master` @ 3eece14 (14 tags)
**Spec:** `Homeschool-HQ-Reading-Addendum-v2-8.md`

## Scope (claimed)
Milestone **MR** — read-aloud fluency sessions: passage player, browser
SpeechRecognition + sequence-alignment → **estimated** WCPM / skips / stumble
candidates, tap-any-word-to-hear (via the MT-V speak adapter, + syllable mode),
offline timer + Dad-scored manual entry, a `RecognitionProvider` seam
(`azure | browser`, only browser wired), gentle non-red summary,
`profile.reading` optional field, and a Grown-Ups reading panel (WCPM trend +
benchmark band, practice-word frequency, calibration entry + biweekly reminder).
**No audio is ever stored** (asserted by test).

## Out of scope (do NOT touch)
`src/missions.ts` (Session C owns it) — the reading card is openable from Home,
but the mission auto-check wiring is **deferred**. Also out: MM (Mindset),
SE-B, MP, assessments, teen profiles.

## Rules
Claim-by-push (origin is live). Own worktree. Additive optional Profile field
(no `schemaVersion` bump). All state writes are functional updates
(`patchProfile(prev => next)`). Master auto-deploys — **no merge without
authorization**. End at a report.
