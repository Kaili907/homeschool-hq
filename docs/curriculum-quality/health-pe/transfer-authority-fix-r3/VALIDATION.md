# R3 Validation

All commands ran in the R3 worktree on 2026-08-14.

## Canonical HS PE source

```sh
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/build-courses.mjs
node --test curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/*.test.mjs
node curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/tools/validate-course.mjs
```

Result: 432 lessons rebuilt; 41 tests passed; 12/12 gates passed. The
transfer-evidence-authority gate validated 216 v3 canonical records and their
source-field bindings; exactly 96 retain the R1 authored-unit-evidence marker.

## Final Health/PE, schemas, and adversarial controls

```sh
node curriculum-production/final/health-physical-education/src/generate.mjs
node --test curriculum-production/final/health-physical-education/tooling/*.test.mjs
node curriculum-production/final/health-physical-education/tooling/validate.mjs
node curriculum-production/final/health-physical-education/tooling/health-content-audit.mjs
```

Result: 40 tests passed. The generator emitted 1,431 READY items, 0 review,
0 not-ready, and 0 privacy findings. The validator re-read 1,431 packages and
1,431 guides and found exactly 216 canonical authorities, 216 learner
derivations, 216 adult derivations, 0 copied authority objects, 0 scoring
conflicts, and 0 content conflicts. All 972 PE lessons remain executable with
zero learner-content issues. Health remains 324 meaningful/actionable lessons
with 0 privacy or safety findings and an exact Grade 3 H2 trace.

The permanent tests cover the four required visible contradiction attacks,
all 16 bound visible fields, five canonical and six derived required-field
removals, seven structured semantic mutations, wrong types, unknown enums,
unknown fields, valid equal-credit paths, the historical false-positive
pattern, and lesson-location invariance. Visible attacks mutate external
in-memory copies only and leave all semantic metadata untouched.

## All 216 reviewed cases

```sh
node docs/curriculum-quality/health-pe/transfer-authority-fix-r3/run-r3-validation.mjs
```

Result:

```text
Validated 216 reviewed cases through three independent R3 schemas.
Historical: scoring=60, content=36, false-positive=120.
Final: scoring=0, content=0, unexplained=0.
Preserved: false-positive=120, safety=216, learner-authority=216.
LEARNER_CURRICULUM_SEMANTICS_CHANGED=NO
```

## Determinism and checksums

The canonical builder and final generator ran twice after the last source,
schema, validator, test, and corpus-document changes. Both runs produced the
same digests:

```text
canonical_build 9b214656ef0c8d5db65934cd9f65fe2fe4b64a9237778f495f0c1bf7c4a78af9 (21 files)
final_corpus    9fff40303a631d4a58a6b865150bec5255dc114613bc1d693e17988b955a46a2 (2,886 files including SHA256SUMS.txt)
checksum_file   6a4776f70e21e618728f58de268d89e4c5e5fc104ef94d05f8f5cb4e754b57ef
```

```sh
cd curriculum-production/final/health-physical-education
sha256sum -c SHA256SUMS.txt
```

Result: PASS; all 2,885 inventoried files verified.

## Projection, Study boundary, and release gates

```sh
node --test scripts/learner-projection/structured-projection-r1.test.mjs
npm run curriculum:build
npm run audit:learner-release
npm run audit:family-pilot-runtime-isolation
npm run audit:web-release
```

Result: 5 projection tests passed; 8,292 lessons projected. Learner release is
8,292/8,292 lessons and 699/699 assessments READY. Runtime graph isolation
passed with no forbidden family modules. All 216 reviewed HS PE transfer
bindings remain `LEARNER_AUTHORITY`, and no Study Engine, scorer, or Tutor V2
file changed. The web release built 556 modules, scanned 338 browser files with
zero answer-authority findings, passed the family-pilot launch audit, and
passed all 10 route/default-off lifecycle tests.

## Final status

`PE_TRANSFER_AUTHORITY_R3_READY_FOR_ACCEPTANCE`
