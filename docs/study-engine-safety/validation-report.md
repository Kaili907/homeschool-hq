# Session 14 validation report

Validation date: 2026-08-01. Base: `74e2c21fe3bbf9c0ec270610fe71101ae5abd60a`. No production external service, notification provider, or real student data was used.

## Final Session 14 results

| Validation | Runtime | Result |
| --- | --- | --- |
| Root TypeScript `tsc --noEmit` | Node 22.23.2 | PASS |
| Focused classifier, corpus, gateway, readiness, privacy, browser boundary, adult recipient, outbox, retry, and delivery evidence suite | Node 22.23.2 | PASS — 5 files, 107 tests |
| Existing Anthropic/TTS gateway and Supabase-auth regressions | Node 22.23.2 | PASS — 2 files, 55 tests |
| Frozen Session 6-R2 safety gateway | Node 22.23.2 | PASS — 12 tests |
| Complete repository npm workflow | installed Node 24.18.0 | PASS — 57 files, 986 tests |
| Production dependency audit, `npm audit --omit=dev` | npm advisory service | PASS — 0 vulnerabilities |
| Browser secret/adult-detail static scan | local | PASS — no matches |
| Raw-log/browser-env static scan | local | PASS — no matches |
| Browser/server import-boundary static scan | local | PASS — no matches |
| Frozen/excluded ownership scan | local | PASS — no changes |
| Diff whitespace check | local | PASS |

The 107 focused tests include 74 versioned synthetic corpus cases and direct tests for exact request/response schemas, deterministic precedence, provider non-downgrade, malformed/refusal/outage behavior, timeout/retry/circuit state, readiness refusal, anonymous/forged/cross-household requests, same-bearer RLS, active learner state, HMAC limiter identity, proposal minimization, recipient injection, route reauthorization, immutable attempts, accepted-versus-delivered semantics, receipt verification, response-loss retry, double-delivery prevention, no raw logs, and browser/server separation.

## Node 22 timing conditions

The exact default full host invocation on the temporary Node 22 binary completed 50/51 files and 885/888 tests; three pre-existing `src/sync/useSync.mounted.test.tsx` cases exceeded their 5-second per-test limit in a resource-constrained run. Isolated rerun reduced this to one case completing in 5.151 seconds. With `--testTimeout 120000`, that unchanged file passed 29/29 on Node 22. The exact complete host suite passed 888/888 on the installed runtime.

The first local PGlite database file completed 54/55 on Node 22; one unchanged setup/RLS test completed in 35.892 seconds and exceeded its 30-second limit. The installed-runtime repository workflow passed that file 55/55 and all remaining local database suites, for 98/98 database tests. No timeout involved Session 14-owned files, and no assertion exposed a behavior difference.

These are validation-environment timing conditions. The host and database code/timeouts are outside Session 14 ownership and were not changed. Production reconciliation should run the full repository workflow on the project CI's supported Node 22 image before merge.

## Supplemental frozen-bridge invocation

A combined four-file bridge command was attempted before the documented external fixture variables were supplied. The safety tests passed, while three fixture/portability entry points correctly refused to run without `SESSION6_SOURCE_ROOT` and `SESSION6_TSC`. The self-contained safety gateway was then rerun alone on Node 22 and passed 12/12. Frozen bridge, contract, runtime, release, and Tutor Core files have no changes.

## Synthetic corpus

- Version: 1
- Provenance: hand-authored synthetic
- Total: 74
- Urgent: 44
- Uncertain: 9
- Clear: 19
- Invalid: 2
- Tutor Core permitted: clear cases only
- Delivery attempted during classification: 0

## Test-failure accounting

- Session 14-focused failed tests: 0
- Final assertion/behavior failures: 0
- Disclosed Node 22 default-timeout conditions: 1 host test on isolated confirmation; 1 local database test in the attempted database chain
- Production calls: 0
- Real notifications: 0
- Real student data: 0
