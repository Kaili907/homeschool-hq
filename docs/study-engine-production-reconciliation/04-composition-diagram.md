# Production composition diagram

```mermaid
flowchart LR
  Browser["Authenticated host session"] --> Gateway["Trusted server boundary"]
  Gateway --> Verify["Session-verifying authorizer"]
  Verify --> Resolve["Household learner resolver"]
  Resolve --> Authority["Server-derived Study authority"]
  Authority --> Compose["Production composition root"]
  Registry["17 branded production ports"] --> Compose
  Runtime["Verified-identity academic runtime"] --> Compose
  Compose -->|all ready| Study["Academic Study Engine"]
  Compose -->|any missing, invalid, or stale| Closed["Not-ready / unavailable"]
  Study --> RPC["Authenticated RPC + RLS"]
  RPC --> Durable["Durable Study, safety, review, outbox, audit data"]
```

The feature flag controls visibility only. It cannot manufacture authority, satisfy readiness, select a local adapter, or turn a synthetic runtime into a production runtime.
