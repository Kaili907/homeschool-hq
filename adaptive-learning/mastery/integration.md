# Mastery integration guide

## Boundary rule

Treat this package as a JSON-safe sidecar. It does not own Manuel Academy
profile authentication, the adaptive teaching loop, the study session state
machine, or the current application persistence schema.

Use canonical IDs byte-for-byte:

```ts
import {
  asStudentId,
  asSkillId,
  evaluateMastery,
  masteryRecordStorageKeyFor,
} from './adaptive-learning/mastery/index.ts'

const studentId = asStudentId(profile.id)
const skillId = asSkillId(existingSkillId)
const storageKey = masteryRecordStorageKeyFor(studentId, skillId)
```

The tuple storage key avoids concatenating independently valid 128-character
IDs into an invalid or collision-prone synthetic aggregate ID. The persisted
`MasteryRecordId` is an opaque, caller-issued ID.

## Do not adapt these values into mastery

The following existing values are useful context but are not independent
mastery evidence:

- `Profile.skills[skillId].mastery`;
- `SkillState.attempts`, `correct`, or `lastSeen`;
- placement/session completion;
- a mission checkbox;
- an assessment `finishedAt` value;
- a tutor-assisted retry;
- a walkthrough count;
- the Study Engine’s provisional numeric/boolean Tutor Core representations.

In particular, `src/appState.ts#recordAnswer` updates a legacy rolling estimate
without a stable attempt ID or an explicit independent-performance assertion.
Do not convert that estimate directly into `mastered`.

## Evidence ingestion

At the producing boundary:

1. Assign a stable event/evidence ID and opaque source/session reference.
2. Map the canonical student and stable skill ID without normalization.
3. Record whether support was independent, minimal, guided, or full.
4. Emit `assessment_attempt` for a scored/unscored assessment event.
5. Emit `tutor_intervention` when the tutor provides a prompt, hint, worked
   example, reteach, redirection, or escalation.
6. Emit `independent_demonstration` only when the producer explicitly attests
   that the performance was independent and records the criterion and result.
7. Preserve source evidence references. The runtime validator rejects dangling
   references when a record is evaluated or loaded.

The boundary accepts no unknown fields. Raw answers, prompt text, transcripts,
private notes, diagnoses, or student reflections must remain in their
authorized source systems.

## Evaluation sequence

Evaluate graph roots first, then follow `topologicallySortSkills(graph)`.
Provide the current direct prerequisite records to each dependent evaluation:

```ts
const next = evaluateMastery({
  recordId,
  studentId,
  skillId,
  graph,
  evidence,
  prerequisiteRecords,
  previous,
  evaluatedAt: new Date().toISOString(),
})
```

Missing direct prerequisite records are explicit blockers. An effective
prerequisite state of `mastered`, including an audited current override,
satisfies a required edge.

Persist with compare-and-swap on `revision`. Replay the same evidence IDs
idempotently at the host boundary; duplicate evidence IDs are rejected rather
than double-counted.

## Manual overrides

Only an authenticated parent or teacher may construct
`ManualMasteryOverride`. Call `applyManualOverride`; do not patch `state`
directly. Revocation and expiration likewise require the exported functions.

An override:

- changes effective `state`;
- appends a full immutable snapshot to `overrideAuditHistory`;
- keeps `computedState`, confidence, evidence, and independent timestamps
  unchanged;
- keeps the next action grounded in computed evidence, so an override to
  `mastered` cannot claim that independent performance occurred.

The host should enforce authorization and persist audit entries atomically with
the record revision. This package validates actor role/ID but does not
authenticate the actor.

## UI projection

Call `explainMastery(record, graph)` and render its text labels in addition to
any color/status glow. The projection directly supplies:

- `learningObjective`;
- `blockingPrerequisites`;
- evidence summaries;
- confidence score, level, factors, and summary;
- `nextAction`;
- `lastIndependentDemonstrationAt` and a fallback sentence;
- a visible manual-override explanation when applicable.

The sample bundle:

```ts
import { masteryDemoFixture } from './adaptive-learning/mastery/index.ts'
```

contains both subject graphs and engine-generated records/explanations covering
every state.

## Version and failure behavior

Run every untrusted/persisted object through `validateMasteryPayload`. Only
schema version 1 and known discriminants are accepted. Older, future, unknown,
or extra-field payloads must be quarantined; do not coerce, drop fields, or
reset a learner’s record.

Circular graphs, dangling edges, duplicate IDs, and self-dependencies are hard
errors. Keep the last valid graph active while an invalid catalog revision is
quarantined.

