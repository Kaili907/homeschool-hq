# Social Studies Director Samples R2 — Validation

Validation status: `PASS`

## Coverage

| Grade | Canonical lesson | Evidence emphasis | Learner controls | Review |
| --- | --- | --- | --- | --- |
| 3 | `ma-g3-social-studies-u06-l03` | Michigan timeline | choice, constructed response | complete |
| 4 | `ma-g4-social-studies-u02-l06` | accessible regional text maps | choice, constructed response | complete |
| 5 | `ma-g5-social-studies-u03-l06` | public-domain map and repository context | choice, constructed response | complete |
| 7 | `ma-g7-social-studies-u02-l06` | simulated excavation records and context | choice, constructed response | complete |
| 8 | `ma-g8-social-studies-u01-l07` | public-domain founding-document excerpts | choice, constructed response | complete |
| 9 | `ma-g9-social-studies-u05-l06` | statute and contrasting party-platform viewpoints | choice, constructed response | complete |
| 10 | `ma-g10-social-studies-u02-l03` | network map and traveler-account context | choice, constructed response | complete |
| 11 | `ma-g11-social-studies-u08-l06` | official indicator definitions and fictional fixed data | choice, constructed response | complete |
| 12 | `ma-g12-social-studies-u03-l03` | simulated provenance and source-dependence dossier | choice, constructed response | complete |

## Automated proof

`src/study/family-pilot/lesson-player/socialStudiesDirectorSamplesR2.test.ts`
verifies:

- the exact requested grade set and a count of nine;
- exact canonical lesson ID, title, course, and standards-line agreement;
- structured Rich Study Player projection with `mode: rich`;
- only supported learner response controls;
- an `EXAMPLE` worked analysis before actual learner response;
- reasoning-specific feedback followed by fresh independent evidence;
- all seven review fields on the final section;
- source-integrity declarations and no browser answer/scoring authority keys;
- no substantive exact-copy duplication across grades; and
- isolation from the production Social Studies root.

## Source-integrity review

- Michigan dates were checked against Library of Congress and U.S. Senate
  statehood records.
- The Waldseemüller map title, creator, date, and repository were checked against
  the Library of Congress item record.
- The Articles of Confederation and Constitution excerpts were checked against
  National Archives transcripts.
- The Social Security Act institutional summary was checked against the Social
  Security Administration's 1935 act transcript.
- The Grade 9 contrasting viewpoints were paraphrased from the 1936 Democratic
  and Republican party platforms and labeled as persuasive campaign sources.
- Archaeology, economic-data, and source-dependence simulations are labeled as
  simulations or fictional practice data wherever they appear.

No historical quotation is invented. No simulated record is presented as a
real event or source.

## Accessibility and readability

Every evidence display has a text route. Maps have legends and text descriptions;
tables have labeled columns and rows; no task depends on color. Existing Rich
Study Player keyboard focus, visible-focus, forced-color, reduced-motion, and
responsive safeguards remain the rendering authority.

Measured authored prompt/body sentence lengths progress from an average of 8.6
words in Grade 3 to sustained high-school analysis without exceeding 27 words
in any measured sentence. Elementary lessons use concrete examples and short
actions; secondary lessons increase source comparison, context, limitation,
and argument demands.

## Commands

- `npm run typecheck`
- `npx vitest run --project root-app src/study/family-pilot/lesson-player/socialStudiesDirectorSamplesR2.test.ts src/study/family-pilot/lesson-player/FamilyPilotLessonPlayer.test.tsx src/study/family-pilot/lesson-player/renderModel.test.ts src/study/family-pilot/final-app/learner-response/mapping.test.ts src/study/family-pilot/final-app/learner-response/runtime.test.ts`

Result: TypeScript passed. Five test files passed with 82 tests.

`SOCIAL_DIRECTOR_SAMPLES_R2_READY_FOR_REVIEW`
