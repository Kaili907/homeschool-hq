# Technology cross-lesson solution-exposure correction R2

Status: `TECHNOLOGY_SOLUTION_EXPOSURE_R2_READY_FOR_ACCEPTANCE`

Parent repair: `7de7b9ad0e9af396937270079f4db0e0d4118990`

## R1 acceptance failure and root cause

R1 correctly removed exact repairs from 68 protected learner packages, kept
19 legitimate `MODEL` worked examples, and retained adult solution authority.
Its semantic gate nevertheless evaluated each package independently. The
browser does not enforce that boundary: selecting a course loads one lazy JSON
payload containing all lesson materials in that course.

The canonical activity generator reused one code-case family across lessons.
Within a family it changed only the lesson-derived identifier while preserving
the starter structure, defect, tests, and effective repair. A worked model was
therefore an answer key for protected siblings in the same course payload.
Course-level reconstruction reproduces the independent acceptance inventory:
45 non-summative exposures plus 11 summative exposures, 56 total.

## Canonical generator repair

`src/technologyActivitySetup.mjs` now has separate canonical paths for worked
and protected code cases. Protected fixtures and their evidence contracts stay
unchanged. Every `MODEL` remains a complete, labelled, non-penalty worked
example, but its program structure, data, defect, repair, output, and tests are
materially different from protected fixtures. Examples include a reverse-loop
inclusive-boundary case instead of the protected forward-loop initial-index
case, and a running-total identity case instead of protected maximum-value
initialization.

The repair changes the generator, then regenerates packages and scoring guides;
it does not patch emitted JSON by hand. All 19 model scoring guides were
regenerated so their adult reference exactly matches their own retained worked
solution. The other 68 protected adult references remain unchanged.

## Course-level semantic gate

`tests/solution-exposure-audit.mjs` reads the 336 admitted Technology bindings,
projects every package with the same `projectJsonLearnerMaterial` function used
by `scripts/build-final-family-pilot-data.mjs`, and groups the projections into
the nine actual browser course payloads. Within each payload it compares every
learner-visible worked solution against every protected code/debug task.

The equivalence rule requires both fixture and repair equivalence:

- starter tokens ignore whitespace, comments, and consistent identifier
  renaming;
- a second structure fingerprint catches cosmetic literal/fixture substitution
  while retaining operators and control flow;
- normalized tests must still describe equivalent inputs and results;
- repair text uses bounded token similarity, controlled wording synonyms, and
  explicit edit signatures;
- same-concept examples with a different defect or repair pass.

Because every lesson body coexists client-side after the payload loads, course
day does not create privacy. A model after a protected task is still compared
and fails if it exposes the task.

## Negative and positive controls

`node --test tests/course-payload-solution-equivalence.test.mjs` covers all
seven required controls:

1. same starter and repair under a different lesson ID: fail;
2. variable-renamed equivalent program and repair: fail;
3. cosmetically reworded exact fix: fail;
4. materially distinct analogous worked fixture: pass;
5. same concept with a different bug and solution: pass;
6. summative task solved by an earlier model: fail;
7. solution in a later model: fail under complete-payload visibility.

## Browser-payload proof

The normal browser-data builder generated 90 lazy course payloads and projected
8,292 lessons. The nine emitted Technology JSON files were then independently
hashed at their `materials` boundary; all 9/9 course hashes and all 336/336
lesson materials match `browser-payload-proof.json`. Adult fields removed by
the full build: 25,848. Adult resource locators removed: 7,320.

## Final corpus result

| Measure | Before R2 | After R2 |
| --- | ---: | ---: |
| Legitimate worked examples | 19 | 19 preserved |
| Non-summative protected exposures | 45 | 0 |
| Summative protected exposures | 11 | 0 |
| Total protected semantic exposures | 56 | 0 |
| Trusted adult solution references | 87 | 87 complete |
| Formal adult-key leaks | 0 | 0 |
| Technology lessons audited | 336 | 336 |

`case-mapping.json` and `case-mapping.csv` record every one of the 56 protected
lessons, its exposing worked lesson or lessons before R2, its post-repair
fixture comparison, generated file paths, and artifact hashes. The complete
semantic result and corpus hashes are in `semantic-gate-report.json`.

## Determinism and verification

Two consecutive full `node generate.mjs` runs produced the same aggregate hash
over every generated package and scoring guide:
`56d8c3194e6e48b0d518bb4f73ad0fe28a1a29acd37eec25ef3f42e9b5db8571`.
The structured record is `determinism.json`.

Verification passed:

- production gate: 984/984 ready;
- duplicate-content gate: 0 violations;
- corpus validation: 984 packages plus guides;
- schema validation: 1,968 files;
- Technology actionability: 336/336, including 87/87 code contracts;
- semantic controls: 8/8 tests (seven equivalence controls plus corpus gate);
- course-payload semantic gate: 56 to 0, with 87/87 adult authorities and zero
  formal leaks;
- actual browser payload hash comparison: 9/9 Technology courses and 336/336
  lesson materials.

No Tutor V2, Dashboard, Study Engine, merge, or deployment work is included.
