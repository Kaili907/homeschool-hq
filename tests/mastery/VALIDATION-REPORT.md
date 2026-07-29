# Manuel Academy mastery-map validation report

Date: 2026-07-28  
Owned scope:

- `adaptive-learning/mastery/**`
- `app/features/mastery/**`
- `tests/mastery/**`

## Completion-gate result

The mastery feature's type, runtime schema, graph, transition, interface,
browser, accessibility, build, and scoped regression gates pass.

| Gate | Result | Evidence |
| --- | --- | --- |
| Mastery engine typecheck | Pass | `tsc -p adaptive-learning/mastery/tsconfig.json --noEmit` |
| Interface typecheck | Pass | `tsc -p app/features/mastery/tsconfig.json --noEmit` |
| Test-contract typecheck | Pass | `tsc -p tests/mastery/tsconfig.json --noEmit` |
| Repository typecheck | Pass | `npm run typecheck` |
| Runtime/schema validation | Pass | 2 graphs, 18 evidence events, and 9 records validated |
| Circular graph rejection | Pass | Runtime validator and focused tests reject cycles |
| Completion-alone rejection | Pass | Completion/attempt context cannot produce mastery |
| `engine.transitions.test.ts` | Pass | 11 transition, decay, and override tests |
| Complete focused mastery suite | Pass | 51 tests across 4 files |
| Interface production build | Pass | Vite transformed 53 modules |
| Repository production build | Pass | Vite transformed 150 modules; only the existing chunk-size advisory was emitted |
| Browser/accessibility | Pass | 3 views, 0 confirmed violations, 3 incomplete `color-contrast` checks, 0 browser errors |
| Existing scoped regressions | Pass | 947 tests across 61 files |
| Corrected ZIP packaging measurements | Pass | 56 regular entries, zero directory entries, and 54 source hashes matched; independent acceptance remains pending |

## Focused mastery validation

Commands:

```powershell
node node_modules/typescript/bin/tsc -p adaptive-learning/mastery/tsconfig.json --noEmit
node --experimental-strip-types adaptive-learning/mastery/scripts/validate.ts
node node_modules/typescript/bin/tsc -p app/features/mastery/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tests/mastery/tsconfig.json --noEmit
node node_modules/vitest/vitest.mjs run --config tests/mastery/vitest.config.ts --reporter=dot
```

Results:

- `engine.transitions.test.ts`: 11 tests passed.
- Complete focused mastery suite: 4 files and 51 tests passed.
- All six required mastery states were represented.
- Two directed graphs, 18 evidence fixtures, and 9 mastery records passed
  runtime validation.
- Circular, dangling, self-referential, duplicate, and malformed graph input
  was rejected.
- Unknown properties, privacy-sensitive raw-answer fields, and future schema
  versions were rejected.
- Mastery required successful, reliable, independent demonstrations; completion
  and tutor-supported work alone did not qualify.
- Decay/reinforcement, conflicting evidence, prerequisite blocking, manual
  override, revocation, expiration, and append-only audit behavior passed.

## Browser and accessibility validation

The isolated production build was exercised with headless Chromium at desktop
and mobile sizes:

```powershell
node node_modules/vite/bin/vite.js build --config app/features/mastery/vite.config.ts
node tests/mastery/browser-accessibility.mjs
```

Results:

| View | Axe passing rules | Violations | Browser errors |
| --- | ---: | ---: | ---: |
| Desktop student accessible-list view | 27 | 0 | 0 |
| Desktop parent detail and override form | 28 | 0 | 0 |
| Mobile student accessible-list view | 27 | 0 | 0 |

Keyboard checks confirmed that the skip link is first in focus order, activates
the unique mastery-content target, and that view and parent-detail controls are
operable. All six state labels are visible. The parent detail exposes all six
required questions as headings and every override control has a unique label.

Axe reported zero confirmed violations and three incomplete
`color-contrast` checks, one in each scanned view, because it cannot determine
final background colors through layered gradients. Manual review of
representative foreground/background token pairs found a minimum ratio of
8.49:1. See `ACCESSIBILITY-REVIEW.md` for the full review and residual
production screen-reader recommendation.

Evidence:

- `browser-accessibility-result.json`
- `artifacts/mastery-desktop.png`

## Existing-system regression validation

Commands and results:

```powershell
node node_modules/vitest/vitest.mjs run --dir src --reporter=dot
# 33 files, 506 tests passed

node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/schemas --reporter=dot
# 7 files, 116 tests passed

node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/engine --reporter=dot
# 21 files, 325 tests passed
```

All 61 explicitly scoped existing test files passed: 947 tests total.

The repository's bare `npm test` command was also inspected before feature
work. It is not a clean aggregate gate in this shared workspace: it discovers
tests in `.worktrees/**` plus Playwright and `node:test` suites intended for
other runners, and it encounters unrelated optional-database/package
requirements. That baseline run reported 6,732 passing tests and 58 failures
across 40 failed suites. No root test configuration was changed because it is
outside this session's owned directories. The canonical application,
Study Engine schema, and Study Engine engine suites above are green in the
final workspace state.

## Findings and integration needs

- The feature is intentionally integration-ready rather than wired into the
  shared app shell, which is outside this session's ownership.
- The host must authenticate parent/teacher override actors, persist record and
  audit updates atomically, and enforce compare-and-swap on `revision`.
- Evidence producers must provide stable event IDs and explicitly attest
  independent performance. Legacy completion and rolling mastery fields are
  context only.
- Shared adaptive-tutor contract additions requested for a future owning
  session are documented in
  `adaptive-learning/mastery/core-change-requests.md`.
- Production integration should add one assistive-technology walkthrough in
  the host shell and should recheck contrast if host styles override feature
  tokens.
