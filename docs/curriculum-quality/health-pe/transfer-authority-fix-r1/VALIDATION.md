# Validation

All commands ran in the correction worktree on 2026-08-14.

## Canonical HS PE

```sh
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/build-courses.mjs
node --test curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/*.test.mjs
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/validate-course.mjs
```

Result: 432 lessons rebuilt; 34 tests passed; 12/12 canonical gates passed.
The transfer-evidence-authority gate confirmed exactly 96 repaired lessons.

## Final Health/PE corpus and semantic controls

```sh
cd curriculum-production/final/health-physical-education
node --test tooling/*.test.mjs
node src/generate.mjs
node tooling/validate.mjs
node tooling/health-content-audit.mjs
```

Result: 16 tests passed. The generator emitted 1,431 READY items, 0 review,
0 not-ready, and 0 privacy findings. The validator checked 1,431 learner
packages plus 1,431 paired scoring guides and reported all 216 HS PE transfer
lessons consistent: 0 scoring-authority conflicts and 0 content-transfer
conflicts. All 972 PE lessons remained executable with zero content issues.
The Health audit remained clean: 324 meaningful/actionable lessons, 0 privacy
findings, 0 safety findings, and the Grade 3 H2 trace passed.

## All 216 reviewed cases

```sh
node docs/curriculum-quality/health-pe/transfer-authority-fix-r1/run-fix-validation.mjs
```

Result:

```text
Validated 216 reviewed cases.
Before: scoring=60, content=36, false-positive=120.
After: scoring=0, content=0, total=0.
Preserved: false-positive=120, safety=216.
```

The validator also confirmed all 216 admitted bindings remain
`completionAuthority: LEARNER_AUTHORITY`.

## Projection and release gates

```sh
node --test scripts/learner-projection/structured-projection-r1.test.mjs
npm run curriculum:build
npm run audit:learner-release
npm run audit:web-release
```

Result: 5 projection tests passed; all 8,292 admitted lesson packages projected;
the learner gate reported 8,292/8,292 lessons and 699/699 assessments ready;
the web security gate passed after the lockfile-pinned dependencies were made
available locally with `npm ci --ignore-scripts`. The production build scanned
338 browser files with zero answer-authority findings, the family-pilot launch
gate passed, and its 10 route/default-off lifecycle tests passed.

## Determinism

The canonical build, final corpus, and learner projection were hashed, rebuilt,
and hashed again in the same worktree. Before and after tree digests matched:

```text
canonical_build   bae00573e9e25ffd859c5e23793ad97e225d9b83d899725b101f3a91f7d6ab53
final_corpus      85ac9fd8eecd82a60108978f6ff648b9735ee620200164b3eed3041a925b35a2
learner_projection 92716e08a553d10f60c95de3ae47311b8f1cbf93f7b41f9661eeb8945e2a7113
```
