# Tutor V2 reuse map

## Classification meanings

- `REUSE_AS_IS`: consume the existing boundary through its public contract; do not fork its authority.
- `EXTEND_ADDITIVELY`: add a new version/path while preserving the current artifact and compatibility history.
- `WRAP_WITH_V2`: retain useful implementation infrastructure behind a new V2 contract; the old public surface is not the V2 surface.
- `LEGACY_COMPATIBILITY_ONLY`: keep for old flows, fixtures, migration, or regression tests; do not make it canonical.
- `MUST_NOT_USE_FOR_PRODUCTION`: demo/local/synthetic or authority-unsafe path that production composition must not import.
- `REQUIRES_LATER_SECURITY_CONVERGENCE`: useful seam cannot become production Tutor V2 wiring until a later authorized convergence closes the named risk.

## Component classifications

| Component / path | Classification | V2 disposition and constraint |
|---|---|---|
| Canonical Study contracts and schemas — `adaptive-tutor/study-engine/contracts/**`, `schemas/**` | `REUSE_AS_IS` | Single authority for plans, sessions, evidence, controls, private records, and version handling. V2 consumes projections; it does not fork schemas into a second engine. |
| Deterministic Study focus/break/interleaving/review/evidence policies — `adaptive-tutor/study-engine/engine/**` | `REUSE_AS_IS` | Continue as Study policy. Tutor may recommend only through the closed action contract. Provisional session orchestrator remains excluded as noted below. |
| Verified academic runtime and production composition — `src/study/production/**`, `netlify/functions/study-academic-runtime.js`, `_shared/study-runtime/**` | `REUSE_AS_IS` | Required future entry/capability/checkpoint boundary. Wave 1 does not modify or wire it. |
| Production item resolver and assessment boundary — `netlify/functions/production-item-*.js` | `REUSE_AS_IS` | Exclusive answer/scoring authority. Tutor receives neither resolver access nor answer-bearing objects. |
| Production Study safety — `netlify/functions/study-safety-classify.js`, `_shared/study-safety/**` | `REUSE_AS_IS` | Pre-invocation and output safety authority; non-clear fails closed. V2 must compose through it later, never reimplement it as Tutor authority. |
| Adult-review state/recipient/receipt boundaries — `src/study/adult-review/**`, `_shared/study-adult-review/**` | `REUSE_AS_IS` | Study owns proposal-to-receipt state. Tutor can emit only a minimized proposal action. |
| Tutor Core 0.2 public history — `adaptive-tutor/core/**` excluding future `core/v2/**` | `EXTEND_ADDITIVELY` | Preserve frozen 0.2. Create new V2 contracts/ports/policies under `core/v2`; do not rewrite 0.2 schemas or semantics. |
| Tutor Core teaching/board/media/prompt concepts | `WRAP_WITH_V2` | Port subject-neutral, age-aware explanation/hint/visual patterns into closed V2 actions. Do not carry forward answer-bearing assessment or transcript state. |
| Tutor Core 0.2 assessment/confidence/misconception/advance decisions | `LEGACY_COMPATIBILITY_ONLY` | Required to replay/test frozen flows. In V2 these outputs are non-authoritative or absent; Study owns scoring and mastery. |
| Tutor Core local regex safety — `adaptive-tutor/core/safety/**` | `LEGACY_COMPATIBILITY_ONLY` | Defense-in-depth for old core only. It is incomplete for urgent safety and cannot authorize production continuation. |
| Study Core Bridge 1.0.1 — `adaptive-tutor/study-engine/bridges/tutor-core/**` | `LEGACY_COMPATIBILITY_ONLY` | Preserve exact version and use its privacy, permit, idempotency, checkpoint, and fail-closed patterns as design evidence. Build a distinct V2 bridge in W1-08 because its Tutor-owned mastery mapping conflicts with V2. |
| Reconciliation provisional orchestrator and retired wire paths | `LEGACY_COMPATIBILITY_ONLY` | Keep for manifest/history and compatibility probes. Never reactivate as canonical Study authority. |
| Generic Anthropic gateway infrastructure — `netlify/functions/anthropic.js`, `_shared/anthropic-policy.js` | `WRAP_WITH_V2` | Auth, entitlement, quota, credential custody, accounting, timeouts, and sanitation may sit behind a provider-neutral port. The current Tutor request/response is not V2. |
| Generic Anthropic Tutor mode and browser contract | `REQUIRES_LATER_SECURITY_CONVERGENCE` | Current contract is provider-specific, accepts browser context that can include `correctAnswer`, passes learner text/history, and returns unstructured text. It cannot be production V2 without server-derived minimized context plus closed-action validation. |
| Family Pilot static fallback — `src/study/family-pilot/tutor/staticFallback.ts` | `WRAP_WITH_V2` | Reuse the deterministic/no-network idea. V2 fallback content must be subject-neutral, curriculum-authored, versioned, grounded, and selected by Study policy. |
| Family Pilot Tutor bridge — `src/study/family-pilot/tutor/tutorBridge.ts` | `MUST_NOT_USE_FOR_PRODUCTION` | Local math/grade subset, browser-held correct answer, in-memory transcript, local safety, and raw text gateway output are incompatible with V2 authority. |
| Family Pilot learner response / browser assessment runtime — `src/study/family-pilot/{learner-response,assessment}/**` | `MUST_NOT_USE_FOR_PRODUCTION` | Local raw response storage, optional/offline assessor, IndexedDB, and browser orchestration are not production custody/authority. |
| Study integration labs — `adaptive-tutor/study-engine/integration-labs/**` | `MUST_NOT_USE_FOR_PRODUCTION` | Synthetic/local IDs, localStorage, expected answers, local safety, and in-memory ports are demo/test-only. Production import boundaries must keep them out. |
| Portable RC runtime — `adaptive-tutor/study-engine/runtime/**` | `MUST_NOT_USE_FOR_PRODUCTION` | Explicitly `portable-non-production`; it accepts expected answers and adapts frozen Tutor programs. Retain only as audit/demo history. |
| Working-level browser/profile update seam — `src/academy/workingLevel.ts` and related host sync | `REQUIRES_LATER_SECURITY_CONVERGENCE` | V2 may recommend but must not write. Production convergence must prove authenticated guardian/server authority and conflict semantics before any official change path is exposed. |
| Protected raw rubric/adult-review response custody | `REQUIRES_LATER_SECURITY_CONVERGENCE` | Current assessment correctly avoids learner evidence storage, but retention, access, deletion, and Tutor non-access must be verified in later end-to-end convergence. |
| V2 contracts/policies/provider/memory/evidence/evals/bridge | `EXTEND_ADDITIVELY` | New Wave 1 surfaces only, under the frozen ownership map. No direct web or production persistence wiring. |

## Production import invariant

Any future production Tutor V2 composition must fail a boundary test if its import graph reaches:

- `adaptive-tutor/study-engine/integration-labs/**`;
- `adaptive-tutor/study-engine/runtime/**`;
- `src/study/family-pilot/tutor/**`;
- browser/local assessment or learner-response stores;
- frozen Tutor Core answer-bearing assessment state as live authority.

Historical tests may import those paths only from explicitly non-production test/demo packages.
