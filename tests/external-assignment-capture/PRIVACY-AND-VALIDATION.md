# External assignment capture privacy and validation report

## Scope and ownership

This harness owns only `tests/external-assignment-capture/**`. It reads the
provider-neutral engine at `external-learning/capture/**` and the browser
prototype at `app/features/external-assignment-capture/**`; it does not modify
either implementation path.

The test harness is intentionally standalone:

```powershell
npx tsc -p tests/external-assignment-capture/tsconfig.json --pretty false
npx vitest run --config tests/external-assignment-capture/vitest.config.ts
```

The engine exposes dependency-free runtime validators and draft 2020-12 JSON
Schema objects through one registry. Representative extraction, attachment,
due-date, course mapping, actor, and persisted-assignment shapes are exercised
through the public runtime boundary.

## Privacy and data-handling requirements

- Never collect a student's external-school password. Manual payloads with
  credential-shaped keys or values are rejected. Credential lines found in
  OCR/document text are removed before values, excerpts, warnings, or records
  are built.
- Never put credentials in provider URLs. Only HTTPS URLs without user-info or
  credential-bearing query parameters are accepted.
- Treat uploaded bytes as host-owned data. Capture contracts carry attachment
  metadata and opaque attachment IDs; a metadata record does not prove that a
  file was retained.
- Keep extraction evidence minimal. Excerpts exist so a family can verify a
  proposal, are length-bounded, and must follow the host's child-data retention
  policy. Raw OCR text should not be logged by this layer.
- Scope every family or adapter action to an opaque learner reference.
  Provider adapters may propose provider changes but cannot confirm them.
- Preserve provider identity and the original assignment reference. Provider
  updates cannot replace either identity.
- Romeo Virtual Academy is a provisional, manual-only adapter. It has no
  synchronization or authorized-payload method, requests no password, and
  makes no direct-sync claim.
- A future provider connection must use a host-managed opaque authorization
  reference. It must not receive student credentials or bypass provider access
  controls.
- Extracted strings and dates remain proposals. Persistence requires an
  explicit decision for every field, including optional fields intentionally
  cleared.
- Completion requires a schedule link plus the configured evidence policy.
  When parent approval is configured, only approved evidence can pass the
  completion gate; returned evidence stays incomplete.

## Adversarial validation matrix

| Area | Adversarial case | Expected control | Automated coverage |
| --- | --- | --- | --- |
| Runtime shape | Wrong schema version, missing field record, invalid confidence | Reject with path-specific issue | `runtime-validation.test.ts` |
| Proposal provenance | Proposed value with empty evidence | Reject; proposed values require source evidence | `runtime-validation.test.ts` |
| Confirmation | Missing decision, accepting missing value, clearing required identity | Refuse persistence | `extraction-confirmation.test.ts` |
| Manual fallback | Empty manual capture edited during review | Require edits/clears for every field | `extraction-confirmation.test.ts` |
| Missing input | Missing file | Manual-entry fallback; no fabricated values | `extraction-confirmation.test.ts` |
| Unreadable input | Unreadable image | Unreadable fields, zero confidence, source identity retained | `extraction-confirmation.test.ts` |
| Extractor/media failure | Unsupported media or extractor outage | Manual-entry fallback | `extraction-confirmation.test.ts` |
| Credential retention | Password/token keys, `Password:`, `School password is`, token line | Reject manual input or scrub document input without echo | `permissions-privacy.test.ts` |
| URL credentials | HTTP, URL user-info, token/API-key/password query | Reject | `runtime-validation.test.ts` |
| Learner isolation | Parent or adapter references another learner | Deny before action | `permissions-privacy.test.ts` |
| Role boundary | Student schedules/reviews/completes; family applies provider update | Deny | `permissions-privacy.test.ts` |
| Course mapping | Student confirms mapping or mapping crosses learner | Deny | `permissions-privacy.test.ts` |
| Exact duplicate | Same learner/provider/original reference | Return existing assignment identity | `duplicate-conflict-timezone.test.ts` |
| Possible duplicate | Same normalized title/course/due, different provider reference | Require family decision | `duplicate-conflict-timezone.test.ts` |
| Provider conflict | Confirmed title/due changes | Surface conflict; never overwrite automatically | `duplicate-conflict-timezone.test.ts` |
| Stale provider event | Observation predates assignment revision | Reject and never roll record time backward | `duplicate-conflict-timezone.test.ts` |
| Provider update review | Changed field lacks accept/retain decision | Reject incomplete review | `duplicate-conflict-timezone.test.ts` |
| Date only | Last minute of local due day vs next local day | Preserve full local calendar day | `duplicate-conflict-timezone.test.ts` |
| DST | Spring-forward and repeated fall-back hour | Compare in named IANA zone | `duplicate-conflict-timezone.test.ts` |
| Evidence policy | Missing/count/type/purpose/availability/note mismatch | Refuse evidence transition | `evidence-lifecycle.test.ts` |
| Parent review | Student self-approval or parent without capability | Deny | `evidence-lifecycle.test.ts` |
| Returned work | Return without reason; complete before resubmission | Reject; remain incomplete | `evidence-lifecycle.test.ts` |
| Forged completion | Persisted completed record lacks required approved evidence | Runtime validator rejects | `evidence-lifecycle.test.ts` |
| Provider capability | Romeo advertises or exposes direct synchronization | Contract test fails | `provider-adapters.test.ts` |
| UI confirmation | Fixture fields start confirmed or lack confidence/evidence | UI contract test fails | `ui-contract.test.ts` |
| UI privacy | Rendered capture UI contains password input or omits guardrail text | Static-render contract test fails | `ui-contract.test.ts` |

## Validation findings

The review identified four implementation hardening needs, all addressed before the
final targeted run:

1. Proposed extraction fields now require at least one source-evidence entry.
2. Provider observations older than the assignment revision are rejected.
3. Credential-line sanitization now covers natural-language forms such as
   `School password is ...` before a value or evidence excerpt is built.
4. Live browser testing found React evidence inputs reading
   `event.currentTarget` inside a deferred state updater. The handlers now copy
   file/link/note values synchronously before updating state; the complete
   evidence-to-parent-approval walkthrough passed after reload.

The UI/engine read-only integration audit also identified and resolved a Romeo
provider-ID separator mismatch (`romeo-virtual-academy` versus
`romeo_virtual_academy`). The UI now uses the engine's canonical provider ID,
and the UI contract test enforces equality.

## External integration needs

- The host must authorize and persist the real calendar entry, then return an
  opaque `calendarEntryRef`. These tests validate the handoff and local
  transition but do not claim a shared calendar implementation exists.
- The host remains responsible for authoritative household/learner
  authorization, attachment storage, malware scanning, retention/deletion,
  and audit logging.
- No authorized Romeo connection exists in this package. Adding one requires a
  separately reviewed adapter and provider-approved authorization flow.
- The static harness covers the UI contract. A separate live browser pass
  exercised missing-file and unreadable fallbacks, all 12 confirmation gates,
  edit-invalidates-confirmation behavior, conflict resolution, scheduling,
  student evidence submission, student self-approval denial, parent approval,
  and provider-neutral manual intake. This is not a substitute for a full
  accessibility audit.

## Latest focused result

Final verification on 2026-07-28:

- Strict scoped TypeScript: passed
  (`npx tsc -p tests/external-assignment-capture/tsconfig.json --pretty false`).
- Focused Vitest: 7 files passed, 137 tests passed, 0 failed
  (`npx vitest run --config tests/external-assignment-capture/vitest.config.ts --reporter=dot`).
- Live browser rerun after the evidence-input fix: passed with no new console
  errors.
- The first final Vitest launch was blocked by a sandbox `spawn EPERM` while
  starting esbuild; the same command passed outside that process restriction.
- The repository's unscoped `npm test` discovers unrelated `.worktrees/**`
  suites and is not a clean shared-workspace gate. A baseline attempt timed out,
  and a later attempt failed only in out-of-scope review worktrees with missing
  root dependencies. The explicitly scoped existing app suite passed 33 files
  and 506 tests before and after Session 4.
