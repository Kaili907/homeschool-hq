# TUTOR-MATH-R1 Final Correction and Freeze-Gate Handoff

## Status

**READY FOR DIRECTOR FREEZE**

New artifact:
`C:\Users\aemanuel\homeschool-hq\manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1.zip`

Final SHA-256:
`ee9d15cdf1184380add17ebdd8f93f01fde3f0915f491d0a4df96798b4f52351`

The earlier aligned ZIP with SHA-256
`665be680aaf4492a556399feaf81177f3740714604332fc2fa8939cdbe181777`
is superseded and must not be frozen. No additional Math subject-development
pass is required.

## 1. Input checksum verification

- Aligned Math ZIP: exact PASS,
  `665be680aaf4492a556399feaf81177f3740714604332fc2fa8939cdbe181777`.
- The literal repository-root Core path supplied in the brief was absent.
- Workspace audit-input Core copy: exact PASS,
  `38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276`.
- Downloads Core copy: independently identical PASS with the same hash.

## 2. Pre-correction reproduction

Microsoft Edge 150.0.4078.105, Playwright 1.62.0, headless, 1280x900,
`http://127.0.0.1:4173/` from the clean aligned extraction.

All four defects reproduced:

1. `Different Example` retained the same phase, prompt, and choices after the
   correct trade.
2. Keyboard answer activation moved focus to `body`; Continue activation left
   the hidden Continue button active.
3. Correct plus `I am not sure; I guessed.` displayed `Good evidence`.
4. The prior reasoning value appeared in the next question and could be
   submitted there.

Exact machine-readable reproduction:
`evidence/pre-correction/edge/baseline-reproduction.json`. The baseline console
record contains one nonfunctional missing-favicon 404, which R1 also corrects
with an inline empty favicon.

## 3. Root causes

- Numeric `phase` was assigned but never read; only one correct and one
  incorrect renderer existed.
- Answer buttons were removed and Continue was hidden without a semantic focus
  handoff.
- Reasoning was checked only for non-emptiness, so explicit uncertainty was
  ignored.
- The shared textarea was cleared only on initial load; new attempts lacked a
  complete transient-state reset.

## 4. Exact corrections

- Added a dependency-free named phase/evidence model with deterministic routes
  through assessment, visual teaching, guided practice, independent attempt,
  reassessment, and checkpoint/continued support.
- Added orthogonal correctness/uncertainty classification and a narrow
  first-person guessing/uncertainty detector. `correct-uncertain` grants no
  confident evidence or mastery credit and routes to clarification.
- Added a complete attempt reset on every new item: answer, reasoning,
  submitted state, feedback, hypothesis, uncertainty, disabled state, and
  hidden values. Completed evidence remains item-keyed in a separate trace.
- Added synchronous semantic focus management, prepared headings, visible
  high-contrast focus rings, native Enter/Space behavior, narrow live status,
  logical Tab/Shift+Tab order, and no timers.
- Reused approved place-value visual content and approved guided, independent,
  and reassessment items. No curriculum, Core, adapter, or runtime change.

## 5. Package file delta

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

## 6. Clean-extraction non-browser matrix

Runtime: Node 22.23.2, npm 10.9.8, TypeScript 5.9.3.

| Gate | Result |
|---|---|
| Strict subject TypeScript | PASS |
| Strict Core-alignment TypeScript | PASS |
| Original behavioral tests | 9/9 PASS |
| Standalone demo regressions | 10/10 PASS |
| Aggregate tests | 19/19 PASS |
| Core v0.2 alignment tests | 8/8 PASS |
| Original content validation | 214/214 PASS |
| Frozen Core programs | 4/4 PASS |
| Source assessments adapted | 72/72 PASS |
| Emitted assessment contracts | 96/96 PASS |
| Visual commands adapted | 20/20 PASS |
| Invalid fixtures rejected | 5/5 PASS |
| Demo model/UI syntax | PASS |
| Package/checksum manifest | PASS |
| Documentation consistency | PASS |
| Ownership boundary | PASS |

Logs: `evidence/final/non-browser/`.

## 7. Final ZIP validation

- File size: 227,812 bytes.
- One exact root:
  `manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1/`.
- 92 subject files and 91 internal SHA-256 records.
- CRC and full decompression: PASS.
- Exact/case duplicates, traversal, absolute paths, backslashes, Windows
  reserved names, ADS paths, unsafe segments, encryption, symlinks, special
  entries, nested ZIPs, forbidden evidence/cache/profile paths, and local
  runtime absolute paths: none.
- Central/local filename parity: PASS.
- Archive-to-manifest and extraction-to-archive byte parity: PASS.
- Declared file delta and subject ownership: PASS.

Audit: `evidence/final/archive/audit-post-browser.json`.

## 8. Clean-extraction browser environment

- Server: Node 22.23.2 running `harness/serve-static.mjs` on port 4175.
- Document root:
  `C:\Users\aemanuel\homeschool-hq\.tutor-math-r1-audit-20260731\final-clean-extraction\manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1\adaptive-tutor\subjects\math\standalone-demo`.
- URL: `http://127.0.0.1:4175/`.
- Viewport/mode: 1280x900, headless.
- Automation: Playwright 1.62.0.
- Browsers: Chromium 151.0.7922.34, Edge 150.0.4078.105, Chrome
  150.0.7871.128.
- Final acceptance: 2026-08-01 00:18:40–00:19:13 America/New_York.
- Result: 12/12 PASS, four scenarios in each browser.

## 9. Browser results

- Functional flow: PASS; guided practice, independent attempt, reassessment,
  and appropriately qualified checkpoint reached. Former loop absent.
- Uncertainty preservation: PASS; the exact guessed response remains
  `correct-uncertain`, visibly denies confident evidence/mastery credit, and
  routes to visual clarification.
- Reasoning isolation: PASS; prior sentinels never appear in the next attempt,
  hidden values are empty, and empty fresh reasoning cannot advance.
- Keyboard/focus continuity: PASS; keyboard-only completion, valid visible
  active element after every transition, logical Tab/Shift+Tab, native
  Enter/Space, no trap, no hidden/removed/body focus.
- Console/resources: PASS; no console errors or broken-behavior warnings,
  uncaught exceptions, unhandled rejections, failed required requests, HTTP
  errors, external network requests, or horizontal overflow.
- Safety/fallbacks: PASS; delayed answer, ungraded operation, one useful step,
  no homework completion, diagnosis, placement, camera, or child imagery;
  displayed text remains usable without media or voice; reduced motion passes.

## 10. Screenshots and evidence

Primary Edge screenshots:

- `evidence/final/browser/edge/01-initial-assessment.png`
- `evidence/final/browser/edge/02-visual-teaching-or-fallback.png`
- `evidence/final/browser/edge/03-guided-practice.png`
- `evidence/final/browser/edge/04-independent-attempt.png`
- `evidence/final/browser/edge/05-reassessment.png`
- `evidence/final/browser/edge/06-mastery-or-continued-support.png`
- `evidence/final/browser/edge/07-correct-but-uncertain.png`
- `evidence/final/browser/edge/08-visible-keyboard-focus.png`

Equivalent eight-screenshot sets and environment JSON files exist under
`evidence/final/browser/bundled-chromium/` and
`evidence/final/browser/chrome/`. Combined results are in
`evidence/final/browser/playwright-results.json`.

## 11. Custody confirmation

- Frozen Core remained unchanged; both post-run Core copies still hash to
  `38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276`.
- The failed aligned ZIP remained unchanged and still hashes to
  `665be680aaf4492a556399feaf81177f3740714604332fc2fa8939cdbe181777`.
- The sealed R1 ZIP remained unchanged after all clean-extraction tests and
  still hashes to
  `ee9d15cdf1184380add17ebdd8f93f01fde3f0915f491d0a4df96798b4f52351`.

TUTOR-MATH-R1 — FINAL CORRECTION AND FREEZE-GATE HANDOFF
