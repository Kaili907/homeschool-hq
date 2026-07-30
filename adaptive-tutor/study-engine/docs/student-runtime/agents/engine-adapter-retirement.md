# Engine Adapter Retirement Agent Report

Status: implemented in the Session 7 local integration lab.

Scope was limited to the Session 7 engine projection, one isolated unit test,
and this report. No Wave 1 package, canonical contract, Tutor Core package,
subject package, calendar/parent runtime, production system, database,
authentication, GitHub resource, or deployment was edited.

## Inputs verified

| Artifact | Observed SHA-256 | Dispatch comparison |
| --- | --- | --- |
| `CARD-1-STUDY-CONTRACTS.zip` | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | Exact |
| Session 2 Study Engine ZIP | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | Exact |
| Session 3 Study UX ZIP | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | Exact |
| Card 5 reconciliation audit | `2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7` | Exact to the pinned local Card 5 record |

The actual Tutor Core v0.2 package and a separately verifiable Session 6
bridge were not present in the accessible workspace. They were not
reconstructed from summaries. The only observed Session 6 implementation is
the explicitly temporary, local-only
`student-runtime.session6-bridge.v1`.

## Retired engine assumptions

The semantic adapter version is now
`student-runtime.engine-projection.v2`. Its filename remains
`engineProjection.v1.ts` for import-path stability during this integration
window.

1. **Synthetic comparable sessions removed.** The v1 projection manufactured
   four successful historical sessions. Together with the current session,
   that allowed a first session to cross Session 2's five-comparable-session
   gate. V2 supplies no history by default, so the browser receives
   `insufficient_data`.
2. **Explicit history intake added.**
   `student-runtime.comparable-focus-history.v1` requires stable canonical
   `SessionId` and `EvidenceId` references, canonical `SubjectId`, bounded
   duration/disruption fields, and explicit verified-Core outcome provenance.
   IDs are used to remove repeated-session records, then stripped before the
   privacy-minimized Session 2 algorithm call. The current session cannot be
   replayed as history.
3. **Temporary bridge directives no longer become academic truth.**
   `continue`/`reteach` is not mapped to accuracy, success, failure,
   independence, hints, intervention counts, mastery, misconception,
   prerequisite status, or reteaching outcome.
4. **Current pacing evidence is conservative.** Until the verified Core bridge
   supplies an outcome, the current session projects `coreOutcome:
   inconclusive` and `durationResponse: unknown`. Technical interruptions make
   the duration record limited; approved breaks remain reliable,
   non-failure context.
5. **Pacing remains bounded.** Session 2 still requires at least five usable
   comparable sessions and the adapter pins `maximumIncreaseRatio` to `0.10`,
   in addition to the active hard maximum.
6. **Canonical evidence is aggregate-only.** Segment-completion events remain
   the progress source. Reflection ratings remain student reports. Raw work,
   names, email, and temporary bridge reason text do not enter emitted
   evidence.
7. **Review scheduling is learner-local and authority-safe.** The scheduler
   receives the learner's IANA time zone and date. Without a verified Core
   result, accuracy and independence are `null`, no retrieval failure or
   prerequisite claim is created, and `StudentSkillReview.retrievalAttempts`
   remains empty.
8. **Break history no longer uses array-position timestamps.** Completed
   canonical break events are adapted at the aggregate active minute. Repeated
   approved breaks can still request adult review without becoming failure
   evidence.

## Card 5 DEC-012 integration

The provisional first-wins chain was removed. The resolver calls the verified
Card 5 policy version 1 and records:

1. supported-version, integrity, and authorized-actor gates;
2. safety minimum/maximum constraints;
3. active required-accommodation maximum;
4. the authorized adult hard maximum;
5. feasible interval;
6. active manual target, otherwise an accepted **and evidence-sufficient**
   engine recommendation, otherwise established target, otherwise grade-band
   default;
7. the selected candidate, clamp, bounds, and reason provenance.

A bare number is no longer accepted as an engine recommendation because it
cannot prove recommendation-decision state or evidence sufficiency. An empty
or invalid constraint intersection returns `status: manual-review`, omits
`automaticTargetMinutes` and `candidateMinutes`, and retains only a bounded
numeric runtime fallback. Consumers must not present that fallback as an
automatic recommendation.

## V1 to V2 migration

1. Keep the v1 filename/import path during one compatibility window.
2. Treat saved `manuel:projection-version:
   student-runtime.engine-projection.v1` records as historical only; never
   recompute their synthetic focus evidence as trusted history.
3. Regenerate deterministic traces and manifests with the v2 semantic ID.
4. Pass an `AcceptedEngineDurationRecommendationV1` object, not a bare number,
   to the Card 5 duration resolver.
5. Supply pacing history only through
   `student-runtime.comparable-focus-history.v1`; quarantine unsupported
   versions at the caller boundary.
6. Remove the compatibility filename only after saved-state migration,
   v1/v2 trace comparison, privacy tests, and browser recovery tests pass.

## Tutor Core / Session 6 replacement dependency

Replacement remains blocked on the actual Tutor Core v0.2 and Session 6
artifacts. When they arrive:

1. verify hashes, archive safety, manifests, exports, dependency graphs, and
   Node/browser compatibility;
2. add a new bridge filename and schema version rather than mutating the
   temporary v1 protocol;
3. exhaustively map verified outcome values, preserving an opaque outcome
   reference and quarantining unknown versions/values;
4. let Core alone supply mastery, misconception, prerequisite, uncertainty,
   correctness, independence, hint/intervention, and reteaching authority;
5. keep raw work inside the trusted invocation boundary;
6. connect verified, deduplicated historical session/evidence references to
   `ComparableFocusHistoryV1`;
7. append a canonical retrieval attempt only after verified scored counts and
   support level exist;
8. rerun canonical schema, privacy, idempotency, deterministic trace,
   refresh/resume, accessibility, browser, and production-build gates before
   deleting the temporary adapter.

## Targeted test

`engineAdapterRetirement.agent.test.ts` covers:

- no fabricated first-session history;
- explicit, unique comparable history and duplicate-session exclusion;
- the ten-percent increase cap;
- bridge-authority withholding from evidence and review records;
- learner-local review dates;
- PII/raw-response exclusion;
- Card 5 manual/engine/established/default candidate gates;
- hard clamping and infeasible-constraint manual review.

