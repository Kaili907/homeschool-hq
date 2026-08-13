# Accuracy review — grade 11

One independent high-school personal-finance accuracy reviewer read all 72
grade-11 task sheets, all 72 scoring records, and the seven authored spec files.
The oracle had already reproduced every fixed answer, so the review targeted
what recomputation cannot reach: whether the formula is the right model for the
scenario, whether the finance is taught correctly, whether the scenario
parameters are mutually consistent, whether every multiple-choice item has
exactly one correct option, whether simplifications are labelled in
learner-facing text, and whether rubric criteria are true and achievable.

**Verdict on the corpus as submitted: FAIL — 13 critical and 10 minor defects.**
All 13 critical defects are fixed and re-verified. Nine of the ten minor defects
are fixed; the tenth is recorded below as open. Four further defects the author
found before the review are also fixed and listed.

The review's own summary of why these survived the oracle is worth recording,
because it defines the limit of the machine guarantee: *"every one of them lives
where no recomputation reaches — in a scenario parameter that no expression
consumes, in a distractor whose consequences are never computed, in an
interpretation attached to a correct number, or in prose the oracle does not
evaluate."*

## Critical findings, all fixed

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | u02-l02 t3-p1 | A criterion credited "delay **or the lease**" under a $1,000 cash constraint, but the lease needs $1,850 at signing. The rubric blessed an option the scenario rules out. | Criterion restated: buying outright, the $2,900 deposit, and the $1,850 signing amount are all out of reach, leaving delay. |
| 2 | u02-l04 t3-p1 | A look-for claimed "three months of the shortfall roughly equals the $900 bill"; the shortfall is $124.00 and three months of it is $372.00. | Re-anchored on the $326.00 left over, three months of which is $978. |
| 3 | u02-l09 remediation | Named $3,650 as the figure the stated error produces; that error actually gives $5,451.41. $3,650 corresponded to nothing in the lesson. | Corrected to $5,451.41. |
| 4 | u04-l07 t1 | "Both are at 0.75% a month" was false for the stated payments, which implied 9.45% and 9.68% APR — different from each other. The 2.12 interest ratio was partly a rate artefact, not the term effect the lesson attributes it to. | Payments corrected to the true amortising figures at 0.75% ($461.10 and $261.37); all nine dependent answers re-derived. Ratio is now 2.06, a pure term effect. |
| 5 | u04-l09 t1 | $16,800 at 11.2% with 42 payments of $459.30 is impossible — it leaves $1,331.98 outstanding. The refinance leg left $1,199.26. | Payments corrected to $485.35 and $456.81; break-even, totals, and net saving re-derived. |
| 6 | u04-l09 t2-p5 | Asked whether "the refinance still pays" at month 18 and keyed **No** from a payment-saving break-even — but on a true-cost basis the refinance is ahead at month 18, because it repays principal faster. This contradicted t3-p2 of the same lesson, which teaches exactly that. | Question restated to ask explicitly whether the **fees are recovered out of the monthly payment saving**, which is what the arithmetic measures. A look-for now credits learners who notice the measure understates the benefit. |
| 7 | u06-l04 t2-p5 | Two correct options. The distractor "raise Policy 1's limit to $13,400" also closes the gap entirely, because Policy 2 was already capped and stays capped. The keyed reasoning claimed it merely moves payment between policies, which is false. | Distractor changed to $12,700, which leaves $700.00 outstanding. Reasoning corrected. |
| 8 | u06-l10 t3-p2 | Same defect: "raise Policy A's limit to $16,700" also covers the loss in full. | Distractor changed to $15,800, which leaves $900.00 outstanding. |
| 9 | u06-l10 t3-p1 | Keyed the largest fully covered loss as $27,500.00 (limits plus both deductibles). Wrong: because each layer applies to whatever the previous one leaves, and Policy C has no deductible, the deductibles are passed down and absorbed. The answer is the sum of the limits, $25,000.00. This also contradicted u06-l04's own criterion that a deductible can be absorbed downstream. | Answer $25,000.00, expression reduced to the three limits, reasoning rewritten to explain the pass-down. Dependent evidence requirement in t4-p1 updated. |
| 10 | u07-l02 remediation | Quoted $1,485.00 and $6,750 — neither figure exists anywhere in the lesson. Orphans from another calculation. | Replaced with $714.00, the figure the named error (effective rate applied instead of marginal) actually produces. |
| 11 | u07-l05 t2-p4, t2-p5, t3-p1 | Asked for the price fall that cancels the tax saving and keyed saving ÷ gain = 7.0%. Wrong: a smaller gain also carries a smaller tax, so the break-even fall is saving ÷ (1 − rate) ÷ gain. Worse, saving ÷ gain is *identically* the rate difference, which made the distractor "the tax rate saved by waiting" literally correct while the keyed option was false. | Expression corrected; answer is now 11.4% under the revised rate. Distractor replaced. Criteria and evidence updated. |
| 12 | u07-l06 remediation | Named $2,320.00 as the product of treating the credit as a deduction. That error gives $1,408.00 — and being a smaller benefit, it cannot exceed the correct $2,110.00. | Corrected to $1,408.00. |
| 13 | u07-l11 t2-p6, t3-p1 | The answer was right but its interpretation was not: 10.7% is the combined saving over the gain, described in the reasoning and criteria as the price fall that would cancel both moves. The true break-even fall is saving ÷ (1 − rate). | Reasoning rewritten to state both figures and distinguish them; criteria updated to the correct break-even. |

## Minor findings

Fixed: the five-year extra fuel estimate in u02-l01 ($2,000 → $2,400, the earlier
figure being the annual bill); the u02-l03 extension, which had the
declining-balance and straight-line schedules crossing the wrong way; the
u02-l08 reasoning that read as though owning were cheaper when the computed
figure means it costs more; the u03-l02 reasoning that stated a
horizon-specific coincidence as a general rule; the u04-l01 payment of $302.15,
which left $18.51 outstanding after 36 payments so the loan never retired and
"total interest = payments − principal" was wrong (corrected to $302.60, ten
dependent answers re-derived); the u04-l08 criterion that credited only one of
the two orderings the course presents as defensible; the u05-l08 reasoning that
said an asset-based fee does not fall with the asset base; the u06-l10
extension, which said a $14,000 loss is covered "apart from the deductibles"
when it is covered in full; and the u07-l01 remediation, which described 22% of
gross income as 22% of taxable income.

**Partly fixed, and partly left open — the invented tax figures.** The reviewer
observed that the capital-gains rule used a 12-month long/short boundary with a
flat 15% rate, which is precisely the real regime, under a scenario claiming it
was "not a real published rule". That is the same defect class the grade-9
review recorded, and it is fixed: the boundary is now 18 months and the rate 12%,
matching no real regime, and both affected lessons were fully re-derived.

The reviewer also noted that the income-tax standard deduction of $11,400
coincides with a real published figure from 2009-2010. That one is **left as
authored**, deliberately. Changing it moves taxable income in all eleven unit-7
lessons and would require re-deriving roughly a hundred answers and every dollar
figure quoted in their prose — and prose is precisely the surface on which this
review found most of its defects, so the churn risk exceeds the benefit of
removing a fifteen-year-stale coincidence. What was wrong was the *claim*, not
the figure: the schedule said its numbers "are not real published figures", which
overclaimed. Every unit-7 scenario now says instead that the deduction,
thresholds, and rates "were chosen for this course and describe no real tax
system", which is true of the schedule as a system. The bracket thresholds
($9,800 / $38,400 / $85,400) and the rate set (10/14/22/30) match no real
schedule.

## Found by the author before the review, all fixed

- **u02-l08 t3-p1** asked for a cost the rent-versus-buy comparison omits and
  credited four answers, but not the strongest one: the $1,412 payment includes
  principal repayment, which builds equity recovered on sale, so counting the
  whole payment as a cost while counting only appreciation as a return
  understates ownership. A learner giving the best answer was not creditable.
  The criterion now leads with it and a look-for says it should be credited as
  the strongest available answer.
- **u03-l09** never connected its reserve to the income shock the source assigns
  as that day's focus, and the emitted sheet prints that focus. The objective and
  scenario now tie the reserve to an interruption in income.
- **u07-l07** teaches marginal-rate effects but said "band" throughout and never
  named the marginal rate anywhere the learner could read it. The directions now
  define it.
- **u07-l08**'s scenario was 0.47 four-word-shingle similar to u07-l02's and did
  not say what distinguishes the lesson. It now states that the saver sits in a
  lower band and that testing what this does to the same contribution is the
  point.

## Categories the review found clean

Stated explicitly rather than omitted:

- **Safety boundary.** No learner-facing text solicits bank, card, account,
  credential, credit-score, household-income, or tax-return data; no personalised
  advice; all 72 packages carry `isFictionalSimulation: true` and
  `realWorldAction: false`. The unit-6 fraud lesson is written-transcript analysis
  with no contact, no account, and no credential, and carries a look-for
  forbidding engaging the sender.
- **Insurance payout order.** Checked on *every* payout item in unit 6:
  `min(max(loss − deductible, 0), limit)` throughout, limit never applied before
  deductible, expected-loss reductions always net the deductible, expected
  deductible cost always probability-weighted. The only insurance defects were
  the layered-arrangement ones above.
- **Tax structure.** Taxable income is computed before any rate in all eleven
  unit-7 lessons; the standard deduction is always applied; marginal and
  effective rates are used correctly; credits and deductions are distinguished
  correctly, including the non-refundable cap.
- **Loan simplifications.** Every interest-ignoring or simple-interest
  simplification is stated in learner-facing text, not only in adult reasoning.
- **Investing.** Fees charged on the correct base throughout; real return uses
  the exact division with the subtraction approximation labelled; the
  arithmetic-versus-compound distinction is handled correctly; no personalised
  investment advice anywhere.
- **Rubric figures.** All figures quoted in judgment criteria but not printed on
  the sheet are one-step derivations from printed values or from the learner's
  own computed answers — checked programmatically across all 72 packages.
- **Rubric defensibility.** 22 judgment items sampled across all seven units.
  Criteria are achievable from the printed information, alternative positions are
  explicitly permitted where the question is genuinely open, and no criterion
  moralises about a learner's character or a fictional actor's circumstances.

## Re-verification after the fixes

- Oracle: 0 findings across 634 verified fixed answers.
- A third independent implementation (Python `decimal`, half-up at the cent,
  written separately from both the authoring path and the TypeScript oracle)
  re-derived all 601 numeric worked-solution lines: 601 matched, 0 mismatched.
- Test suite: 52 tests across 8 files, all passing. Typecheck clean.
- Emission byte-identical across repeated runs.
- Near-duplicate sweep: 0 pairs above 0.35 similarity on scenarios, objectives,
  remediations, or extensions, and 0 above 0.30 on digit-stripped prompt sets.
- Safety re-scan of all 72 emitted sheets: 0 hits in every category.
