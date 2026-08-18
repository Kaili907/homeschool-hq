# Social Studies Production R3 — validation

Validation status: `PASS`
Scope: framework plus one Grade 3 reference lesson. One lesson authored, zero admitted.

## Reference lesson

`ma-g3-social-studies-u08-l07` — *Investigation or close reading: the purpose of the
Michigan Constitution*. Unit 8, day 7, course day 91 of 108. `READY_FOR_GATE`.

## What was proved

| Claim | How |
| --- | --- |
| The model schema still describes the approved model | All nine frozen Director-approved Social Studies samples validate against it unchanged, after the per-item `feedback` and `lessonReview` additions. |
| The rhythm rule is the approved rhythm | All nine frozen samples and the reference lesson satisfy the nine ordered steps. |
| The rhythm survives projection | Through the real `createRichLessonRenderModel`, page order is source → worked-example → guided-practice → remediation → independent-practice → reflection last, across 15 pages. |
| The promotion gate is real | Each frozen sample fails the production envelope for exactly seven findings: six missing production fields and the forbidden `sampleStatus` carry-forward. |
| The gate is passable | The reference lesson validates clean against the model schema, the production envelope, and the rhythm rule. |
| Every learner turn has a real control | Through the real `mapLearnerMaterialToStudySegments`: 6 required items — 4 `CHOICE` with 3 choices each, 1 `CONSTRUCTED_RESPONSE`, 1 `CHOICE` review — and every `CHOICE` item carries at least two choices. |
| Looking at an example is not mastery | Both worked-example items project as `READ`, `required: false`, and carry no feedback. |
| Feedback is instructional and per item | Every required item carries `feedback.correct` and `feedback.incorrect`; every incorrect branch is at least 40 characters, none matches the generic-verdict denylist, and all six incorrect strings are distinct. |
| The COURSE PROGRESS / NEXT ACTION ruling is applied | Both the seven-field review and the DTO `lessonReview` state "course day 91 of 108" and carry no no-credit wording; `nextAction` is `Continue required work` in the file and in `renderModel.review`. |
| Canonical identity is exact | `lessonRef`, `title`, and all eight standards reproduce the canonical student-work package. The canonical corpus is unmodified. |
| No browser answer or scoring authority | No forbidden key appears in the lesson or in any render-model item. |
| It is not a rewrite of the frozen sample | Different lesson, different unit (U08 vs the frozen U06), and zero substantive learner strings in common. |
| Nothing is admitted | `sourceReview.reviewedByRole` is `PENDING_HUMAN_SOURCE_REVIEW`; the verifier rejects that role for `PRODUCTION_ADMITTED`. |
| The frozen model is untouched | All nine sample content hashes match, and `verify-director-r2-freeze.mjs` reports an empty lesson-substance diff against the freeze commit. |

## Source integrity

Every source is drawn from the verified set the repository already binds to this
canonical lesson (`taskSourceBinding.sourceKeys`), each `VERIFIED` on 2026-08-13:

- `loc-2022688639` — Library of Congress, House message, December 10, 1835
- `loc-2022697426` — Library of Congress, Senate message, December 10, 1835
- `nara-constitution` — U.S. National Archives, Constitution of the United States (1787), used for the worked example's different case

The registry stores metadata and links only (`quotationStored: false`). The lesson
therefore reproduces catalog titles, labeled in learner-visible text as catalog
titles rather than as words spoken by a person, and labels every plain-language
restatement as a paraphrase. No document text is reproduced. No quotation, title,
creator, date, or URL is invented.

Social Studies has no answer keys; scoring authority lives in each canonical
package's rubric. All feedback is hand-authored per item.

## Framework changes this lesson required

Each traces to a binding contract clause, and none weakens the gate.

1. **`item.feedback` added to the model schema.** The Common Lesson Contract requires
   instructional feedback; the item contract previously had no place to put it.
2. **`lessonReview` added** — shape in the model schema, presence required by the
   envelope. This carries the COURSE PROGRESS / NEXT ACTION ruling and is what
   `renderModel.review` surfaces. The gate grew from six findings to seven.
3. **`reviewedByRole` gained `PENDING_HUMAN_SOURCE_REVIEW`**, and the verifier now
   rejects it for `PRODUCTION_ADMITTED`. This makes the honest state expressible
   without letting it pass as a human sign-off.
4. **Forbidden-key pattern narrowed to drop bare `correct`**, which is the runtime
   `LearnerItemFeedback` branch name, and widened to add `accepted` and
   `acceptedChoiceOrdinal`, matching the Mathematics R3 validator. `correctAnswer`,
   `answerKey`, `solution`, `score`, `scoring`, and `rubricAnswer` remain forbidden.

## Commands

```sh
node scripts/curriculum/verify-social-studies-r3-framework.mjs
npx vitest run --project root-app src/study/family-pilot/lesson-player/socialStudiesProductionR3.test.ts
npm run typecheck
node scripts/curriculum/verify-director-r2-freeze.mjs e9b9d723ed4b447f9de97aa5d7de26ac1dfd1f9a
```

## Results

```
manifest: curriculum-production/social-studies-r3/SOCIAL_STUDIES_PRODUCTION_R3.manifest.json
status: REFERENCE_LESSON
grades: 3,4,5,7,8,9,10,11,12
grade 6: absent
pinned checksums: 4 matched
frozen Social Studies model samples: 9 unchanged
model schema: 9/9 frozen samples validate
rhythm rule (9 steps): 9/9 frozen samples satisfy
promotion gap: 7 findings per frozen sample, exactly as documented
authored R3 lessons: 1 (grade-03/ma-g3-social-studies-u08-l07.lesson.json)
admitted R3 lessons: 0
automatic promotion: disabled
SOCIAL_STUDIES_R3_FRAMEWORK_VERIFIED
```

TypeScript passed. The R3 test passed with 34 tests. Run with the Director R2 sample
tests, the render-model test, the lesson-player test, and the Director review registry
test: 6 files, 182 tests passed. `verify-director-r2-freeze.mjs` reported
`DIRECTOR_R2_FREEZE_VERIFIED`.

The preview route was served and returned HTTP 200 at
`/curriculum-preview/social-studies-r3`, with the route component and the lesson JSON
both resolving as modules.

## Not covered

Whether the modeled case is genuinely a different case remains a human judgment; the
automated check only proves the modeled prompt is not a copy of the learner's prompts.
Whether a cited record says what the lesson claims cannot be computed — the sources
are registry-verified, and a named human sign-off is still outstanding, which is why
this lesson is `READY_FOR_GATE` and not admitted.

`SOCIAL_STUDIES_R3_REFERENCE_LESSON_READY`
