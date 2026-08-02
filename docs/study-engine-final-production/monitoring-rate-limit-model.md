# Monitoring and rate-limit model

Monitoring replay identity includes event ID and kind, household, learner, proposal/job/attempt references when applicable, severity, schema version, occurrence bucket, idempotency key, and a canonical structured-dimensions digest. An identical replay is idempotent; conflicting evidence is rejected or quarantined.

The durable rate-limit scope registry is the union of valid Session 14, 15, and 17 scopes. Replacing a constraint must never invalidate legacy safety-classifier buckets. Runtime and migration tests enumerate every active caller.
