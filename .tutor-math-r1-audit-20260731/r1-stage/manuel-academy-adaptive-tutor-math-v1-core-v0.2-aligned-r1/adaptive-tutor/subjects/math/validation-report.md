# Adaptive Math Intervention Content v1 — TUTOR-MATH-R1 Validation Report

**Derived release:** 1.0.2  
**Content version:** 1.0.0  
**Derived artifact:** `manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1.zip`  
**Content boundary:** `adaptive-tutor/subjects/math/**`

## Artifact custody

- Failed aligned input SHA-256:
  `665be680aaf4492a556399feaf81177f3740714604332fc2fa8939cdbe181777`
- Frozen Core v0.2 SHA-256:
  `38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276`
- Both values were recomputed before correction and matched exactly.
- The aligned input ZIP and frozen Core files were not changed.

## Corrected standalone defects

| Browser-verified defect | R1 correction |
|---|---|
| Different Example repeated indefinitely | Named phase/evidence model now renders visual teaching, guided practice, independent attempt, reassessment, and a bounded result. |
| Focus moved to `body` or stayed on hidden Continue | Every synchronous render focuses the prepared phase heading or visible reasoning control; native buttons retain Enter/Space behavior and all focusable surfaces have a visible ring. |
| Correct plus explicit guessing became positive evidence | A narrow uncertainty-cue rule records `correct-uncertain`, preserves that evidence, routes to clarification, and grants no confident evidence or mastery credit. |
| Reasoning and feedback leaked between questions | Every new attempt resets selected answer, textarea value, submitted state, feedback, uncertainty, disabled/hidden state, and item-specific hypothesis data. Historical trace entries remain item-keyed. |

## Preserved content

- Four ordered adaptive sequences
- 72 source assessment items
- 24 misconception patterns
- 20 visual-board commands
- 40 narration/WebVTT cues
- All lesson trees, sequence content, assessment wording, answer keys, approved
  visuals, adapters, and runtime files remain byte-identical to the failed
  aligned input.

## Pre-seal results

| Check | Result |
|---|---|
| Node/npm runtime | 22.23.2 / 10.9.8 |
| Strict TypeScript 5.9.3 | PASS |
| Original behavioral tests | 9/9 PASS |
| Standalone demo regressions | 10/10 PASS |
| Aggregate subject tests | 19/19 PASS |
| Original content validator | 214/214 PASS |
| Core v0.2 alignment tests | 8/8 PASS |
| TutorProgram contracts | 4/4 PASS |
| Source assessments adapted | 72/72 PASS |
| Emitted assessment contracts | 96/96 PASS |
| Source visuals adapted | 20/20 PASS |
| Invalid runtime/Core fixtures | 5/5 rejected |
| Working-tree Playwright acceptance | 4/4 PASS |
| Working-tree browser | Chromium 151.0.7922.34, Playwright 1.62.0, headless, 1280x900 |
| Guided/independent/reassessment/checkpoint flow | PASS |
| Correct-but-uncertain route | PASS |
| Reasoning isolation | PASS |
| Keyboard/focus continuity | PASS |
| Missing-media/unavailable-voice/reduced-motion | PASS |
| Console, required resources, and horizontal overflow | PASS |

The sealed outer ZIP SHA-256 and all final clean-extraction results are recorded
after sealing in external freeze evidence. They cannot be embedded into the ZIP
without changing the artifact being identified.

## Boundary confirmation

No Core, GitHub, Supabase, Netlify, Lovable, database, storage, identity,
authentication, progress-synchronization, Tutor Assembly, or deployment change
was made.
