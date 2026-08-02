# Production registry and port wiring

## Canonical inventory

There is one typed registry, `ProductionDependencyPortMap`. Each entry must be created by `brandProductionPort(...)`, is provenance-checked at runtime, and is remembered in a module-private `WeakSet`. Recovering the private symbol is not sufficient to forge a port or registry.

| # | Canonical key | Contract/source | Session 16 result |
|---:|---|---|---|
| 1 | `session-verifying-authorizer` | trusted identity server | Implemented contract; live identity readiness |
| 2 | `household-learner-resolver` | trusted identity server | Server-derived authority contract |
| 3 | `study-session-adapter` | Session 13 Supabase persistence | Wired |
| 4 | `checkpoint-adapter` | Session 13 Supabase checkpoint | Wired |
| 5 | `review-queue` | Session 13 Supabase review queue | Wired |
| 6 | `calendar-adapter` | Session 13 Supabase calendar | Wired |
| 7 | `parent-settings-adapter` | Session 13 Supabase parent settings | Wired |
| 8 | `adult-private-adapter` | Session 13 Supabase adult-private | Wired |
| 9 | `event-ledger` | Session 13 Supabase ledger | Wired |
| 10 | `adult-review-proposal-store` | Session 13 Supabase outbox | Wired through proposal method |
| 11 | `outbox-store` | Session 13 Supabase outbox | Wired through enqueue/transition/status |
| 12 | `rate-limiter` | durable safety Supabase port | Existing live probe projected |
| 13 | `authorized-recipient-resolver` | trusted server | Existing authorization contract; live durable probe |
| 14 | `production-classifier` | server Anthropic safety classifier | Existing circuit/config health |
| 15 | `monitoring-sink` | durable safety Supabase port | Existing live probe projected |
| 16 | `delivery-provider` | Session 17 | Explicitly `not-ready` |
| 17 | `receipt-validator` | Session 17 | Explicitly `not-ready` |

## Construction rules

The registry rejects duplicates, omissions, incompatible contract versions, missing methods, non-production deployment metadata, wrong trust/durability, test/preview/in-memory flags, and implementation identifiers that advertise local, fixture, synthetic, mock, noop, or preview provenance. Successful ports, their implementations, and the registry are frozen.

Readiness calls are live. A configured dependency is not treated as healthy. Probe exceptions fail closed. Browser-facing readiness omits registration names, versions, recipients, secrets, and diagnostic reasons.

## Session 13 assembly

`createSession13ProductionAssembly(...)` accepts authenticated and trusted-server Supabase client interfaces and constructs the eight existing durable adapters. Supabase clients remain behind adapters and are not passed to UI components. Each of the nine registry slots requires an injected live health probe; the safety reconciliation probe does not claim academic RPC health.

The underlying Session 13 contracts retain structured domain errors, revision/CAS and idempotency behavior, household binding, and minimized evidence rules. Session 16 adds optional lifecycle operation context without weakening those contracts.

## Session 17 replacement map

Session 17 must supply real operational `delivery-provider` and `receipt-validator` branded ports plus live probes. It must reconcile worker/receipt behavior with the existing proposal and outbox stores. No Session 16 placeholder may be promoted; the current two slots intentionally keep the aggregate registry `not-ready`.

Session 17 must also provide its final registry assembly to the host/server boundary. Only then may runtime readiness move toward `ready`.
