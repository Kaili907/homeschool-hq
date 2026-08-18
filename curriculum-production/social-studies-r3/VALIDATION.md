# Social Studies Production R3 — validation

Validation status: `PASS`
Scope: framework only. Zero lessons authored, zero admitted.

## What was proved

| Claim | How |
| --- | --- |
| The model schema describes the approved model, not a new one | All nine frozen Director-approved Social Studies samples validate against `social-studies-lesson-model.schema.json` with zero violations, unchanged. |
| The rhythm rule is the approved rhythm | All nine frozen samples satisfy the nine ordered steps, including the labeled `EXAMPLE`, the ≥5-step worked solution, reasoning-specific feedback, the independent constructed response, and all seven review fields on the final section. |
| The promotion gate is real | Each frozen sample fails the production envelope for exactly six findings: five missing production fields and the forbidden `sampleStatus` carry-forward. The verifier asserts the set is exactly that — no wider, no narrower. |
| The gate is passable, not contradictory | A minimal production envelope validates clean, and the model schema's required fields and the envelope's required fields are disjoint. |
| No parallel model, engine, or runtime | `schemaVersion` is pinned to `manuel-academy.rich-study-lesson.v1`; every permitted `responseKind` is an existing `LEARNER_RESPONSE_TYPES` value; every permitted `sectionKind` classifies into the canonical `RichLessonSectionKind` union through `classifyRichLessonSection`. |
| The permitted vocabulary renders | Each frozen sample projects through `createRichLessonRenderModel` with `mode: rich`, no legacy fallback, a worked-example page flagged as an instructional example, an evidence page, a remediation page, and a reflection page last. |
| The rules are not a rubber stamp | Negative cases: a lesson missing feedback, a review that is not last, a worked example that models the learner's own prompt, an incomplete review, a bare-verdict feedback body, and a grade 6 identity are each rejected. |
| The framework admits nothing | The manifest reports `FRAMEWORK_ONLY`, `authored: 0`, `admitted: 0`, and the verifier fails if the count disagrees with what is on disk. |
| The frozen model is untouched | All nine sample content hashes match the approvals manifest, and `verify-director-r2-freeze.mjs` reports an empty lesson-substance diff against the freeze commit. |

## Verifier negative tests

Both were run against a temporary file and then reverted:

- An undeclared lesson file on disk →
  `Manifest reports 0 authored lesson(s); 1 found under curriculum-production/social-studies-r3/lessons.`
- A declared but still sample-shaped lesson →
  `ma-g8-social-studies-u01-l07 fails the production envelope schema`

## Commands

```sh
node scripts/curriculum/verify-social-studies-r3-framework.mjs
npx vitest run --project root-app src/study/family-pilot/lesson-player/socialStudiesProductionR3.test.ts
npm run typecheck
node scripts/curriculum/verify-director-r2-freeze.mjs e9b9d723ed4b447f9de97aa5d7de26ac1dfd1f9a
```

## Results

```
manifest: curriculum-production/social-studies-r3/SOCIAL_STUDIES_PRODUCTION_R3.manifest.json
status: FRAMEWORK_ONLY
grades: 3,4,5,7,8,9,10,11,12
grade 6: absent
pinned checksums: 4 matched
frozen Social Studies model samples: 9 unchanged
model schema: 9/9 frozen samples validate
rhythm rule (9 steps): 9/9 frozen samples satisfy
promotion gap: 6 findings per frozen sample, exactly as documented
authored R3 lessons: 0
admitted R3 lessons: 0
automatic promotion: disabled
SOCIAL_STUDIES_R3_FRAMEWORK_VERIFIED
```

TypeScript passed. The R3 validator test passed with 26 tests. Run together with
the Director R2 sample test, the render-model test, the lesson-player test, and
the Director review registry test: 5 files, 136 tests passed.
`verify-director-r2-freeze.mjs` reported `DIRECTOR_R2_FREEZE_VERIFIED` with 36
content hashes matched and an empty diff against the freeze commit.

## Not covered

Two rules are enforced only in part; `PROMOTION.md` records both. Whether a
modeled case is genuinely a *different* case is a human review judgment beyond
the prompt-copy check. Whether a cited document actually says what a lesson
claims cannot be computed — `sourceReview` records the named human who verified
it and the records they checked it against.

`SOCIAL_STUDIES_R3_FRAMEWORK_READY`
