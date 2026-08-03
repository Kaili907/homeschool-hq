# Session 8 integration instructions

## Boundary

Keep this lab local until the dispatch room explicitly assigns a production
integration owner. It performs no persistence, login, import fetch, scraping,
calendar write, parent-dashboard write, identity lookup, or Student Study-UX
integration.

The ZIP expands under `adaptive-tutor/study-engine/` and contains only:

- `integration-labs/calendar-parent-runtime/**`
- `tests/calendar-parent-runtime/**`
- `docs/calendar-parent-runtime/**`

## Verify supplied packages

From the repository root:

```powershell
& adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime/scripts/verify-inputs.ps1
```

The command must report `PASS` for all four pinned SHA-256 values and zero workspace
mismatches. Do not continue from summaries or reconstructed package content.

## Install and validate the isolated lab

```powershell
npm install --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm ls --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime --depth=0
npm run typecheck --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm test --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm run build --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm run audit:node --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
npm run traces --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
```

`@types/node` must appear as an explicit dependency. The final validated
versions are recorded in `validation-report.md`.

## Run the local demo

```powershell
npm run preview --prefix adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime
```

Open `http://127.0.0.1:4189`. The preview is local-only and is not a deployment.

## Adapter call order

1. Validate the engine envelope and call `ingestEngineRecommendation`.
2. Retain its canonical `StudentSkillReview` and local `ReviewQueueEntry`.
3. Call `buildDailyReviewPlan` with required instruction minutes and hard
   review limits.
4. Convert scheduled entries into `calendar-runtime` blocks in the household
   IANA timezone. Keep external and internal IDs separate.
5. Record segment transitions; use `ExactResumeMetadata` and
   `createAutomaticContinuation` for partial work.
6. Produce a canonical `SessionResult` and aggregate retrieval attempt.
7. Call `applyCanonicalReviewResult`; retain its completed entry, next
   canonical review, one next queue entry, and the versioned idempotent
   result-return outbox command. Persist/deliver that command transactionally
   only in a future authorized host.
8. Build parent evidence only from minimized aggregate fields.
9. Route private-note writes to the separately authorized private record.
10. For Romeo, normalize versioned supplied metadata, retain any HTTPS
    `externalUrlReference` only in the adult/adapter record, expose the opaque
    `hostLaunchRef`, and call `projectRomeoAssignmentToCalendar`; never fetch
    the URL.

## Card 5 reconciliation

Card 5 is present and pinned at
`SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip`, SHA-256
`39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41`.
The local adapters consume DEC-009/012/014/017/018/019. In particular:

- `card5-duration-policy.ts` calls the verified DEC-012 policy v1 reference;
- same-day timing remains nullable unless an authorized scheduler/adult
  supplies an offset-bearing slot after the required support boundary;
- canonical result return uses an idempotent command/outbox;
- Romeo public/calendar projections use `hostLaunchRef` and a versioned study
  plan support reference;
- parent-only note audiences are never widened and the student projection is
  empty.

See `CARD-5-REPLACEMENT.md` for verification evidence and parity fixtures.
Card 5 remains `PASS_WITH_BLOCKER`; this does not authorize production or final
assembly.

## Production gates not satisfied by this lab

- Host authorization and household membership
- Persistence, retention, deletion, and concurrency policy
- Production calendar or Parent Hub command routing
- External URL host allowlisting
- General-purpose sensitive-text/DLP review
- Security, accessibility, privacy, and data-governance approval
- Student Study-UX integration
