# Elementary Math Depth + Readability Audit R1

**Status:** COMPLETE

**Authoritative base:** `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

**Scope:** 540 active Mathematics lessons: Grade 3 180, Grade 4 180, Grade 5 180. Production curriculum was read only; this audit does not repair it.

## Executive finding

0 lessons meet the operational richer standard and 491 are structurally too thin for their lesson type. The corpus is consistently engineered as a compact worksheet bank: many lessons contain only one worked example, explicit learner-facing remediation items are absent, and shared blueprint directions expose adult/engineering vocabulary. Assessment and review days were evaluated against their own targets, not concept-lesson targets.

## Re-derived inventory

| Grade | Schedule rows | Active package files | Unique lesson IDs | Answer keys | Result |
| --- | --- | --- | --- | --- | --- |
| 3 | 180 | 180 | 180 | 180 | RECONCILED |
| 4 | 180 | 180 | 180 | 180 | RECONCILED |
| 5 | 180 | 180 | 180 | 180 | RECONCILED |

Total: **540**. Expected 540; exact match: **yes**.

## Type-aware richer standard

Counts below are audit thresholds, not production repairs. “Remediation” means an explicit learner-facing remediation/reteach item, not adult-only prose in an answer key. “Remediation-profile items” are also recorded separately so targeted-correction lessons are not mistaken for having no corrective purpose.

| Lesson type | Teaching blocks | Worked | Guided | Independent | Mastery | Explicit remediation | Challenge |
| --- | --- | --- | --- | --- | --- | --- | --- |
| diagnostic | 1 | 1 | 0 | 5 | 3 | 0 | 0 |
| normal | 1 | 2 | 4 | 5 | 3 | 0 | 0 |
| review | 0 | 0 | 0 | 8 | 4 | 0 | 0 |
| remediation | 1 | 2 | 4 | 3 | 0 | 3 | 0 |
| mastery | 0 | 0 | 0 | 6 | 3 | 0 | 0 |
| assessment | 0 | 0 | 0 | 0 | 8 | 0 | 0 |
| other | 1 | 2 | 2 | 4 | 0 | 0 | 2 |

Type counts: normal concept **150**, diagnostic **30**, review **60**, remediation **60**, mastery **50**, assessment-like **30**, other **160**.

## Question-bank distribution

Cells show min / p25 / median / p75 / max (mean).

| Grade | Worked examples | Guided items | Independent items | Mastery items | Explicit remediation |
| --- | --- | --- | --- | --- | --- |
| 3 | 0 / 1 / 1 / 1 / 2 (mean 0.91) | 0 / 0 / 2 / 3 / 5 (mean 1.83) | 0 / 3 / 4 / 5 / 7 (mean 3.61) | 0 / 0 / 2 / 2 / 10 (mean 1.89) | 0 / 0 / 0 / 0 / 0 (mean 0) |
| 4 | 0 / 1 / 1 / 1 / 2 (mean 0.89) | 0 / 0 / 2 / 3 / 5 (mean 1.83) | 0 / 3 / 4 / 5 / 7 (mean 3.61) | 0 / 0 / 2 / 2 / 10 (mean 1.88) | 0 / 0 / 0 / 0 / 0 (mean 0) |
| 5 | 0 / 1 / 1 / 1 / 2 (mean 1) | 0 / 0 / 2.5 / 3 / 5 (mean 2) | 0 / 4 / 4 / 5 / 9 (mean 4.5) | 0 / 0 / 2 / 2 / 12 (mean 1.89) | 0 / 0 / 0 / 0 / 0 (mean 0) |

Full p10/p90 values and histograms are in `grade-summary.json`.

Question variety per lesson: distinct item types 1 / 1 / 2 / 6 / 12 (mean 3.88); distinct prompt templates 1 / 2 / 4 / 7 / 12 (mean 4.83). **81** lessons have multiple scored items but only one parameterized prompt template.

## Depth classification

| Classification | Lessons |
| --- | --- |
| DEEP_ENOUGH | 0 |
| NEEDS_MORE_EXPLANATION | 0 |
| NEEDS_MORE_WORKED_EXAMPLES | 0 |
| NEEDS_GUIDED_PRACTICE | 22 |
| NEEDS_INDEPENDENT_DEPTH | 0 |
| NEEDS_MASTERY_DEPTH | 0 |
| NEEDS_REMEDIATION | 0 |
| LANGUAGE_TOO_ADVANCED | 49 |
| MULTIPLE_DEFECTS | 469 |

Thin-bank lessons: **491**. By grade: G3 170, G4 170, G5 151.

## Negative controls

| Control | Lessons detected |
| --- | --- |
| oneWorkedExampleOnly | 336 |
| answerOnlyExample | 58 |
| twoIndependentQuestions | 20 |
| emptyMastery | 200 |
| noExplicitRemediation | 540 |
| engineeringLanguageDirection | 420 |
| duplicateQuestionBankWithinLesson | 416 |
| adultAnswerLeak | 0 |

## Worked-example depth and reasoning

There are 504 worked examples. Step-count distribution is 1 / 2 / 3 / 3 / 5 (mean 2.47). Answer-only examples: **59**; weak: **96**; adequate: **295**; strong: **113**. A worked example is strong only when it has at least three steps, at least two substantive steps, and an explicit reasoning/sequence marker.

## Readability

The audit recorded **3680** field-level readability findings affecting **518** lessons. Engineering-language findings: **420**; teacher-facing language: **1192**; long sentences: **366**; dense directions: **0**; multi-clause directions: **520**.

The checks are subject-aware: mathematical vocabulary such as numerator, denominator, product, expression, estimate, and evaluate is not automatically treated as age-inappropriate. The vocabulary flags focus on curriculum-engineering and adult workflow terms. Flesch–Kincaid values are stored as advisory machine evidence only and never decide a lesson classification by themselves.

## Duplication and passive structure

Exact within-lesson prompt duplicate groups affect **0** lessons; parameter-template near-duplicate groups affect **416**; identical template-bank clusters affect **130** lessons across **54** clusters. Exact prompt reuse across lessons affects **310** lessons. Passive question-list structure appears in **90** lessons; those are mostly review/assessment profiles, but the structure remains a learner-experience risk when not paired with active explanation elsewhere.

## Answer leakage

Forbidden adult answer fields in learner packages: **0 lessons**. Verbal answer disclosures: **0 lessons**. Reuse of an answered worked-example prompt as a scored prompt in the same lesson: **0 lessons**. Adult answer keys remain separately stored.

## Generator families and repair ownership

Two shared composition families drive section counts and directions: `g34-phase-blueprint` for 360 Grade 3/4 lessons and `g5-12-phase-blueprint` for 180 Grade 5 lessons. Thirty grade/unit item-bank families drive prompt templates, examples, distractors, and vocabulary. Exact source paths and per-family counts are in `generator-families.json`.

The repair plan contains **30** parallel, non-overlapping grade/unit builders of 18 lessons each, bracketed by two shared-composition builders and one serialized integration builder. Unit builders own source banks only; the integration builder alone owns regenerated packages and keys. The Grade 3/4 canonical source tree and shared Grade 5-12 composition source are not present at this base; the plan records the exact upstream input revisions that must be restored instead of editing evidence snapshots.

## Tutor V2 readiness inventory

| Metadata | Status | Gap |
| --- | --- | --- |
| conceptIds | PARTIAL_DERIVATION_ONLY | itemType plus standard can form a provisional concept key, but no stable canonical conceptId or concept-version field exists. |
| prerequisites | GAP | Course order can suggest earlier material, but no prerequisite edge, required concept, or minimum mastery threshold is encoded. |
| misconceptionMetadata | PARTIAL_ADULT_KEY_ONLY | Adult keys carry observed/likelyCause/remediation prose, but there are no stable misconception IDs, trigger signatures, severities, or cross-item mappings. |
| phaseInformation | DERIVABLE | Phase and section order are present, but no Tutor V2 state transition or retry policy is encoded. |
| answerPolicy | PARTIAL_ADULT_KEY_ONLY | Separate answer authority is strong, but hint timing, reveal rules, attempt limits, acceptable equivalent forms, and adult-only access policy are not a complete runtime contract. |
| agePolicy | GAP | Grade is present, but no age band, vocabulary policy, sentence/direction limits, or child/adult visibility tag exists. |

## Evidence files

- `lesson-findings.jsonl`: one complete record per active lesson.
- `grade-summary.json`: reconciled counts, distributions, classifications, controls, and Tutor inventory.
- `generator-families.json`: shared composition and 30 unit-bank family attributions.
- `readability-findings.json`: every field-level readability finding plus advisory machine scores.
- `bulk-repair-plan.json`: staged, non-overlapping repair ownership without curriculum changes.

## Audit limits

- Near-duplicate detection is deterministic template analysis, not a claim that all repeated drill forms are pedagogically invalid.
- Readability rules identify review candidates; human elementary-math judgment remains authoritative.
- The audit verifies package structure and adult-key separation but does not run the future Tutor V2 runtime.

**Final classification: ELEMENTARY_MATH_DEPTH_AUDIT_COMPLETE**
