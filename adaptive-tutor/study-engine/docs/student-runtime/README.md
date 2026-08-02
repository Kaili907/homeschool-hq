# Manuel Academy Session 7 student runtime

This local browser integration lab connects verified Session 2 algorithms and
verified Session 3 Study UX components through verified Card 1 canonical
contracts and Card 5 reconciliation decision `DEC-012`.

The packages are not merely colocated. Accepted UI responses cross a versioned
adapter, mutate one canonical `StudySession` state machine, and drive
privacy-minimized engine, evidence, and review projections. Canonical segment
completion—not React state or timers—is the progress authority.

Tutor Core v0.2 and a genuine Session 6 bridge were not available and were not
reconstructed. The isolated v2 temporary bridge withholds mastery and
misconception authority.

No calendar/parent runtime, production system, database, authentication,
identity provider, Supabase project, cloud storage, GitHub repository, or
deployment is integrated.

## Run locally

From `adaptive-tutor/study-engine/integration-labs/student-runtime`:

```powershell
npm ci
npm run dev -- --port 4327
```

Open `http://127.0.0.1:4327`.

The home console offers Grade 5 mathematics, Grade 5 reading, exact local
resume cards, canonical mock parent/accommodation settings, and seven
adversarial probes. Add `?media=missing` to force the deterministic text
fallback.

## Validate

```powershell
npm run typecheck
npm test -- --reporter=dot
npm run test:browser
npm run build
npm run generate:traces
```

`dist/` contains the production browser build. Playwright runs desktop and
mobile Chromium against a local Vite server on port 4327.

## Source map

- `src/catalog.ts`: fixed opaque IDs and canonical plan/control/focus
  projections.
- `src/state/canonicalSession.ts`: canonical session transitions and events.
- `src/state/runtimeMachine.ts`: one guarded runtime command/state boundary.
- `src/adapters/uiActionVocabulary.v2.ts`: verified Study-UX action projection.
- `src/adapters/engineProjection.v1.ts`: v2 canonical/Session 2/Card 5
  projection; compatibility filename retained.
- `src/bridges/session6Bridge.v2.ts`: temporary, bound, local-only Tutor
  boundary.
- `src/bridges/session6Bridge.v1.ts`: path shim only; v1 wire input is retired.
- `src/persistence/resumeStore.ts`: v2 integrity-checked exact local resume.
- `src/adversarial/probes.ts`: seven deterministic safety/integrity probes.
- `src/App.tsx`: integrated browser prototype using verified Study-UX
  components.
- `scripts/generate-traces.mjs`: deterministic privacy-safe trace generator.
- `tests/student-runtime/unit`: conformance, recommendations, lifecycle,
  Card 5, authority, privacy, persistence, idempotency, and trace tests.
- `tests/student-runtime/e2e`: full demonstrations, Axe, keyboard, fallbacks,
  refresh loops, 320px/390px responsive checks, and screenshots.

## Documentation

- `artifact-verification-report.md`
- `canonical-adapter-manifest.json`
- `source-package-manifest.json`
- `provisional-adapter-retirement-report.md`
- `event-dictionary.md`
- `state-diagram.md`
- `sample-traces.md`
- `screenshots.md`
- `accessibility-report.md`
- `validation-report.md`
- `integration-instructions.md`
- `SESSION-7-HANDOFF.md`

The five agent reports and deeper pre-integration audit findings remain in the
same folder for traceability. Draft findings that predate Card 5 activation are
historical, not the final runtime status.

## Downloadable source package

`MANUEL-ACADEMY-SESSION-7-STUDY-STUDENT-RUNTIME.zip` preserves the
`adaptive-tutor/study-engine` path and includes:

- the owned Session 7 source, tests, docs, screenshots, traces, and build;
- the required verified, unmodified `contracts`, `schemas`, `engine`,
  `prompts`, `ui`, and `prototype/src` dependencies;
- the verified, unmodified Card 5 `reconciliation` package.

Use the adjacent `.sha256.txt` file to verify the archive before extraction.
