# Study safety production boundary

## Scope

This boundary classifies transient Study input before Tutor Core. Only a validated `clear` result can set `continueToTutorCore` to true. `urgent`, `uncertain`, and `invalid` stop academic processing. Session 6-R2 remains frozen; its synchronous fail-closed port was not modified. The asynchronous server provider is deliberately a separate port.

## Request path

1. Netlify route matching rejects unexpected paths, methods, and query strings.
2. The existing Supabase bearer verifier authenticates the request.
3. The readiness gate checks authentication, provider, authorization, limiter, monitoring, proposal, recipient, and outbox ports.
4. The server derives an opaque limiter key with `STUDY_SAFETY_RATE_LIMIT_HMAC_KEY`; the limiter never receives a raw user ID.
5. An exact request schema and an 8 KiB body limit reject extra authority fields and malformed input.
6. Learner authorization queries the existing RLS-protected student view with the same bearer token, accepts exactly one active learner, and derives household and student identity server-side.
7. Text is held only in a local transient value, normalized, and evaluated by deterministic high-confidence rules.
8. The server-only provider adapter supplies an independently reviewed classification. Its exact output schema is validated, and it cannot downgrade a deterministic stop.
9. A `clear` result returns the fixed learner wire response. Every other result creates a minimized proposal through the proposal persistence port.
10. Adult review is a separate process boundary: durable recipient resolution, per-route outbox work, reauthorization immediately before delivery, an immutable attempt, a provider call under a stable idempotency key, receipt verification, and only then `delivered`.

## Trust boundaries

- Browser: owns no provider keys, recipient authority, delivery state, or arbitrary learner message.
- Classification function: authenticates and authorizes; raw input lives only for the duration of classification.
- Provider adapter: sends transient text server-side and accepts an exact structured result only.
- Proposal/outbox ports: persist approved structured fields, never raw disclosure text.
- Recipient resolver: derives stable opaque references from adult membership, relationship, permission, and private-route records.
- Delivery provider: receives a generic fixed template, opaque recipient/route references, and a durable idempotency key.
- Monitoring: accepts only enumerated events and bounded attributes; identifiers and raw text are not in the event schema.

## Default production posture

The checked-in default is intentionally `not-ready`. In-memory stores, test recipient resolvers, test delivery providers, non-session-verifying authorization, and the no-op monitoring port cannot satisfy production readiness. They exist only for deterministic validation until Session 13 and production infrastructure are reconciled.
