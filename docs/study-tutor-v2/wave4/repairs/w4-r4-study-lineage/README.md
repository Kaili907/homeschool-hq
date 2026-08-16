# W4-R4 Study accepted-effect and memory lineage repair

Session: `STUDY-TUTOR-V2-W4-R4`

Starting R1 SHA: `ef672ba2e65e83e17f84057782d8005cc1a03016`

## Outcome

Study accepted-effect recovery now validates the actual W4-R1
`CommercialExecutionScope`; it does not define a second commercial scope.
The trusted Study receipt, Tutor advisory, recoverable operation, minimized
accepted event, and instructional-memory delta must reconcile to that same
scope before memory can change.

The minimized lineage contains only opaque references and bounded curriculum
identifiers. It binds the canonical commercial scope, household, learner,
session, interaction, logical operation, concept, opportunity, and curriculum
release/package/course/subject/unit/lesson. Learner names, raw attempts,
provider prompts or responses, Tutor transcripts, media, diagnoses, and
emotion/personality inferences remain outside every durable boundary.

## Authority

Study remains the sole authority for accepted effects, progression,
completion, mastery, working level, nominal grade, and curriculum assignment.
The commercial scope is trusted context and evidence. It grants Tutor no
mutation authority, and all existing false authority flags remain closed.

## Accepted effect and memory

`StudyCommercialEffectReceipt` v2 attests the canonical commercial scope ref
and its minimized Study-owned facts. The Study integration validates the full
canonical scope and then checks the receipt and advisory against it.

`InstructionalMemoryDelta` repeats the minimized lineage. Its learner/session/
interaction/opportunity scope, source receipt, logical operation, concept,
household, canonical scope ref, and curriculum tuple must equal the receipt.
Concept additions and replacements cannot introduce a concept other than the
accepted concept. Removal may remove prior bounded context but cannot add a
sibling concept.

`MinimizedAcceptedStudyEffectEvent` and the recoverable operation carry the
same lineage. Canonical lookup results are compared to the exact retry payload,
including the full memory delta. A same-operation payload with different
lineage is quarantined as `CONFLICTING_LOGICAL_OPERATION`; it is never treated
as an idempotent replay.

## Recovery

An exact retry after Study effect acceptance and memory-write failure resolves
the already accepted event, applies memory once, and does not accept the Study
effect again. A fresh coordinator can still reconstruct memory from the exact
accepted minimized event. No replay can cross commercial scope, household,
learner, session, concept, or opportunity.

## Serialized-boundary impact

The following existing durable boundaries change; no new serialized boundary
or second Study Engine is introduced:

- `StudyCommercialEffectReceipt` advances from v1 to v2 and gains canonical
  commercial, household, concept, and curriculum lineage.
- `InstructionalMemoryDelta` gains the same minimized lineage, and that
  lineage contributes to its deterministic revision fingerprint.
- `MinimizedAcceptedStudyEffectEvent` gains the same minimized lineage.

Wave 4 convergence must regenerate and review the global JSON Schemas,
inventory digests, and release evidence for these three contracts. This repair
intentionally does not commit generated Wave 3/Wave 4 schemas or release
artifacts.
