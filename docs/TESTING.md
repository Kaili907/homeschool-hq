# TESTING.md — Test Surface Classification (A3-C)

Classification of every test surface on `integrate/study-recompose-v1`.
Three tiers: **GATING (root)** and **GATING (secondary)** must be green
before merge consideration; **ARCHIVAL** surfaces are documented
forensics tools that are NOT part of any gate.

---

## 1. GATING — root vitest suite

The authoritative gate. Runs under master's root `vite.config.ts`
(include: `src/**`, `supabase/**`, `tests/**`; threads pool; 120s
timeouts).

| Suite | Command |
|---|---|
| Root suite (93 files / 1,213 tests at time of writing) | `npm test` |

Covers: host app + study host surface (`src/**` incl. `src/study`),
all Supabase migration/RLS suites via PGlite (`supabase/**` — including
the migration-manifest custody test and master's v2.2
`academy-gateway-usage.db.test.ts` / `academy-cas.db.test.ts`), and the
netlify function boundary tests (`tests/netlify-functions/**` —
including the A3/R3 fail-closed auth-timeout tests and the A3/R4
`ACADEMY_STUDY_ENABLED` containment-gate tests).

Companion gates: `npm run typecheck`, `npm run build`, and the bundle
grep (`grep -rE "api\.anthropic\.com|api\.elevenlabs\.io|dangerous-direct-browser-access" dist/`
must return nothing).

## 2. GATING (secondary, runnable) — candidate-config suites

The suites the A3-R review executed green, now first-class npm scripts.
Run all of them with:

```
npm run test:secondary
```

| Suite | Command | Config / notes |
|---|---|---|
| Engine + integrations | `npm run test:engine` | `adaptive-tutor/study-engine/tests/final-assembly/component-vitest.config.mjs` (despite its filename it targets `tests/engine/**` + `tests/integrations/**`); react resolved via alias into `prototype/node_modules` |
| Adaptive-tutor core | `npm run test:tutor` | `adaptive-tutor/scripts/run-tests.mjs` — tsc compile to `.test-dist/` then `node --test`; portable (no bash) since A3-C |
| Calendar runtime | `npm run test:calendar` | lab-local `vitest.config.ts`, targets `study-engine/tests/calendar-parent-runtime/**` |
| Student runtime (unit) | `npm run test:student` | lab `vite.config.ts` test block, targets `study-engine/tests/student-runtime/unit/**` |
| Student runtime (browser) | `npm run test:student-browser` | Playwright 1.62.0, desktop + mobile chromium projects |
| Prototype UI (unit) | `npm run test:ui` | jsdom environment, targets `study-engine/tests/ui/unit/**` |
| Prototype UI (browser) | `npm run test:ui-browser` | Playwright 1.62.0, desktop + mobile chromium projects |
| Final assembly (unit) | `npm run test:assembly` | `runtime/vitest.config.ts`, targets `tests/final-assembly/**` excluding `browser/` |
| Final assembly (browser) | `npm run test:assembly-browser` | Playwright 1.54.1 via `runtime/playwright.config.ts`, targets `tests/final-assembly/browser/**`; serves the release surface on 127.0.0.1:4319 |

### Prerequisites

The secondary suites resolve their toolchains from per-package
`node_modules`. On a fresh clone, install before running:

```
npm ci --prefix adaptive-tutor/study-engine/runtime
npm ci --prefix adaptive-tutor/study-engine/prototype
npm ci --prefix adaptive-tutor/study-engine/integration-labs/student-runtime
npm ci --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
```

(`adaptive-tutor` core needs no install — it uses the repo root's
TypeScript.) Browser suites additionally need Playwright's chromium
builds; if missing, run `npx playwright install chromium` from the
suite's directory so the version matches that suite's pinned
`@playwright/test`.

## 3. ARCHIVAL — non-gating, forensics only

**These surfaces verified pre-recompose package custody; custody is now
the A3/A3-R record. They run only for forensics, with their inputs
supplied manually. They are not wired into any gate or npm script.**

### 3.1 `adaptive-tutor/study-engine/tests/reconciliation/reconciliation.test.mjs`

Verifies checksums, ZIP-entry safety, and content agreement of the five
frozen source packages. Requires the five ZIPs, resolved from the
directory named by `STUDY_ARTIFACT_DIR` (default: `./artifacts` relative
to the working directory). The frozen packages live in Dad's `archives/`
store, outside this repository. Exact expected filenames (from
`study-engine/reconciliation/artifact-map.json`):

| Artifact id | Expected filename |
|---|---|
| session-1-study-contracts | `CARD-1-STUDY-CONTRACTS.zip` |
| session-2-study-engine | `manuel-academy-session-2-study-engine.zip` |
| session-3-study-ux | `manuel-academy-study-ux-session-3.zip` |
| session-4-study-integrations | `manuel-academy-session-4-study-integrations.zip` |
| tutor-core-v0.2 | `manuel-academy-adaptive-tutor-core-v0.2.zip` (accepted alias: `manuel-academy-adaptive-tutor-core-v0.2 .zip`) |

So, e.g. with the store mounted at `archives/`:
`STUDY_ARTIFACT_DIR=archives/ node --test adaptive-tutor/study-engine/tests/reconciliation/reconciliation.test.mjs`

### 3.2 Tutor-core bridge suites (`adaptive-tutor/study-engine/tests/tutor-core-bridge/`)

Four files: `bridge.test.mjs`, `event-integrity-r2.test.mjs`,
`portability-r2.test.mjs`, `safety-gateway-r2.test.mjs`. They verified
the Session-6 bridge against an externally supplied, pre-verified
extraction of the tutor-core package:

- `SESSION6_SOURCE_ROOT` — path to the verified extraction root
  (required by bridge, event-integrity-r2, portability-r2).
- `SESSION6_TSC` — path to an externally supplied TypeScript compiler
  CLI (additionally required by portability-r2).

### 3.3 Uncollected vendored copies

`adaptive-tutor/study-engine/integration-labs/student-runtime/vendor/**`
holds byte-preserved copies made for lab isolation: an
`adaptive-tutor-core` snapshot (including `core/schema/` and
`json-schema/` copies), a `study-core-bridge` snapshot, and
`study-engine/schemas` fixtures. No suite collects them as a gate; they
exist so the labs and the custody record stay reproducible. The
vendored core's `dist/` was excluded from the recompose (A3/R7) — a
forensic rebuild would use the vendored `scripts/build.mjs`.

The vendored `adaptive-tutor-core/scripts/validate-package.ts` therefore
still carries the pre-`platform-boundary.ts` rule — a bare `/auth/i`
entry in `forbiddenPatterns` — and is intentionally left that way. It is
the sealed original, not a second copy to keep in sync:

- `study-engine/release/file-manifest.json` seals both it and
  `adaptive-tutor/scripts/validate-package.ts` under the same digest
  (`388F617E...FFF61`, 5175 bytes). The vendored file still hashes to
  exactly that; the live validator has since drifted away from it.
- It has one commit ever (`992b1a7`), while the live validator has taken
  two later corrections (`6cffa72` D-MATH-2, `0609753` H2) — neither of
  which touched the vendor tree. It also predates
  `scripts/platform-boundary.ts` and `scripts/subject-package-guard.ts`,
  neither of which exists in the snapshot.
- No tsconfig includes it (`adaptive-tutor/tsconfig{,.build,.test}.json`
  cover `core, examples, prototype, scripts, tests` only), so neither
  `run-tests.mjs` nor `run-validation.mjs` ever compiles or runs it.
- `src/study/production/tutorAdapterImportClosure.test.ts` fails the
  build if production code reaches `study-engine/integration-labs`, so
  the snapshot is executably fenced off rather than merely unused.

Updating it would break the custody seal it exists to preserve.

---

Last updated: A3-C (August 2026), branch `integrate/study-recompose-v1`.
