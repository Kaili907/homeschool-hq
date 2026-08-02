# Final production composition

```mermaid
flowchart LR
  B["Browser: opaque launch reference only"] --> G["Host-owned academic gateway"]
  G --> V["Transactional grant verification"]
  V --> A["Verified identity academic adapter"]
  A --> C["Frozen lower-level RC1 bridge and Tutor Core"]
  A --> P["Durable Session 13 ports"]
  A --> S["Session 14 safety boundary"]
  S --> R["Durable adult-review proposal"]
  R --> O["Session 17 outbox, lease, attempt, receipt"]
```

The sentinel-bound RC1 convenience composition is not a production dependency. The host adapter uses only lower-level immutable interfaces with server-derived identity. Every durable operation must revalidate the opaque grant in the same database transaction; browser branding or lifecycle state is never authorization.
