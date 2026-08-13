# Final Social Studies production package

Classification: `FINAL_SOCIAL_PRODUCTION_READY`

This directory is the final admission manifest for all 972 Social Studies lessons. It pins the production package, scoring authority, source readiness policy, and source metadata/provenance state for every lesson without copying the 972 upstream lesson files.

The package admits all 972 lesson packages. The 960 lessons with verified static sources are runtime-ready. The 12 Grade 3 Unit 9 civic-action capstone lessons remain honestly dynamic: the package is admitted, but each lesson ships as `PENDING_SOURCE_ATTACHMENT`, with lesson launch and scoring disabled until an adult attaches qualifying evidence about the issue the learner actually chose.

Grade 7 Unit 2 (Era 1) is static and uses the pinned Smithsonian records from the dynamic-source input. No fake static source is assigned to Grade 3 civic-action work.

## Artifacts

- `production-manifest.json` — counts, pinned input SHAs, invariants, and Production Gate H3 result.
- `lesson-records.jsonl` — one complete runtime/admission record per lesson.
- `verified-static-sources.json` — verified metadata and provenance; no source body or quotation.
- `runtime-source-policy.json` — exact dynamic states, transitions, attachment schema, authority, privacy, and revalidation rules.
- `gate-h3-report.json` — actual Production Gate H3 evaluation plus the package-admission overlay.
- `checksums.sha256` — SHA-256 checksums for every other file in this final package tree. Each lesson record also pins the upstream lesson package by Git blob SHA-1.

## Runtime contract

`PENDING_SOURCE_ATTACHMENT` and `ATTACHED_INCOMPLETE` keep launch and scoring disabled but do not make the course or production package globally unready. `ATTACHED_SATISFIED` enables both only after the adult-attested attachment passes every required metadata, qualification, authority, retrieval, safety, privacy, and unit-sufficiency rule.

The tutor may explain evidence, context, and source types; locate or read a source; critique reasoning; and ask guiding questions. The tutor may not write, dictate, rewrite, or correct the learner's graded civic or historical argument or citation.

The static registry distinguishes 528 lessons whose source records were independently checked by the source-resolution inputs from 432 grades 9–12 lessons whose `VERIFIED` assertion is pinned to the production input but was not independently rechecked by this final lane. This provenance distinction prevents the final package from overstating what its own registry established.

## Rebuild and verify

Run:

```sh
node curriculum-production/final/social-studies/tools/build-final-package.mjs
node curriculum-production/final/social-studies/tools/verify-final-package.mjs
```
