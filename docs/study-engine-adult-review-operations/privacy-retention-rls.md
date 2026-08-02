# Privacy, Retention, and RLS Report

The design stores no raw disclosure, transcript, classifier prompt/output,
provider response body, contact value, credential, or adult-private note body.
Worker persistence and telemetry minimize arbitrary provider results to stable
references and closed codes. Guardian responses contain only the approved
projection. Learners receive no adult-review existence signal.

## Retention

| Record | Default retention |
|---|---:|
| Proposal | 2 years |
| Route job | 2 years |
| Attempt / receipt / lifecycle events | 2 years |
| In-app notification | 1 year |
| Monitoring | catalog value: 90, 180, or 365 days |
| Adult-review audit | 2 years |
| Rate-limit bucket/reservation | 2 days |

`academy_study_purge_adult_review_retention_v2` is a bounded, postgres-owned,
worker-scope-authorized erasure path. It deletes only expired records, in
foreign-key-safe order, and only terminal jobs/proposals. The append-only trigger
permits deletion exclusively under its transaction-local retention flag and
only for a closed table allowlist. Each purge appends a count-only audit event.
Ordinary update/delete remains forbidden.

## RLS matrix

| Data | anon | authenticated guardian | learner | service role |
|---|---|---|---|---|
| Private operations tables | none | none | none | RPC only |
| Notification list/mark-read | none | own active membership/relationship/permission via RPC | none | no direct table grant |
| Resolver/jobs/attempts/receipts | none | none | none | worker-scoped security-definer RPC |
| Worker registry/capabilities/audit | none | none | none | no direct table grant |
| Monitoring/rate-limit storage | none | none | none | trusted RPC only |

Private tables have forced RLS, postgres ownership, revoked direct application
grants, server-only security-definer functions, and pinned `search_path`.
