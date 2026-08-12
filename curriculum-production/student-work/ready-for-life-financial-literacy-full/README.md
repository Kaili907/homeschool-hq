# Ready for Life & Financial Literacy — full-coverage production: BLOCKED

This directory was created to scale the proven 24-lesson student-work pipeline
in [`../ready-for-life-financial-literacy`](../ready-for-life-financial-literacy)
to **every** authored Ready for Life (RFL) and Financial Literacy (FinLit)
lesson across grades 3, 4, 5, 7, 8, 9, 10, 11, and 12.

It does not contain that corpus. It contains the derived inventory and the
executable evidence for why full coverage cannot be certified production-ready
from this source. Everything asserted below is proven by the test suite here
against the real source and the real gate, not stated as opinion.

## The exact lesson counts, derived from source

| Grade | Ready for Life | Financial Literacy | Source |
|------:|---------------:|-------------------:|--------|
| 3  | 36 | 36 | `mac/g34-rfl-finlit-r1` |
| 4  | 36 | 36 | `mac/g34-rfl-finlit-r1` |
| 5  | 36 | 36 | worktree |
| 7  | 36 | 36 | worktree |
| 8  | 36 | 72 | worktree |
| 9–12 | — | — | **no source exists** |

**396 authored lessons total**, in 10 courses. Grades 3 and 4 are not in this
worktree; they exist only on `mac/g34-rfl-finlit-r1`, so `src/inventory.ts`
reads them through `git show`.

Machine-readable: [`corpus-inventory.json`](corpus-inventory.json).

## Why this is blocked

### 1. Four of the nine requested grades have no source at all

Grades 9, 10, 11, and 12 were requested. No ref in this repository — all 524
scanned — contains any `curriculum-content` for those grades, and
`curriculum-content/manuel-academy/1.1.0/` has never existed in history. There
is nothing to derive lesson counts or student work from.

### 2. The shipped slice's four high-school packages cite a source that does not exist

The existing `grade-09-hs` packages declare:

```json
"integrity": { "sourceCorpusVersion": "1.1.0", "sourceLessonId": "ma-g9-financial-literacy-u04-l04" }
```

That corpus version and those lesson IDs have never existed here.
`corpus-manifest.json` repeats the same nonexistent path under
`generatedFrom.highSchool`. **This is a provenance defect in already-committed
material and should be corrected independently of this work.**

### 3. The source carries no per-lesson answer content

`answer_or_scoring_guidance` is byte-identical across every lesson in every
course, contains no digits, and answers nothing:

> "Score the stated learning target, accuracy, evidence/reasoning, and revision.
> Accept multiple valid approaches when they meet the criteria. Do not infer
> effort, motivation, diagnosis, or character from an error."

`materials`, `mastery_rule`, and `safety_and_privacy` are likewise single-valued
per course. The only genuine per-lesson signal is `focus` / `title` /
`student_activity` — a topic label and a sentence.

The shipped slice's quality comes from human authoring, not from source. Nothing
in `ma-g3-ready-for-life-u03-l04` yields "a butter knife, a plastic scraper, a
whisk" versus "a chef's knife, the stove, the oven", or the remediation step
that contrasts a butter knife with a chef's knife. That is curriculum judgment.

So the gate's required **216 FinLit fixed answer keys** cannot be derived — each
must be authored and independently verified. Mass-generating them would put
unverified answers in front of parents as authoritative.

### 4. The gate cannot detect any of this

This is the load-bearing finding. `evaluateLessonProductionReadiness` requires
`MATH_STRUCTURED_FINLIT` lessons to carry a fixed `ANSWER_KEY`, but it only
checks that the block is **present** and clears the word-count/uniqueness
heuristic in `specificity.ts`. It never checks that an answer exists.

Feed it the generic string above as the answer key, with the surrounding prose
over the 25-word floor, and it returns **`READY` with zero notes**.

> A mechanically mass-generated 396-lesson corpus would therefore report
> `QUALITY_GATE: READY` while containing no real answer keys.

Passing this gate is **necessary but not sufficient** evidence of FinLit
production readiness. `tests/gateAnswerKeyBlindSpot.test.ts` pins that as a
characterization test so it stops being an invisible assumption.

To be clear about what this does *not* say: the 24 already-shipped packages were
checked and are genuinely authored. All 12 FinLit scoring records carry distinct,
arithmetically verifiable answer keys (`"$7.75"`, with reasoning
`1.25 + 2.00 + 4.50 = 7.75`). The blind spot is a risk for *scaling*, not a defect
in the shipped slice — it means the gate would not stop a future batch that lacked
that same care.

## What full coverage actually requires

792 files — 396 task sheets plus 396 adult-only scoring records — each with a
concrete lesson-specific task, safety notes, a simulation alternative wherever
the task is real-world, remediation, extension, and either a verified fixed
answer key (216 FinLit) or an authored rubric (180 RFL).

**The pipeline is not the bottleneck.** `../ready-for-life-financial-literacy/src`
is already grade-agnostic and needs no change to accept 396 packages. The
bottleneck is 396 acts of curriculum authoring that the source cannot supply.

## Recommended sequencing

1. Fix the fabricated `grade-09-hs` provenance in the shipped slice.
2. Decide whether grades 9–12 are to be authored as curriculum first; until
   then, drop them from production-coverage scope rather than carrying them.
3. Harden the gate to require genuine answer content for `ANSWER_KEY`
   authorities, so coverage claims cannot outrun reality. Update
   `tests/gateAnswerKeyBlindSpot.test.ts` to expect rejection when that lands.
4. Author the remaining 372 lessons in reviewed batches, RFL rubrics and FinLit
   answer keys separately, with the answer keys independently verified.

## Running the evidence

```bash
npx vitest run --config curriculum-production/student-work/ready-for-life-financial-literacy-full/tooling/vitest.config.mts
```

`src/inventory.ts` derives the counts; `tests/inventory.test.ts` checks them
against real source and proves the grade 9–12 absence across all refs;
`tests/gateAnswerKeyBlindSpot.test.ts` exercises the real gate.
