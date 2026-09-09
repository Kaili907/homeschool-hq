# W2-B4 adaptive subsystem fallback repair validation

Validation date: 2026-08-15

- Session: `STUDY-TUTOR-V2-W2-B4`
- Starting R2 candidate: `a251987b28909e827c0af0ee8bbeea668522459f`
- Branch: `mac/tutor-v2-w2-subsystem-fallback-repair-r2`
- Final repair SHA: the commit containing this record

## Root cause and repair

The R2 candidate invoked all eleven adaptive subsystem ports directly after
validation, authority binding, replay, and Study safety gates. Synchronous
throws and the asynchronous repair/reteach rejections could therefore reject
the top-level composition Promise instead of returning a Study-reviewed static
fallback packet.

The repaired orchestrator contains every port invocation independently. It
uses a fixed generic policy code and the exact `AdaptiveFeature` attribution
for the failed boundary. It never reads, coerces, serializes, or returns the
thrown value. Repair and reteach invocations are awaited inside their
containment scopes, so synchronous throws and rejected Promises take the same
fail-closed path.

Every valid-request subsystem fallback is built only from:

- `request.studyAuthority.eventRef`
- `request.reviewedStaticFallback.fallbackRef`
- `request.reviewedStaticFallback.reviewedContentRefs`

Malformed requests continue to use only the canonical invalid-request
constants. Study safety holds remain quarantined, contain no reviewed academic
fallback content, and run zero adaptive subsystems. Replay duplicate,
collision, and ledger-unavailable behavior is unchanged.

## Focused exception matrix

The new `subsystem-fallback.test.ts` suite passed 27/27. It covers:

- 11/11 independently injected synchronous subsystem failures;
- rejected Promises from prerequisite repair and reteach;
- `Error`, string, number, `null`, `undefined`, plain-object, custom-class, and
  hostile `toString` throws;
- sensitive `credential`, `privateNote`, and `rawLearnerAttempt` values;
- late reteach failure after hint, intervention, mastery, and repair computed;
- Study safety hold with every injected subsystem configured to throw;
- disabled hint, repair, and reteach call counts;
- absent Parent Why call count; and
- canonical invalid-request fallback separation.

An explicit disposable-copy RED run against the exact starting SHA injected a
throwing `buildConceptGraph`: the test failed because
`secret-parent-pin-4938` escaped with exit 1. The same regression passes after
the repair with `concept-graph-unavailable`, validated Study fallback authority,
and no later subsystem calls. The `evaluateAdmission` injection is likewise
covered by the green 11/11 boundary matrix.

## Validation results

All commands used Node `v22.23.2`.

| Check | Result |
| --- | --- |
| Strict Tutor V2 TypeScript | PASS |
| Focused W2-B4 exception suite | 27/27 PASS |
| Adaptive orchestrator plus W2-B4 | 36/36 PASS |
| Complete Wave 2 lane plus repair tests | 219/219 PASS |
| Tutor V2 convergence bundle | 280/280 PASS |
| B1/B2/B3 blocker regression bundle | 10/10 PASS |
| Wave 1 hard boundaries | 253/253 PASS |
| Study bridge | 209/209 PASS |
| Tutor Core | 21/21 PASS |
| Tutor Core build | PASS |
| Tutor Core static prototype smoke | PASS |
| `git diff --check` | PASS |

The 10/10 blocker bundle re-ran global safety reconciliation, allowed-actions
enforcement, canonical invalid fallback, cross-child/session/context history
scope, legitimate prior interactions, concept-cue and guided assistance
binding, historical independence, most-assisted same-opportunity binding, and
duplicate-opportunity rejection.

## Ownership and isolation

Tracked changes are confined to:

- `adaptive-tutor/study-engine/tutor-v2/adaptive/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b4-subsystem-fallback/**`

No Wave 1 source, permanent Wave 2 gate/release artifact, schema generator,
production source, Netlify, Supabase, curriculum release, deployment, or
environment configuration was modified or contacted. No merge or deployment
was performed.
