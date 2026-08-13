# Grade 11 Financial Literacy — student-work completion supplement

Learner-facing task sheets and adult-only scoring records for **all 72 lessons**
of the grade-11 Financial Literacy course authored on `mac/hs912-rfl-finlit-r1`,
read at the pinned tip `481296a9e794770348881b43bd0d1fa4f794db29`.

**Status: complete. 72 of 72 source lessons authored, PF1 through PF7, and
reviewed.**

This supplement is deliberately **self-contained**. It shares no module with the
grades 9-10 lane in `../../financial-literacy-hs/`: it carries its own copy of
the accepted pipeline, its own schemas, its own tests, and its own pinned reader
that loads the grade-11 course only. It can be reviewed, tested, and merged on
its own, and it does not modify the sibling lane or the source curriculum.

Nothing here is promoted, released, or wired into the app. The source it is
authored against is itself authoring-stage: `curriculum-authoring/` holds grades
9-12 and no release contains them. Promotion remains a release decision and is
not made here.

## Coverage, re-derived rather than assumed

The inventory is read out of the pinned source at test time, not hard-coded:
`tests/corpus.test.ts` loads `units.json` and `lessons.jsonl`, asserts seven
units carrying the PF1-PF7 standards, asserts 72 lessons, and then requires a
one-to-one match against the authored specs with nothing missing and nothing
invented.

```
unit 1 (PF1) 10   unit 2 (PF2) 10   unit 3 (PF3) 10   unit 4 (PF4/PF4.1) 11
unit 5 (PF5) 10   unit 6 (PF6) 10   unit 7 (PF7) 11                    = 72
```

| | |
|---|---|
| task sheets / scoring records | 72 / 72 |
| questions | 803 |
| fixed-answer items | 659 |
| rubric-scored items | 144 |
| independently recomputed numeric answers | 601 |
| comparison-derived keyed choices | 33 |
| asserted-fact choices (keyed, reviewer-checkable reasoning) | 25 |
| scoring authority | HYBRID on all 72 — every lesson carries both |

## How an answer becomes trustworthy

Every lesson is one authored `LessonSpec` in `src/specs/`. Both shipped files are
projected from it by `src/compose.ts`, deterministically — same spec,
byte-identical output — so a diff in `packages/`, `scoring/`, or `gate/` is
always a diff in authored content.

The authored `answer` on a fixed item is treated as a **claim, never as
authority**:

1. **Two independent computation paths.** Every figure was worked once by hand
   in a separate exact-rational implementation while the lesson was written, and
   then re-derived by `src/oracle.ts` from the item's own declared scenario
   parameters using a separately written expression evaluator. An answer is only
   accepted when both agree. This caught real authoring slips — the year-6 salary
   in `u01-l04` was wrong by $0.19 until the oracle refused it.
2. **Exact arithmetic.** All of it runs in rational arithmetic over `BigInt`
   (`src/exact.ts`), rounding half away from zero at the cent. No binary floating
   point touches a currency answer. `tests/exact.test.ts` pins this.
3. **Fails closed.** `src/compose.ts` refuses to emit a scoring record whose
   answers the oracle cannot reproduce, so a bad key cannot reach `scoring/`.
4. **The oracle cannot become a no-op.** `tests/oracle.test.ts` feeds it a
   deliberately wrong numeric key, a keyed choice that disagrees with the
   parameters that decide it, an expression reaching for an undeclared parameter,
   and an expression reaching for a result that is not an earlier item — and
   requires all four to be rejected. It further requires that *every single
   lesson* verifies at least one fixed answer, so the corpus cannot pass by
   having verification concentrated in a few lessons.
5. **Parameter visibility.** Every figure an answer is scored against must appear
   somewhere the learner can read it, in an exact rendering. This is what stops a
   key drifting away from the sheet it grades, and it is the practical check on
   the model: a formula reaching for a figure the scenario never states fails.

### What this establishes, and what it does not

Recomputation establishes that a key **follows from the figures the learner was
shown**. It does not establish that the formula is the **right model** for the
scenario — an internally consistent computation of the wrong thing still passes.
That gap is carried by the per-item `reasoning` string (adult-only, saying why
this computation is the right one), by the visibility rule, and by human review.
The limit is stated in every emitted scoring record rather than left implicit.

One independent accuracy reviewer read all 72 task sheets, all 72 scoring
records, and the seven spec files. It failed the corpus as submitted, with **13
critical and 10 minor defects** — a scenario whose stated rate and payment could
not both be true, two multiple-choice items with two correct options, a layered
insurance answer that double-counted deductibles, a break-even keyed to the wrong
formula, and several remediations quoting figures that existed nowhere in their
lesson. Every critical defect is fixed and re-verified; nine of the ten minor
ones are fixed and the tenth is recorded. The findings, the fixes, and the item
left open are in [`REVIEW.md`](REVIEW.md).

## Grade 11 sits above grade 9, and is checked against it

The brief for this supplement required grade 11 to be substantively above grade 9
and not grade 9 re-skinned with larger numbers. Both are enforced in
`src/progression.ts` and `tests/progression.test.ts`, not asserted in prose.

The grade-9 corpus in the sibling lane was **measured** to set the baseline:

| | grade 9 (measured) | grade 11 |
|---|---|---|
| items per lesson | 7.21 | **11.15** |
| fixed items per lesson | 6.00 | **9.15** |
| rubric items per lesson | 1.21 | **2.00** |
| composition depth (earlier results consumed by one expression), mean | 1.93 | **2.32** |
| lessons composing 2+ earlier results | 54 / 72 | **72 / 72** |
| lessons composing 3+ earlier results | 8 / 72 | **20 / 72** |
| lessons modelling more than one period with `pow` | 7 / 72 | **19 / 72** |

Per-lesson floors: at least 8 items, 6 fixed and 2 judgment; at least one
expression composing two earlier results; at least one judgment item scored on a
tradeoff, assumption, uncertainty, transfer, error-diagnosis, or plan-coherence
dimension. Corpus floors are set as **gates just under what the corpus achieves**
and well above grade 9 — they are bars a regression would trip, not targets the
content was bent to reach.

**Anti-reskin.** `checkNotReskinnedFromGrade9` strips every digit from each
grade-11 lesson's prompts and directions and requires the remaining shape to
appear nowhere in the emitted grade-9 corpus. A grade-11 lesson that is a grade-9
lesson with the numbers changed collides and fails. The check is skipped, and
reported as skipped, if the sibling lane is absent — this supplement must stand
alone, so it may not hard-depend on that corpus.

**Where multi-period work lives.** Closed-form compounding (`pow`) is the right
model where a quantity grows at a rate, and it appears across units 1, 2, 3, 5,
and 6. Units 4 and 7 also work across many periods and many bands, but they do it
explicitly: unit 4 builds amortisation month by month from the outstanding
balance, and unit 7 computes tax band by band. Those are the correct models for
those topics and would be less rigorous, not more, compressed into a power.

## The conceptual checks the brief named

- **Taxes.** One schedule is used across unit 7 and stated in full in every
  lesson that uses it: a standard deduction of $11,400, then 10% on the first
  $9,800 of taxable income, 14% to $38,400, 22% to $85,400, 30% above. The
  thresholds and the rate set match no real schedule, and every lesson says the
  figures were chosen for this course and describe no real tax system. Taxable
  income is computed before any rate is applied, so no lesson charges a bracket
  rate against gross income. The capital-gains rule in u07-l05 and u07-l11 uses
  an 18-month boundary and a flat 12%, deliberately off the real regime. One
  residual coincidence — the $11,400 deduction matching a 2009-2010 published
  figure — is recorded and left as authored in [`REVIEW.md`](REVIEW.md).
- **Loans.** Unit 4 builds real amortisation: interest on the outstanding
  balance, principal as the remainder of the payment, balance reduced by the
  principal only. Where a lesson deliberately drops interest to isolate an
  ordering effect, or uses a classroom simple-interest rule, it says so in the
  learner-facing text and the scoring record explains what a real loan would do
  differently.
- **Insurance.** Every payout is worked in the order a policy applies it:
  `min(max(loss - deductible, 0), limit)`. Deductible first, then the limit caps
  what remains, then the remainder is the holder's. `u06-l04` makes the order
  itself the object of study and asks the learner to construct a loss for which
  the two orders disagree.
- **Investing.** General concepts on fictional cases only — diversification,
  rebalancing, fees, real return, expected value, the arithmetic-versus-compound
  distinction. No lesson names a real product or asks any learner what to do with
  money of their own.
- **Fraud.** `u06-l06` is analysis of a written, already-concluded fictional
  transcript. It requires no contact with anyone, no message, no account, and no
  credential, and the learner-facing text says so.

## Judgment work carries no invented key

Items scored by judgment emit `exactKey: null` — asserted by
`tests/emitted.test.ts`, not merely intended. Every lesson carries at least two
of them, and each carries, authored per lesson: at least two acceptable-answer
criteria substantive enough to score against, at least one evidence requirement,
at least two observable look-fors, and at least two rubric dimensions.
`tests/rubric.test.ts` requires all of that, requires every named dimension to
have an emitted criteria block, and requires no two judgment items in the corpus
to share a criteria set.

Rubric *level descriptors* are shared across the course by design: a rubric a
household applies across 72 lessons has to mean the same thing in October as in
April. Everything that makes the rubric usable on a particular task is authored
per lesson.

## The safety boundary

Enforced by `checkSafety` on learner-facing text, not by policy alone:

- Every figure, person, employer, lender, insurer, fund, and document is
  fictional, and each scenario must say so.
- No lesson solicits real financial data — no bank, card, brokerage, tax, or
  login detail, no real balance, no household income, no credit score.
- No lesson asks a learner what to do with their own money.
- `realWorldAction` is `false` and `completionAuthority` is `learner` throughout.

Answers, rubric descriptors, worked solutions, and look-fors never appear in a
task sheet. `tests/emitted.test.ts` walks every key of every composed sheet, and
separately checks that no computed answer string appears as a value anywhere in
it.

## Production Gate H3

`gate/h3-manifest.json` is the reconciliation claim: source pinning, coverage
with explicit `missing` and `invented` lists, per-lesson rows carrying the
package id, standards, scoring authority, item counts, verification counts,
composition depth, and a sha256 of each emitted file, plus corpus totals,
progression metrics, and the safety flags. It is derived, never hand-maintained:
`tests/gateH3.test.ts` rebuilds it, fails if the committed file differs,
reconciles its own totals against its per-lesson rows, and requires zero
unresolved oracle and validation findings.

## Layout

```
schema/      task-sheet and scoring-record JSON Schemas
src/
  types.ts        the authoring model
  exact.ts        rational arithmetic over BigInt
  oracle.ts       expression evaluator, formatting, fail-closed verification
  rubric.ts       shared rubric spine for judgment items
  validate.ts     visibility, safety, structure, anti-template checks
  progression.ts  grade-11 floors and the anti-reskin check against grade 9
  gateH3.ts       Production Gate H3 reconciliation metadata
  compose.ts      spec -> task sheet + scoring record
  sourceIndex.ts  reads the pinned grade-11 source through `git show`
  specs/          the authored lessons, one file per unit
  emit.ts         writes packages/, scoring/, and gate/
  report.ts       coverage, verification, and progression position
tooling/     vitest and tsconfig for this lane, plus the authoring check loop
packages/grade-11/   learner-facing task sheets
scoring/grade-11/    adult-only scoring records
gate/                the H3 reconciliation manifest
```

## Running it

```
node --experimental-strip-types src/emit.ts
npx vitest run --config tooling/vitest.config.mts
npx tsc -p tooling/tsconfig.json --noEmit
node --experimental-strip-types src/report.ts
```

While authoring, `tooling/check.mjs` runs the oracle and every validation and
progression check over the registry and prints one line per finding, which is
easier to read than a failed deep-equality diff over 72 lessons. It takes an
optional substring to narrow to one lesson or unit:

```
node --experimental-strip-types tooling/check.mjs u04-l01
```

Emission and the test suite both read the source corpus through `git show` at the
pinned SHA, so they require the repository but not a checkout of the source
branch.

## Outstanding

- Grades 10 and 12 are out of scope here and remain incomplete in the sibling
  lane; this supplement does not touch them.
- Promotion of `curriculum-authoring/full-family-highschool-9-12` into a
  `curriculum-content` release is unresolved, and `lesson.schema.json` in the
  frozen release still pins `grade` to `[5,7,8]`. Both are release-owned changes
  and are not made here.
- The gate blind spot documented by the earlier round — an answer-key requirement
  that reduced to a boolean being true — is untouched by this lane. This corpus
  does not rely on that gate; hardening it remains open work.
