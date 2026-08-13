# Manuel Academy — English Language Arts canonical learner corpus

This directory contains the canonical learner-content projection and separate
adult scoring guides for English Language Arts in Grades 3, 4, 5, 7, 8, 9,
10, 11, and 12: 9 courses, 180 lessons per course, 1,620 lessons total.

## Reading source model

Every learner package uses `academy-original-inline` source delivery. The
complete reading body is in `sourceReference.text`, and its only reference
record declares:

- `rightsCategory: original`
- `deliveryMode: inline_full_text`
- `learnerAvailable: true`
- `fullTextIncluded: true`
- the reading's word count and SHA-256 digest

The generator reuses 320 complete Manuel Academy originals from the pinned
Grades 3–4 original text banks. It creates and delivers 1,300 additional
Academy-original reading-lab texts for lessons whose prior source was absent,
facilitator-selected, public-domain/reference-only, or only an opening passage.
It copies no modern copyrighted work, rights-required work, or third-party
text. `source-ledger.jsonl` records the mode, provenance, rights category,
delivery state, word count, and body digest for every lesson.

This is source/content repair only. It does not modify the browser projector,
response UI, persistence, scoring implementation, release admission, course
counts, or schedules.

## Learner package contract

Each `packages/grade-XX/*.package.json` contains:

- substantive skill instruction and context;
- a complete inline reading;
- a source-specific, actionable question;
- an explicit deliverable and evidence requirement;
- three or more task steps;
- learner-visible success and completion criteria;
- source-specific guided support, remediation, and extension; and
- a writing-task record that identifies required writing phases.

Demands progress by grade: evidence quantity and precision, response length,
qualification, counterclaim/alternative interpretation, and limitation work
increase from Grade 3 through English 12. Task text includes its own source,
focus, phase, deliverable, and grade demand, so no independent task is copied
unchanged across grades.

Learner packages contain no model answers, answer keys, rubric objects,
acceptable-answer criteria, mastery criteria, or scorer-only guardrails.

## Adult scoring separation

Every `scoring-guides/grade-XX/*.scoring.json` is paired by lesson ID and stays
outside the learner package tree. ELA scoring authority remains qualitative
`RUBRIC`; acceptable-answer criteria describe evidence and reasoning features
without supplying a response. Generator and test gates reject adult scoring
keys or model-answer fields in learner packages.

## Pinned canonical inputs

The generator refuses to run if any input worktree has drifted from its pinned
commit:

- Grades 3–4: `ef81511c2b582d003e397bb79daa8a26a41e3b10`
- Grades 5/7/8 canonical production input: `00374a8dc26eddfac2cf52aec5661deff760ddbb`
- Grades 9–12: `42f2505bb04d831c4aefc195a7ce03edb2d7b1d9`

The generator preserves all source lesson IDs, course days, unit/day positions,
course counts, and schedule identities.

## Regenerate and verify

From the repository root:

```bash
node curriculum-production/student-work/english-language-arts/tools/generate.mjs
npx vitest run --config curriculum-production/student-work/english-language-arts/tooling/vitest.config.mjs
(cd curriculum-production/student-work/english-language-arts && shasum -a 256 -c SHA256SUMS.txt)
```

Generation is deterministic. It rewrites all 1,620 learner packages, all 1,620
adult guides, `corpus-manifest.json`, `source-ledger.jsonl`, the content-quality
evidence, and `SHA256SUMS.txt`.

`validation/content-quality-report.json` is the acceptance evidence. Its gate
requires zero actionless tasks, empty required writing tasks, placeholder
shells, cross-grade exact task copies, missing/unresolvable readings, false
source claims, learner adult leaks, learner model answers, and guide-pairing
mismatches.
