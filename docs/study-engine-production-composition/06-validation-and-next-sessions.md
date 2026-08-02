# Validation and next-session dependencies

## Node 22 validation

| Validation | Result |
|---|---|
| TypeScript | Passed with Node 22 |
| Focused Session 16 contracts, identity, composition, lifecycle, clients, readiness, hostile bundle | 16 files, 128 tests passed |
| Session 12 host integration focus | 8 files, 46 tests passed |
| Safety and adult-review boundaries | 5 files, 111 tests passed |
| Study migration/RLS regression | 3 files, 22 tests passed |
| Root host + Netlify, excluding separately recorded bundle/frozen fixtures | 77 files, 1059 tests passed |
| Hostile production bundle scan | 1 file, 18 tests passed |
| Frozen Session 12 fixture isolation | 7 passed, 2 deterministic fixture failures |
| Aggregate root result | 80 files; 1084 passed, 2 failed |
| RC1 runtime unit | 4 files, 44 tests passed |
| RC1 browser | 10/10 passed across desktop and mobile Chromium, including axe, keyboard, reduced motion, no-audio, and reflow |
| RC1 custody audit | 1097 manifest entries; source, bundle, and trace digests passed |
| Tutor Core custody | 248/248 files and 1,133,026/1,133,026 bytes matched; zero missing/mismatched |
| Browser interaction | Passed safe unavailable flow; focused heading; no console errors |
| Mobile | 320px and 390px: no horizontal overflow; 44px action target |
| Production provider bundle | Passed hostile minified bundle scan |
| Production build | Passed; chunk-size warning only |
| Dependency audit | Four locks: zero; frozen RC1 runtime: two high-severity Playwright advisories |

The root runner must be scoped to `src` and `netlify`. An exploratory repository-wide discovery command is not a valid harness because the frozen adaptive packages have independent configurations, aliases, Playwright runners, and custody environment requirements. Each required adaptive package check above was run through its own checked-in configuration.

## Known root-suite condition

Two frozen Session 12 local-preview tests derive a synthetic block with the current wall clock, then assert against a fixed `2026-08-01T13:00:00Z` clock. After that hour, `createSyntheticMathBlock(...)` produces an event timestamp later than the fixed continuation timestamp, so the chronological-order guard correctly rejects the fixture. The failing cases are:

- `src/study/localDevelopmentPorts.adversarial.test.ts` — “provides exact resume and idempotent partial continuation”
- `src/study/parentController.test.ts` — “applies the complete parent control set without leaking private text”

Session 16 did not edit or weaken those provisional Session 12 tests/runtime files. Their surrounding Session 12 host integration focus passes. This deterministic fixture defect prevents a full unqualified PASS until its owning session corrects the frozen time construction.

## Remaining production blockers

1. Session 17 delivery-provider and receipt-validator implementations and live readiness probes.
2. Final complete registry assembly exposed to the supported host/server composition boundary.
3. An approved verified-identity academic runtime bridge or replacement. The frozen RC1 sentinel runtime cannot be branded as production.
4. End-to-end host learner selection must exchange a verified guardian launch for authority and pass the completed registry/runtime to the composition root.
5. Hosted preflight and migration application remain prohibited until Session 18 and an explicit later deployment decision.
6. Approved staff governance is absent; staff remains disabled.
7. The RC1 runtime lock pins Playwright below the current advisory fix. Its owning release session must assess and rebuild a new release candidate; Session 16 cannot change checksum-frozen RC1 bytes.

## Session 18 hosted-preflight dependency map

Session 18 may perform read-only hosted inspection only after authorization. It must verify:

- Exact predecessor migration marker and absence of reserved-object collisions.
- Existing academy household, learner, guardian membership/relationship, credential, and session-grant schema compatibility.
- Role grants for `authenticated`, `service_role`, `anon`, and public on the new functions.
- RLS/function owner/search-path expectations and required extensions/functions.
- Netlify environment variable *presence only*, never values.
- Existing function routes and hosted readiness behavior without creating a learner grant or touching real learner data.

Session 18 must not apply the migration. A later explicitly authorized deployment must apply it transactionally, then verify the metadata marker and readiness RPC before enabling any feature.

## Multi-agent reconciliation

The coordinator used the eight required specialist roles: production composition; host invocation/navigation; guardian/learner identity; student-session issuer/verification; production port registry; lifecycle/races; provider-key/bundle security; and adversarial regression. Several agent transports disconnected after leaving work in the shared worktree; the coordinator inspected, reconciled, hardened, typechecked, and retested every accepted change before commit.
