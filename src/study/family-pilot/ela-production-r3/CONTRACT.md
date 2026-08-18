# ELA Production R3 — Derived Contract

**Status: DERIVED, NOT NEW.**

This document restates, for ELA production, exactly what the frozen R2 artifacts
already require. It adds nothing. Every clause below cites the frozen source it
comes from, and `elaProductionR3.test.ts` re-derives each machine-checkable
clause directly from the nine frozen ELA samples, so this document cannot drift
away from them silently.

Binding sources, both FROZEN and unmodified by this branch:

- `curriculum/approvals/director-samples-r2-approved.json` — the binding manifest
  (`DIRECTOR_SAMPLES_R2_APPROVED`, gallery SHA `416664e165…`, freeze date
  `2026-08-18`).
- `docs/curriculum-quality/APPROVED-LESSON-CONTRACTS-R2.md` — the prose contract.
- `src/study/family-pilot/ela-director-samples-r2/` — the nine approved ELA
  samples, all marked `DIRECTOR_APPROVED_FOR_PRODUCTION`.

Where production needs a decision these sources do not make, this document does
not make it either. See [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md).

---

## 1. Scope

Grades 3, 4, 5, 7, 8, 9, 10, 11, 12. Grade 6 does not exist.

*Derived from:* approval manifest `grades` and `grade6Excluded: true`.

## 2. Runtime

Every lesson is a structured `LearnerMaterialDto` that projects through the real
`createRichLessonRenderModel` into the Rich Study Player, with no legacy or
markdown fallback, and through the real `LearnerResponseRuntime` for responses.
No parallel engine, runtime, or lesson model is introduced.

*Derived from:* Common Lesson Contract — "The learner experiences the lesson
through the real Rich Study Player and its real learner-response runtime"; all
nine samples are `format: 'structured'` with `richPlayerCompatible: true` and
`legacyFallbackRequired: false` in the approval manifest.

## 3. The eighteen-section flow

In this exact order:

| # | Section | `sectionKind` |
|---|---|---|
| 1 | `WELCOME / PURPOSE` | `teaching` |
| 2 | `SHORT INSTRUCTION` | `teaching` |
| 3 | `WORDS TO KNOW` | `vocabulary` |
| 4 | `EXAMPLE / LET'S LOOK AT ONE` | `worked-example` |
| 5 | `READ: <reading title>` | `source` |
| 6 | `YOUR TURN — GUIDED PRACTICE` | `guided-practice` |
| 7 | `FEEDBACK — CHECK THE REASONING` | `remediation feedback-after-response` |
| 8 | `YOUR TURN — INDEPENDENT RESPONSE` | `independent-practice` |
| 9 | `FEEDBACK — PREPARE TO REVISE` | `remediation feedback-after-response` |
| 10 | `YOUR TURN — REVISE` | `independent-practice additional-practice revision` |
| 11 | `PARENT REVIEW` | `rubric-review-pending` |
| 12–18 | the seven review pages | `reflection` |

*Derived from:* the section list every one of the nine approved samples emits.

## 4. Teaching and the worked example

TEACH is written to the learner in age-appropriate language with a clear purpose.
The worked example is clearly labelled, shows both the reasoning and the model
response, sits on a microtext distinct from the lesson reading, and projects as a
non-required `READ` instructional example. Viewing it is not mastery and it is
never mixed into protected learner work.

*Derived from:* Common Lesson Contract — "TEACH is written to the learner…";
"A WORKED EXAMPLE is clearly labelled and shows both the answer and the
reasoning. Looking at an example is not mastery."; "TAUGHT, PRACTICED, and
DEMONSTRATED remain distinct."

## 5. Response controls

Exactly three required learner responses, in order:

1. guided fixed choice — `CHOICE`
2. independent constructed response — `CONSTRUCTED_RESPONSE`
3. revision constructed response — `CONSTRUCTED_RESPONSE`

Every required item carries a prompt. A question never leads to nowhere to type,
choose, or enter a response.

*Derived from:* Common Lesson Contract — "YOUR TURN always has a real supported
response control. A question must never lead to nowhere to type, choose, or enter
a response."; ELA model — "Learners receive real constructed-response surfaces,
opportunities for revision, and useful multiple-choice feedback."; the required
sequence produced by all nine approved samples.

## 6. Feedback

Feedback is instructional: it explains the reasoning, names the next move, and
supports correction or reteaching. It is released on a page *after* the linked
response page, never before, and projects as a `PRACTICE` / `remediation` page.

*Derived from:* Common Lesson Contract — "FEEDBACK is instructional…"; the
feedback-link ordering asserted by the frozen R2 gate.

## 7. No invented essay score

Constructed writing is saved as pending evidence and routed to Parent Review.
Exactly one `RUBRIC_REVIEW_PENDING` item per lesson. The learner-visible material
states "No automatic essay score is produced" and "pending human judgment". No
answer key, correct-choice, solution, scoring, or mastery-criteria field appears
anywhere in the learner record.

*Derived from:* ELA model — "The system must not pretend to deterministically
score an essay. Where judgment is required, the lesson provides Parent Review.";
the frozen R2 gate's forbidden-key and required-phrase probes.

## 8. Readings

Age-appropriate, complete, delivered inline, and declared `creator: Manuel
Academy`, `rightsCategory: original`. Reading directions are always present. The
recorded word count equals the delivered body. No copyrighted text.

*Derived from:* ELA model — "ELA lessons use age-appropriate passages."; the
`reference` block on every approved sample's source section.

## 9. Review

Seven review pages, in order: WHAT YOU LEARNED, HOW YOU DID, WHAT YOU DID WELL,
WHAT TO PRACTICE, REVIEW THIS LESSON, COURSE PROGRESS, NEXT ACTION. The lesson
ends on NEXT ACTION. Review reflects what the learner actually did and is never
only "Great work" or "Done".

*Derived from:* Common Lesson Contract — "LESSON REVIEW is meaningful and
includes…"; ELA model — "The end review is meaningful and reflects what the
learner actually did."

## 10. Age progression and no generic template

Grade 3 reads like Grade 3 and Grade 12 like mature high-school work. There is no
single generic voice. Instructional copy is never repeated inside a lesson, and
never repeated verbatim across lessons.

*Derived from:* Common Lesson Contract — "AGE PROGRESSION is real… There is no
single generic voice."; `DIRECTOR-SAMPLES-R2-APPROVED.md` freeze rule — the
approved samples "must not be regenerated, reinterpreted, re-modelled, or
replaced by a generic lesson template."

---

## Observed, not ruled

These are measurements of the approved samples, reported by the validator as
non-failing observations. The frozen contract sets no bound for any of them and
this harness does not invent one.

| Grade | Reading words | Vocabulary terms | Guided choices |
|---:|---:|---:|---:|
| 3 | 178 | 2 | 3 |
| 4 | 241 | 3 | 3 |
| 5 | 224 | 3 | 3 |
| 7 | 310 | 3 | 3 |
| 8 | 275 | 3 | 3 |
| 9 | 343 | 3 | 3 |
| 10 | 206 | 3 | 3 |
| 11 | 373 | 3 | 3 |
| 12 | 493 | 3 | 3 |
