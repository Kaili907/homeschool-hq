# Grade 12 Financial Literacy — student-work production

Learner-facing task sheets and adult-only scoring records for the **complete**
grade 12 Financial Literacy course, authored against the source lane
`mac/hs912-rfl-finlit-r1` read at the pinned tip
`481296a9e794770348881b43bd0d1fa4f794db29`.

## Status

**Complete: 72 of 72 source lessons authored**, across the seven units the
source defines — 10, 10, 10, 11, 10, 10, and 11 lessons, the last being the
adult-finance capstone unit. Coverage is derived from the source at test time,
not asserted: `tests/corpus.test.ts` reads `units.json` and `lessons.jsonl` at
the pinned SHA and fails if a single lesson is missing, invented, or misplaced.

```
lessons                 72 / 72        fixed items            482
tasks                  222             rubric-scored items     72
prompts                554             oracle findings          0
fixed answers verified 465             capstone lessons         7
```

Nothing here is promoted, released, or wired into the app. The source it is
authored against is itself authoring-stage: `curriculum-authoring/` holds
grades 9-12 and no release contains them. Promotion remains a release decision
and is not made here.

## Why this lane exists separately

The sibling lane [`../../financial-literacy-hs`](../../financial-literacy-hs)
holds grades 9 and 10 and is not modified by this round, which owns
`financial-literacy-hs-completion/grade-12/**` only. That ownership boundary is
the reason the engine below is a sibling copy rather than a shared import: this
lane cannot add a spec file, a registry entry, or a test to a directory it does
not own. The cost is a duplicated toolchain; the benefit is that grade 12 is
independently verifiable and fails closed on its own.

## How an answer becomes trustworthy

Every lesson is one authored `LessonSpec` in `src/specs/`. All three shipped
artefacts — the task sheet, the scoring record, and the gate metadata — are
projected from it by `src/compose.ts` and `src/gateMetadata.ts`,
deterministically, so a diff in `packages/`, `scoring/`, or `gate/` is always a
diff in authored content.

The authored `answer` on a fixed item is treated as a **claim, never as
authority**:

1. **Independent recomputation.** `src/oracle.ts` re-derives the value from the
   item's own declared scenario parameters using a separately written
   expression evaluator, formats it by the item's declared format, and
   compares. A mismatch is a hard failure. `compose.ts` refuses to emit a
   lesson whose answers the oracle cannot reproduce, and `gateMetadata.ts`
   refuses to publish metadata for one, so a bad key cannot reach `scoring/`
   or the gate at all.
2. **Two independent implementations.** Every authored answer was computed
   first in a separate Fraction-based evaluator during authoring, then
   re-derived by the TypeScript oracle. Agreement between two implementations
   written independently is what the 465 verified answers rest on.
3. **Exact arithmetic.** All of it runs in rational arithmetic over `BigInt`
   (`src/exact.ts`), rounding half away from zero at the cent. No binary
   floating point touches a currency answer. `tests/exact.test.ts` pins this.
4. **The oracle cannot become a no-op.** `tests/oracle.test.ts` feeds it a
   deliberately wrong numeric key, a deliberately broken expression, and a
   choice key that disagrees with the comparison its own parameters decide, and
   requires all three to be rejected.
5. **Parameter visibility.** Every figure an answer is scored against must
   appear somewhere the learner can read it. `checkParameterVisibility`
   searches the whole sheet for each declared parameter and each non-structural
   literal. This is what stops a key drifting away from the sheet it grades,
   and during authoring it caught a real defect: a capstone lesson scoring
   against a salary its own directions never stated.

### What this establishes, and what it does not

Recomputation establishes that a key **follows from the figures the learner was
shown**. It does not establish that the formula is the **right model** for the
scenario — an internally consistent computation of the wrong thing still
passes. That gap is carried by the per-item `reasoning` string (adult-only,
checkable against the scenario prose), the parameter-visibility rule, and human
review. The limit is stated in every emitted scoring record rather than left
implicit. See [`REVIEW.md`](REVIEW.md) for the accuracy review this corpus
carries.

## What makes this grade 12 rather than grade 9 with larger numbers

Two properties are enforced by validators, not by intent:

- **Integration.** Every lesson declares the financial domains it actually
  makes the learner reason across, and `checkIntegration` requires at least
  two. The corpus averages 4.54 and covers all twelve domains the brief
  names — income, taxes, budgeting, banking, credit, debt, insurance and risk,
  saving and investing, consumer protection, fraud, postsecondary financing,
  and multi-variable decisions.
- **Mixed scoring.** `checkMixedScoring` requires every lesson to carry both
  fixed and judgment scoring authority. No grade 12 lesson is scored purely by
  arithmetic or purely by opinion.

`tests/progression.test.ts` additionally runs the anti-template check *across
grades*, comparing every grade 12 task sheet against the 92 sheets the sibling
lane already ships for grades 9 and 10: no repeated prompt shape once digits
are stripped, no repeated scenario, no repeated objective. It then measures
what makes a lesson senior — that 80% or more of lessons chain a computation
onto an earlier result, and that judgment items are weighted toward tradeoff
defence, assumption identification, uncertainty, and plan coherence.

## The capstone

Unit 7 is the adult-finance capstone: seven lessons operating one fictional
adult's simulated financial year end to end, then defending it.

- It runs on **Case R**, a fictional adult invented for the course, or on a
  **fictional profile the learner invents** instead. It never asks for the
  learner's own income, bank balances, credit score, debts, financial aid,
  tuition, tax return, family finances, investment accounts, or insurance
  policies. `checkCapstoneIntegrity` and `checkPrivacy` enforce this against
  the learner-facing text; `tests/capstone.test.ts` re-checks it against every
  forbidden artefact the brief names.
- It integrates broadly: every capstone lesson declares at least five domains,
  and the set spans income, taxes, budgeting, debt, saving and investing, and
  insurance and risk.
- **There is no single correct life plan.** Every capstone judgment item that
  asks for a decision records at least two genuinely defensible alternatives —
  23 of them across the unit — and these are published in the scoring record
  the adult actually reads, so the artefact itself states that competing
  answers earn full credit when they are defended. A capstone lesson recording
  only one path fails the validator. `tests/capstone.test.ts` asserts this both
  on the specs and on the emitted records.
- Case R's figures are consistent across every lesson that shares them, and
  each lesson restates the figures it depends on so the sheet is self-contained.

## Judgment work carries no invented key

Items scored by judgment emit `exactKey: null` — asserted by
`tests/emitted.test.ts`, not merely intended. What they carry instead is
authored per lesson: 247 acceptable-answer criteria, 86 evidence requirements,
and 163 look-fors across the 72 rubric-scored items, plus a common
misconception where the item was built to surface one.

Rubric *level descriptors* are shared across the course by design: a rubric a
household applies across 72 lessons has to mean the same thing in October as in
April. Everything that makes the rubric usable on a particular task is authored
per lesson.

## Production Gate H3 scoring modes

The shared production-readiness gate this repository owns
(`src/curriculum/production-quality`) recognises exactly three scoring modes —
`ANSWER_KEY`, `RUBRIC`, and `SCORING_JUDGMENT` — and requires a
`MATH_STRUCTURED_FINLIT` lesson to present a fixed `ANSWER_KEY`. This lane
authors every lesson as mixed work, so its own records are `HYBRID`, a kind the
gate's vocabulary does not contain.

`src/gateMetadata.ts` prepares the mapping rather than papering over it. A
lesson may be declared `ANSWER_KEY` to the gate only when it actually carries
at least one fixed answer the oracle reproduced; `projectGateMode` throws
rather than downgrading, so a lesson that lost its fixed items can never reach
the gate still claiming a key. Per-lesson `fixedItemCount`,
`rubricItemCount`, and `oracleVerifiedFixedAnswers` are published in
`gate/gate-metadata.json` so the claim can be audited rather than trusted, and
the rubric half is reported alongside rather than discarded.

`tests/gate.test.ts` runs the **real gate code, unmodified**, over the authored
corpus projected through that metadata. The gate is not owned by this lane and
is not changed by it.

## The safety boundary

Enforced by `checkSafety` and `checkPrivacy` on learner-facing text, not by
policy alone:

- Every figure, person, employer, institution, offer, account, schedule, rate,
  and document is fictional, and each scenario says so. No real firm, product,
  or ticker is named anywhere.
- No lesson solicits real financial data, and nothing shaped like a credential
  or account identifier appears in anything emitted.
- No lesson asks a learner what to do with their own money. Simplified tax
  schedules, payment factors, and programme rules are invented and labelled as
  such in the lesson text.
- Return figures in the investing unit are stated assumptions for an
  illustration, never forecasts, and the judgment items are built so a response
  cannot score well by treating an illustrated figure as a promise.
- `realWorldAction` is `false` and `completionAuthority` is `learner`
  throughout.

Answers, rubric descriptors, worked solutions, and look-fors never appear in a
task sheet: `tests/emitted.test.ts` walks every key of every composed sheet and
fails on any of them.

## Layout

```
schema/      task-sheet, scoring-record, and gate-metadata JSON Schemas
src/
  types.ts        the authoring model
  exact.ts        rational arithmetic over BigInt
  oracle.ts       expression evaluator, formatting, fail-closed verification
  rubric.ts       shared rubric spine for judgment items
  validate.ts     visibility, safety, structure, anti-template, integration,
                  mixed scoring, capstone integrity, privacy
  compose.ts      spec -> task sheet + scoring record
  gateMetadata.ts spec -> Production Gate H3 scoring-mode metadata
  sourceIndex.ts  reads the pinned source corpus through `git show`
  specs/          the authored lessons, one file per unit
  emit.ts         writes packages/, scoring/, and gate/
  report.ts       coverage and verification counts
  check.ts        runs every validator at once, for authoring
packages/    learner-facing task sheets (72)
scoring/     adult-only scoring records (72)
gate/        Production Gate H3 scoring-mode metadata
```

## Running it

```
node --experimental-strip-types src/emit.ts
npx vitest run --config tooling/vitest.config.mts
npx tsc --noEmit -p tooling/tsconfig.json
node --experimental-strip-types src/report.ts
```

Emission and the test suite both read the source corpus through `git show` at
the pinned SHA, so they require the repository but not a checkout of the source
branch.

## Outstanding

- Grades 11 and 12 in the sibling lane remain as that lane records them; this
  round owns grade 12 in this directory only and does not modify the sibling.
  Whether the two lanes are later merged is a decision for whoever owns both.
- The engine is duplicated from the sibling lane for the ownership reason given
  above. If the lanes are consolidated, `exact.ts`, `oracle.ts`, and `rubric.ts`
  are the files to share first — they are byte-identical apart from the grade 12
  additions in `types.ts` and `validate.ts`.
- Promotion of `curriculum-authoring/full-family-highschool-9-12` into a
  `curriculum-content` release is unresolved, and `lesson.schema.json` in the
  frozen release still pins `grade` to `[5,7,8]`. Both are release-owned changes
  and are not made here.
