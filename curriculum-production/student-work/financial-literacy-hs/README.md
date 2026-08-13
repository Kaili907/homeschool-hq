# High School Financial Literacy — student-work production

Learner-facing task sheets and adult-only scoring records for the high-school
Financial Literacy sequence authored on `mac/hs912-rfl-finlit-r1`, read at the
pinned tip `481296a9e794770348881b43bd0d1fa4f794db29`.

This lane exists because the previous round could not honestly certify a
full-coverage corpus. The finding it recorded was specific: the gate's
answer-key requirement reduces to *a boolean is true and a label reads
`ANSWER_KEY`*, so a mass-generated corpus would report `READY` while containing
no answer to any question — and the arithmetic behind a key handed to a parent
as authoritative is exactly what cannot be self-certified. See
[`../ready-for-life-financial-literacy-full/README.md`](../ready-for-life-financial-literacy-full/README.md).

The answer here is not to assert harder. It is to make the corpus fail closed.

## Status

**Partial: 82 of 288 lessons authored.** Grade 9 is complete (72/72) and
grade 10 stands at 10/72; grades 11 and 12 are not started.
`tests/corpus.test.ts` fails until every source lesson is authored, and reports
the exact count outstanding. Run `node --experimental-strip-types src/report.ts`
for the current position.

Nothing in this lane is promoted, released, or wired into the app. The source it
is authored against is itself authoring-stage: `curriculum-authoring/` holds
grades 9-12 and no release contains them. Promotion remains a release decision
and is not made here.

## How an answer becomes trustworthy

Every lesson is one authored `LessonSpec` in `src/specs/`. Both shipped files are
projected from it by `src/compose.ts`, deterministically — same spec, byte-identical
output — so a diff in `packages/` or `scoring/` is always a diff in authored content.

The authored `answer` on a fixed item is treated as a **claim, never as authority**:

1. **Independent recomputation.** `src/oracle.ts` re-derives the value from the
   item's own declared scenario parameters using a separately written expression
   evaluator, formats it by the item's declared format, and compares. A mismatch
   is a hard failure. `src/compose.ts` refuses to emit a lesson whose answers the
   oracle cannot reproduce, so a bad key cannot reach `scoring/` at all.
2. **Exact arithmetic.** All of it runs in rational arithmetic over `BigInt`
   (`src/exact.ts`), rounding half away from zero at the cent. No binary floating
   point touches a currency answer. `tests/exact.test.ts` pins this.
3. **The oracle cannot become a no-op.** `tests/oracle.test.ts` feeds it a
   deliberately wrong key and a deliberately broken expression and requires both
   to be rejected. If the oracle is ever weakened, that test fails before the
   corpus does — the blind spot the previous round documented cannot reappear here
   unnoticed.
4. **Parameter visibility.** Every figure an answer is scored against must appear
   somewhere the learner can read it. `checkParameterVisibility` searches the whole
   sheet for each declared parameter and each non-structural literal in the
   expression, in every exact rendering. This is what stops a key drifting away
   from the sheet it grades, and it is also the practical check on the model: a
   formula reaching for a figure the scenario never states fails.

### What this establishes, and what it does not

Recomputation establishes that a key **follows from the figures the learner was
shown**. It does not establish that the formula is the **right model** for the
scenario — an internally consistent computation of the wrong thing still passes.
That gap is carried by three other things, and the limit is stated in each emitted
scoring record rather than left implicit:

- a per-item `reasoning` string, adult-only, saying why this computation is the
  right one, which a reviewer can check against the scenario prose;
- the parameter-visibility rule above;
- human review. One high-school personal-finance accuracy reviewer read the
  grade-9 corpus for model correctness, concept accuracy, labelling of
  simplifications, and the safety boundary. It found twelve critical defects the
  oracle could not have caught — including a rubric with no correct answer, a key
  that contradicted its own sheet's chronology, and a taxes unit that applied
  brackets to gross income with no standard deduction anywhere in it. All twelve
  are fixed; the findings, the fixes, and the minor items left open are recorded
  in [`REVIEW.md`](REVIEW.md). Grades 10-12 carry no review.

## Judgment work carries no invented key

Items scored by judgment emit `exactKey: null` — asserted by
`tests/emitted.test.ts`, not merely intended. What they carry instead is authored
per lesson:

- **acceptable-answer criteria** — at least two, each substantive enough to score
  against, describing what a response must establish;
- **evidence requirements** — what the response must cite from the scenario;
- **look-fors** — observable indicators for the adult scoring the work, including
  where a defensible answer may go either way;
- **common misconception**, where the item was built to surface one.

Rubric *level descriptors* are shared across the course by design: a rubric a
household applies across 72 lessons has to mean the same thing in October as in
April. Everything that makes the rubric usable on a particular task is authored
per lesson, and `tests/corpus.test.ts` requires it.

## No lesson is another lesson with the numbers changed

`checkAntiTemplate` strips every digit from a lesson's prompts and directions and
requires the remaining shape to be unique across the corpus, and separately
requires distinct scenarios, objectives, remediations, and fixed-answer sets. Two
lessons that are the same lesson with different numbers collide and fail.

## The safety boundary

Enforced by `checkSafety` on learner-facing text, not by policy alone:

- Every figure, person, employer, institution, offer, account, and document is
  fictional, and each scenario must say so.
- No lesson solicits real financial data — no bank, card, brokerage, tax, or login
  detail, no real balance, no household income.
- No lesson asks a learner what to do with their own money. Simplified tax
  schedules and penalty rules are invented and labelled as such in the lesson text.
- `realWorldAction` is `false` and `completionAuthority` is `learner` throughout:
  no lesson requires a purchase, transfer, application, or account opening.

Answers, rubric descriptors, worked solutions, and look-fors never appear in a
task sheet. `tests/emitted.test.ts` walks every key of every composed sheet and
fails on any of them.

## Layout

```
schema/      task-sheet and scoring-record JSON Schemas for grades 9-12
src/
  types.ts        the authoring model
  exact.ts        rational arithmetic over BigInt
  oracle.ts       expression evaluator, formatting, fail-closed verification
  rubric.ts       shared rubric spine for judgment items
  validate.ts     visibility, safety, structure, anti-template checks
  compose.ts      spec -> task sheet + scoring record
  sourceIndex.ts  reads the pinned source corpus through `git show`
  specs/          the authored lessons, one file per grade-unit
  emit.ts         writes packages/ and scoring/
  report.ts       coverage and verification counts
packages/    learner-facing task sheets
scoring/     adult-only scoring records
```

## Running it

```
node --experimental-strip-types src/emit.ts
npx vitest run --config tooling/vitest.config.mts
node --experimental-strip-types src/report.ts
```

Emission and the test suite both read the source corpus through `git show` at the
pinned SHA, so they require the repository but not a checkout of the source branch.

## Outstanding

- 206 lessons remain unauthored: grade 10 units 2-7 (62 lessons), grade 11
  (72), and grade 12 (72), including the grade 12 unit 7 simulated adult-finance
  capstone. The coverage test fails closed until they are authored, and names the
  first missing lesson ids in its failure output.
- Promotion of `curriculum-authoring/full-family-highschool-9-12` into a
  `curriculum-content` release is unresolved, and `lesson.schema.json` in the
  frozen release still pins `grade` to `[5,7,8]`. Both are release-owned changes
  and are not made here.
- The gate blind spot documented by the previous round is untouched by this lane.
  This corpus does not rely on the gate; hardening it remains open work.
