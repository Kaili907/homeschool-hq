# Deployment preflight closed-contract correction R2

## Decision

`BLOCKED`

Parent R1: `1d652ad09eccb08029315dcf8087b45ef648ed7e`

Scope is local deployment-preflight enforcement only. No production Netlify
handler, Dashboard, Auto Planner, Study Engine, Tutor V2, curriculum, hosted
sync, or production deployment was changed.

## R1 acceptance failure

R1 correctly changed the configured callable root from `netlify/functions` to
`netlify/function-entrypoints` and preserved the reviewed 31-handler surface.
It remained fail-open in two ways:

1. `parseNetlifyDeploymentConfig` collected redirects, but preflight used them
   only to discover referenced function names and scheduled-worker publicity.
   It did not enforce source, destination, status, completeness, or order.
2. callable enumeration used followed directory-entry metadata and created the
   surface from successfully read handler sources. A symbolic link could be
   followed as a file, while a FIFO or other unsupported entry could disappear
   from the inventory instead of blocking.

## Canonical redirect contract

The contract is the reviewed Web R3 `netlify.toml` table at parent R1. It has 37
ordered rows: 36 API redirects followed by one SPA fallback. All statuses are
the numeric HTTP rewrite status `200`.

| # | Source | Destination | Status |
| ---: | --- | --- | ---: |
| 1 | `/api/anthropic/*` | `/.netlify/functions/anthropic/:splat` | 200 |
| 2 | `/api/tts/*` | `/.netlify/functions/tts/:splat` | 200 |
| 3 | `/api/admin/v1/authorization` | `/.netlify/functions/admin-authorization` | 200 |
| 4 | `/api/admin/v1/access/*` | `/.netlify/functions/admin-access` | 200 |
| 5 | `/api/admin/v1/access` | `/.netlify/functions/admin-access` | 200 |
| 6 | `/api/admin/v1/overview` | `/.netlify/functions/admin-overview` | 200 |
| 7 | `/api/admin/v1/engine-performance` | `/.netlify/functions/admin-engine-performance` | 200 |
| 8 | `/api/admin/v1/learners/*` | `/.netlify/functions/admin-learners/:splat` | 200 |
| 9 | `/api/admin/v1/learners` | `/.netlify/functions/admin-learners` | 200 |
| 10 | `/api/admin/v1/costs` | `/.netlify/functions/admin-costs` | 200 |
| 11 | `/api/admin/v1/health` | `/.netlify/functions/admin-health` | 200 |
| 12 | `/api/admin/v1/study-operations` | `/.netlify/functions/admin-study-operations` | 200 |
| 13 | `/api/admin/v1/study-telemetry-delivery` | `/.netlify/functions/study-session-telemetry-deliver` | 200 |
| 14 | `/api/admin/v1/safety-operations` | `/.netlify/functions/admin-safety-operations` | 200 |
| 15 | `/api/admin/v1/audit` | `/.netlify/functions/admin-audit` | 200 |
| 16 | `/api/admin/v1/correlations` | `/.netlify/functions/admin-correlations` | 200 |
| 17 | `/api/admin/v1/configuration` | `/.netlify/functions/admin-configuration` | 200 |
| 18 | `/api/admin/v1/configuration/preview` | `/.netlify/functions/admin-configuration` | 200 |
| 19 | `/api/admin/v1/configuration/commit` | `/.netlify/functions/admin-configuration` | 200 |
| 20 | `/api/admin/v1/production-readiness` | `/.netlify/functions/admin-production-readiness` | 200 |
| 21 | `/api/admin/v1/provider-pricing-terms/*` | `/.netlify/functions/admin-provider-pricing-terms/:splat` | 200 |
| 22 | `/api/admin/v1/provider-pricing-terms` | `/.netlify/functions/admin-provider-pricing-terms` | 200 |
| 23 | `/api/admin/curriculum/*` | `/.netlify/functions/admin-curriculum/:splat` | 200 |
| 24 | `/api/study/safety/*` | `/.netlify/functions/study-safety-classify` | 200 |
| 25 | `/api/study/parent-notifications` | `/.netlify/functions/study-parent-notifications` | 200 |
| 26 | `/api/study/adult-review/health` | `/.netlify/functions/study-adult-review-health` | 200 |
| 27 | `/api/study/adult-review/deliver` | `/.netlify/functions/study-adult-review-deliver` | 200 |
| 28 | `/api/study/adult-review/worker` | `/.netlify/functions/study-adult-review-worker` | 200 |
| 29 | `/api/study/adult-review/*` | `/.netlify/functions/study-adult-review` | 200 |
| 30 | `/api/study/production/readiness` | `/.netlify/functions/study-production-readiness` | 200 |
| 31 | `/api/study/session/issue` | `/.netlify/functions/study-session-issue` | 200 |
| 32 | `/api/study/session/verify` | `/.netlify/functions/study-session-verify` | 200 |
| 33 | `/api/study/session/revoke` | `/.netlify/functions/study-session-verify` | 200 |
| 34 | `/api/study/session/readiness` | `/.netlify/functions/study-session-verify` | 200 |
| 35 | `/api/study/academic-runtime` | `/.netlify/functions/study-academic-runtime` | 200 |
| 36 | `/api/study/bound-content` | `/.netlify/functions/study-bound-content` | 200 |
| 37 | `/*` | `/index.html` | 200 |

The contract comparison is closed and order-sensitive. It blocks missing or
extra routes, target swaps (including Anthropic/TTS), changed function targets,
changed status behavior, precedence changes, and a missing, altered, duplicated,
or non-final SPA fallback.

## Closed callable filesystem inventory

The canonical `netlify/function-entrypoints` directory permits only:

- 31 regular files named `<allowlisted-handler>.js`;
- one regular non-callable metadata file, `README.md`.

There are no permitted callable directories. The shared permanent inspector
uses `lstat` semantics and classifies each direct entry without following it.
Symbolic links, FIFOs, sockets, block devices, character devices, directories,
other non-regular entries, unexpected regular files, hidden entries, and
alternate-extension handlers are forbidden. An expected handler name is still
missing unless that exact path is a regular `.js` file.

Both the Study deployment preflight and the web-release function-surface gate
consume `inspectNetlifyFunctionSurface`, so a given filesystem entry receives
the same callable/forbidden classification in both gates.

## Final callable surface

Exactly 31 regular handler-only delegates are callable:

`admin-access`, `admin-audit`, `admin-authorization`, `admin-configuration`,
`admin-correlations`, `admin-costs`, `admin-curriculum`,
`admin-engine-performance`, `admin-health`, `admin-learners`, `admin-overview`,
`admin-production-readiness`, `admin-provider-pricing-terms`,
`admin-safety-operations`, `admin-study-operations`, `anthropic`,
`production-item-assessment`, `study-academic-runtime`, `study-adult-review`,
`study-adult-review-deliver`, `study-adult-review-health`,
`study-adult-review-scheduled-worker`, `study-adult-review-worker`,
`study-bound-content`, `study-parent-notifications`,
`study-production-readiness`, `study-safety-classify`, `study-session-issue`,
`study-session-telemetry-deliver`, `study-session-verify`, `tts`.

Resolver exposed: no. Test/helper/debug handler exposed: no.

## Permanent negative controls

The preflight suite retains R1 controls and proves blocking for:

1. all redirects removed;
2. Anthropic routed to TTS;
3. a required redirect changed from status 200 to 302;
4. SPA fallback removed;
5. precedence changed and SPA fallback made non-final;
6. an unexpected route that adds routing authority;
7. `surprise.js` as a symlink to a production module in an external temporary repository;
8. expected `anthropic.js` replaced by a symlink in an external temporary repository;
9. `surprise.js` as a FIFO in an external temporary repository.

The web-release inspector suite independently proves the same symlink and FIFO
classification and never opens the FIFO.

## Validation evidence

The scoped correction and release gates pass:

- Study deployment preflight: 34/34 tests passed;
- unified production-local preflight: 10/10 tests passed;
- web-release gate controls: 13/13 tests passed;
- Netlify surface: 3/3 tests passed;
- full root `npm test`: passed;
- checked-in Study preflight with a complete value-silent environment:
  `READY_FOR_DEPLOYMENT_ENVIRONMENT`;
- typecheck: passed;
- default-off production build: passed;
- proxy-enabled Family Pilot build and web-release security gate: passed;
- Netlify CLI 27.1.1 offline production build: passed, 31 functions bundled,
  zero function-bundler warnings and zero fallbacks.

The checked-in unified CLI result is still `BLOCKED_BY_CONFIGURATION`. Its Study
component is ready and migration reconciliation is valid/read-only, but the
pre-existing Admin R3 evidence correctly retains three out-of-scope blockers:

- `ACCOUNT_PRICING_NOT_VERIFIED`;
- `PRODUCTION_LEDGER_OPERATION_NOT_VERIFIED`;
- `STUDY_TELEMETRY_CADENCE_NOT_APPROVED`.

This session did not rewrite those records as PASS because doing so would
fabricate production evidence and exceed the explicit no-hosted/no-production
scope. Therefore the umbrella requirement that the checked-in unified preflight
pass is not met, even though the R2 closed-contract correction itself is green.
