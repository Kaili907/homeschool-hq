# Provisional-adapter retirement report

Status: implemented for Session 7 runtime `0.7.1`.

The verified Card 1, Session 2, Session 3, and Card 5 packages remain
byte-preserved. “Retired” means a provisional shape is no longer authoritative
at the Session 7 boundary; no Wave 1 or Card 5 source was edited or deleted.

| Provisional assumption | Session 7 disposition | Remaining condition |
| --- | --- | --- |
| Session 2 owns session identity or phase | Retired. Inputs are projected from validated Card 1 plan/session/evidence aggregates. | Remove the projection only if Session 2 later accepts those aggregates directly. |
| Session 2 snake-case orchestration events are persisted | Retired. Only Card 1 `StudySessionEvent` values enter canonical history. | None. |
| Session 2 can infer mastery, misconceptions, retrieval success, or independence | Rejected. Those fields remain unavailable without verified Tutor Core evidence. | Verified Tutor Core integration. |
| Synthetic history may unlock pacing | Retired. Interactive first sessions produce `insufficient_data`; optional history must carry canonical IDs and verified Tutor Core authority. | Sufficient comparable verified history. |
| Session 3 browser state owns progress | Retired. Canonical `segment-completed` events own progress. | None. |
| Session 3 free-form UI events are bridge events | Retired. `student-runtime.study-ux-adapter.v2` translates bounded actions to typed commands. | None. |
| A local `TaskId` exists beside `SegmentId` | Retired under Card 5 `DEC-004`. Canonical `SegmentId` is the task identity. | None. |
| Browser scoring can create mastery | Retired. The temporary bridge returns only a bound `continue`/`reteach` receipt. | Verified Tutor Core v0.2 and Session 6 bridge. |
| Browser answers may appear in events or evidence | Retired. Entered work remains device-local and is omitted from canonical events, evidence, logs, recommendations, and traces. | None. |
| Timer completion advances progress | Retired. Visible, minimal, and hidden timers are presentation only; a cap pauses and saves. | None. |
| Breaks are failures or lost progress | Retired. Approved breaks preserve position and use `countsAsFailure: false`. | None. |
| Refresh is a learner break | Retired. Technical interruption events and counters are separate. | None. |
| First-wins parent precedence | Retired. Verified Card 5 `DEC-012` performs gates, constraint reduction, feasible-interval resolution, candidate selection, and clamping with provenance. | None. |

## Intentional versioned adapters

- `student-runtime.study-ux-adapter.v2`: UI actions to canonical commands.
- `student-runtime.engine-projection.v2`: canonical aggregates to Session 2
  inputs/outputs and Card 5 duration policy. The source filename remains
  `engineProjection.v1.ts` only for path compatibility.
- `student-runtime.resume-envelope.v2`: canonical JSON, SHA-256 integrity,
  session binding, monotonic revisions, stale handling, and quarantine.
- `student-runtime.session6-bridge.v2`: temporary local-only Tutor boundary.

The v1 Session 6 file is a module-path compatibility shim that re-exports v2;
the v1 wire protocol is not accepted. Unsupported saved or bridge versions are
quarantined.

## Why the temporary Session 6 bridge remains

Tutor Core v0.2 and a genuine Session 6 bridge were not found in the exhaustive
local archive, manifest, attachment, reconciliation, and owned-root search.
They were not reconstructed from summaries or legacy tutor code.

The temporary implementation is isolated at:

`integration-labs/student-runtime/src/bridges/session6Bridge.v2.ts`

Every receipt binds:

- bridge version and unique request ID;
- canonical `SessionId` and `SegmentId` task reference;
- opaque local response reference;
- submission revision and occurrence time;
- bounded directive and reason code.

The state machine rejects a receipt if any binding differs from the active
submission. The receipt explicitly withholds mastery and misconception
authority.

## Exact Tutor Core / Session 6 replacement steps

1. Obtain the actual Tutor Core v0.2 and Session 6 packages plus dispatch
   hashes. Do not proceed from a handoff summary.
2. Verify each archive SHA-256 and compare every archive entry to its extracted
   working tree.
3. Record package, schema, command, result, and error versions in the canonical
   adapter manifest.
4. Add a new adapter whose filename and exported wire ID use the verified
   incoming version. Do not silently mutate `student-runtime.session6-bridge.v2`.
5. Map canonical `SessionId`, `SegmentId` task identity, learner reference,
   draft reference, submission revision, and occurrence time to the verified
   request contract.
6. Keep raw work inside the trusted call boundary. Permit only validated,
   privacy-minimized receipts, outcome references, evidence references, and
   reason codes to return.
7. Map mastery, misconception, prerequisite, retrieval, and instructional
   directives only from explicitly authoritative Tutor Core fields. Confidence,
   timers, breaks, React, and Session 2 must never author them.
8. Reject unknown versions, stale revisions, duplicate/conflicting command IDs,
   mismatched task/session/draft references, and forged outcomes before any
   canonical mutation.
9. Add official valid/invalid fixtures and run authority-boundary,
   conformance, idempotency, resume, privacy, prompt-injection, deterministic
   trace, accessibility, mobile, and production-build tests.
10. Run the math, reading, and seven adversarial demonstrations against both
    boundaries and compare IDs, events, progress, reason codes, review output,
    and resume position.
11. Switch the composition-root import only after parity passes. Keep an
    explicit migration/quarantine path for v2 local saves.
12. Remove the temporary implementation only after the full Session 7 suite
    passes with the verified packages.

## Card 5 status

Card 5 is present, hash-verified, and active. The runtime imports the verified
`reconciliation/probes/policy.mjs` implementation and records
`card5.resolve-duration-policy.v1` provenance. There is no provisional Card 5
replacement outstanding.
