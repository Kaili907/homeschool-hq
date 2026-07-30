# Session 8-R3 file manifest

Release `0.8.1` uses Node `v22.23.1`, declares `>=22`, and is delivered as
`SESSION-8-R3-FINAL-STUDY-CALENDAR-RUNTIME.zip`.

Final executable/validation source digest:
`0E51E597958D1089CBD0A07CB31C6FC7DDC4F1182131E6D0976BBD397864FB92`
(27 files). The clean build transformed 26 modules; 86 tests passed. The
four-file bundle digest is
`40A87D103A57392816D8C5D5496E8DCC53B7FCA03770B1ED771D3897BF21D53B`.

## `integration-labs/calendar-parent-runtime/` — 32 files

- `README.md`
- `app.ts`
- `calendar-runtime.ts`
- `card5-duration-policy.ts`
- `demo-scenarios.ts`
- `index.html`
- `package-lock.json`
- `package.json`
- `parent-runtime.ts`
- `privacy.ts`
- `review-runtime.ts`
- `romeo-runtime.ts`
- `styles.css`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `scripts/capture-screenshots.mjs`
- `scripts/generate-traces.mjs`
- `scripts/node-audit.mjs`
- `scripts/release-consistency.mjs`
- `scripts/verify-inputs.ps1`
- `dist/index.html`
- `dist/assets/index-C4dNgVJX.js`
- `dist/assets/index-C4dNgVJX.js.map`
- `dist/assets/index-DAyrtZlt.css`
- `traces/deterministic-traces.json`
- `traces/parent-precedence-traces.json`
- `screenshots/01-retrieval-failure-desktop.png`
- `screenshots/02-partial-resume-desktop.png`
- `screenshots/03-parent-controls-mobile.png`
- `screenshots/04-romeo-adapter-desktop.png`
- `screenshots/manifest.json`

## `tests/calendar-parent-runtime/` — 6 files

- `adversarial-validation.test.ts`
- `calendar-runtime.test.ts`
- `demo-runtime.test.ts`
- `parent-runtime.test.ts`
- `review-runtime.test.ts`
- `romeo-runtime.test.ts`

## `docs/calendar-parent-runtime/` — 20 packaged files

- `CARD-5-REPLACEMENT.md`
- `SESSION-8-HANDOFF.md`
- `archive-audit-report.md`
- `canonical-adapter-manifest.json`
- `clean-extraction-validation-report.md`
- `deterministic-build-report.md`
- `file-manifest.md`
- `integration-instructions.md`
- `privacy-report.md`
- `release-evidence.json`
- `review-to-calendar-event-dictionary.md`
- `romeo-adapter.md`
- `six-decision-parity-report.md`
- `timezone-strategy.md`
- `validation-report.md`
- `agents/calendar-resume.md`
- `agents/parent-controls.md`
- `agents/privacy-timezone-adversarial.md`
- `agents/review-scheduler.md`
- `agents/romeo-adapter.md`

Total packaged files: 58. The release ZIP itself and `node_modules` are not
members of their own inventory. This prevents nested archives and
self-referential checksum drift.
