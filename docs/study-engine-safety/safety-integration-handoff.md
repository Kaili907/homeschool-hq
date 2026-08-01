# Safety integration handoff

## Decision

**PASS WITH CONDITIONS.** The Session 14 production safety boundary is ready for Session 13 reconciliation, but the checked-in defaults deliberately refuse production readiness until durable, session-verifying adapters and the schema requirements below exist.

## Delivered boundary

- An authenticated, exact-schema, size- and rate-limited Netlify classification endpoint.
- Same-session RLS learner lookup with server-derived household/student context and no caller authority claims.
- Transient normalization, deterministic high-confidence rules, and an asynchronous server-only reviewed provider port.
- Provider timeout, retry, maximum attempts, exact structured output, refusal/outage/malformed fail-closed behavior, versioned model/config identity, and circuit state.
- Fixed learner-safe responses. Only `clear` can continue to Tutor Core; stop states never promise delivery.
- A minimized idempotent adult-review proposal with no disclosure text.
- Typed durable boundaries for proposal creation, recipient-resolution leasing, per-route enqueue/claim, immutable attempts, retry/permanent/indeterminate state, receipt evidence, and monitoring.
- Test email and in-app providers with durable idempotency simulation and no network calls.
- Active guardian, relationship, notification-permission, private-route, and immediate pre-send reauthorization contracts.
- Per-route stable idempotency, lost-response recovery, unique verified receipt binding, and double-delivery prevention.
- An exact-schema monitoring model, recommended alerts/dashboard, and incident runbook.
- An authenticated narrow browser adapter with one request, bounded timeout, no automatic retry/storage/cookies/referrer, minimal fixed response validation, and fail-closed errors.
- A 74-case versioned hand-authored synthetic corpus.

## Existing infrastructure reused

- `_shared/supabase-auth.js`: bearer verification, sanitized configuration readiness, bounded auth timeout, and internal-only access token for same-session RLS.
- `_shared/http.js`: exact objects, bounded JSON/body handling, and generic errors.
- `_shared/anthropic-policy.js`: the existing server model allowlist.
- Existing gateway authentication and policy tests. TTS policy was inspected but is unrelated to this classifier.

Session 6-R2 version 1.0.1/contract 1 remains frozen. Its synchronous production port still fails closed without a valid classifier. Session 14 adds a separate asynchronous server boundary because a network provider cannot honestly implement the synchronous frozen port; integration must complete classification and issue the frozen clear permit before Tutor Core invocation.

## Production readiness

Default result: `not-ready`. Academic processing stops with 503. Production requires configured Supabase bearer authentication, provider configuration, a durable session-verifying learner authorizer, a distributed limiter and HMAC key, durable monitoring, durable proposal/outbox/attempt/receipt adapters, a durable recipient resolver with reauthorization, and production providers with durable idempotency and verifiable receipt evidence. Circuit-open is `degraded` and also cannot classify academic work.

## Session 13 replacement conditions

Replace the in-memory/test ports at the exact methods in `session-13-replacement-map.md`. Blocking differences are:

1. Map proposal category/reason/urgency/source fields losslessly; Session 13 currently has one reason code and a different vocabulary.
2. Add active guardian relationship and explicit adult-notification permission. Learning-manager or identity-manager access alone is insufficient.
3. Resolve only private active routes and reauthorize membership, relationship, permission, and route immediately before each send.
4. Add per-route jobs, channel/route references, lease token/expiry/recovery, and an append-only immutable attempt ledger.
5. Add accepted/indeterminate state; provider acceptance is not delivered.
6. Make verified receipt evidence unique, provider-bound, attempt-bound, and atomic with the delivered transition.
7. Prove durable provider-side idempotency under a lost response before enabling any real provider.
8. Install durable exact-schema monitoring and the distributed limiter before readiness can become `ready`.

## Remaining blockers and conditions

- Session 13 reconciliation and migration/RPC changes are owned by that session; Session 14 made no database changes.
- The current base learner authorizer relies on RLS but is marked `verifiesSession: false`; replace it with the canonical Session 13 authorization contract.
- No production monitoring, limiter, recipient resolver, outbox worker authorization, or delivery provider is wired.
- Provider-specific receipt verification and idempotency must be reviewed against the selected vendor's production guarantees.
- The pre-existing non-Study browser provider-key path documented in the privacy report must be resolved before a repository-wide no-browser-secret production claim.
- Re-run the complete repository workflow on the supported Node 22 CI image because this workstation's temporary Node 22 binary exceeded two unchanged test timeouts; all Session 14-focused Node 22 tests pass.

## Specialists reconciled

Safety Classifier Architecture; Existing Gateway and Authentication; Child-Safety Adversarial Corpus; Adult Authorization and Recipient; Delivery Provider and Retry; Privacy and Data Minimization; Monitoring and Incident Evidence.

No push, merge, deployment, migration, real notification, or production provider call was performed. The final local commit is reported by the coordinator because a Git commit cannot contain its own hash.
