# Session 6 Bridge Integration Agent report

Date: 2026-07-29  
Scope: Session 7-R1 read-only bridge audit and integration gate  
Status: **blocked pending the exact Session 6 and Tutor Core archives**

No runtime or test implementation was changed during this audit. The temporary
bridge remains active because the two artifacts required to replace it were not
available for verification or API inspection.

## Artifact verification

| Artifact | Dispatch SHA-256 | Local result |
| --- | --- | --- |
| `MANUEL-ACADEMY-SESSION-7-STUDY-STUDENT-RUNTIME.zip` | `9448B7F91519FDF7213A8939ED5458B9749E58DBF8054F64A56E3F548482097D` | **Verified exact** at `docs/student-runtime/`; 4,910,937 bytes |
| `SESSION-6-R1-STUDY-CORE-BRIDGE.zip` | `A8777FE13360B6D24097190CDF6D6088F0FE8B3397CF58B11AD0DFFB897D19BE` | **Not present; not used** |
| `manuel-academy-adaptive-tutor-core-v0.2.zip` | `38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276` | **Not present; not used** |

Evidence for the missing-artifact result:

- An exact-name recursive search of the repository found only the verified
  Session 7 ZIP.
- An exact-name recursive search under `C:\Users\Empower Gaming` found no
  Session 6, Tutor Core v0.2, or Session 5-R2 ZIP.
- A source search excluding ZIPs and `node_modules` found no
  `@manuel-academy/study-core-bridge` package and no
  `bridgeContractVersion` implementation.
- The only student-runtime bridge sources present were the existing temporary
  implementation and its module-path shim.
- No package was reconstructed from a handoff, summary, legacy tutor source, or
  reconciliation document.

The dispatch-specified identifiers
`@manuel-academy/study-core-bridge`, package version `1.0.0`, and
`bridgeContractVersion: 1` remain **expected but unverified** until the archive
hash matches and those declarations are read from the verified bytes.

## Current temporary seam

The active implementation is:

- `src/bridges/session6Bridge.v2.ts`
  - SHA-256:
    `275DC461ECB52525F08124990536F2DA68A1FF90A7142ABE4118D48C872545B8`
- `src/bridges/session6Bridge.v1.ts`
  - SHA-256:
    `AD852B31563D198A4305F2B2D83635F8D2D979A53BC0D3B76543C22B5E3822F4`
  - This is a source-path shim that re-exports v2; it does not accept a v1 wire
    value.

The exact current API is:

```ts
runTemporarySession6Bridge(
  request: unknown,
): TemporarySession6BridgeResult
```

Its request contains:

- `schemaVersion: "student-runtime.session6-bridge.v2"`
- unique `requestId`
- canonical `SessionId`
- canonical `SegmentId` as the sole task identity
- opaque device-local response draft reference
- submission revision
- raw local response, solely for the in-browser demonstration boundary
- a local expected-answer or minimum-length rule
- occurrence time

Its successful receipt contains:

- bridge version and request ID
- session, task, response-reference, revision, and occurrence bindings
- only `continue` or `reteach`
- an explicit `withheld-pending-tutor-core` value for both mastery and
  misconception authority
- a bounded demo reason code

The current composition-root flow is:

1. `submitCurrentResponse` requires an active canonical session and learning
   screen.
2. It reads the current device-local response, assigns the canonical
   `SegmentId`, draft reference, attempt/request ID, revision, and timestamp.
3. It calls `runTemporarySession6Bridge` directly.
4. A bridge rejection appends only a safe quarantine/diagnostic record.
5. A receipt produces bounded ready/support presentation feedback.
6. `completeCurrentSegment` advances only when
   `hasMatchingStrictBridgeReceipt` validates the exact receipt binding.
7. Canonical `segment-completed` history remains the sole progress authority.

The resume boundary separately provides canonical serialization, SHA-256
integrity, session binding, exact revision binding, monotonic stale-revision
rejection, history validation, and unsupported-version quarantine.

## Capability gaps that the genuine adapter must close

The temporary bridge does **not** provide the following Session 6 capabilities:

- Pre-Core urgent-safety gateway;
- Tutor event validation;
- verified minimized Study evidence;
- Session 6 PII and raw-response filtering;
- learner-media transient projection;
- unknown Tutor-event quarantine;
- genuine bridge-version quarantine;
- genuine exact-checkpoint boundary;
- outbox proposals or downstream hook proposals.

The current runtime has local privacy, resume, quarantine, and idempotency
guards, but those are not evidence that the Session 6 APIs have been integrated.
The current local bridge also evaluates a demo expected answer/minimum length;
that behavior must not survive as a substitute for Tutor Core authority.

## Authority boundaries that may not change

| Authority | Sole owner | Adapter rule |
| --- | --- | --- |
| Mastery, misconceptions, prerequisites, instructional directives, instructional safety | Tutor Core | Preserve only verified Tutor Core values after Session 6 validation; the UI and adapter cannot synthesize them |
| Pacing recommendations | Session 2 | Supply only comparable, minimized, authoritative evidence and retain the sufficient-evidence gate |
| Session progress, timer presentation, learner breaks, pause/resume, local checkpoint orchestration | Study runtime | Canonical session events remain authoritative; bridge output cannot complete a segment directly |
| Safety gateway, event/evidence/media filtering, quarantine, checkpoint and proposal boundary | Verified Session 6 bridge | Invoke the exact verified API and preserve its result/error vocabulary |

The adapter must not convert UI confidence, timing, a break, a local rubric, or
a `continue` result into mastery, misconception, prerequisite, retrieval, or
instructional-safety claims.

## Required composition-root call order

Exact exported function and type names must be taken from the verified Session 6
package. The semantic order below is mandatory and must not be implemented by
inventing guessed API names:

1. Build one privacy-bounded request with canonical session/task IDs, an opaque
   learner reference, deterministic command/idempotency key, current revision,
   and occurrence time.
2. Invoke the **Pre-Core urgent-safety gateway before Tutor Core**. A blocked or
   quarantined result ends processing before any Core call, canonical progress
   mutation, checkpoint, outbox proposal, or learner-visible raw diagnostic.
3. Invoke Tutor Core only through the Director-frozen boundary. Do not modify or
   copy its algorithms into the student runtime.
4. Pass the resulting Tutor event through Session 6 event/version validation.
5. Quarantine unknown event kinds and unsupported bridge/event versions before
   projection or state mutation.
6. Apply Session 6 PII/raw-response filtering and construct minimized Study
   evidence. Raw answers, transcripts, prompts, names, email addresses, contact
   fields, and learner-media bytes may not enter canonical events, evidence,
   traces, logs, checkpoints, or outbox values.
7. Treat learner-media output as transient projection only; never persist its
   bytes or derive academic authority from UI playback state.
8. Validate authoritative Core references and reason codes. Only a verified
   Core result may populate mastery, misconception, prerequisite, or
   instructional-directive fields.
9. Apply the Study runtime command through the existing canonical state
   machine. Progress advances exactly once from the canonical completion
   command, not from the bridge response.
10. Create the exact Session 6 checkpoint at the documented boundary and bind
    it to the canonical session, task, draft reference, revision, and command.
11. Accept only Session 6 outbox/downstream-hook **proposals**. Deduplicate on
    the bridge-specified stable identity and reject same-ID/different-payload
    conflicts. A retry must not create a second proposal.
12. Emit only fixed safe errors and reason-coded diagnostics; retain local raw
    inputs solely within the trusted transient call boundary.

No checkpoint or outbox write may precede safety, version, event, privacy, and
authority validation.

## Parity plan

The genuine adapter must be added under a new, version-explicit source name
without mutating the temporary v2 wire contract in place. Before switching the
composition-root import, run the same deterministic math, reading, refresh, and
adversarial fixtures against both paths and compare:

- canonical session ID, planned and completed `SegmentId` sequence;
- canonical event vocabulary, event order, and exact once-only progress;
- pause, approved-break, and technical-interruption distinctions;
- exact resumed segment, local draft, focus, and revision;
- timer/accessibility presentation behavior;
- evidence/review absence of PII, answers, transcripts, prompts, and media;
- pacing sufficient-evidence behavior;
- learner-local review result;
- safe reason codes and quarantine outcomes;
- checkpoint identity and boundary;
- outbox/hook proposal stable IDs and duplicate handling.

Expected differences must be narrowly allow-listed: genuine authoritative Tutor
Core fields and genuine Session 6 reason/version/proposal fields. They may not
change canonical progress, break semantics, exact resume, or accessibility.

## Required positive and negative tests

Add official fixtures only after they are read from the verified packages.
Required tests:

1. Package identity: adapter asserts verified package `1.0.0` and
   `bridgeContractVersion: 1`.
2. Call order: urgent-safety gateway occurs before Core; a block proves the Core
   spy was never called.
3. Event validation: a valid official Tutor event reaches the minimized Study
   projection.
4. Privacy: raw answer, transcript, prompt injection, name, email, phone,
   address, and media bytes cannot cross the Session 6 output boundary.
5. Unknown event: quarantined with fixed safe output and zero canonical
   mutation.
6. Unsupported bridge/event version: quarantined before Core output is applied.
7. Authority: only Tutor Core-authored mastery/misconception/prerequisite and
   instructional directives can be projected; UI-forged equivalents fail.
8. Exact checkpoint: official checkpoint fixture matches session/task/draft,
   revision, timestamp, and command identity; stale, forged, and cross-session
   checkpoints fail.
9. Progress: a bridge success alone cannot complete a segment.
10. Outbox idempotency: same stable ID and same payload is a no-op; same ID and
    changed payload is rejected; refresh/retry creates no duplicate proposal.
11. Resume: saves carrying the temporary bridge version follow an explicit
    migration or quarantine path and are never silently treated as genuine
    bridge receipts.
12. Determinism: traces contain the genuine bridge/contract versions, stable
    proposal IDs, no raw fields, and byte-identical output across two runs.
13. Regression: the complete existing unit, browser, accessibility, mobile,
    reduced-motion, no-audio, and production-build suites remain green.

## Temporary bridge retirement gate

Do not remove either temporary source file or switch the composition root until
all of the following are true:

1. Both missing ZIPs are present and their SHA-256 values match dispatch.
2. Their central-directory entries and extracted trees are audited before any
   import.
3. Session 6 package/version/contract declarations and exact public exports are
   recorded from verified source.
4. Tutor Core v0.2 remains byte-preserved and is invoked only through the
   documented boundary.
5. The genuine adapter maps every required Session 6 capability.
6. Positive, parity, authority, privacy, call-order, checkpoint, quarantine,
   outbox/idempotency, and negative fixtures pass.
7. The math, reading, refresh, and adversarial demonstrations pass without
   canonical progress or accessibility regression.
8. Existing temporary saves have an explicit migration/quarantine rule.
9. The manifest, event dictionary, traces, state diagram, validation report, and
   screenshots refer to the genuine version.
10. A repository search shows no composition-root import, runtime string, trace,
    or test fixture depends on `student-runtime.session6-bridge.v2`.
11. The complete clean-install Node 22 validation and clean extracted-package
    browser run pass.
12. Only then delete the temporary implementation and its compatibility shim.

Until those gates pass, deleting the temporary files would make the validated
Session 7 lab nonfunctional and would violate the twelve-step retirement
procedure. Their present retention is therefore intentional and auditable.

