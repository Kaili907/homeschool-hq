# Production port registry

The registry requires exactly these 17 dependencies:

| Dependency | Boundary | Durability |
|---|---|---|
| session-verifying-authorizer | trusted server | stateless |
| household-learner-resolver | trusted server | durable |
| study-session-adapter | authenticated RPC | durable |
| checkpoint-adapter | authenticated RPC | durable |
| review-queue | authenticated RPC | durable |
| calendar-adapter | authenticated RPC | durable |
| parent-settings-adapter | authenticated RPC | durable |
| adult-private-adapter | authenticated RPC | durable |
| event-ledger | authenticated RPC | durable |
| adult-review-proposal-store | trusted server | durable |
| outbox-store | trusted server | durable |
| rate-limiter | trusted server | durable |
| authorized-recipient-resolver | trusted server | durable |
| production-classifier | trusted server | stateless |
| monitoring-sink | trusted server | durable |
| delivery-provider | trusted server | durable |
| receipt-validator | trusted server | durable |

Registration is branded at runtime. Provenance, trust boundary, durability, readiness state, implementation identifier, and schema version are validated. Missing or duplicate keys fail closed. Identifiers that indicate local, memory, test, preview, fixture, synthetic, noop, or mock implementations are rejected.
