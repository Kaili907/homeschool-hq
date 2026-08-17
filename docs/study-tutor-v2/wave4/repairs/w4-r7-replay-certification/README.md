# W4-R7 current replay/crash certification repair

This repair updates the current W4-04 detector to the post-W4-R1/R4
commercial-lineage contracts. It does not rewrite the historical W4-04 lane
record and does not change product behavior.

## Reproduced defect

At starting SHA `27bf8d544f60a7024d0b4c3f47e3d0ee71ee9b76`, strict W4-04 TypeScript
failed in `fixtures.ts`. The call to `createInstructionalMemoryDelta` omitted
the current required fields:

- `commercialExecutionScopeRef`
- `householdScopeRef`
- `conceptRef`
- `curriculumReleaseRef`
- `curriculumPackageRef`
- `curriculumCourseRef`
- `curriculumSubjectRef`
- `curriculumUnitRef`
- `curriculumLessonRef`

The stale emitted JavaScript therefore could not establish a current 28/28
certification.

## Current detector

The fixture now begins with one exact `CommercialExecutionScope`. Its payload,
commercial route-attempt plan, accepted `StudyCommercialEffectReceipt` v2,
`InstructionalMemoryScope`, and `InstructionalMemoryDelta` all derive from and
are checked against that scope. This preserves a single authority lineage
rather than introducing a second scope model.

The detector keeps every historical crash window and replay case. It also adds:

1. an integration probe through `executeCommercialTutorInvocation` and
   `InMemoryPhysicalAttemptDispatchClaimStore`, proving an exact replay cannot
   execute the R1 physical provider attempt twice;
2. a same-logical-operation, different-commercial-scope conflict probe; and
3. a fail-once-memory probe through
   `RecoverableInstructionalOperationCoordinator`, proving the accepted effect
   is reused while exact replay repairs memory.

The resulting current detector is 31/31 TAP tests. The original 28-count
mapping is in `TEST-MATRIX.md`.

## Load-bearing negative control

`adaptive-tutor/adversarial/v4/replay-crash/negative-control.mjs` compiles the
current detector, copies only the emitted implementation into a disposable
temporary directory, weakens R1's exact-identity result from
`ALREADY_CLAIMED` to `CLAIMED`, and requires the current R1 integration probe
to fail. The temporary copy is removed after the run.
