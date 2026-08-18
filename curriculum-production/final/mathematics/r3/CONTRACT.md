# Mathematics Production R3 — Lesson Contract

**Status: DERIVED, NOT INDEPENDENT.**

This document does not create requirements. It restates the frozen R2 contracts so they can be
checked mechanically against R3 production lessons. The binding sources are, in order:

1. `curriculum/approvals/director-samples-r2-approved.json` — the binding approval manifest (FROZEN)
2. `docs/curriculum-quality/APPROVED-LESSON-CONTRACTS-R2.md` — the approved contracts (FROZEN)
3. `curriculum-review-samples/director/mathematics-r2/samples/grade-3.json` — the controlling
   Mathematics example, sample id `director-math-r2-g3-place-value` (FROZEN)

Where this document and a frozen source disagree, the frozen source wins. Nothing here may be
used to extend, narrow, or reinterpret the approved contracts. Matters the R2 contracts do not
settle are listed under **Open questions** and are not decided here.

## Surface

Fixed by the freeze. R3 lessons render through the same path as the approved samples:

```
LearnerMaterialDto -> createRichLessonRenderModel -> RichLessonPresentation
```

mounted in the real `FamilyPilotLessonPlayer`. R3 does not introduce an engine, runtime, or
lesson model of its own.

## Derived requirements

Each row restates one clause of the frozen contracts and names the check that enforces it.

| # | Restated from the frozen contracts | Enforced by |
|---|---|---|
| C1 | The learner experiences the lesson through the real Rich Study Player and its real learner-response runtime. | `renderModel.mode === 'rich'`; material projects through `mapLearnerMaterialToStudySegments` |
| C2 | TEACH is written to the learner, with age-appropriate language and a clear purpose. | a `teaching` section is present and carries a body |
| C3 | A WORKED EXAMPLE is clearly labelled and shows both the answer and the reasoning. Looking at an example is not mastery. | a `worked-example` section exists; every worked item projects `responseType === 'READ'`, `required === false`, and carries `workedSolution.steps` |
| C4 | YOUR TURN always has a real supported response control. A question must never lead to nowhere to type, choose, or enter a response. | every required item projects a responseType in `CHOICE`/`TEXT`/`NUMERIC`/`CONSTRUCTED_RESPONSE`; every `CHOICE` item carries at least two choices |
| C5 | FEEDBACK is instructional: it explains the reasoning, names the next move, and supports correction or reteaching. | every required item carries non-empty `feedback.correct` and `feedback.incorrect`; no feedback string matches the generic-retry denylist |
| C6 | PRACTICE collects real learner-response evidence. | an `independent-practice` section exists and contains required items |
| C7 | TAUGHT, PRACTICED, and DEMONSTRATED remain distinct. Viewing an example is not mastery, and one response is not by itself sufficient evidence of mastery. | worked-example items are never required; `mastery-check` is a distinct section from `worked-example` and `independent-practice` |
| C8 | LESSON REVIEW is meaningful and is never only "Great work" or "Done". | `lessonReview.whatYouLearned.length >= 2`, non-empty `courseProgress`, `nextAction` within the DTO enum, `reviewActionLabel` matching `review this lesson` |
| C9 | AGE PROGRESSION is real: Grade 3 reads like Grade 3. | not machine-checkable; carried by human readability review, as in R2 |
| M1 | Math lessons use small-step teaching. | teaching body present ahead of the worked example |
| M2 | Visual organization where useful. | the teaching section may carry `data`; present in this lesson as a place-value/step-count table |
| M3 | A clearly separated worked example and YOUR TURN. | the worked-example section and the first learner-response section are distinct sections with distinct `sectionRef`s |
| M4 | Real numeric/choice/text controls. | see C4 |
| M5 | Instructional feedback. | see C5 |
| M6 | Reteach or scaffold support. | a `remediation` section exists and carries at least one required item on a fresh number |
| M7 | Meaningful practice and review. | see C6 and C8 |
| M8 | The controlling Grade 3 example shows the contrast concretely, then provides a separate YOUR TURN with a real response control. The example and the learner response must remain distinct. | the worked example and the guided item use different numbers; the guided item is required and the worked item is not |
| P1 | Learner material carries no answer or scoring authority. | no `answer`, `answerKey`, `correctAnswer`, `scoring`, or `scoringRule` key anywhere in `learnerMaterial`; no accepted-choice field reaches the render model |
| P2 | Protected criteria live outside browser-imported material. | `restricted/assessment-authority.json` has `browserImportAllowed: false` and holds exactly one entry per required item |

## Provenance

R3 lessons are rewrites of existing canonical production lessons. Each R3 lesson records the
canonical package and answer key it derives from, and its grade, course, unit, and standards
mapping must equal the canonical source. The canonical corpus is not modified by R3.

## Open questions

The R2 contracts do not settle these. They are recorded, not decided. The reference lesson makes
a provisional choice where it had to in order to exist; each provisional choice is named below and
is subject to Director direction.

1. **`courseProgress` wording for production.** All nine approved Math samples say the lesson
   "does not change your production-course progress", which is true of a review sample and false
   of a production lesson. The contracts do not state what a production lesson should say.
   *Provisional choice in this lesson:* `"Unit 1, Lesson 2 of 18 in Mathematical Habits, Place
   Value, and Rounding."`
2. **`nextAction` for a mid-unit production lesson.** The approved samples use `Done for today`.
   The DTO enum also allows `Continue required work`, `Keep learning / Work ahead`, and
   `Waiting for Parent`. The contracts do not say which applies mid-unit.
   *Provisional choice in this lesson:* `Continue required work`.
3. **Relationship between the R3 restricted authority and the canonical answer key.** The
   canonical `.key.json` already holds answers, `solutionReasoning`, and `commonErrors`. R2
   introduced a separate restricted authority file for review samples. Whether production R3
   should carry its own authority file, defer entirely to the canonical key, or generate one from
   the key is not covered. *Provisional choice in this lesson:* a separate R3 authority file whose
   entries record `sourceAnswer` back to the canonical key.
4. **Whether an R3 lesson must use every canonical source item.** This lesson uses 7 of the 8
   canonical items. Canonical `#gp-03` (round 424 to the nearest 10) is omitted as duplicative of
   `#ip-03` (round 653 to the nearest 10) — both are three-digit round-down cases — and one item,
   `#rt-01`, is newly authored for the reteach section, which the canonical package has no
   section for. The contracts do not state whether canonical item coverage must be total.
5. **Learner-facing title divergence.** The canonical package title is
   `"Concept build A: the place-value structure of three-digit numbers"`, which is internal phase
   language. All nine approved samples retitled their source lesson for the learner, but the
   contracts do not state a rule. *Provisional choice in this lesson:*
   `"Rounding to the Nearest Ten"`.
6. **Item-ref namespacing.** Approved samples use `<sampleId>:<section>:<n>`. This lesson uses the
   canonical `<lessonId>#<sectionId>-<nn>` refs so responses trace to the canonical answer key.
   The contracts do not state which form production must use.
7. **Numeric thresholds.** The R2 validation suite asserted at least five required response items
   and at least ten render-model pages. Those are properties of the approved samples, not clauses
   of the contracts. R3 records them as observations rather than gates.
8. **Canonical content mismatch in this source lesson (not an R3 decision).** The canonical
   package for `ma-g3-mathematics-u01-l02` states focus "the place-value structure of three-digit
   numbers", but all eight of its items assess rounding under `3.NBT.1`, three of them on
   two-digit numbers, and its single worked example rounds to the nearest 100 while every
   practice item rounds to the nearest 10. This lesson teaches what the canonical items actually
   assess and does not modify the canonical corpus. Whether the canonical focus text or the item
   set is the error is a curriculum question outside this session's scope.
