# Social Studies Director Samples R2

Status: `READY_FOR_DIRECTOR_REVIEW`

This directory contains nine isolated learner-facing Social Studies samples for
Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12. It does not replace or edit the
production Social Studies corpus. Each package preserves an exact canonical
lesson reference and standards line while supplying production-depth structured
content for the existing Rich Study Player.

## Player contract

- Content shape: structured `LearnerMaterialDto` compatible JSON.
- Projection: `createRichLessonRenderModel`.
- Response controls: existing `CHOICE` and `CONSTRUCTED_RESPONSE` controls.
- Browser authority: learner responses are saved pending trusted assessment;
  packages contain no answer key, correctness flag, score, or rubric answer.
- Legacy fallback: not required.

## Teaching rhythm

Every sample uses a subject-appropriate version of:

1. Question and context.
2. Necessary background.
3. Readable source, map, timeline, artifact, or data evidence.
4. A clearly labeled `EXAMPLE` with complete modeled reasoning on a different
   case, clause, dataset, or network.
5. A real learner response.
6. Evidence- and reasoning-specific feedback.
7. A fresh independent response with less support.
8. A final lesson review containing all seven required review fields.

## Source and neutrality boundary

Historical excerpts are short, public-domain, attributed, and contextualized.
Paraphrases are labeled as paraphrases. Simulated dossiers and datasets are
explicitly identified as fictional training evidence. The Grade 9 contested
policy sample separates statutory facts, implementation, political viewpoint,
historical interpretation, and opinion while fairly representing relevant
supporting and critical perspectives.

The machine-readable nine-grade authority is
`SOCIAL_STUDIES_DIRECTOR_SAMPLES_R2.manifest.json`.
