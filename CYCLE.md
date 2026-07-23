# CYCLE CLAIM — SESSION 3 (MT-V)

**Milestone:** MT-V — Premium Voice (ElevenLabs) per `Homeschool-HQ-Voice-Addendum-v2-5.md`
**Session:** SESSION 3 (MT-V) · wave 2 parallel dispatch
**Worktree:** `../hq-mtv`
**Branch:** `mtv-premium-voice`
**Base:** `master` @ ce330a9 (tags through v2.0-mt1)
**Dev port:** 5176

## Scope (in)
- Provider adapter in `src/tutor/voice.ts`: resolution **cache → ElevenLabs → browser**, silent degradation (never kid-facing errors).
- ElevenLabs REST provider (model id in ONE commented constant; fetch layer swappable to a proxy base).
- API key entry in Grown-Ups (masked, test button; stored OUTSIDE AppState so it is excluded from exports/commits).
- Monthly character counter + Dad-set soft cap (default 90,000) that flips ElevenLabs → browser-only at cap, with a Grown-Ups-only banner.
- IndexedDB mp3 cache: key = hash(voiceRef + rate + text), 200MB LRU, size display + clear.
- Pre-warm "Download voices for offline" for all static lines.
- Per-girl per-subject `voiceMap` grid (mathTutor / mindset / japanese / default; fall-through; legacy single voice migrates to `default`; additive field, no schema bump).
- Teen opt-in and mute behavior unchanged.

## Scope (out)
- MS, MM, H1's conversions.
- Any change to Walkthrough / QuizSession logic (they already call the speak layer).
- MT-2 / AI anything.

## Coordination
- H1 merges before MT-V → every new state write is authored as a functional update (`prev => next`); expect a rebase over H1 at merge time.
- No merge performed in this cycle — ends at report.
