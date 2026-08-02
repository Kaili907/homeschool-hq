# Manuel Academy Mastery and Prerequisite Intelligence

This directory is the dependency-light mastery domain for Manuel Academy. It
adds a visible prerequisite map and evidence-based state engine without
changing the existing adaptive tutor, study engine, profile store, or progress
algorithms.

## Resolved path and inspected contracts

The requested path, `adaptive-learning/mastery/**`, did not exist. It was
created exactly as requested; no equivalent path was substituted.

Before implementation, the following existing systems were inspected:

- `src/tutor/**` for the current adaptive tutoring and walkthrough escalation
  behavior;
- `src/appState.ts`, `src/types.ts`, and `src/skills.ts` for profile identity,
  legacy skill IDs, rolling progress, and persistence;
- `src/assessment/**` for fixed-form assessment attempts and scoring;
- `adaptive-tutor/study-engine/contracts/**` for canonical identity, evidence,
  session, review, and adult-control contracts;
- `adaptive-tutor/study-engine/engine/evidence/**` for conservative evidence
  interpretation;
- `adaptive-tutor/study-engine/reconciliation/**` for the unresolved Tutor Core
  v0.2 compatibility boundary.

`StudentId`, `SubjectId`, `SkillId`, `EvidenceId`, `ISODate`, `ISODateTime`, and
`GradeBand` in this feature are direct TypeScript aliases of
`adaptive-tutor/study-engine/contracts/common.ts`. The compile-time assertions
in `canonical-compatibility.type-test.ts` prevent accidental replacement.
Runtime ID acceptance also matches the canonical pattern and 128-character
limit. Feature-specific aggregate IDs remain separately branded.

## Public API

Import from `adaptive-learning/mastery/index.ts`.

Primary operations:

- `validateMasteryPayload` version-gates untrusted JSON, rejects unknown kinds,
  and rejects unknown properties such as raw answers or transcripts.
- `validateSkillGraph`, `createSkillGraph`, and
  `findPrerequisiteCycles` validate directed prerequisite graphs. Edge
  direction is always prerequisite to dependent.
- `evaluateMastery` produces a `StudentSkillMastery` record from explicit
  evidence and direct prerequisite records.
- `applyManualOverride`, `revokeManualOverride`, and
  `expireManualOverride` preserve the computed evidence state and append an
  audit entry.
- `explainMastery` creates a parent/student-safe read model answering what the
  skill is, what blocks it, what evidence supports it, confidence, next action,
  and the last successful independent demonstration.

The public fixture bundle is `masteryDemoFixture`. It includes math and English
graphs, nine engine-produced student records, explanations, and all six
required states.

## Mastery rules

The engine applies rules in this order:

1. Reject an invalid/circular graph, invalid evidence, identity mismatch,
   missing evidence reference, duplicate evidence ID, future evidence, or
   out-of-order evaluation.
2. Mark a skill `blocked_by_prerequisite` when any direct required prerequisite
   is missing or not effectively `mastered`.
3. Use `not_yet_assessed` only when there is no evidence.
4. Use `evidence_uncertain` for invalidated-only, limited-only,
   inconclusive-only, or conflicting evidence.
5. Require repeated, reliable `independent_demonstration` evidence on distinct
   days for computed `mastered`.
6. Move evidence-qualified mastery to `needs_reinforcement` after the configured
   age threshold or when a newer independent failure follows the successful
   demonstrations.
7. Keep supported assessment/tutor work in `currently_learning`; it can guide
   instruction but cannot establish mastery.
8. Apply a current manual override only to the effective `state`. It never
   alters `computedState`, confidence, evidence, or the independent timestamp.

Default policy requires two successful independent demonstrations on two days,
at least one using new or transfer work, and reinforcement after 45 days.
Policy values are explicit evaluation inputs and are stored through
`confidence.algorithmVersion`.

## Confidence is not a diagnosis

Confidence is a bounded evidence-quality estimate, not a probability, learner
trait, or diagnosis. It increases with reliable, repeated, recent independent
observations and decreases with limited or conflicting evidence. Invalidated
evidence remains visible for audit but does not contribute.

## Validation

From the repository root:

```powershell
npx tsc -p adaptive-learning/mastery/tsconfig.json --noEmit
node --experimental-strip-types adaptive-learning/mastery/scripts/validate.ts
```

The validation script checks both sample graphs, every seed evidence/record,
all six states, circular rejection, the completion-only mastery gate, manual
override audit preservation, unknown-property privacy rejection, and
future-version quarantine.

See `integration.md` for host wiring and `core-change-requests.md` for missing
shared-core contracts that were deliberately not guessed here.

