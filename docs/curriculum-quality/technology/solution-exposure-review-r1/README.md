# Technology learner solution-exposure review R1

Status: **COMPLETE**

Base: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

Scope: all 87 generated Technology/Computer Science learner packages whose `activity_setup.activity_kind` is `CODE_OR_DEBUG`

Method: read-only inspection of the generated learner packages, authored-source registry, generator, learner projection, lesson UI, admitted bindings, canonical assessment projection, and evidence-save path

## Verdict

The source finding is confirmed, with an important classification distinction:

| Classification | Count | Boundary result |
|---|---:|---|
| `LEGITIMATE_WORKED_EXAMPLE` | 19 | Acceptable only as the explicitly non-penalty `MODEL` fixture; independent transfer must use a different fixture. |
| `GUIDED_HINT` | 0 | No `passing_change` is merely a hint; each names the exact repair and the passing outputs. |
| `FULL_SOLUTION_BEFORE_ATTEMPT` | 56 | Violation. The exact repair is visible in the ungated learner package before evidence is saved. |
| `FULL_SOLUTION_AFTER_ATTEMPT` | 0 | No package contains or enforces an attempt gate. A `CORRECT` phase name does not prove an attempt on this exact fixture was collected. |
| `SUMMATIVE_SOLUTION_EXPOSURE` | 12 | Violation. Every mastery package exposes its exact repair before lesson evidence can be saved. |
| `FALSE_POSITIVE` | 0 | All 87 `passing_change` strings identify the exact field, operator, initialization, state expression, or index needed to pass. |

Overall, **68 of 87 cases violate the intended answer-authority boundary**. The remaining 19 are genuine worked-model lessons, not independent or summative evidence. There is no formal adult-key field leak; this is a semantic solution leak carried in a learner field named `passing_change`.

The row-by-row disposition is in [case-review.csv](./case-review.csv). [case-review.json](./case-review.json) adds source lines, hashes, admitted-binding checks, per-summative assessment checks, and the exact generator/projection/render path.

## Why `passing_change` is a full solution

The generator has six code-case families. Every family supplies a broken program, expected test results, a debugging target, and a learner-visible `passing_change` that states the exact repair:

| Generator family | Cases | Exact repair disclosed |
|---|---:|---|
| `GENERIC_SEQUENCE_INDEX` | 50 | Start iteration at index `0`. |
| `ALGORITHM_INITIALIZATION` | 11 | Initialize `best` from `values[0]`. |
| `STALE_STATE_UPDATE` | 10 | Use `current + delta`. |
| `OBJECT_STATE_UPDATE` | 8 | Combine `this.value` with `amount`. |
| `DATA_AGGREGATION` | 7 | Use `total + record.value`. |
| `HTML_ACCESSIBLE_LABEL` | 1 | Inspect `control.label`. |

The strings also disclose the passing outputs. They are stronger than a conceptual cue, defect-location hint, or test oracle.

## Exact source and runtime trace

1. Authored lesson rows are resolved by `curriculum-production/student-work/technology-arts-lessons/src/courses.mjs`: 12 cases from the grade 3–4 sibling source worktree, 24 from the in-repository grade 5/7/8 canonical sources, and 51 from the grade 9–12 sibling source worktree. Every case records the exact `lessons.jsonl` path, line, and row hash.
2. `curriculum-production/student-work/technology-arts-lessons/src/technologyActivitySetup.mjs:11` selects code/debug lessons by focus/title. `buildCodeCase` at line 18 chooses one of the six families. `codeFixture` at line 117 places the exact repair in `debugging_target.passing_change` at line 146.
3. `curriculum-production/student-work/technology-arts-lessons/src/generateLessonMaterials.mjs:257` calls the activity builder and places the resulting object in each task package. The same package is learner material, not a restricted scoring artifact.
4. `scripts/learner-projection/structured-projection-r1.mjs:369` copies `value.activity_setup` wholesale into `activitySetup`. Its forbidden-key rule at lines 568–590 rejects formal answer/scoring keys and misplaced `workedSolution`, but does not inspect `passing_change` semantically.
5. `src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx:802` includes `material.activitySetup` in the learner material view. `MaterialValue` recursively renders every object property. The lesson surface mounts that material at line 960 beside the response player mounted at line 970.
6. Evidence is saved only after learner action: `FamilyPilotLessonPlayer.tsx:116` calls `onSubmitAction`, and the lesson surface persists the response beginning at `FinalFamilyPilotApp.tsx:922`. Therefore the repair is already on screen before protected evidence is captured.

This is one generator defect propagated to 87 outputs. It is not 87 independent authored answer-key leaks.

## Summative determination

For each of the 12 cases, two learner surfaces must be distinguished:

- **Admitted mastery-lesson surface:** exposes the repair. Every reviewed `l05` package has an admitted production binding to that same package. The app makes every admitted lesson assignable, and the lesson surface renders all of `activitySetup` before its response control saves evidence.
- **Canonical assessment surface:** does not directly expose the repair. `curriculum-production/final/assessments/src/generate.mjs:183` extracts only `primary_task` and `deliverable` from these source packages; it does not copy `activity_setup`. The 12 canonical assessment JSON files contain neither `passing_change` nor the repair text.

The overall capability answer is still **YES for all 12**: the learner can see the expected solution in the admitted mastery lesson before protected lesson evidence is collected. The clean canonical assessment projection does not revoke access to the separately admitted mastery lesson from which it was derived.

| Mastery lesson | Family | Learner-visible repair | Canonical assessment | Mastery lesson exposes before save? | Canonical assessment directly exposes? |
|---|---|---|---|---|---|
| `ma-g4-tech-cs-u04-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g4-tech-cs-u04-assessment` | Yes | No |
| `ma-g5-technology-u04-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g5-technology-u04-assessment` | Yes | No |
| `ma-g5-technology-u06-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g5-technology-u06-assessment` | Yes | No |
| `ma-g7-technology-u02-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g7-technology-u02-assessment` | Yes | No |
| `ma-g8-technology-u02-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g8-technology-u02-assessment` | Yes | No |
| `ma-g9-technology-u01-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g9-technology-u01-assessment` | Yes | No |
| `ma-g9-technology-u02-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g9-technology-u02-assessment` | Yes | No |
| `ma-g9-technology-u03-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g9-technology-u03-assessment` | Yes | No |
| `ma-g10-technology-u02-l05` | `ALGORITHM_INITIALIZATION` | Initialize `best` from `values[0]`; outputs 7, -2, and 6. | `ma-g10-technology-u02-assessment` | Yes | No |
| `ma-g11-technology-u02-l05` | `OBJECT_STATE_UPDATE` | Combine `this.value` with `amount`; outputs 5, 0, and 3. | `ma-g11-technology-u02-assessment` | Yes | No |
| `ma-g12-technology-u01-l05` | `GENERIC_SEQUENCE_INDEX` | Iteration begins at index 0; all three tests retain every step in order. | `ma-g12-technology-u01-assessment` | Yes | No |
| `ma-g12-technology-u02-l05` | `STALE_STATE_UPDATE` | Use `current + delta`; outputs 4, 5, and 5. | `ma-g12-technology-u02-assessment` | Yes | No |

The exposure directly contradicts the mastery task language requiring “no scaffold, prompts, or worked example in view.” The assessment metadata's `answerMaterialIncluded: false` is accurate for the narrow canonical assessment DTO, but it is not evidence that the source mastery lesson or course payload is solution-free.

## Intended answer-authority boundary

The repository already expresses the intended boundary in three places:

- The learner projection permits worked solutions only in an `instructional-example` section with a `worked-example` item (`structured-projection-r1.mjs:51–61` and `:584–586`).
- Canonical assessments point to a `restricted:` adult scoring authority and expose only learner tasks (`curriculum-production/final/assessments/src/generate.mjs:290–351`).
- Assessment responses are saved before rubric/adult review (`FinalFamilyPilotApp.tsx:703–739`).

`passing_change` bypasses those controls because its name is not a conventional answer-key field. The content still functions as answer authority. Boundary validation therefore needs semantic or schema-based custody, not only forbidden key names and locator patterns.

## Safest correction model

No curriculum repair is implemented in this review. The safest repository-consistent model is phase-specific:

| Current mode | Cases | Safest model |
|---|---:|---|
| `MODEL` | 19 | **Worked example separation.** Mark the supplied repair as an instructional worked example, collect no independent evidence on that fixture, and use a fresh isomorphic fixture for transfer. |
| `PROBE` | 13 | **Trusted solution reference.** Keep the repair out of learner material; optionally reveal a review only after the dated baseline is saved. |
| `GUIDED` / `GUIDED_B` | 21 | **Hint ladder.** Stage defect symptom → region/variable cue → conceptual operation cue. Do not reveal the exact token before the learner commits the unscaffolded case. |
| `BUILD` | 9 | **Hint ladder plus trusted solution reference.** Learners retain the specification and tests; the exact reference repair stays outside the browser/evidence surface. |
| `CORRECT` | 13 | **Post-submission review.** First capture the learner's original repair and defect log for this exact fixture, then reveal/compare against the trusted repair. An earlier lesson with a similar topic is not an adequate gate. |
| `DEMONSTRATE` | 12 | **Trusted solution reference, then post-submission review.** Keep the repair in restricted assessor custody until every required response is durably saved and the assessment is submitted. |

The smallest safe generator change would be to stop treating `activity_setup` as phase-neutral. Preserve starter code, specifications, and tests in learner material, but emit exact solution data only into one of two explicit structures:

1. an instructional `workedSolution` allowed solely for a clearly separated worked-example item; or
2. a trusted/restricted solution reference used by post-submission review or an assessor.

This approach uses existing repository concepts and does not require Tutor V2.

## Reproduction and evidence integrity

Run from the repository root:

```sh
node docs/curriculum-quality/technology/solution-exposure-review-r1/audit-solution-exposure.mjs
```

The audit fails unless it resolves exactly 87 cases, exactly 12 summative cases, all six known exact-repair families, every authored source row, every admitted lesson binding, and every canonical summative assessment. It also verifies the generator → projection → render → response-save trace. Source and package hashes are recorded in `case-review.json`.

Only files under this review directory are created. Curriculum, Tutor V2, runtime code, and generated production packages remain unchanged.
