# Engine validation report

Date: 2026-07-28

Scope: `external-learning/capture/**` only.

## Completed checks

| Check | Result |
| --- | --- |
| Scoped strict TypeScript compilation | PASS |
| Focused test/engine TypeScript compilation | PASS |
| Focused capture automated suite | PASS — 7 files, 137 tests |
| Runtime extraction-result validator present | PASS |
| Runtime assignment-record validator present | PASS |
| JSON Schema objects/registry present | PASS |
| Credential-shaped keys/text/URLs rejected or stripped | PASS — automated |
| Manual provider and provisional Romeo adapters | PASS (Romeo has no sync method) |
| Missing/unreadable/unsupported/extractor fallback contracts | PASS |
| Field-by-field confirmation required | PASS |
| Exact/possible duplicate detection | PASS |
| Stale update/provider identity/conflict handling | PASS |
| Evidence and parent approval completion gates | PASS |

Command:

```powershell
npx tsc -p external-learning/capture/tsconfig.json --noEmit
npx tsc -p tests/external-assignment-capture/tsconfig.json --noEmit
npx vitest run --config tests/external-assignment-capture/vitest.config.ts
```

Results: exit code 0; 7 test files and 137 tests passed.

## Representative fixtures

`fixtures/index.ts` includes:

- a readable Romeo screenshot/OCR proposal with title, course, section,
  provider assignment reference, due date/time/time zone, instructions, rubric,
  duration, link, confidence, and evidence;
- a provider-neutral manual literature assignment;
- a missing-file fallback;
- an unreadable-image fallback;
- parent/student actors and a complete confirmation decision set.

## Combined-suite status

Final Session 4 verification on 2026-07-28:

- root TypeScript: passed;
- engine, UI, and focused-test TypeScript: passed;
- focused capture suite: 7 files and 137 tests passed;
- existing root application suite: 33 files and 506 tests passed;
- live browser intake/evidence/approval walkthrough: passed after correcting
  an evidence-input event-lifetime defect found by that walkthrough.

The shared workspace's unscoped `npm test` command also discovers unrelated
test files under `.worktrees/**`. Its baseline run timed out, and a later
unscoped run reported failures in two out-of-scope review worktrees whose
dependencies are not installed at the repository root. No shared Vitest
configuration was changed. The canonical root application regression check was
therefore run explicitly as `npx vitest run --dir src`; all 506 tests passed
both before and after this work.

The focused privacy and adversarial matrix is in
`../../tests/external-assignment-capture/PRIVACY-AND-VALIDATION.md`.

## Open integration findings

Production calendar insertion, profile-to-student authorization, household time
zone, course catalog, attachment storage/retention, parent review persistence,
provider authorization, and schema migration are absent shared contracts. See
`core-change-requests.md`.
