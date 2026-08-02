# Director Handoff — TUTOR-MATH-R1 Standalone Demo Correction

## Package state

**Pre-seal correction gates: PASS. Final Director Freeze status is determined
from the sealed ZIP's external clean-extraction evidence.**

The new candidate name is
`manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1.zip`. The failed
aligned ZIP with SHA-256
`665be680aaf4492a556399feaf81177f3740714604332fc2fa8939cdbe181777`
must not be frozen.

## Artifact custody

- Failed aligned input SHA-256: exact PASS.
- Frozen Core v0.2 SHA-256
  `38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276`:
  exact PASS.
- The literal repository-root Core ZIP path named in the correction brief was
  absent; two independently located copies matched the required Core hash.
- The failed aligned ZIP and frozen Core were not overwritten, renamed,
  deleted, repackaged, or changed.

## Root causes and corrections

1. The demo assigned numeric `phase` values but never read them; correct and
   incorrect branches each rebuilt one fixed screen. R1 adds a named,
   deterministic subject-owned model that reaches visual teaching, guided
   practice, independent attempt, reassessment, and checkpoint/continued
   support.
2. Answer buttons were removed and Continue was hidden without a focus handoff.
   R1 prepares the phase heading with `tabindex="-1"`, focuses it after every
   major render, focuses the textarea after selection/error, retains native
   keyboard semantics, and supplies a high-contrast focus indicator.
3. Reasoning text was checked only for non-emptiness. R1 uses a narrow
   first-person uncertainty/guessing cue rule, keeps correctness orthogonal to
   uncertainty, records `correct-uncertain`, and routes it to visual
   clarification without confident evidence or mastery credit.
4. The shared textarea was cleared only on initial load. R1 resets all
   item-specific transient state on every new attempt while retaining completed
   evidence separately and keyed to its source item.

## Regression snapshot

- Node 22.23.2 / npm 10.9.8 / TypeScript 5.9.3
- Strict TypeScript: PASS
- Original behavioral tests: 9/9 PASS
- New standalone demo regressions: 10/10 PASS
- Core alignment tests: 8/8 PASS
- Content validation: 214/214 PASS
- Frozen Core verification: 4 programs, 72 source items, 96 emitted contracts,
  20 visuals, and 5/5 invalid fixtures rejected
- Working-tree Playwright acceptance: 4/4 PASS on bundled Chromium
  151.0.7922.34 with Playwright 1.62.0, headless at 1280x900
- Pre-correction reproduction: Edge 150.0.4078.105 with Playwright 1.62.0

## Exact package file delta from the failed aligned ZIP

Added:

- `standalone-demo/model.js`
- `tests/standalone-demo-regression.test.mjs`

Modified:

- `README.md`
- `SHA256SUMS.txt`
- `director-handoff.md`
- `docs/core-v0.2-alignment-report.md`
- `manifest.json`
- `package.json`
- `standalone-demo/README.md`
- `standalone-demo/demo.css`
- `standalone-demo/demo.js`
- `standalone-demo/index.html`
- `test-results.txt`
- `validation-report.md`
- `validation-results.json`

Deleted: none.

The final outer ZIP SHA-256, raw archive audit, manifest reconciliation,
clean-extraction non-browser matrix, final browser environment/results, and
screenshot paths are intentionally external post-seal evidence. Embedding them
would change the artifact after it was tested.

## Boundaries

Core v0.2, `core-v0.2-adapter.ts`, `runtime-v0.2.ts`, lesson trees, sequence
content, assessment wording, answer keys, approved visual source content, Core
fixtures/traces, and every external system remain unchanged.
