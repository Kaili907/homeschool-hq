# Family Pilot learner-response runtime R1

## Boundary

This runtime is a reusable learner-evidence seam around the accepted Family Pilot Lesson Player and Study Engine. It does not score, read an answer key, modify curriculum packages, alter the browser projection builder, call the Netlify scoring endpoint, or define a second progression engine.

The runtime accepts a local compatibility DTO that covers both the current learner-safe browser projection and a future richer section/item DTO. Rich `sectionRef` and `itemRef` values are preserved exactly. When the current projection omits them, stable opaque references are derived from `lessonRef`, section order/title, and item order. Duplicate or invalid references fail closed.

## Closed response taxonomy

| Type | Learner behavior |
| --- | --- |
| `NONE` | Closed taxonomy member for compatibility; structured answerable material is never mapped to it. |
| `READ` | Instructional/read-only material with Continue. Worked examples are always read-only. |
| `CHOICE` | Labelled radio group; the saved value is an opaque choice reference, not flattened answer text. |
| `TEXT` | Labelled single-line text response. |
| `NUMERIC` | Labelled text input with `inputMode="decimal"` for numeric mobile keyboards. |
| `CONSTRUCTED_RESPONSE` | Labelled long-response textarea. |
| `ACTIVITY_EVIDENCE` | Evidence textarea plus explicit activity-completed checkbox. |
| `RUBRIC_REVIEW_PENDING` | Pending-review status; no correctness is invented. |
| `GUARDIAN_ATTESTATION` | Learner-facing guardian-attestation status; guardian authority remains in final composition. |

## Study segment mapping

The accepted `manuel-academy-activity` Study plan already has three canonical segments. Material is grouped into those segments rather than adding another state machine:

| Existing Study segment | Structured material mapping | Evidence mode |
| --- | --- | --- |
| `learn` | Instructional examples, sources, lesson goals, scenarios, directions, supports, safety/accessibility material | `READ`; no answer expected |
| `practice` | Guided practice/support, independent practice/evidence, essential questions, student/primary tasks, deliverables, activities/projects | `SUPPORTED`, `INDEPENDENT`, or `COMPLETION` |
| `reflect` | Mastery/knowledge checks, explicit rubric-review pending, guardian attestation, review material | `MASTERY` or pending/read-only flow |

Markdown learner packages map to a read segment, an `ACTIVITY_EVIDENCE` segment, and a read/review segment. The full admitted-catalog audit proves all 8,292 lessons map to the three Study segments and have at least one required response without any `NONE` fallback.

## Identity and persistence

Every saved response carries:

- `lessonRef`
- `sectionRef`
- `itemRef`
- `studentRef`
- `assignmentRef`
- `attemptRef` (the exact stable Study session reference in the current final composition)
- the current Study `segmentRef`

The final UI creates the binding from the Study snapshot and open assignment. The runtime rejects a wrong lesson, missing section/item reference, foreign item, invalid choice reference, read-only item submission, and empty/no-op submission.

The browser store writes locally before any assessor call. A successful local write without an assessor is `PENDING_ASSESSMENT`. An unavailable or throwing assessor leaves that durable pending record intact and never supplies false correctness. Study progression remains blocked until every required response in the current canonical segment is locally saved. Unreadable or unwritable local state is not overwritten and does not advance Study.

## Injected assessor

`LearnerResponseAssessor` is the only assessment seam. It is optional and injected. The learner runtime contains no scoring rule or key. Only a receipt returned by that injected interface can transition a record from `PENDING_ASSESSMENT` to `ASSESSED`; the default Family Pilot integration supplies no assessor.

## Accessibility

Choice controls use `fieldset`, `legend`, radio inputs, and labels. Text, numeric, constructed-response, and activity evidence controls have explicit labels and described help text. Forms retain keyboard submission semantics, controls have native disabled states during transitions, radio/activity labels have mobile-friendly minimum target height, focus moves to the step heading after Study advances, and no control requires pointer-only interaction.

## Fixture and negative-control proof

- Grade 3 mathematics: worked example is `READ`; independent items preserve source refs and map to `CHOICE` and `NUMERIC`; mastery maps to independent `CONSTRUCTED_RESPONSE` evidence.
- Grade 5 ELA: guided support maps to `SUPPORTED` constructed response and independent evidence maps to `INDEPENDENT` constructed response.
- Cross-subject: markdown science and structured arts/activity fixtures map to `ACTIVITY_EVIDENCE` without invented correctness.
- Negative controls cover generic `NONE`, flattened choices, no-op submit, lost `itemRef`, wrong lesson submission, invalid choice text/ref, storage failure, and false offline correctness.

Primary verification:

```text
npm run typecheck
npx vitest run src/study/family-pilot/final-app/learner-response src/study/family-pilot/lesson-player/FamilyPilotLessonPlayer.test.tsx
npx vitest run src/study/family-pilot/final-app/finalConvergence.integration.test.ts
```
