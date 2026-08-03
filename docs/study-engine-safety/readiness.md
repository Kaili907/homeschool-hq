# Readiness and configuration gate

The readiness GET routes return only a minimal status and never classify or process work. `not-ready` uses HTTP 503. Classification and adult-review processing requests require bearer authentication and also stop with 503 while not ready, before transient text reaches a provider.

Production `ready` requires all of the following:

- Existing Supabase endpoint authentication configured by `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Server classifier provider configured by `ANTHROPIC_API_KEY`, with bounded timeout/retries and current circuit not open.
- Durable, session-verifying learner/household authorization.
- Durable distributed rate limiter and `STUDY_SAFETY_RATE_LIMIT_HMAC_KEY`.
- Durable exact-schema monitoring adapter.
- Durable minimized proposal persistence.
- Durable outbox/attempt/receipt persistence.
- Durable recipient resolver with pre-delivery reauthorization.
- Production delivery providers with durable idempotency and verifiable receipt binding before delivery is enabled.

`degraded` is reserved for a configured system whose classifier circuit is currently open. It is not safe for academic classification. Missing requirements result in `not-ready`; internal missing-component names are not returned to clients.

The in-memory stores, test resolver/providers, no-op monitor, and current base learner authorizer are deliberately marked non-durable or non-session-verifying and can never make the checked-in handler production-ready.
