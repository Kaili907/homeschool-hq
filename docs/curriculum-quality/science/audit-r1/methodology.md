# Methodology

## Audit perimeter

The lesson universe is defined by records in
`curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl` whose
`subject` is `science`. The audit does not infer active status from filenames,
source branches, old candidates, tests, fixtures, or the curriculum authoring
tree.

The extractor loads every final package from
`curriculum-production/final/science/packages/*/work-packages.jsonl`, requires
exact set equality with the active bindings, and fails on count drift,
duplicates, or set mismatch. At the pinned base, both sides contain 972 unique
lesson IDs.

The 81 Science records in `assessment-bindings.json` are a linked inspection
perimeter. Their learner and adult JSON payloads are audited separately and are
not counted as additional lessons.

## Lesson-type mapping

The audit preserves the raw phase and assigns one mutually exclusive type so
findings can be compared without double-counting:

| Raw phase | Audit type |
| --- | --- |
| Launch and diagnostic | concept |
| Concept model A/B | concept |
| Guided practice A/B | concept |
| Independent application A | mastery |
| Investigation or close reading | inquiry/investigation |
| Investigation | lab/activity |
| Reteach and varied practice | remediation |
| Correction and reflection | remediation |
| Synthesis and review | review |
| Performance task build | assessment/project |
| Unit assessment | assessment/project |

This is an audit lens, not a proposed curriculum taxonomy. Raw phase, work type,
route kind, unit, day, band, and lineage remain available in the lesson ledger.

## Measures

- **Worked example payload:** a learner content object explicitly keyed as a
  worked example, worked model, or demonstration. A learner-created model and a
  High School alternative dataset do not count as worked instruction.
- **Vocabulary metadata:** an explicit structured vocabulary field. Scientific
  words inside prose are acknowledged but do not provide reusable tutor or
  accessibility metadata.
- **Numeric/categorical model table:** an equal-credit High School input whose
  kind is `MODEL_OUTPUT` and contains rows.
- **Graph request:** the delivered model task or analysis questions explicitly
  use the word graph. This is conservative; a learner may choose a table or
  diagram elsewhere without being counted.
- **Engineering language:** a broad detector over focus, unit title, essential
  question, and unit performance task for engineering/design/criteria/
  constraints/prototype/solution/optimization language. The narrower focus
  count uses the same detector on `focus` only.
- **Duplicate science payload:** SHA-256 over the complete science brief, case,
  and supplied evidence object. IDs outside that learner science object are not
  included.
- **Learner-sheet word volume:** an audit tokenizer over the rendered Markdown.
  It is evidence of relative surface load, not a readability grade and not a
  quota.
- **Tutor structured fields:** presence of `tutor_metadata`,
  `prerequisite_ids`, `misconception_codes`, `response_schema`,
  `attempt_history_contract`, or `next_lesson_routes`. Existing expected-
  reasoning, remediation, and mastery prose are counted separately as strengths.

## Science-specific stance

No Mathematics question or practice counts were imposed. The audit asks whether
the task form fits the science purpose: explanation, modelling, inquiry,
measurement, data interpretation, evidence-based argument, safe investigation,
engineering design, and independent mastery. Counts document the delivered
corpus; they are not universal Science quotas.

## Reproduction

From the repository root:

```bash
python3 docs/curriculum-quality/science/audit-r1/audit.py
```

The script reads curriculum and release files and writes only the CSV and JSON
evidence files in this audit directory. It contains no curriculum mutation,
network access, clock use, or randomness.

## Verification run

The audit is accepted only when all of the following pass at the pinned base:

```bash
python3 docs/curriculum-quality/science/audit-r1/audit.py
node curriculum-production/final/science/validation/validate-learner-content.mjs
node curriculum-production/final/science/validation/validate-safety.mjs
node curriculum-production/final/science/validation/run-production-quality-gate.mjs
node curriculum-production/final/science/validation/verify-checksums.mjs
python3 curriculum-release-admitted/family-pilot-r1/build_release.py --validate-only
```

Passing existing production gates establishes structural, safety, checksum, and
binding integrity. It does not reverse the learner-depth findings, because the
audit checks instructional substance the existing gates intentionally do not
measure.

## Limitations

- This is a static artifact audit, not an observation of learners using the
  lessons or tutors scoring real work.
- Word volume is not a validated reading level.
- The graph detector is intentionally literal and may undercount optional
  representations.
- Safety judgments confirm package completeness and usability risks; they are
  not a substitute for a qualified lab-safety review.
- The audit reports the pinned active release only. Superseded source branches
  and unadmitted Grade 6 material are outside scope.
