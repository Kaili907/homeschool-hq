# Financial Literacy, grades 3–8 — student work and scoring authority

Genuine student work and adult-only scoring authority for **every** Financial
Literacy lesson in grades 3, 4, 5, 7, and 8: **216 lessons, 432 files.**

```bash
node --import ./curriculum-production/student-work/financial-literacy-g38/tooling/register.mjs \
  curriculum-production/student-work/financial-literacy-g38/tooling/verify.ts
python3 curriculum-production/student-work/financial-literacy-g38/tooling/crosscheck.py
```

## The inventory, re-derived rather than assumed

| Grade | Lessons | Fixed answer key | Rubric judgment | Recomputed items | Source |
|------:|--------:|-----------------:|----------------:|-----------------:|--------|
| 3  | 36 | 30 | 6  | 150 | `mac/g34-rfl-finlit-r1` (via `git show`) |
| 4  | 36 | 29 | 7  | 145 | `mac/g34-rfl-finlit-r1` (via `git show`) |
| 5  | 36 | 30 | 6  | 150 | worktree |
| 7  | 36 | 30 | 6  | 150 | worktree |
| 8  | 72 | 61 | 11 | 305 | worktree |
| **Total** | **216** | **180** | **36** | **900** | corpus `1.0.0` |

`src/inventory.ts` reads the released `1.0.0` JSONL for each grade on every run;
grades 3 and 4 are not checked out here, so they are read through `git show`.
`tests/inventory.test.ts` asserts the counts against source rather than against
a stored number.

## Why no answer was taken from the source corpus

The prior review established that the released courses carry no per-lesson
answer content: `answer_or_scoring_guidance` is byte-identical across every
lesson in a course and contains no digits. **Nothing here is derived from it.**
`checks.ts` asserts that string never appears in any scoring record, and every
package records `integrity.answerDerivedFromSourceGuidance: false`.

Each fixed-answer lesson instead carries an authored fictional scenario with
deterministic figures, and each numeric item is answered three times over:

1. **Authored** — a human writes the answer literal (`expected`).
2. **Recomputed** — `src/oracle.ts` evaluates a committed computation spec in
   integer cents, with no access to the authored literal.
3. **Cross-checked** — `tooling/crosscheck.py` re-evaluates the same committed
   specs in a different language with `decimal.Decimal`, reading only the
   emitted JSON.

**The build fails closed.** `verify()` throws on any disagreement and
`build.ts` emits nothing for that lesson. This is not decorative: during
authoring it caught real errors, including a mis-added five-item total
(`$189.00` authored, `$191.00` recomputed) and a one-cent divergence over ten
compounding periods that the Python checker settled. The cross-check also
caught a defect in *itself* — `Decimal//` truncates toward zero, so the
ceiling division was wrong on ten items — which is the point of running two
implementations rather than one.

Every committed spec is stored in the scoring record, so any future
implementation can re-verify the whole corpus without this code.

## Fixed answers versus judgment

**180 lessons** are fixed-answer: the work is arithmetic, so the scoring record
is an `ANSWER_KEY` whose every item is oracle-recomputed, with the arithmetic
shown (`(3.00 + 4.00) = 7.00`) so an adult can check it by hand.

**36 lessons** are judgment: dignity across households, privacy, scam
recognition, workplace fairness, honest selling, policy tradeoffs. These carry a
`RUBRIC` with three-level criteria and explicit acceptable-answer criteria, and
**no exact answer at all**. Inventing one would be the exact failure the prior
review warned about.

### What the readiness gate says about that, and why it is left alone

The shared gate models every `MATH_STRUCTURED_FINLIT` lesson as requiring a
fixed answer key. Running it unmodified over all 216 projections:

- **180 READY**, with zero notes.
- **36 NOT_READY**, every one of them `MISSING_ANSWER_KEY` — and every one of
  them a judgment lesson.

That split is pinned in `tests/gate.test.ts`. It is a finding about the gate's
subject model, not a defect in the corpus: for a lesson about what to say when
a classmate mentions what their family can afford, there is no fixed answer,
and relabelling the rubric `ANSWER_KEY` would buy a green gate with a claim
this corpus cannot support. **Recommendation:** let the gate accept
`RUBRIC` + acceptable-answer criteria for FinLit lessons that are genuinely
judgment-based, in the same way it already does for other subject families.

## Gate H2 tagging

Every scoring record carries a machine-readable `authorityTag` a hardened check
can consume without re-deriving anything:

```json
{ "gate": "H2", "authorityClass": "FIXED_ANSWER_KEY", "answerTextPresent": true,
  "fixedItemCount": 5, "rubricCriterionCount": 1,
  "answerDerivation": "independent-recompute",
  "derivedFromSourceGenericGuidance": false,
  "oracleId": "finlit-g38-oracle@1", "oracleVerdict": "AGREES" }
```

This addresses the prior review's load-bearing finding — that the gate's
`isSubstantive` never reads `text`, so `{present: true}` with no answer passes.
`tests/authority.test.ts` asserts non-empty answers and figure-bearing
reasoning on all 900 items, which is what a hardened `isSubstantive` would
check.

## Grade-level arithmetic

`src/gradeLevel.ts` declares what each grade's tasks may demand — operations,
amount ceilings, multipliers, divisors, percentage granularity, compounding
periods, and whether negative amounts appear — and every committed computation
is asserted against its grade's profile, including intermediate values.

| Grade | Ceiling | Adds |
|------:|--------:|------|
| 3 | $20 | whole-cent addition, subtraction, repeated addition, comparison |
| 4 | $100 | exact division, whole percentages to 10% |
| 5 | $500 | half-percent granularity to 25%, longer runs |
| 7 | $10,000 | multi-step percentages, negative cash flow, compounding to 5 periods |
| 8 | $500,000 | basis-point rates, compounding to 45 periods, amortisation concepts |

This is enforced, not aspirational: the guard rejected a grade-4 draft that
reached $128.00 and a grade-5 draft that multiplied by 30.

## Safety

Every scenario is invented and says so on its face; a check rejects any
scenario that does not. Every package declares
`isFictionalSimulation: true`, `realWorldAction: false`,
`completionAuthority: "learner"`, and both financial-safety flags. No sheet ever
requests a real bank account, card, PIN, password, Social Security or tax
number, and none gives individualised advice. Scam wording is deliberately
quoted so learners can practise recognising it, and the lint skips quoted
examples and negated prohibitions while still firing on a real request —
`tests/safety.test.ts` proves both directions with positive controls.

Scoring records are marked `adultOnly` and are never referenced from
student-facing text; a leakage check rejects any package containing an
answer-bearing key.

## Anti-boilerplate

The prior review's central finding was collapse: blank the topic phrase and
whole fields become identical. `checkDistinctness` asserts that no two of the
216 lessons share an objective, scenario, task set, remediation, extension, or
scoring text; that every rubric names its own lesson's scenario figure; and
that each grade uses at least one distinct fictional character per four
lessons. The corpus uses 216 distinct characters and 216 distinct scenarios.

## Layout

```
src/authoring/   216 authored lesson records (the human work) + a small DSL
src/oracle.ts    integer-cent computation engine; verify() fails closed
src/gradeLevel.ts per-grade arithmetic profiles, asserted against every spec
src/build.ts     joins authored records to source, verifies, emits, detects drift
src/checks.ts    structure, safety, leakage, authority, distinctness invariants
packages/        216 student-facing task sheets
scoring/         216 adult-only scoring records with committed computations
tooling/         verify.ts, crosscheck.py, manifest.ts, run-tests.ts
```

Editing a lesson means editing `src/authoring/`, then rerunning
`tooling/verify.ts --write`; `tests/corpus.test.ts` fails if the committed JSON
ever drifts from what the authored source rebuilds.

## Known limitations

- **The 36 judgment lessons fail the shared gate** for lacking an answer key
  they should not have. Left visible deliberately; see above.
- **Rubric quality is not machine-verifiable.** The oracle proves arithmetic,
  not that a rubric level discriminates well. The rubrics are authored and
  checked for specificity and distinctness, but they warrant human review.
- **Answer keys are verified, not validated for pedagogy.** Three
  implementations agreeing proves the arithmetic; whether a task is the right
  task for that lesson remains a curriculum judgment.
- **`computeCompletionStatus` remains uncalled in product code.** That finding
  from the prior review is untouched here; this corpus is learner-authority
  throughout, so nothing in it depends on guardian attestation.
