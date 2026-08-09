# Administrative audit contract

Administrative audit history is an append-only accountability ledger, separate
from operational telemetry and the existing domain-specific identity/Study audit
tables. ADMIN-15 implements the private ledger, atomic internal append helper,
authorized read projection, API, and read-only Audit Log. It does not rewrite
domain audits or force incompatible Admin actions into their closed event
vocabularies.

`AdminAuditEvent` version 2 contains the unchanged audit shape:

- server-generated event ID and acceptance timestamp;
- actor user reference and the server-resolved Admin role used for the decision;
- one canonical action;
- resource type/reference plus applicable immutable version and revision;
- allowlisted previous and new values;
- bounded reason code when required; and
- correlation ID binding the authorization decision, mutation, and audit append.

Actor identity, role, timestamp, and resource revision are server-derived. The
browser may propose a reason, but the server validates and bounds it and never
accepts a caller-supplied actor/role as fact.

## Mutation rules

- Role changes, configuration changes, engine controls, safety triage, incident
  acknowledgement, curriculum draft changes/approval/publication, and release
  activation/rollback are audited.
- The protected mutation and its audit append succeed atomically. If the audit
  event cannot be appended, the mutation fails.
- Audit rows cannot be updated or deleted through application roles. Corrections
  are new events that reference the earlier event/resource.
- Previous/new values contain only fields allowlisted for that action. They do
  not contain secrets, credentials, tokens, raw learner content, conversations,
  audio, assessment answers, protected work, or unrestricted configuration blobs.
- Reads require `audit:read`. No Admin role has an audit mutation capability.

The initial action and resource vocabularies are frozen in
`src/admin/contracts.ts`. New actions require a contract revision and an explicit
old/new-value allowlist.

The implemented schema, local reason-code boundary, safe-value grammar, service
read contract, browser privacy projection, and ADMIN-14 handoff are documented in
[`../admin-audit-foundation.md`](../admin-audit-foundation.md).