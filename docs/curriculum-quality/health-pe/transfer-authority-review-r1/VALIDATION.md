# Validation evidence

All commands were run on 2026-08-14. Curriculum was not regenerated or
modified.

## Final corpus validator

```text
$ cd curriculum-production/final/health-physical-education
$ node tooling/validate.mjs
Checked 1431 packages + 1431 scoring guides.
Counts: 1296 lessons + 135 assessments = 1431 items.
Grade 3 Health H2 provenance: 42 packages + 42 guides.
PE content: 972 executable lessons; 0 learner-content issue(s).
All final production, H3, privacy, rubric, provenance, and checksum checks passed.
```

This pass demonstrates why the reviewed conflict can survive the current gate:
the validator checks rubric presence/kind and PE execution-block presence, not
cross-field semantic compatibility.

## Final Health/PE tests

```text
$ node --test tooling/pe-execution.test.mjs tooling/privacy-scan.test.mjs tooling/production-gate.test.mjs
tests 10
pass 10
fail 0
```

## Canonical HS PE source validator

Run read-only in the pinned source worktree at
`mac/hs912-health-pe-r1@e39e2b343c41a1a800825651159e0e962d5288d7`:

```text
$ node tools/validate-course.mjs
PASS  grade-progression
PASS  privacy-guard
PASS  pe-inclusive-path
PASS  no-body-metrics
PASS  no-media-route
PASS  no-public-performance
PASS  guardian-safety
PASS  standards-mapping
PASS  study-compatibility
PASS  multi-occasion-evidence
PASS  distinct-lessons
11/11 gates passed.
```

## Canonical HS PE source tests

```text
$ node --test tools/validate-course.test.mjs
tests 32
suites 2
pass 32
fail 0
```

## Review coverage and reproducibility

`run-review.mjs` was run twice around SHA-256 calculation. Both outputs were
byte-identical:

```text
Reviewed 216 transfer candidates.
{"FALSE_POSITIVE":120,"METADATA_CONFLICT_ONLY":0,"CONTENT_TRANSFER_CONFLICT":36,"SCORING_AUTHORITY_CONFLICT":60,"PROGRESSION_RISK":0,"UNKNOWN":0}
{"HIGH":60,"INFORMATIONAL":120,"MODERATE":36}
f7d32e6de952673ce6cce5ecfa7b3d7a451112dda0861438dd2a2a6a7d45dc16  findings.jsonl
eac2abfe562a56f70be26b3ff98cdfb4a93b955a75a9729d465c25d1754de7c5  summary.json
PASS: 216 unique findings contain every required review field.
```

The required-field assertion covered lesson/item refs, expected/observed
authority, classification, scoring/progression impact, metadata/false-positive
status, learner/adult/Study effects, and source family for every row.

## Authority-path static assertion

A dependency-free assertion read the admitted bindings and exact runtime source
seams used by the review:

```text
PASS: 216 bindings are LEARNER_AUTHORITY + RUBRIC; Study maps activity to
completion-only, default UI injects no assessor, local response existence gates
segment completion, and rubric assessment returns review-required.
```

## Broader Study/assessment test limitation

The following supplemental Vitest command was attempted:

```text
$ npx vitest run netlify/functions/production-item-assessment.test.js \
    src/study/family-pilot/final-app/learner-response \
    src/study/family-pilot/lesson-player/FamilyPilotLessonPlayer.test.tsx \
    src/study/curriculumAdapter.test.ts \
    src/study/family-pilot/final-composition
```

It did not start because this worktree has no installed `vite`,
`@vitejs/plugin-react`, or `@tailwindcss/vite` packages. The observed terminal
ended with `ERR_MODULE_NOT_FOUND: Cannot find package 'vite'`. This command is
recorded as **not run**, not as a pass. No dependency installation was made in
this evidence-only lane. The PE-native gates above are independent Node tests
and all passed.
