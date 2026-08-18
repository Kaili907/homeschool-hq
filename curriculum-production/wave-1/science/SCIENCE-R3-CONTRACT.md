# Science R3 Contract

**Status: DERIVED — awaiting Director approval of the Wave 1 reference lesson**

This document is derived from the frozen R2 approval artifacts. It adds no new requirement
of its own. Where the frozen contracts are silent, the question is recorded in
[Open questions](#open-questions) and left undecided.

## Controlling sources

| Artifact | Role |
|---|---|
| [`curriculum/approvals/director-samples-r2-approved.json`](../../../curriculum/approvals/director-samples-r2-approved.json) | Binding machine-readable approval manifest (36 samples) |
| [`docs/curriculum-quality/APPROVED-LESSON-CONTRACTS-R2.md`](../../../docs/curriculum-quality/APPROVED-LESSON-CONTRACTS-R2.md) | Common Lesson Contract and Science model |
| [`docs/curriculum-quality/DIRECTOR-SAMPLES-R2-APPROVED.md`](../../../docs/curriculum-quality/DIRECTOR-SAMPLES-R2-APPROVED.md) | Approval record and frozen inventory |
| [`docs/curriculum-quality/science/director-samples-r2/samples/`](../../../docs/curriculum-quality/science/director-samples-r2/samples) | The nine approved Science lesson bodies |
| [`docs/curriculum-quality/science/director-samples-r2/science-director-sample.schema.json`](../../../docs/curriculum-quality/science/director-samples-r2/science-director-sample.schema.json) | Lesson schema |
| `curriculum-production/final/science/packages/<courseId>/work-packages.jsonl` | Canonical sequence, standards, and scientific correctness authority |

All six are read-only to R3 authoring. Frozen artifacts are never regenerated, reinterpreted,
re-modelled, or replaced.

## 1. Common Lesson Contract (carried unchanged from R2)

Every R3 Science lesson:

1. Is experienced through the real Rich Study Player and its real learner-response runtime.
2. Writes TEACH to the learner, in age-appropriate language, with a clear purpose.
3. Labels a WORKED EXAMPLE that shows both the answer and the reasoning. Looking at an
   example is not mastery.
4. Gives YOUR TURN a real supported response control. A question must never lead to nowhere
   to type, choose, or enter a response.
5. Makes FEEDBACK instructional: it explains the reasoning, names the next move, and supports
   correction or reteaching.
6. Collects real learner-response evidence in PRACTICE.
7. Keeps TAUGHT, PRACTICED, and DEMONSTRATED distinct. Viewing an example is not mastery, and
   one response is not by itself sufficient evidence of mastery.
8. Ends with a meaningful LESSON REVIEW containing: What you learned; Evidence you used; How
   you did; What to practice; Review this lesson; Course progress; Next action. Never only
   "Great work" or "Done".
9. Reads at its own grade. Grade 3 reads like Grade 3. There is no single generic voice.

## 2. Science model (carried unchanged from R2)

The approved rhythm is:

**NOTICE → LEARN → MODEL → YOUR TURN → FEEDBACK → APPLY → REVIEW**

Science lessons maintain scientific accuracy and use phenomena, tables, data, and models where
appropriate. They require evidence and reasoning, provide real response controls, and use
subject-specific review rather than generic completion language.

## 3. Observed form of the nine approved Science samples

These are properties read off the frozen bodies, not new rules. They are what "match the
approved model" means in practice.

- One JSON file per lesson, `format: "structured"`, conforming to the frozen schema, imported
  directly as a `LearnerMaterialDto`. No markdown path, no legacy fallback.
- Top-level `phenomenonOrContext`, `lessonGoal`, `successCriteria`, and `vocabulary` carry the
  framing; the phenomenon itself is restated inside the NOTICE section body, because
  `phenomenonOrContext` is metadata the player does not render as a page.
- Sections carry `sectionRef` + `sectionKind` + `title`. Questions live in `items[]` with
  `itemRef`, `itemKind`, and `responseKind`.
- Section titles open with the rhythm beat (`NOTICE — …`, `LEARN — …`, `MODEL — …`,
  `YOUR TURN — …`, `FEEDBACK — …`, `APPLY — …`), in rhythm order.
- Feedback is its own `sectionKind: "remediation"` section, carries `feedbackFor`, holds no
  items of its own, and is placed after the item it answers, so it is response-gated by page
  order and cannot leak ahead of the learner's response.
- The worked example uses `itemKind: "worked-example"` with `workedSolution.steps`, which the
  runtime maps to a read-only LEARN item. It never becomes learner evidence.
- Data uses `section.data` with `tableLabel`, `columns`, `rows`, and a `note`. Constructed
  numbers are labelled as instructional, never as observed or published results.
- The final seven sections are exactly `WHAT YOU LEARNED`, `EVIDENCE YOU USED`, `HOW YOU DID`,
  `WHAT TO PRACTICE`, `REVIEW THIS LESSON`, `COURSE PROGRESS`, `NEXT ACTION`, in that order.
  `REVIEW THIS LESSON` carries a real response item. `HOW YOU DID` says the saved work is
  pending assessment rather than claiming mastery.
- `lessonReview` is a seven-key attestation block. See [Open question 1](#1-lessonreview-shape).
- The lesson's course, grade, title, and standards are carried from the canonical
  `work-packages.jsonl` record, not authored. The canonical
  `scientific_correctness_authority` — its `relationships`, `fixed_facts`,
  `disqualifying_errors`, and `out_of_scope` — is the accuracy authority for the lesson.
- No `?` appears anywhere in a lesson except inside an item `prompt`. A question anywhere else
  is a question with nowhere to answer it, which the R2 validator rejects.
- No answer key, scoring key, or correctness authority is present in learner-reachable content.

## 4. Anti-template rule

Every lesson must be specific to its own learning objective: its own teaching approach, its own
worked example with real content, its own YOUR TURN items, its own misconception-keyed
feedback, its own review. Two lessons that differ only by topic nouns are a failure and are
rewritten.

This is mechanized: no body, directions, prompt, or worked-example step of 80 characters or
more may repeat, normalized, either across R3 lessons or from any of the nine frozen Science
samples.

## 5. Learner-facing voice

**Provenance:** this section is not derived from the R2 contracts. It records the Director's
stated grounds for rejecting the first Wave 1 lesson draft (2026-08-18), applied as a
requirement to Wave 1 onward.

It diverges from the frozen model in one place worth naming: the frozen Grade 3 sample's HOW YOU
DID says "They remain pending assessment", and the Director ruled that a Grade 3 learner must
not read that phrase. Wave 1 therefore carries the same guarantee in child-facing words
("saved and waiting to be checked"), which makes Wave 1 stricter than the approved sample on
this point rather than looser. The validator accepts either wording and additionally fails any
HOW YOU DID that claims the learner was correct.

Learner-facing prose speaks to the learner. It never names the Director, an approval state, a
wave, a manifest, a schema, or a release process, and it never describes constructed data as
anything a learner has to decode. Constructed numbers are labelled as an example made up for
the lesson.

Density is measured against the frozen sample of the same grade, not judged by eye. The frozen
Grade 3 sample runs 32.6 words per section on average, a maximum body of 51 words, and feedback
bodies of 28 to 34 words. A Grade 3 R3 lesson holds to that band; the validator fails a body
over 55 words or a feedback body over 40.

Any question a learner is asked must be answerable with a step the learner has been taught and
can carry out. Where a numeric answer could reasonably vary, the feedback states the accepted
range, because the lesson file may not carry one.

## 6. Validation

```bash
node --disable-warning=ExperimentalWarning --experimental-transform-types --experimental-loader ./docs/curriculum-quality/science/director-samples-r2/ts-loader-hook.mjs ./scripts/curriculum/validate-science-r3-wave1.mjs
```

The validator proves the R2 freeze is byte-intact, the manifest covers the whole canonical
course, canonical mapping and correctness authority, the approved rhythm in order, a response
control behind every question, response-gated instructional feedback, the seven-part review,
TAUGHT distinct from PRACTICED, rich (not legacy) presentation, real persistence through the
real `LearnerResponseRuntime` with every response `PENDING_ASSESSMENT`, labelled instructional
data, no learner-facing build or approval language, grade-appropriate density, and no copy
reused from the freeze.

`src/study/curriculum-preview-r3/scienceR3ReferenceLesson.test.ts` proves the same lesson
through the real render model and the real canonical in-memory learner-response store under
`vitest run --project root-app`.

## Open questions

The frozen R2 contracts do not cover the following. They are recorded here undecided. Where
Wave 1 had to act in order to produce a renderable lesson, the provisional choice is disclosed
so it can be confirmed or rejected — it is not proposed as a contract term.

### 1. `lessonReview` shape

The frozen Science samples carry `lessonReview` as a seven-key attestation block of strings
(`"present"`, `"present-with-response"`). The player's `LearnerLessonReview` type expects
`whatYouLearned: string[]`, `courseProgress: string`, a `nextAction` enum, and
`reviewActionLabel`. The R2 gallery bridges the two in `src/study/director-review/registry.ts`,
which is frozen and scoped to the R2 approval manifest.

Undecided: whether production R3 lessons carry the attestation block (and something normalizes
it at load), or carry the player DTO directly; and where a production normalizer lives.

*Wave 1 disclosure:* the lesson carries the attestation block, matching the frozen samples and
the frozen schema. The preview route carries its own normalizer, used only by the preview.

### 2. `sampleRevision` constant for production lessons

The frozen schema pins `sampleRevision` to the const `SCIENCE_DIRECTOR_SAMPLES_R2`, so any
lesson that validates against it must carry that value, including production lessons that are
not Director samples.

Undecided: whether R3 production lessons get their own schema and revision constant, or keep
validating against the frozen sample schema.

*Wave 1 disclosure:* the lesson carries `sampleRevision: "SCIENCE_DIRECTOR_SAMPLES_R2"` to
validate, plus additive `productionRevision: "SCIENCE_R3_WAVE_1"` and `authoringStatus` fields.

### 3. Promotion path into the final package

Wave 1 writes to `curriculum-production/wave-1/science/grade-03/`, deliberately separate from
`curriculum-production/final/science/packages/ma-g3-science/`.

Undecided: how an approved R3 lesson body is promoted into the final package, and what the
released relationship is between a `work-packages.jsonl` record and an authored lesson body.

### 4. Canonical adult-facing fields

Each canonical work package carries `safety_brief`, `guardian_record`,
`equal_credit_safe_alternative`, `accessibility`, `home_connection`, `extension`, and
`remediation.adult_routes`. None of the nine frozen Science samples surface any of them in the
learner lesson.

Undecided: whether R3 production lessons must carry these, and whether they stay adult-facing
in the work package or gain a learner-facing surface.

### 5. Canonical `analysis_questions` coverage

Each canonical work package carries seven `analysis_questions` with kinds such as
`ACTIVATE_PRIOR`, `COMMUNICATE_REPRESENTATION`, `CHECK_REVISE`, `ESSENTIAL_QUESTION`,
`EVIDENCE_QUALITY`, `LIMITATION`, and `PROVENANCE`. The frozen samples do not map their items
onto these kinds.

Undecided: whether an R3 lesson must cover all seven canonical question kinds, a stated subset,
or none of them as a structural requirement.

### 6. Response-type register by grade

The frozen Grade 3 Science sample uses `CHOICE` and `TEXT`. Grades 4 and up use
`CONSTRUCTED_RESPONSE`, and Grades 5, 7, 8, 10, and 11 use `NUMERIC`.

Undecided: which response kinds are permitted at Grade 3.

*Wave 1 disclosure:* the lesson uses `CHOICE`, `NUMERIC`, and `TEXT`. `CONSTRUCTED_RESPONSE`
was not used at Grade 3. The `NUMERIC` item asks the learner to order three values and enter
the middle one, which is a step a Grade 3 can execute; its feedback names the accepted range
in prose, because an accepted range in the lesson file would be answer authority in
browser-reachable content.

### 7. Assessment authority for Science

The R2 contracts state that review responses remain `PENDING_ASSESSMENT` without an approved
assessor, and the ELA model names Parent Review where judgment is required. The Science model
names no equivalent.

Undecided: who the approved assessor is for Grade 3 Science production, and whether Parent
Review applies to Science constructed responses.

### 8. Wave sizing and course completion

Undecided: whether the remaining 107 Grade 3 Science lessons are authored in units, in phase
bands across units, or in another order; and whether a course is releasable before all 108 are
authored.
