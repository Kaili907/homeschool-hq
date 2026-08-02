# In-app delivery policy gate

Canonical value:

```text
adultReviewInAppDeliveryPolicy = approved | not-approved
```

The value comes only from server production configuration or a Director-approved configuration record. Missing, malformed, and `not-approved` values normalize to `not-approved`.

When not approved, adult-review operational readiness is `not-ready`, no provider send occurs, the proposal remains durable, and no delivered claim is recorded. Approval does not bypass recipient authorization, lease, attempt, receipt, monitoring, retention, or rate-limit gates.

No approval was invented during local reconciliation.
