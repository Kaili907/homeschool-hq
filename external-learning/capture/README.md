# External assignment capture engine

This directory is the provider-neutral, dependency-free contract and state
transition layer for Manuel Academy external-school work. Romeo Virtual Academy
is the first provisional provider, not an architectural special case.

## Supported flow

1. A parent creates a manual intake, or a parent/student supplies attachment
   metadata and extracted document text.
2. The engine produces field proposals. Every proposed value has confidence and
   source evidence. Missing/unreadable inputs return a manual-entry fallback.
3. A parent/student must accept, edit, or clear **every** field.
4. The confirmed record can produce a schedule handoff. The record becomes
   scheduled only after the host returns a real calendar entry reference.
5. A student/parent submits configured completion evidence.
6. A parent approves or returns that evidence.
7. Completion remains blocked until the schedule, evidence, and approval gates
   pass.
8. A future authorized provider adapter may propose updates. Updates never
   overwrite confirmed data without another user confirmation.

## Main entry points

- `adapters.ts` — generic manual adapter/factory and provisional Romeo adapter.
- `extraction.ts` — manual and document proposal generation.
- `confirmation.ts` — mandatory field-by-field confirmation.
- `mapping.ts` — parent-confirmed external course/section mapping.
- `identity.ts` — provider identity, duplicates, updates, and conflicts.
- `lifecycle.ts` — schedule handoff, evidence, parent review, and completion.
- `permissions.ts` — defense-in-depth role/learner permission checks.
- `validation.ts` — dependency-free runtime validation and credential checks.
- `schemas.ts` — JSON Schema objects plus a runtime schema registry.
- `fixtures/index.ts` — representative manual, readable Romeo, missing-file,
  and unreadable-image fixtures.
- `core-change-requests.md` — shared host contracts still required.

Consumers should import the public surface from `index.ts`.

## Safety invariants

- The model has no password, login, token, cookie, or credential field.
- Runtime validation rejects credential-shaped keys/text and credential-bearing
  URLs. Document extraction discards credential-like lines before proposing
  values or source excerpts.
- Romeo's provisional adapter is `manual_only`, reports synchronization as
  unavailable, and has no `synchronize` method.
- Extracted fields and provider updates are proposals until explicitly
  confirmed.
- Provider identity and the original assignment reference are immutable.
- Completion cannot bypass configured evidence or parent approval.
- No function signs into an external school, fetches provider pages, stores raw
  files, or bypasses provider/host access controls.

## Scoped typecheck

```powershell
npx tsc -p external-learning/capture/tsconfig.json --noEmit
```

See `docs/integration.md` for the end-to-end host sequence and
`docs/privacy-and-data-handling.md` for storage rules.
