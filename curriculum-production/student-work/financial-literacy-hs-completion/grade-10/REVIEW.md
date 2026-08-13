# Accuracy review — grade 10 units 3-7

One independent high-school personal-finance accuracy reviewer read all 52 task
sheets, all 52 scoring records, and the five authored spec files. The oracle had
already reproduced every fixed answer, so the review targeted what recomputation
cannot reach: whether the formula is the right model for the scenario as the
learner reads it, whether the finance is taught correctly, whether
simplifications are stated rather than assumed, whether rubric criteria are true
and achievable against the sheet, and whether the safety boundary holds.

The reviewer worked 39 of the 52 lessons by hand from the learner-visible prose
alone, and separately wrote an independent rational-arithmetic evaluator to
re-derive every fixed item twice — once from exact prior results and once from
the **displayed rounded** prior results — specifically to hunt for chain-rounding
traps the oracle cannot see. That second pass found exactly one, recorded below.

**Verdict: pass with findings.** Four critical and thirteen minor. All
seventeen are fixed in this lane and re-verified by the oracle and the full test
suite. Nothing was deferred.

## Four critical findings, all fixed

| # | Where | Finding | Fix |
|---|-------|---------|-----|
| 1 | u06-l07 t1-p1 | The prompt asked how much the landlord's policy **pays for**, but the key was $5,240.00 — what the *tenant* bears. The sheet states the landlord's policy pays $0, so the only correct answer to the prompt as written was $0.00. A learner reading carefully was marked wrong. | Prompt reworded to ask what the tenant must replace out of their own pocket, which is the quantity that was keyed. |
| 2 | u07-l07 remediation | Stated "the second [bracket] charges $4,508 in both" years. Before the raise, taxable income is $41,300, below the $42,000 threshold, so the second bracket charges $4,410. Following the remediation gave $5,702 against a keyed $5,800, and $312 of extra tax against a keyed $410. The unit's flagship anti-bracket-myth lesson did not reconcile with its own key. | Remediation rewritten to $4,410 before and $4,508 after, and to show that $98 plus 24% of the $1,300 above the threshold is the whole $410.00. |
| 3 | u05-l08 t2-p4 | The prompt asked how much **cheaper** the percentage fee was and the key was **-$41.00**, asserting the opposite of the truth; the natural correct answer, $41.00, was marked wrong. The adjacent t2-p3 used the opposite convention. | Prompt reworded to ask how much *more* the flat fee costs, and re-keyed to $41.00. |
| 4 | u06-l09 t3-p1 | An acceptable-answer criterion credited "a household already spending on **four** policies". That sheet names two — a renters policy and collision — and says the household holds no disability coverage. The figure had bled in from u06-l01, a different household. A correct response would have failed the criterion. | Criterion restated on the two coverages the sheet actually names. |

Findings 1, 3, and 4 are the same defect classes the grade-9 review recorded: a
stem with no correct answer, and a criterion contradicting its own sheet.

## Thirteen minor findings, all fixed

- **u03-l05** remediation misdiagnosed the $1,940 error. That figure is the
  unweighted average of the two monthly rates, not peak earnings divided by 12.
  Re-diagnosed on weighting.
- **u05-l05 t1-p2** carried the one chain-rounding trap in the corpus: a learner
  multiplying the displayed $17,167.48 by 0.78 gets $13,390.63 against a keyed
  $13,390.64. The directions now say to round only the figure a question asks
  for, and the reasoning names the trap. Same class as the grade-9 U04-L11
  rounding mismatch, which that review left open.
- **u04-l07 t2-p3** and **u05-l06 t2-p3** asked for percentage points and
  rendered the answers with a percent sign, undercutting the distinction being
  taught. Both re-formatted to a bare number, with the unit stated. This closes
  the grade-9 U05-L09 minor that was left open.
- **u07-l11** was u07-l05 with the states renamed: same structure, same
  remediation shape, and an extension asking the same question. `checkAntiTemplate`
  passed because the strings differed; the substance did not. **Rewritten** around
  tax incidence — two households, one owning and one renting, where the fixed
  $2,180 levy reaches only the owner, so the same pair of states costs one
  household $933.00 more and saves the other $2,215.00.
- **u04-l06 t2-p2** priced the comparison credit-union loan with simple interest
  on the full principal — the method u04-l03 trains learners to reject. The sheet
  now states the loan is repaid in a single payment at the end of the term, which
  is what makes that model correct, and says so explicitly. The "three months"
  wording for six 14-day fee periods was also corrected.
- **u06-l04 t2-p4** compared charges against the out-of-pocket maximum rather
  than against the $19,800 threshold the learner had just computed. As printed
  the rule was wrong for any year between $5,400 and $19,800 of charges. Now
  compares against the computed threshold.
- **u05-l05** listed its simplifications but omitted the largest: the ordinary
  account is taxed on all growth annually at the full rate, so the keyed
  $3,601.43 is an upper bound. Now stated. The reviewer confirmed the lesson's
  central claim — that pre-tax and after-tax finish exactly equal when the rate
  is the same at both ends — is mathematically correct and correctly explained.
- **u07-l08** told the learner the equalising rate leaves the contractor "no
  worse off", but income tax is not identical at the higher pay. The sheet now
  says the figure is level on payroll tax alone and is a floor.
- **u07-l07** extension asked for a raise leaving the worker keeping exactly
  half; with a 24% top rate no such raise exists. Reworded to ask whether one
  could.
- **u04-l10** collapsed two disbursement dates into one accrual window without
  saying so, where u04-l05 does say it. Now stated.
- **u06-l01 t3-p1** had two criteria that could not be checked against the sheet:
  one referenced savings the sheet never states, the other called $14,600 the
  smallest exposure when it is the only quantified one. Both restated.
- **u05-l03** remediation offered a second diagnosis that does not produce the
  stated figure. Removed.
- **u07-l06** disclaimed that its penalty schedule "is not the schedule any real
  tax authority uses" while closely tracking real failure-to-file penalties.
  Softened to claim only that the rates and cap are invented.

## What the review confirmed

- **Insurance payout rule.** Every payout in units 6 lessons 2, 3, 8, 9, and 10 is
  `min(loss − deductible, limit)` in both the authored expression and the emitted
  worked solution; `limit − deductible` appears nowhere as a payout. The rule is
  stated in learner-visible text before first use in all five. The "own cost
  equals the deductible" trap is handled deliberately, with a limit-binding case
  in each of those lessons; u06-l06, which does equate the two, states the
  condition on the sheet. The l04 health structure is correctly ordered and the
  $19,800 threshold was re-derived by hand. The l10 claim reconciles exactly to
  the $47,400 loss.
- **Taxes.** Every bracket computation applies rates to gross minus a visible
  $11,200 standard deduction, computed as a step the learner performs; all six
  were recomputed by hand. Thresholds, rates, the $158,000 wage cap, and the 15%
  self-employment treatment are consistent across all eleven lessons and mutually
  consistent with the 7.5% employee share. Marginal versus effective is taught
  correctly, and the credit, deduction, and refundability distinctions in l04 are
  all correct.
- **Multi-year loans.** u04-l03 is true amortisation, worked by hand. The level
  payments in l09 and l10 were independently recomputed and full 36-, 60-, and
  120-month schedules run: each retires the balance to within $0.23, consistent
  with the rounding assumption the sheet states. In-school accrual and
  capitalisation are described accurately.
- **Investing.** No guaranteed return is implied, no real security or firm is
  named, and no lesson advises anyone about their own money.
- **Safety.** All 52 sheets were scanned for solicitation and individualized-advice
  patterns. The only hits were the disclaimers themselves. Every scenario declares
  itself fictional and the four boundary flags hold on all 52.
- **Grade progression.** Grade 10 advances on every axis over grade 9's schedule —
  three brackets rather than two, a wage cap, self-employment treatment,
  refundability, penalties, and a two-state crossover.
- **Chronology.** No instance of the grade-9 defect class where a key assumes a
  state the sheet already changed. Every back-reference is an explicit
  counterfactual.

## Limits of this review

One reviewer, one pass. It establishes that the model is defensible and the
finance is taught correctly on the lessons examined; it is not a guarantee of
correctness, and the lane does not claim one. Units 1 and 2 of grade 10 live in
the sibling `financial-literacy-hs` lane and were reviewed under that lane's own
round; they are out of scope here.
