# Ready for Life & Financial Literacy — full-coverage production: BLOCKED

This directory was created to scale the proven 24-lesson student-work pipeline
in [`../ready-for-life-financial-literacy`](../ready-for-life-financial-literacy)
to **every** authored Ready for Life (RFL) and Financial Literacy (FinLit)
lesson across grades 3, 4, 5, 7, 8, 9, 10, 11, and 12.

It does not contain that corpus. It contains the derived inventory and the
executable evidence for why full coverage cannot honestly be certified
production-ready today. Every claim below is proven by the test suite here
against real source and the real gate.

## The exact lesson counts, derived from source

| Grade | RFL | FinLit | Stage | Location |
|------:|----:|-------:|-------|----------|
| 3  | 36 | 36 | released | `mac/g34-rfl-finlit-r1` |
| 4  | 36 | 36 | released | `mac/g34-rfl-finlit-r1` |
| 5  | 36 | 36 | released | worktree |
| 7  | 36 | 36 | released | worktree |
| 8  | 36 | 72 | released | worktree |
| 9  | 36 | 72 | **authoring** | `mac/hs912-rfl-finlit-r1` |
| 10 | 36 | 72 | **authoring** | `mac/hs912-rfl-finlit-r1` |
| 11 | 36 | 72 | **authoring** | `mac/hs912-rfl-finlit-r1` |
| 12 | 36 | 72 | **authoring** | `mac/hs912-rfl-finlit-r1` |

- **396** lessons promoted into the frozen `curriculum-content/manuel-academy/1.0.0`
  release (10 courses).
- **432** high-school lessons authored but **not** promoted into any release,
  living at `curriculum-authoring/full-family-highschool-9-12/` (8 courses).
- **828 authored lessons in total.**

Grades 3–4 and all of high school are outside this worktree, so
`src/inventory.ts` reads them through `git show`. Machine-readable:
[`corpus-inventory.json`](corpus-inventory.json).

> A scan restricted to `curriculum-content/` finds no grade 9–12 content and
> makes it look as though high school were unwritten. It is written; it has
> simply never been released. The distinction is the whole question for grades
> 9–12, and `tests/inventory.test.ts` asserts both halves of it.

## Why this is blocked

### 1. High school is authored but unreleased

No ref promotes grade 9–12 into a `curriculum-content` release, and corpus
version `1.1.0` has never existed. Building production student work against
`curriculum-authoring/` would pin 432 lessons of shipping material to a source
that has not been through release. **This is a sequencing decision, not a
content gap** — the curriculum exists.

### 2. The shipped grade-09-hs packages cite a path that does not exist

The four `grade-09-hs` packages declare:

```json
"integrity": { "sourceCorpusVersion": "1.1.0", "sourceLessonId": "ma-g9-financial-literacy-u04-l04" }
```

`corpus-manifest.json` repeats a nonexistent
`curriculum-content/manuel-academy/1.1.0/…` path under `generatedFrom.highSchool`
— while naming the correct *branch*.

The **lessons themselves are real**: all four cited IDs resolve in
`curriculum-authoring/full-family-highschool-9-12/`, asserted in
`tests/inventory.test.ts`. So this is a **wrong-path citation, not invented
material**. The fix is to correct the version and path, not to discard the work.

### 3. Source carries no per-lesson answer content

In the released 1.0.0 courses, `answer_or_scoring_guidance`, `materials`,
`mastery_rule`, and `safety_and_privacy` are each **byte-identical across every
lesson in the course**, and the scoring string contains no digits:

> "Score the stated learning target, accuracy, evidence/reasoning, and revision.
> Accept multiple valid approaches when they meet the criteria. Do not infer
> effort, motivation, diagnosis, or character from an error."

The apparently-unique fields are interpolations of one topic phrase. Blank out
`focus` / `unit_title` / `phase` and `success_criteria`, `extension`,
`home_connection`, and `title` each collapse to a single value; `student_activity`
collapses to two. The genuine per-lesson payload is `focus` — a topic phrase.
(Grade-8 FinLit has only 42 distinct `focus` values across 72 lessons.)

The HS authoring corpus is better but not different in kind: its guidance varies,
yet across all 432 lessons **none contains a currency amount or a computation**,
and most explicitly defer to "any defensible conclusion the fictional figures
support". Promoting high school would add 288 FinLit lessons to the answer-key
burden, not reduce it.

So the gate's required FinLit answer keys — 216 released, 504 including high
school — cannot be derived. Each needs a fictional scenario invented, items
authored against it, answers computed, and each computation independently
re-verified. That last step is exactly what cannot be self-certified, and
silently wrong arithmetic handed to a parent as the authoritative key is the
specific harm.

### 4. The gate cannot detect any of this

This is the load-bearing finding. For `MATH_STRUCTURED_FINLIT` the gate requires
a fixed `ANSWER_KEY` — but the only checks are `kind === 'ANSWER_KEY'` and
`isSubstantive(content)`, and:

- `isSubstantive` returns `block?.present === true`. **It never reads `text`.**
- The `specificity.ts` heuristic is applied to `instruction`, `workedExample`,
  `guidedPractice`, and `independentWork` — **and to nothing else.** It never
  runs on the answer key.

The answer-key requirement therefore reduces to *a boolean is true and a label
reads `ANSWER_KEY`*. All of these return **`READY` with zero notes**: the generic
boilerplate, `"TODO"`, `"The answer is 2 + 2 = 5"`, `""`, and `{ present: true }`
with no text at all.

> A mass-generated corpus would report `QUALITY_GATE: READY` while containing no
> answer to any question.

Passing this gate is **necessary but not sufficient** for FinLit.
`tests/gateAnswerKeyBlindSpot.test.ts` pins this, and also shows the heuristic
firing correctly on a covered field — so its absence here is a genuine gap, not
a dead feature.

To be clear about what this does *not* say: the 24 shipped packages are
genuinely authored. All 12 FinLit scoring records carry distinct, recomputed
answer keys (`"$12.00"`, with reasoning `0.03 x 400.00 = 12.00`). The blind spot
is a scaling risk, not a description of what shipped.

### 5. The attestation invariant is library-only, not enforced at runtime

`computeCompletionStatus` — the function proving a learner click can never
certify a guardian-supervised task — **has no caller anywhere in `src/`**.
`grep -rn 'computeCompletionStatus\|completionAuthority' src/` returns nothing.

The property is proven about a pure function the product does not currently
invoke. **This should be closed before any guardian-authority lesson reaches a
real household**, and it is independent of coverage.

## What full coverage actually requires

1,656 files at full scope — 828 task sheets plus 828 adult-only scoring records
(792 for the released 396 alone). Each needs a concrete lesson-specific task,
safety notes, a simulation alternative wherever the task is real-world,
remediation, extension, and either a verified fixed answer key or an authored
rubric.

**The pipeline is not the bottleneck.** `../ready-for-life-financial-literacy/src`
is already grade-agnostic and needs no change. The bottleneck is curriculum
authoring the source cannot supply: nothing in `ma-g3-ready-for-life-u03-l04`
yields "a butter knife, a plastic scraper, a whisk" versus "a chef's knife, the
stove, the oven", nor the remediation that repairs the misconception by
contrasting exactly two tools.

## Recommended sequencing

1. Correct the four `grade-09-hs` `integrity` blocks and `corpus-manifest.json`
   to cite the real `curriculum-authoring` path, or hold those packages until
   high school is released.
2. Decide whether to promote `curriculum-authoring/full-family-highschool-9-12`
   into a `curriculum-content` release. This is a release decision; the
   curriculum is written.
3. Harden `evaluateLessonProductionReadiness`: make `isSubstantive` require
   non-empty text, and apply `flagIfGeneric` to `scoringAuthority.content`. Then
   flip `tests/gateAnswerKeyBlindSpot.test.ts` to expect rejection.
4. Wire `computeCompletionStatus` into the real completion path before any
   guardian-authority lesson ships.
5. Author the remaining lessons in reviewed batches, with FinLit answer keys
   independently verified rather than self-certified.

## Running the evidence

```bash
npx vitest run --config curriculum-production/student-work/ready-for-life-financial-literacy-full/tooling/vitest.config.mts
```

`src/inventory.ts` derives the counts; `tests/inventory.test.ts` checks them
against real source and separates "unreleased" from "unwritten";
`tests/gateAnswerKeyBlindSpot.test.ts` exercises the real gate.
