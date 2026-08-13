# High School Financial Literacy — grade 10 completion lane

Learner-facing task sheets and adult-only scoring records for **grade 10 units
3 to 7** of the high-school Financial Literacy sequence, authored against
`mac/hs912-rfl-finlit-r1` at the pinned tip
`481296a9e794770348881b43bd0d1fa4f794db29`.

## What this lane owns, and what it does not

Grade 10 has 72 source lessons. Units 1 and 2 — the first 20 — were authored in
an earlier round and live in the sibling lane
[`../../financial-literacy-hs`](../../financial-literacy-hs). **This lane
authors the remaining 52 and does not modify the sibling lane, the accepted
grade 9 corpus, another grade's completion lane, or the source curriculum.**

```
grade 10 units 1-2   20 lessons   financial-literacy-hs           (accepted earlier)
grade 10 units 3-7   52 lessons   this lane
                     ---------
                     72 lessons   grade 10 after convergence
```

`tests/corpus.test.ts` asserts both halves: that all 52 owned lessons are
authored exactly once with none invented, and that reading the sibling lane's
emitted sheets brings grade 10 to 72 with no overlapping lesson id. Run
`node --experimental-strip-types src/report.ts` for the current position.

Nothing here is promoted, released, or wired into the app. The source it is
authored against is itself authoring-stage.

## The architecture is the accepted one

The verification machinery — `types.ts`, `exact.ts`, `oracle.ts`, `rubric.ts`,
`validate.ts`, `compose.ts` — is the architecture accepted for grade 9, carried
into this lane so that grades can be authored in parallel without contending for
one registry and one emitted tree. It is a copy, not a fork: no behaviour was
changed. What is new here is `gateMetadata.ts`, described below.

Every lesson is one authored `LessonSpec` in `src/specs/`. Both shipped files
are projected from it deterministically by `compose.ts` — same spec,
byte-identical output — so a diff in `packages/` or `scoring/` is always a diff
in authored content.

The authored `answer` on a fixed item is a **claim, never authority**:

1. **Independent recomputation.** `oracle.ts` re-derives the value from the
   item's own declared scenario parameters with a separately written expression
   evaluator, formats it by the item's declared format, and compares. A mismatch
   is a hard failure, and `compose.ts` refuses to emit a lesson whose answers the
   oracle cannot reproduce.
2. **Exact arithmetic.** All of it in rational arithmetic over `BigInt`, rounding
   half away from zero at the cent. No binary floating point touches a currency
   answer.
3. **The oracle cannot become a no-op.** `tests/oracle.test.ts` feeds it a
   deliberately wrong key and a deliberately broken expression and requires both
   to be rejected.
4. **Parameter visibility.** Every figure an answer is scored against must appear
   somewhere the learner can read it, and `tests/corpus.test.ts` additionally
   requires that no numeric answer appears in the sheet text *preceding its own
   item* — a fixed answer must not be readable before it is computed.

Recomputation establishes that a key follows from the figures the learner was
shown. It does not establish that the formula is the right **model**. That gap is
carried by the per-item `reasoning` in each scoring record, by the visibility
rules, and by human review — see [`REVIEW.md`](REVIEW.md).

## Modelling commitments, stated on the sheet rather than assumed

The grade 9 review found a taxes unit that applied brackets to gross income with
no standard deduction anywhere in it, and a key that contradicted its own sheet's
chronology. This lane states its models in the learner-facing directions of every
lesson that depends on them:

- **Insurance (unit 6).** `payout = min(covered loss − deductible, coverage
  limit)`. The deductible comes off the **loss**; the limit caps the **payout**.
  `limit − deductible` is not the payout, and unit 6 lesson 2 computes the size
  of that specific error explicitly. It follows that the insured's own cost is
  **not** always the deductible: when the limit binds, they carry the deductible
  and everything above the limit. Lessons 2, 8, 9, and 10 each carry a case where
  that happens. Health coverage in lesson 4 uses a different structure again —
  deductible, then coinsurance, then an out-of-pocket maximum capping the
  **patient** — and the sheet states the order of operations.
- **Taxes (unit 7).** Taxable income is gross less a **visible** standard
  deduction of $11,200, and brackets apply to taxable income, never to gross.
  Rates are 10% to $9,800, 14% to $42,000, and 24% above. Payroll tax is 6% up to
  a $158,000 wage cap plus an uncapped 1.5% levy, and 15% on self-employment
  income. Every figure is invented, and is deliberately different from the
  fictional grade 9 schedule so a learner meets a second structure rather than a
  memorised one.
- **Amortisation (unit 4).** Modelled as it behaves: interest on the balance
  outstanding at the start of each period, the fixed payment applied to interest
  first, the remainder reducing the balance. Lesson 3 carries three months by
  hand; lessons 9 and 10 use the level-payment annuity. Where a total is a
  payment times a count, the sheet says the payment is rounded to the cent and a
  real final payment absorbs the difference. In-school interest accrues simple
  and capitalises once, and the sheet says real loans vary.
- **Investing (unit 5).** Returns are stated outcomes of a simulated period, never
  forecasts, and no lesson advises anyone about their own money.

## Judgment work carries no invented key

Items scored by judgment emit `exactKey: null` — asserted by
`tests/emitted.test.ts`. What they carry instead is authored per lesson:
acceptable-answer criteria (at least two, each substantive enough to score
against), evidence requirements, look-fors, and a common misconception where the
item was built to surface one. Rubric *level descriptors* are shared by design;
everything that makes the rubric usable on a particular task is per lesson.

## No lesson is another lesson with the numbers changed

`checkAntiTemplate` strips every digit from a lesson's prompts and requires the
remaining shape to be unique, and separately requires distinct scenarios,
objectives, remediations, and fixed-answer sets. Because that check only sees
this lane, `tests/corpus.test.ts` additionally reads the sibling lane's 92
emitted task sheets and requires no collision against those either.

## The safety boundary

Enforced by `checkSafety` on learner-facing text, not by policy alone. Every
figure, person, employer, institution, offer, account, policy, and document is
fictional and each scenario says so. No lesson solicits real financial data — no
bank, card, brokerage, tax, or login detail, no real balance, income, credit
score, debt, or holdings. No lesson asks a learner what to do with their own
money. `realWorldAction` is `false` and `completionAuthority` is `learner`
throughout. Answers, rubric descriptors, worked solutions, and look-fors never
appear in a task sheet, and `tests/emitted.test.ts` walks every key of every
composed sheet and fails on any of them.

## Production Gate H3

`src/gateMetadata.ts` emits [`gate-metadata.json`](gate-metadata.json), the
projection convergence needs into H3's `responseScoring` contract. H3 treats
`MATH_STRUCTURED_FINLIT` as two disciplines: a lesson declaring
`structuredDiscipline: 'FINANCIAL_LITERACY'` carries a mode plus an inventory of
items each tagged `FIXED` or `OPEN`, and is failed closed without it.

Every lesson in this lane is mixed work, so every one projects to `MIXED` — and
that is a fact rather than a label: H3 requires both authorities for `MIXED`, and
both are present in all 52 scoring records. The inventory is **derived from the
emitted task sheet**, not asserted, so the mode cannot drift from what ships;
`projectLesson` throws rather than emitting a contract its own items contradict,
or metadata for a lesson the oracle could not reproduce.

## Layout

```
schema/      task-sheet, scoring-record, and gate-metadata JSON Schemas
src/
  types.ts        the authoring model
  exact.ts        rational arithmetic over BigInt
  oracle.ts       expression evaluator, formatting, fail-closed verification
  rubric.ts       shared rubric spine for judgment items
  validate.ts     visibility, safety, structure, anti-template checks
  compose.ts      spec -> task sheet + scoring record
  gateMetadata.ts spec + sheet -> Production Gate H3 responseScoring projection
  sourceIndex.ts  reads the pinned source corpus through `git show`
  specs/          the authored lessons, one file per unit
  emit.ts         writes packages/, scoring/, and gate-metadata.json
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

Emission and the tests read the source corpus through `git show` at the pinned
SHA, so they require the repository but not a checkout of the source branch.

## Outstanding

- Grades 11 and 12 are authored in their own completion lanes and are not this
  lane's concern. Grade 10 is complete only once this lane and
  `financial-literacy-hs` are converged; neither is complete alone.
- Promotion of `curriculum-authoring/full-family-highschool-9-12` into a
  `curriculum-content` release is unresolved, and `lesson.schema.json` in the
  frozen release still pins `grade` to `[5,7,8]`. Both are release-owned and are
  not decided here.
