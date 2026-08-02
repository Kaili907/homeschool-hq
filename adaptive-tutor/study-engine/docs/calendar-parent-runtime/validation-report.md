# Session 8 validation report

Date: 2026-07-29  
Runtime: Node v24.14.1  
Scope: Card 8 exclusive ownership trees only  
Overall result: **PASS for local integration-lab handoff**

This is not production approval.

## Package verification

`scripts/verify-inputs.ps1` validates both the requested package digest and the
hash of every matching file already expanded in the workspace.

| Package | Required or observed/pinned SHA-256 | Archive entries | Matching workspace files | Mismatches | Result |
| --- | --- | ---: | ---: | ---: | --- |
| `CARD-1-STUDY-CONTRACTS.zip` | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | 73 | 70 | 0 | PASS |
| Study-Engine ZIP | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | 62 | 58 | 0 | PASS |
| Study-Integrations ZIP | `F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B` | 38 | 38 | 0 | PASS |
| Card 5 reconciliation ZIP (observed/pinned on arrival) | `2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7` | 39 | 36 | 0 | PASS |

The packages were used in place. No missing package was reconstructed from a
summary.

## Upstream executable baseline

The canonical schemas, Session 2 engine, and verified Session 4 integrations
were tested before Card 8 integration:

```text
Test Files  38 passed (38)
Tests       496 passed (496)
```

Card 5’s executable reconciliation evidence also passed:

```text
Reconciliation probes  7 passed (7)
Node tests             19 passed (19)
Package status          PASS_WITH_BLOCKER
Final assembly          not authorized
```

## Card 8 automated suite

Command:

```powershell
npm test --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
```

Final result:

```text
Test Files  6 passed (6)
Tests       86 passed (86)
```

| Test file | Tests | Primary coverage |
| --- | ---: | --- |
| `review-runtime.test.ts` | 17 | Canonical adapter, queue priority/limits, instruction reserve, authorized/null same-day windows, result feedback/outbox, interval/reteach/remediate, dedupe, deterministic traces |
| `calendar-runtime.test.ts` | 17 | All 13 mappings, reverse canonical mapping, transforms, canonical SegmentIds, 3-of-6 resume, continuation, drag/drop, parent activities, interruptions, required-unit completion, timezone/DST snapshots, duplicates |
| `parent-runtime.test.ts` | 15 | All ten controls, Card 5 DEC-012 constraint reduction/parity, expected-revision CAS, gates, clamping/manual review, winner/reason traces, rejected history, accommodation, private projection, mobile model |
| `romeo-runtime.test.ts` | 16 | DEC-018 versioned metadata/source modes, typed support reference, separate progress, public/adapter projection split, credential aliases, HTTPS, explicit-offset DST projection, idempotent calendar projection, no network |
| `demo-runtime.test.ts` | 5 | Six required demonstrations, ten-control UI model, estimate/actual separation, deterministic trace, public-field exclusion |
| `adversarial-validation.test.ts` | 16 | Canonical boundaries, PII/private aliases, DEC-019 exact-empty student projection, credential smuggling, duplicates, timezone/DST/host-zone, browser source, mobile invariants, declared local toolchain |

## Compilation and dependency audit

Strict TypeScript:

```text
strict: PASS
noUncheckedIndexedAccess: PASS
exactOptionalPropertyTypes: PASS
```

Installed isolated lab dependencies:

```text
@types/node@24.13.3
playwright-core@1.62.0
typescript@5.8.3
vite@6.4.3
vitest@4.1.10
```

All five packages are explicit in `package.json` and resolved in
`package-lock.json`; `@types/node` is also loaded by `tsconfig.json`.
`npm audit --audit-level=high` reported zero vulnerabilities.

## Browser-safe build and Node-backed audit

Vite production build:

```text
27 modules transformed
JavaScript 145.08 kB (37.57 kB gzip)
CSS          7.82 kB ( 2.42 kB gzip)
Result       PASS
```

The Node-backed bundle audit scanned four built artifacts and one JavaScript
bundle. It found no Node builtin import, CommonJS `require`, `process`
dependency, Node `Buffer`, or `__dirname`.

```text
Browser bundle digest:
FF7CBCABE0A7CE68255F717A2460A5B1095BEE9C7DF8B1FDCB1AB98F71B94ADD
```

## Browser and mobile audit

The in-app Browser validated scenario-tab interaction, selected-state and URL
updates, all ten mobile controls, 44-pixel targets, zero warning/error logs,
and no horizontal overflow. The reproducible artifact script also drove
headless system Chrome through `playwright-core` against the local preview.
Each capture had six scenario tabs, no page error, no document-level
horizontal overflow, and a minimum button height of 44 pixels.

| Screenshot | Viewport | SHA-256 | Result |
| --- | --- | --- | --- |
| `01-retrieval-failure-desktop.png` | 1440×1050 | `17BF43182B19C58D9C61FB881647C4111188086829312F409D853DF28689DF19` | PASS |
| `02-partial-resume-desktop.png` | 1440×1050 | `9634E92900CB15BB587C7F3C569C115F8D94CCC8F50321F0CF8FBBAE0DBE8D31` | PASS |
| `03-parent-controls-mobile.png` | 390×844 | `BFFCE8CD5B290A7D4D8887AC58ABECDA54C94F992DDDB4C7D60A65DD6DFDB2EF` | PASS |
| `04-romeo-adapter-desktop.png` | 1440×1050 | `45E3E828088E89B842E0DCC25376E1264C6669FE05402695D15E1A2D82A02C75` | PASS |

## Deterministic traces

`npm run traces` loaded the same integrated browser model twice and required
byte-identical output before writing either artifact.

```text
traces/deterministic-traces.json
SHA-256 2E0FDC6FD89C790722CAB1A778C4C9F497B2F1AEBFFBDCDCE73949486AE06615

traces/parent-precedence-traces.json
SHA-256 908B254D3CAD8F78CC9AEC2DB7BE93A431303BDBBA03FA034B976B2B42292323

Result PASS
```

The dedicated DEC-012 parent-precedence artifact records the rejection and
accommodation scenarios, including candidate values, binding constraints,
winner/reason evidence, parent decision history, and all ten control outcomes.
The adversarial suite also reproduced scenario and recommendation traces
byte-for-byte and proved learner-local results were identical under UTC,
Honolulu, and Tokyo host process timezones.

## Requirement matrix

| Required validation | Evidence | Result |
| --- | --- | --- |
| Canonical conformance | Current Card 1 header/version and canonical task vocabulary; upstream schema suite | PASS |
| Calendar transformations | 13 mappings, reschedule/edit/source projections | PASS |
| Partial/resume/continuation | Exact 3-of-6 point, 16-minute remainder, idempotent continuation | PASS |
| Duplicate entries | Queue semantic duplicates and calendar identity conflicts rejected/collapsed | PASS |
| Review overload | Required instruction reserved; item/minute limits and priority preserved | PASS |
| Same-day scheduling | Date-only intent remains null/manual review; explicit authorized slot requires preparation, boundary, offset instant, provenance, and attempt limit | PASS |
| Timezone/DST | IANA validation, spring gap, fall overlap, host-zone independence | PASS |
| Parent precedence | Card 5 DEC-012 gates, constraint intersection, candidate selection, clamp/manual-review, winner/reason/provenance, dedicated deterministic trace | PASS |
| Private projections | DEC-019 parent-only non-widening, adult metadata-only events, empty student projection, exact-body isolation | PASS |
| PII/data exclusion | PII, raw answer/response, transcript, diagnosis, hidden-score tests | PASS |
| Romeo adapter | DEC-018 schema/version, opaque host launch, typed study-plan support, split progress/public projection, credentials, no-network boundary | PASS |
| Mobile parent dashboard | One-column model, ten controls, 44px browser targets, no overflow | PASS |
| Browser-safe build | Vite production build + bundle scan + Chrome screenshots | PASS |
| Node-backed audits | Dependency, bundle, trace, and hash audits | PASS |
| `@types/node` | Explicit manifest/lock/config/runtime verification | PASS |
| Deterministic traces | Generated trace plus repeat and host-timezone tests | PASS |

## Card 5 status

Card 5 arrived during final reconciliation. Its observed archive digest is
pinned above; archive/workspace parity has zero mismatches; 7/7 probes and
19/19 Node tests pass. Card 8 consumes DEC-009, DEC-012, DEC-014, DEC-017,
DEC-018, and DEC-019 with focused parity/adversarial tests.

Card 5 remains `PASS_WITH_BLOCKER` because Tutor Core v0.2 is unavailable.
Production integration and final assembly are explicitly not authorized. The
full local integration record is `CARD-5-REPLACEMENT.md`.

## Residual limits

Authorization, transactional persistence/dedupe, retention/deletion, production
command routing, Romeo host allowlisting, general-purpose DLP, pinned ICU/tzdb,
and Student Study-UX remain out of scope. See `privacy-report.md` for the full
adversarial residual-risk analysis.
