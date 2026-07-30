# Provisional-adapter retirement report

Status: final retirement completed for Session 7-R1.

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
| Browser scoring can create mastery | Retired. Only frozen Tutor Core output accepted through Session 6-R2 may carry instructional authority. | None. |
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
- `@manuel-academy/study-core-bridge` version `1.0.1`, bridge contract `1`:
  safety, permit, Tutor validation, ledger, minimized projection, quarantine,
  and proposed outbox boundary.

The temporary `student-runtime.session6-bridge.v1` and
`student-runtime.session6-bridge.v2` protocols are not supported runtime
paths. Unsupported saved or bridge versions are quarantined.

## Accepted bridge replacement

The genuine Session 6-R2 bridge was verified as:

- package: `@manuel-academy/study-core-bridge`;
- version: `1.0.1`;
- bridge contract: `1`;
- archive SHA-256:
  `0847B14EC8FEFA79E85210ED1565CE8302DC3F81331BC04FCBD895F05B7AD571`.

Frozen Tutor Core v0.2 was independently verified with SHA-256
`38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276`.
Neither artifact was reconstructed or modified.

The supported order is:

1. urgent-safety classification;
2. one-time event-bound permit;
3. Tutor Core;
4. authority adapter;
5. event-ledger acceptance;
6. privacy-minimized Study projection;
7. proposed outbox/downstream hooks.

No projection or enqueue operation may occur before ledger acceptance.
Identical duplicates are ignored; conflicting event-ID collisions, unknown
Tutor kinds, unsupported versions, and replayed permits are quarantined.
Adult-review hooks remain `proposed-not-delivered`.

## Session 5-R2 status

Accepted Session 5-R2 is present, hash-verified, and active at
`39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41`.
The earlier `2231E758...E2E7` value belongs to the nonaccepted
`CARD-5-STUDY-RECON-AUDIT.zip` version `0.5.0-blocked.1`. It is retained only
as historical explanation, never as current provenance.
