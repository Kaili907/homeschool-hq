# Mathematics Director Samples R2

This namespace contains nine isolated, normal instructional lesson samples for
Director review. It does not replace or mutate the production Mathematics
curriculum.

Each `samples/grade-*.json` file is a review wrapper around a
`learnerMaterial` object. That nested object uses the same structured
`LearnerMaterialDto` contract projected by `createRichLessonRenderModel` and
rendered by `RichLessonPresentation`. The wrapper records the unchanged
canonical course, source lesson/package, and standards mapping.

The learner samples intentionally contain no answer keys or scoring rules.
Protected criteria live in `restricted/assessment-authority.json`, which is not
imported by browser code. Authored feedback is explanatory but not
answer-bearing; the Rich Player selects a feedback branch only after it receives
a trusted assessment decision. A lesson review is part of each learner
material, while response counts and skill evidence are supplied at runtime.

Grade 6 is intentionally absent. These samples are not imported by the Family
Pilot catalog and cannot replace production lessons accidentally.
