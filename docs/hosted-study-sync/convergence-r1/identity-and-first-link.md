# Identity and first-link strategy

## Stable chain

The imported bridge enforces:

```text
authenticated adult
  -> hosted household authority revision
  -> hosted UUID student roster
  -> closure-branded selected student authority
  -> memory-only Study session grant
  -> fresh request headers
```

PIN input and PIN digests remain device-local UX protection. Neither is a
hosted credential and neither is accepted by the sync metadata or RPC payload
contracts.

## Existing local household

The pure first-link planner never matches display names. It requires an
adult-confirmed one-to-one mapping of local household/student refs to hosted
household/student refs. The convergence metadata persists that exact ledger and
refuses silent replacement.

## Blocking import gap

The DB authority input has no RPC to create or link an existing local
assignment/session lineage to hosted `academy_study_sessions`. A local student
mapping alone cannot safely invent hosted assignment or session identity, and
the write RPC requires those rows to exist already. Therefore existing local
progress cannot yet be proven importable without loss or duplication.

A staging-ready follow-up must add an adult-approved, idempotent first-link
import primitive that returns an explicit assignment/session mapping ledger,
or prove that the existing hosted creation path preserves the exact local refs.
