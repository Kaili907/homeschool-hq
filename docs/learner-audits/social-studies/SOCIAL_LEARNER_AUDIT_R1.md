# Social Studies learner completeness audit R1

Classification: `SOCIAL_LEARNER_AUDIT_COMPLETE`

Curriculum result: **FAIL — 0/972 lessons are safe to begin through the audited learner/browser path.**

Audit base: `c81ddb6e04bc1c3629212327d47817c1b5677477`

## Scope and method

The audit inspected all 972 admitted Social Studies lesson packages, their final lesson records, the static-source registry, the Grade 3 dynamic-source policy, admitted production bindings, runtime/browser rows, browser material builder, learner UI, and source-unlock implementation. The audit is read-only with respect to curriculum/runtime inputs; only this report lane and its audit script are produced.

Every lesson was checked for substantive disciplinary work, source readiness and metadata, learner-visible source context, evidence questions, argument criteria, readiness ordering, dynamic unlock representability, browser preservation, response support, scoring leakage, placeholders, copyright handling, and the Tutor graded-work boundary.

## Result by grade

| Grade | Lessons | Static | Dynamic | Unresolved source | Source projection loss | Dynamic policy error | Safe | Result |
|---:|---:|---:|---:|---:|---:|---:|---:|:---:|
| 3 | 108 | 96 | 12 | 0 | 96 | 12 | 0 | FAIL |
| 4 | 108 | 108 | 0 | 0 | 108 | 0 | 0 | FAIL |
| 5 | 108 | 108 | 0 | 0 | 108 | 0 | 0 | FAIL |
| 7 | 108 | 108 | 0 | 0 | 108 | 0 | 0 | FAIL |
| 8 | 108 | 108 | 0 | 0 | 108 | 0 | 0 | FAIL |
| 9 | 108 | 108 | 0 | 108 | 0 | 0 | 0 | FAIL |
| 10 | 108 | 108 | 0 | 108 | 0 | 0 | 0 | FAIL |
| 11 | 108 | 108 | 0 | 108 | 0 | 0 | 0 | FAIL |
| 12 | 108 | 108 | 0 | 108 | 0 | 0 | 0 | FAIL |

## Findings

- **Static sources — FAIL.** 528 Grades 3–8 static lessons have valid registry metadata, but none of their exact source keys, titles, or URLs reaches the learner Markdown/browser material. The 432 Grades 9–12 lessons name source labels but have zero source keys and rely on an unrechecked upstream `VERIFIED` assertion, so their source metadata cannot be validated from the final package.
- **Grade 7 Era 1 — FAIL at learner delivery.** All 12 lessons are correctly static and map to four verified Smithsonian CC0 records. The learner packages instead name Library of Congress, Fordham, and David Rumsey generically; the browser binding drops the Smithsonian keys and metadata.
- **Grade 3 dynamic sources — FAIL.** All 12 lessons correctly ship pending and are blocked before attachment. The browser asks only for title, publisher, and date, then immediately stores `ATTACHED_SATISFIED`; it cannot represent the declared 21-field contract or enforce issue relevance, retrieval, read-in-full, safety/level preview, authority tiers, perspective, privacy, or unit sufficiency.
- **Browser — partial preservation, overall FAIL.** Catalog/runtime coverage is 972/972 and full Markdown preserves learner tasks, questions, criteria, and Tutor boundaries. Required source identity/metadata is not preserved for the 528 registry-backed static lessons; the 432 high-school coverage entries have no source keys or source records to project.
- **Learner work — PASS structurally.** Every lesson contains a source-record task, Claim–Evidence–Reasoning work, an independent response or unit-assessment prompt set, a four-level rubric, and acceptable-answer criteria. Zero lessons have empty evidence tasks, empty argument criteria, zero actionable work, unsupported response paths, placeholders, or adult scoring leaks.
- **Copyright — PASS.** All 114 registry records carry rights/access metadata, no quoted source text is stored, and learner packages direct retrieval/transcription instead of redistributing source bodies.

## Flag totals

`MISSING_STATIC_SOURCE=0`; `UNRESOLVED_SOURCE=432`; `DYNAMIC_SOURCE_POLICY_ERROR=12`; `EMPTY_EVIDENCE_TASK=0`; `EMPTY_ARGUMENT_TASK=0`; `ZERO_ACTIONABLE_WORK=0`; `UNSUPPORTED_RESPONSE=0`; `PROJECTION_LOSS=528`; `COPYRIGHT_SOURCE_PROBLEM=0`; `SCORING_LEAK=0`; `PLACEHOLDER=0`.

## Negative controls

All five required mutation controls were detected without altering source inputs: static source removed → `MISSING_STATIC_SOURCE`; dynamic lesson ready before attachment → `DYNAMIC_SOURCE_POLICY_ERROR`; question deleted → `EMPTY_EVIDENCE_TASK`; browser content removed → `PROJECTION_LOSS`; adult scoring field injected → `SCORING_LEAK`.

## Safe-to-begin decision

Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12 are **not safe to begin**. Resolve the 432 source-metadata assertions, project exact verified static source identity/context to the learner, and implement the full dynamic attachment contract before any Social Studies grade is released to learners.
