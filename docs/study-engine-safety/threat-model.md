# Threat model

## Protected assets

- A learner's transient disclosure and identity relationship.
- Provider credentials and classifier internals.
- Household membership, adult notification permission, and private delivery routes.
- Proposal, attempt, idempotency, and verified-delivery evidence.
- The invariant that Tutor Core runs only after a validated `clear` classification.

## Threats and controls

| Threat | Boundary control | Validation evidence |
| --- | --- | --- |
| Anonymous, invalid, or expired bearer | Existing Supabase bearer verifier; no parallel unauthenticated route | Gateway and existing auth tests |
| Forged household/student authority | Exact request schema accepts only a typed student reference; household is derived under RLS | Boundary and gateway tests |
| Cross-household, inactive, or missing permission | Same bearer is used for the RLS learner lookup; exactly one active record is required | RLS authorization tests |
| Oversized, empty, or smuggled input | 8 KiB body cap, bounded text, exact JSON schema, no query parameters | Contract/gateway tests |
| Prompt injection or academic camouflage | Deterministic layer runs first; personal disclosure outranks story/academic context; provider output cannot downgrade it | Versioned synthetic corpus |
| Provider refusal, outage, timeout, or malformed output | Bounded timeout/retries, circuit breaker, exact schema and reason allowlist; result becomes `invalid` | Provider and classifier tests |
| Caller-supplied recipient, email, or phone | Recipient resolver accepts proposal context only and returns typed opaque references; route destinations are private | Recipient-injection tests |
| Revoked adult between enqueue and send | Membership, relationship, notification permission, and route are reauthorized immediately before every attempt | TOCTOU test |
| False delivered claim | Attempt is recorded first; provider acceptance is not delivery; receipt binding must verify before state transition | Delivery-evidence tests |
| Duplicate delivery after lost response | Stable per-route key, durable provider idempotency, immutable attempt binding, and receipt uniqueness | Crash/retry test |
| Raw text or identity in logs/metrics | Monitoring schema is an exact event allowlist with bounded numeric/state attributes only | No-raw-log/static tests |
| Browser secret or adult-detail exposure | Client imports no server modules, uses no storage/cookies, validates a minimal fixed wire shape | Browser/server boundary tests |
| Runtime misconfiguration | Authenticated readiness returns `not-ready`; academic requests receive 503 before classification | Readiness tests |

## Residual risks before production

Production remains blocked until the Session 13 durable schema and RPCs satisfy the replacement map, a canonical session-verifying learner authorizer is installed, a distributed limiter and durable monitoring are configured, and delivery receipt/idempotency semantics are verified for the selected providers. The repository also has a pre-existing non-Study browser provider-key path outside this session's ownership; it must be removed or otherwise resolved before a repository-wide no-browser-secret claim can be made.
