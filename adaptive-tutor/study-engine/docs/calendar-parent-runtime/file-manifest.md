# Session 8 file manifest

All files are confined to the three Card 8 exclusive ownership trees. No Wave
1, canonical contract, Tutor Core, Study-UX, subject, production calendar,
production parent dashboard, Supabase, database, authentication, identity,
storage, deployment, or GitHub file was edited.

The downloadable ZIP and its companion checksum are generated after this
manifest and are intentionally not included in their own inventory.

## `integration-labs/calendar-parent-runtime/`

Runtime and browser demo:

- `README.md`
- `app.ts`
- `calendar-runtime.ts`
- `card5-duration-policy.ts`
- `demo-scenarios.ts`
- `index.html`
- `parent-runtime.ts`
- `privacy.ts`
- `review-runtime.ts`
- `romeo-runtime.ts`
- `styles.css`

Isolated package/build configuration:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`

Audit and artifact scripts:

- `scripts/capture-screenshots.mjs`
- `scripts/generate-traces.mjs`
- `scripts/node-audit.mjs`
- `scripts/verify-inputs.ps1`

Generated browser build:

- `dist/index.html`
- `dist/assets/index-DAyrtZlt.css`
- `dist/assets/index-_RLKMMPo.js`
- `dist/assets/index-_RLKMMPo.js.map`

Generated deterministic traces:

- `traces/deterministic-traces.json`
- `traces/parent-precedence-traces.json`

Generated screenshots:

- `screenshots/01-retrieval-failure-desktop.png`
- `screenshots/02-partial-resume-desktop.png`
- `screenshots/03-parent-controls-mobile.png`
- `screenshots/04-romeo-adapter-desktop.png`
- `screenshots/manifest.json`

`node_modules/` is local installation state and is excluded from the ZIP.

## `tests/calendar-parent-runtime/`

- `adversarial-validation.test.ts`
- `calendar-runtime.test.ts`
- `demo-runtime.test.ts`
- `parent-runtime.test.ts`
- `review-runtime.test.ts`
- `romeo-runtime.test.ts`

## `docs/calendar-parent-runtime/`

- `CARD-5-REPLACEMENT.md`
- `SESSION-8-HANDOFF.md`
- `canonical-adapter-manifest.json`
- `file-manifest.md`
- `integration-instructions.md`
- `privacy-report.md`
- `review-to-calendar-event-dictionary.md`
- `romeo-adapter.md`
- `timezone-strategy.md`
- `validation-report.md`
- `agents/calendar-resume.md`
- `agents/parent-controls.md`
- `agents/privacy-timezone-adversarial.md`
- `agents/review-scheduler.md`
- `agents/romeo-adapter.md`

## Counts before ZIP/checksum

| Tree | Files |
| --- | ---: |
| Runtime lab, including build/screenshots/traces | 31 |
| Automated tests | 6 |
| Documentation, including this manifest and handoff | 15 |

Packaging adds only the ZIP and companion checksum within
`docs/calendar-parent-runtime/`.
