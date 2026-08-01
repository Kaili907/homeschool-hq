# Study Engine RLS matrix

`Y` means the catalog asserts both `relrowsecurity` and
`relforcerowsecurity`. Public writes are RPC-only: each public table has named
INSERT/UPDATE/DELETE deny policies, and authenticated has SELECT table grants
only. Private rows have no browser schema/table grants and no browser policies.

| Table | RLS | Forced | SELECT | INSERT | UPDATE | DELETE | Household | Learner | Adult-private | Trusted server path | Executable result |
|---|---:|---:|---|---|---|---|---|---|---|---|---|
| `public.academy_study_household_settings` | Y | Y | active adult guardian | deny | deny | deny | Y | n/a | Y | timezone RPC | PASS |
| `public.academy_study_sessions` | Y | Y | guardian view or bound student | deny | deny | deny | Y | Y | n/a | session RPCs | PASS |
| `public.academy_study_event_ledger` | Y | Y | manager or bound student | deny | deny | deny | Y | Y | minimized | append RPC | PASS |
| `public.academy_study_checkpoints` | Y | Y | guardian view or bound student | deny | deny | deny | Y | Y | no raw work | CAS/read RPCs | PASS |
| `public.academy_study_reviews` | Y | Y | guardian view or bound student | deny | deny | deny | Y | Y | n/a | managed-record RPC | PASS |
| `public.academy_study_calendar_blocks` | Y | Y | guardian view or bound student | deny | deny | deny | Y | Y | n/a | managed-record RPC | PASS |
| `public.academy_study_parent_settings` | Y | Y | learning manager | deny | deny | deny | Y | Y | Y | managed-record RPC | PASS |
| `public.academy_study_accommodations` | Y | Y | learning manager | deny | deny | deny | Y | Y | Y | managed-record RPC | PASS |
| `public.academy_study_audit_events` | Y | Y | learning manager | deny | deny | deny | Y | Y | metadata validator | internal append | PASS |
| `academy_private.study_protected_learner_work` | Y | Y | none direct | none | none | none | Y | Y | encrypted envelope | scoped projection/erasure | PASS |
| `academy_private.study_adult_notes` | Y | Y | none direct | none | none | none | Y | Y | body hidden | audited adult projection/erasure | PASS |
| `academy_private.study_accommodation_revisions` | Y | Y | none direct | none | none | none | Y | Y | Y | trigger only | PASS |
| `academy_private.study_adult_review_proposals` | Y | Y | none direct | none | none | none | Y | Y | Y | service-role RPC | PASS |
| `academy_private.study_outbox` | Y | Y | none direct | none | none | none | Y | Y | Y | service-role RPC | PASS |
| `academy_private.study_mutation_receipts` | Y | Y | none direct | none | none | none | scoped actor | scoped operation | Y | definer RPCs | PASS |
| `academy_private.study_persistence_metadata` | Y | Y | none direct | none | none | none | n/a | n/a | Y | migration owner | PASS |

The executable catalog test checks every row above for enabled/forced RLS,
public command policy coverage, and private ACL denial. Role probes then cover
anonymous denial, both households, learner-grant binding, inactive and
permissionless guardians, direct-write denial, private-table denial,
security-definer forgery, event collisions, checkpoint CAS/integrity, outbox
recipient binding, retention erasure, and audit minimization.

The public SELECT policy is intentionally more restrictive for parent settings,
accommodations, and audit history. Student effective-settings uses a minimized
RPC projection that omits `parent_override`, provenance, recipient, and audit
history.
