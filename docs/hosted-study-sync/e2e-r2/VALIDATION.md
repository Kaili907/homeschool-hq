# Cross-device sync E2E R2 validation

## Scope and classification

This change is test/harness and documentation only. It makes no production code
change, adds no database migration, and makes no hosted contact.

Classification after the recorded local checks: `CROSS_DEVICE_E2E_R2_READY`.

## Current learner-release data model

The R2 learner aggregate embeds current release structures rather than a toy
progress schema. The aggregate includes the core student/assignment record,
final app child records, `DurableStudyDocumentV1`,
`FinalAssessmentAttemptV1`, and `LearnerResponseRecord` values. Hydration is
refused if the aggregate cannot be validated by the current core, final-app, and
durable Study parsers.

The exact-resume proof is the synchronized durable checkpoint:

- household, learner, assignment, lesson, session, and segment references match;
- completed segment references are preserved in order;
- checkpoint revision and active seconds survive hydration;
- the durable session points at the next unfinished segment;
- `rawAnswerIncluded` and `transcriptIncluded` remain literal `false`.

## Scenario ledger

| # | Scenario | Proof |
|---:|---|---|
| 1 | Device A setup/link | Current setup profiles and seeded assignment upload on first link. |
| 2 | Start Study | Core active assignment and durable active session synchronize. |
| 3 | Independent Device B | Empty store, different storage identity, independent auth. |
| 4 | A to B hydrate | Exact learner aggregate equality. |
| 5 | Exact resume | Durable checkpoint resumes at next segment with preserved elapsed time. |
| 6 | Offline A | Local checkpoint and pending mutation remain. |
| 7 | Reconnect | Queued mutation reaches the server once. |
| 8 | B to A | Progress converges in both directions. |
| 9 | Concurrent base | Both devices queue from the same server revision. |
| 10 | Conflict | Stale CAS response rebases semantic progress; completed segments are unioned. |
| 11 | Completion | Standard completion propagates. |
| 12 | No regression | Stale progress cannot reopen a completed assignment. |
| 13 | RFL pending | Learner finish creates `PENDING_GUARDIAN_ATTESTATION`. |
| 14 | RFL certified | Parent certification and completion propagate. |
| 15 | RFL role control | Student self-attestation is refused. |
| 16 | Social metadata | Qualified source metadata propagates without source body content. |
| 17 | Social gate | Pending source blocks start. |
| 18 | Safety hold | Minimized current `SafetyHoldV1` propagates. |
| 19 | Safety stale/offline | Rebased stale work is stopped by the authoritative hold. |
| 20 | Safety clear | Parent clear propagates and is the only resume transition. |
| 21 | Sibling isolation | Student grant hydrates and mutates only its learner. |
| 22 | Wrong household | Opaque forbidden response and no local disclosure. |
| 23 | Auth expiration | Auth clears; safety state is unchanged. |
| 24 | Duplicate retry | Idempotency key prevents a second revision/effect. |
| 25 | Server outage | Local progress and pending work remain. |
| 26 | Clock skew | Server revision/receipt time wins over ±1-year device clocks. |
| 27 | Logout | Ephemeral auth clears; safe local state remains. |
| 28 | Privacy canaries | PIN, bearer, transcript, and restricted answer authority cannot upload. |
| 29 | First-link aggregate | Current setup/assignment/Study aggregate uploads once. |
| 30 | Repeated first link | Device/household link is idempotent. |
| 31 | Lesson response assessment | Pending response and trusted scored receipt propagate. |
| 32 | Assessment attempt | Pending attempt A→B and certified attempt B→A propagate. |

## Negative controls

- Whole-document LWW would lose one concurrent segment; the expected merged
  segment set makes that implementation fail.
- Client timestamp authority would accept the ±1-year device clock values; the
  required server date makes that implementation fail.
- Reusing a store for Device A and B throws before a scenario can run.
- Corrupt remote durable state is refused without replacing the local copy with
  an empty document.
- Injecting restricted scoring authority into a response mutation is rejected.
- Lost acknowledgement replay returns the original idempotent effect.

## Local evidence

The acceptance command passes 36 tests: 32 cataloged scenarios plus the scenario
catalog assertion and three explicit negative controls. `npm run typecheck`
also passes.
