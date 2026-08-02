# Session 7-R1 Reconciliation Provenance Agent Report

Date: 2026-07-29  
Scope: read-only artifact identification and decision comparison  
Runtime and test files modified: none

## Result

The prior value
`2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7`
is conclusively the SHA-256 of the older ZIP container:

`adaptive-tutor/study-engine/docs/reconciliation/artifacts/CARD-5-STUDY-RECON-AUDIT.zip`

It is **not** an extracted-tree digest, source-only-package digest, or manifest
digest. The exact file is 79,261 bytes. Its raw ZIP central directory has 39
entries: three directory entries and 36 file entries. Direct hashing of those
79,261 bytes produced the supplied `2231...` value.

The ZIP's embedded
`adaptive-tutor/study-engine/reconciliation/reconciliation-manifest.v1.json`
identifies it as:

- manifest ID `CARD-5-STUDY-RECON-AUDIT`;
- package ID `manuel-academy.study-reconciliation`;
- package version `0.5.0-blocked.1`;
- status `BLOCKED`;
- purpose `Wave 2 contract reconciliation and integration plan only`;
- final-assembly authorization `false`;
- production-integration authorization `false`.

The container includes reconciliation documents, machine records, executable
probes, and tests. Session 7's earlier “36/36 byte-identical” statement means
that each non-directory member of this older ZIP matched the corresponding
mounted workspace file. It does not change what the `2231...` checksum hashes:
the checksum hashes the ZIP container bytes.

## Accepted R2 availability

Required accepted artifact:

`SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip`

Expected SHA-256:

`39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41`

Result: **NOT PRESENT; NOT USED**.

The exact filename was searched in the workspace, `.codex-remote-attachments`,
`incoming`, Downloads, Desktop, Documents, and the user temporary directory.
The expected checksum was also searched in accessible workspace files. All ZIP
files accessible in the workspace were hashed; none had the expected checksum.

Therefore:

- accepted R2 bytes were not opened or inferred;
- accepted R2 manifests were not reconstructed from summaries;
- accepted R2 decision parity was not run;
- no claim that the older `0.5.0-blocked.1` audit equals accepted R2 is valid;
- affected tests cannot truthfully be described as rerun against accepted R2
  until the exact expected ZIP is staged and verifies to `39D161...`.

This is an input-availability blocker, not a test failure.

## Observed Session 7 comparison to the older `2231...` audit

This table is deliberately limited to the bytes that were available. “Match”
below means match to the older `CARD-5-STUDY-RECON-AUDIT.zip`; it does not mean
accepted-R2 parity.

| Area | Older audit requirement | Session 7 observation | Result against older audit |
| --- | --- | --- | --- |
| `DEC-004` | `SubjectId`, `SkillId`, and `SegmentId`; `SegmentId` is the sole task-instance identity; no parallel `TaskId` | Catalog uses fixed canonical subject and skill IDs plus canonical `SegmentId` values. The bridge task reference is a `SegmentId`; no parallel task-instance ID appears in the runtime model. | Match |
| Stable IDs (`DEC-002`) | Caller-authored, immutable opaque IDs; do not derive them from names, email, dates, titles, grades, or positions | Catalog uses fixed opaque branded IDs, with caller-created opaque session IDs for interactive runs and fixed IDs only for deterministic fixtures. | Match |
| Event vocabulary (`DEC-005`, `DEC-006`) | Persist only Session 1 `StudySessionEvent` values, with canonical sequence and idempotency; UI/engine events remain commands or projections | The canonical reducer emits `session-planned`, `session-started`, `segment-started`, `active-response-recorded`, `segment-completed`, pause/break/technical-interruption lifecycle events, `session-resumed`, and `session-completed`. Local UI actions are not dual-persisted in `StudySession.eventLog`. | Match for exercised runtime events |
| Privacy projection (`DEC-009`, `DEC-020`) | Evidence and outbound projections exclude raw answers, prompt bodies, transcript text/audio, names, email, diagnoses, and app names | Canonical response events carry an opaque evidence reference and fixed detail code. Learning evidence/review projections contain bounded aggregates and omission markers, not entered work, PII, or transcript bodies. | Match at canonical event/evidence/review boundaries |
| Resume rules (`DEC-007`) | Canonical `ResumePoint` plus a bound cursor; raw drafts live in a separate authorized local draft vault and never in the cursor | Canonical `ResumePoint` contains `segmentId`, elapsed active seconds, and `responseDraftRef`. The v2 envelope binds subject/session/revision/time and verifies SHA-256 plus canonical history. However, the saved envelope serializes the whole local workspace, including device-local response fields, instead of storing raw drafts behind a separate vault reference. Several cursor fields are represented indirectly rather than as the exact v1 sidecar shape. | Partial; requires accepted-R2/Session-6 checkpoint reconciliation |
| Adult control (`DEC-012`) | Validate gates, intersect safety/accommodation/adult constraints, select an authorized candidate, clamp, and preserve provenance; no simple first-wins chain | `engineProjection.v1.ts` imports the mounted reconciliation `POLICY_VERSION` and `resolveDurationPolicy` probe. It applies version/integrity/authorization gates, safety and accommodation bounds, the parent hard maximum, accepted evidence-sufficient engine eligibility, feasible-interval handling, candidate selection, clamping, and ordered reason codes. | Functional match |

## Findings requiring R1 attention

1. `catalog.ts` still writes
   `manuel:card5-precedence-status: "provisional-awaiting-card5"` into mock
   `ParentTeacherControls` metadata even though Session 7 invokes the older
   verified Card 5 policy. This is stale provenance metadata and should be
   corrected only after accepted R2 is verified.
2. Session 7's duration policy behavior follows the older `DEC-012` constraint
   reducer, but its source import points directly at the mounted older
   `reconciliation/probes/policy.mjs`. An R1 adapter should target the verified
   accepted-R2 package surface without editing Session 5 files.
3. Emitted canonical evidence, review records, and canonical events respect the
   older privacy decisions. The device-local exact-resume envelope contains the
   local workspace and entered work; this is not an outbound data leak, but it
   is not the older `DEC-007` separate-vault cursor architecture.
4. The current permanent `America/New_York` constant is consistent with the
   Manuel Academy sample default but cannot establish accepted-R2 timezone
   parity and does not satisfy R1's configurable-timezone correction.

## Exact accepted-R2 parity procedure still required

After the exact accepted ZIP becomes available:

1. hash its raw bytes and require exact equality with `39D161...`;
2. audit and extract it without modifying Session 5-owned files;
3. identify its package and decision-set versions from its own manifest;
4. compare its `DEC-004` and `DEC-012` records byte-for-byte and semantically
   with the older audit;
5. compare the accepted canonical-ID, event-vocabulary, privacy, resume, adult
   precedence, and timezone records;
6. point the Session 7-owned adapter at the accepted R2 surface;
7. remove stale provisional provenance strings;
8. rerun the affected policy, ID, event, privacy, resume, timezone, trace, and
   browser tests;
9. record any accepted-R2 differences rather than assuming parity.

## Disposition

Prior `2231...` identity: **PROVED — older ZIP container**.  
Accepted R2 hash verification: **BLOCKED — artifact absent**.  
Accepted R2 semantic parity: **NOT RUN**.  
Runtime/test mutations by this agent: **ZERO**.
