# Science Director Samples R2

Status: `READY_FOR_DIRECTOR_REVIEW`

This review-only directory contains one learner-facing Science sample for each
supported grade: 3, 4, 5, 7, 8, 9, 10, 11, and 12. It does not replace, overlay,
or register any file in `curriculum-production/final/science`.

The samples use the canonical Rich Study learner-material shape consumed by
`mapLearnerMaterialToStudySegments` and `createRichLessonRenderModel`. Every
question is an item with a supported response control. Worked examples are
read-only, independent evidence is saved through the existing learner-response
runtime, and the browser does not decide correctness or mastery.

## Teaching model

The common rhythm is `NOTICE -> LEARN -> MODEL -> YOUR TURN -> FEEDBACK -> APPLY
-> REVIEW`. Player segments keep teaching, practice, and review distinct. Static
feedback is response-gated by page order and diagnoses scientific reasoning; it
contains no scorer key. Review responses remain `PENDING_ASSESSMENT` without an
approved assessor.

Elementary samples use concrete situations, short prose, brief vocabulary, and
labeled tables or sequences. Grades 7–8 add multi-step data and model reasoning.
Grades 9–12 add quantitative evidence, causal systems, model assumptions,
uncertainty, limitations, and claim-evidence-reasoning.

## Data and accuracy model

Canonical course, lesson, grade, title, and standard mappings are checked
directly against the nine production Science `work-packages.jsonl` files. Each
selected lesson must also carry the existing scientific correctness authority.
Any constructed numbers are labeled as fictional or instructional model output,
never as observed or published empirical results.

## Validation

Run from the repository root:

```bash
node --disable-warning=ExperimentalWarning \
  --experimental-transform-types \
  --experimental-loader ./docs/curriculum-quality/science/director-samples-r2/ts-loader-hook.mjs \
  ./docs/curriculum-quality/science/director-samples-r2/validate.mjs
```

The validator proves schema conformance, exact canonical mappings, Rich Study
mode, response persistence through the real runtime, response-gated feedback,
the seven-part lesson review, unique substantive copy, no protected answer key,
no legacy fallback, and labeled data/model components.

See `manifest.json` for the grade-by-grade review index and readability notes.
