# W2-08 prerequisite repair and reteach

This lane adds deterministic, proposal-only orchestration. Study remains the only
sequencing and assignment authority. Neither orchestrator writes progress or
mastery, changes an official working level or grade, assigns a course, or routes a
learner to a different curriculum.

## Boundaries

Prerequisite repair uses three narrow read-only ports:

- `PrerequisiteGraphLookupPort` returns immediate prerequisite concept nodes.
- `MisconceptionSignalLookupPort` returns closed, reference-only signals.
- `RepairReviewedContentLookupPort` admits reviewed content references for the
  candidate concepts.

Reteach uses two narrow read-only ports:

- `HintInterventionRecommendationPort` returns closed, reference-only step
  recommendations.
- `ReteachReviewedContentLookupPort` confirms that every step uses reviewed
  content.

All responses echo the complete Study scope binding. A learner, household,
session, invocation, subject, grade, curriculum, or working-level mismatch fails
closed. Graph nodes are additionally constrained to the authorized subject,
grade, and curriculum. Port responses reject unknown fields, which excludes
mutation commands, provider prose, answer fields, and covert route requests.

W2-09 is expected to supply the production implementations of these ports. This
lane does not import another Wave 2 lane.

## Bounded behavior

- Repair depth is hard-capped at 3 and repair proposals at 12 concepts/content
  references.
- Reteach is hard-capped at 4 steps and 2 repeated loops.
- Active graded/mastery assessment and safety holds return `withheld` with no
  content or instructional steps.
- Adaptive failure, malformed data, cross-context data, unauthorized routes,
  conflicting signals, and unreviewed recommendations fall back to the exact
  reviewed static references supplied by Study.
- Every result sets `studyDecisionRequired: true` and contains an explicit
  `authorityEffects` record whose values are all `none`.
- Reteach results set `answerAuthority: "none"` and
  `activeAssessmentBypass: false`; no result field can carry novel prose.

## Determinism and replay

Traversal is breadth-first with reference sorting, cycles and duplicates are
removed, chain ancestry is reconstructed without asserting sequence authority,
and proposal references derive from the Study request reference. Identical
requests and dependency results therefore produce byte-identical proposals.
Ports receive cloned, minimal requests and returned data is projected into fresh
closed objects.

## Lane validation

The owned tests cover one prerequisite, a prerequisite chain, maximum depth,
graph failure, conflicting misconception signals, normal reteach, repeated-loop
cap, working-level mutation attempts, cross-grade routes, active assessment,
safety hold, cross-child context, replay, reviewed/static fallback, unreviewed
content, and provider prose/answer injection.

Run:

```sh
npx tsc -p adaptive-tutor/study-engine/tutor-v2/prerequisite-repair/tsconfig.json
npx tsc -p adaptive-tutor/study-engine/tutor-v2/reteach/tsconfig.json
npx vitest run adaptive-tutor/study-engine/tutor-v2/prerequisite-repair/prerequisite-repair.test.ts adaptive-tutor/study-engine/tutor-v2/reteach/reteach.test.ts
```
