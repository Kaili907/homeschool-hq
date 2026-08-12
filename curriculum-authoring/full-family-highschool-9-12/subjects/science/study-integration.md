# Study Engine Integration — High School Science 9–12

## Current state of the seam

The Study Engine's host lesson contract lives in [`src/study/curriculumAdapter.ts`](../../../../src/study/curriculumAdapter.ts)
and [`src/study/types.ts`](../../../../src/study/types.ts). Today it recognises:

- **Lesson kinds:** `math`, `reading`, `writing`, `quiz-practice`, `quiz-assessment`, `review`,
  `parent-created`, `romeo-virtual-academy`
- **Subjects:** `math`, `reading`, `writing`, `other`

**There is no science subject and no laboratory task type.** This is not a new gap introduced by this
package — the published Grade 5, 7, and 8 science courses are in exactly the same position.

This package **does not modify `src/study/**`**, which is outside its ownership. It authors to the
contracts that already exist and records the integration work as explicit follow-ups rather than
assuming it.

## How these courses map onto the seam as it stands

| Lesson day | Phase | Existing host kind | Mastery authority |
| --- | --- | --- | --- |
| 1, 2, 5 | Launch, concept models | `review` (subject `other`) | `tutor-core` |
| 3, 4, 6, 8 | Guided and independent practice | `review` (subject `other`) | `tutor-core` |
| 7 | Investigation | `parent-created` | `completion-only` |
| 9 | Performance task build | `parent-created` | `completion-only` |
| 10 | Synthesis and review | `review` | `tutor-core` |
| 11 | Unit assessment | `quiz-assessment` | `tutor-core` |
| 12 | Correction and reflection | `review` | `tutor-core` |

The Day 7 investigation and Day 9 performance build map to `parent-created` / `completion-only`
deliberately: the Study Engine cannot verify that a household investigation was performed safely or
correctly, so it must not claim mastery authority over it. The guardian confirms; the engine records
completion only.

Lesson, unit, and course identifiers all satisfy the seam's `SAFE_REF` pattern
(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$`), verified across all 472 identifiers by
`validation/validate.mjs`, so they can be used directly as `lessonRef` and `skillRefs` values.

## Invariants this package already satisfies

**Minimal persistence.** Every lesson declares privacy declarations limiting stored learning metadata to
target, completion state, evidence type, and next step. No raw reflection text, no free-text answers, no
photograph, no video, no voice recording, no body or health data, and no location.

**Tutor cannot fabricate or complete work.** `authoring-set/policy-set.json` pins
`reveals_answers`, `gives_final_graded_answer`, and `controls_graded_work_policy` to `false`. Every
lesson uses only the five controlled tutor signals with their one legal strategy each, and the
contract's recursive forbidden-key check rejects any extension that tries to re-introduce answer
authority. On the Day 11 assessment, `academic_integrity_mode` is `independent-graded` and the scoring
guidance states the tutor may clarify what a prompt asks but supplies no answer, no worked solution, and
no correctness judgement during the assessment.

**No investigation is completed for the student.** Investigation lessons state that no expected value is
supplied beforehand and no result is ever filled in; a messy result is recorded and explained rather
than replaced.

**Projection safety.** All 432 lessons were run through `projectStudentLesson` during validation; none
leaks `scoring_guidance`, `mastery`, `tutor_routes`, `safety_privacy`, or `guardian_visibility_note`
into student-visible output.

## Integration follow-ups (not done here — outside this package's ownership)

1. **A `science` subject** in `StudySubject`, so science work is not filed as `other`.
2. **An `investigation` / laboratory task type** in `CanonicalStudyTaskType`, with `completion-only`
   mastery authority and a guardian safety-confirmation step before the block can start.
3. **A guardian pre-session safety surface** that renders the lesson's hazard list, supervision level,
   and stop conditions before the block opens, and lets the guardian select the alternative path. This
   remains a follow-up, but it is no longer the only thing standing between a learner and the hazard
   information: the learner-visible `safety-review` segment is part of the student projection already,
   so a host that renders `lesson_flow` at all renders the full safety brief. Nothing in this package
   requires a new engine — the existing Study Engine seam carries it as ordinary lesson flow.
4. **Evidence-type and transfer-mode recording** in learner evidence, which the schema-set v2 README
   already names as the precondition for enforcing structured mastery rules at runtime. Until that
   exists, the multi-occasion mastery floor in this package is authored and auditable but not
   runtime-enforced.
5. **A loader** for this authoring set. Nothing reads `curriculum-authoring/**` today; the published
   release at `curriculum-content/manuel-academy/1.0.0` is the only curriculum source wired into the
   app, and it is sealed and immutable.
