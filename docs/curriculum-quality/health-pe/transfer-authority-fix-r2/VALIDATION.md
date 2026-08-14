# R2 Validation

All commands ran in the R2 worktree on 2026-08-14.

## Canonical HS PE source

```sh
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/build-courses.mjs
node --test curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/*.test.mjs
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/validate-course.mjs
```

Result: 432 lessons rebuilt; 34 tests passed; 12/12 gates passed. The
transfer-evidence-authority gate found 216 valid structured transfer records and
exactly 96 R1 authored-unit-evidence markers.

## Final Health/PE corpus and structured controls

```sh
cd curriculum-production/final/health-physical-education
node src/generate.mjs
node --test tooling/*.test.mjs
node tooling/validate.mjs
node tooling/health-content-audit.mjs
```

Result: 25 tests passed. The generator emitted 1,431 READY items, 0 review,
0 not-ready, and 0 privacy findings. The validator checked 1,431 learner
packages plus 1,431 adult guides and reported all 216 HS PE transfer lessons
consistent: 0 scoring-authority conflicts and 0 content-transfer conflicts. All
972 PE lessons remained executable with zero content issues. The Health audit
reported 324 meaningful/actionable lessons, 0 privacy findings, 0 safety
findings, and an exact Grade 3 H2 trace.

## All 216 reviewed cases

```sh
node docs/curriculum-quality/health-pe/transfer-authority-fix-r2/run-r2-validation.mjs
```

Result:

```text
Validated 216 reviewed cases through manuel-academy.pe-transfer-authority.v2.
Historical: scoring=60, content=36, false-positive=120.
Final: scoring=0, content=0, unexplained=0.
Preserved: false-positive=120, safety=216, learner-authority=216.
CURRICULUM_SEMANTICS_CHANGED=NO
```

## Projection and release gates

```sh
node --test scripts/learner-projection/structured-projection-r1.test.mjs
npm run curriculum:build
npm run audit:learner-release
npm ci --ignore-scripts
npm run audit:web-release
```

Result: 5 projection tests passed; all 8,292 admitted lesson packages projected;
the learner gate reported 8,292/8,292 lessons and 699/699 assessments ready.
The lockfile install supplied local Vite/Vitest dependencies without running
package scripts. The web gate built 556 modules, scanned 338 browser files with
zero answer-authority findings, passed the family-pilot launch audit, and passed
all 10 route/default-off lifecycle tests.

## Checksums and determinism

The canonical source builder, final generator, and learner projection were run
twice after the final schema, test, and documentation changes. Tree digests and
the checksum manifest were identical across both runs:

```text
canonical_build    125e29c33240f050e526d79227bedf469c64dbae40a23412d5763007489db700
final_corpus       c5e468b258e7c3b68fa5fc3882210566db9abfa4a11c0b9a8d65a8835a563501
learner_projection 92716e08a553d10f60c95de3ae47311b8f1cbf93f7b41f9661eeb8945e2a7113
checksum_manifest  1dfc6282f04c3b6132238278ea59fc2cae9a93b6ad981adbcb495c840b7eaf22
```

```sh
cd curriculum-production/final/health-physical-education
sha256sum -c SHA256SUMS.txt
```

Result: PASS, with 2,883/2,883 inventoried files verified.
