# Accuracy review — grade 9

One high-school personal-finance accuracy reviewer read all 72 grade-9 task
sheets, all 72 scoring records, and the seven authored spec files. The oracle had
already reproduced every fixed answer, so the review targeted what recomputation
cannot reach: whether the formula is the right model for the scenario, whether
the finance is taught correctly, whether simplifications are labelled, whether
the safety boundary holds, and whether rubric criteria are true and achievable.

**Safety boundary: no findings.** No prompt solicits real personal financial
data; no real institution, product, or ticker is named anywhere; the
hardship-related rubrics were found to guard against moralising rather than
invite it.

**Twelve critical findings, all fixed** in this lane and re-verified by the
oracle and the test suite:

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | u07-l01 t3-p1 | Stem asked which of five taxes do *not* appear on a pay stub; four of the five do. No correct answer existed. | Stem corrected to "only one", matching the key. |
| 2 | u07-l01, l06, l08 | Brackets applied to gross with no standard deduction anywhere in the taxes unit, and thresholds were verbatim real 2024 figures under a "not real" disclaimer. | Fictional standard deduction of $9,000 added as a visible step, thresholds moved off the real boundary, disclaimer rewritten. All affected answers re-derived. |
| 3 | u04-l03 t2-p2 | Key compared a pre-payment balance against a post-payment state the sheet had already established; the correct answer under the sheet's own chronology was the opposite. | Item marked an explicit counterfactual returning to the original balances. |
| 4 | u04-l08 t3-p1 | A look-for asserted the term was extended; it was not, and it contradicted the criterion directly above it. | Look-for rewritten to attribute the flat payment to a smaller balance over the same remaining term. |
| 5 | u04-l06 | Minimum payment computed on the pre-interest balance, against the lesson's own stated order and against how a real card bills. | Minimum now taken on the statement balance after interest; all three months and the totals re-keyed. |
| 6 | u02-l01 t2-p2 | Discrete-replacement prose keyed with a continuous amortisation, implying you can buy half a pair of headphones. | Re-keyed on whole purchases ($82.00), which is the better teaching point. |
| 7 | u06-l01 t3-p1 | Criterion called $39.60 the smallest expected loss; $35.60 was smaller, contradicting the same file. | Corrected to "second smallest", naming the smaller figure. |
| 8 | u06-l02 t3-p1 | Criterion credited "a $620 loss cannot be absorbed while $185 can" — but savings were $150. | Restated on magnitude and on what is actually due on the day of a claim. |
| 9 | u01-l02 | Remediation double-counted paid time off for a salaried worker, contradicting the keyed total. | Remediation reduced to the three lines that total $38,620; PTO removed from the evidence requirement. |
| 10 | u01-l09 | A pre-tax retirement contribution shown reducing *all* withholding, including FICA. | Scoped to income tax, with Social Security and Medicare stated as charged on full gross in both periods. |
| 11 | u03-l08 t2-p3 | "Fixed" gloss admitted the registration share, so two defensible answers were both marked wrong. | Re-glossed on use-independence and re-keyed to $282.33. |
| 12 | u05-l05 t3-p1 | Criterion scored securities regulation, which the learner sheet never mentioned. | Supplied on the sheet, closing the unit's brokerage-failure-versus-market-loss gap. |

**Minor findings.** Several were fixed in passing: the U.S./Canadian spelling
drift on "checking", the U04-L03 claim that a credit report omits employment,
the U04-L09 and U02-L09 disclaimers that overstated what was fictional, the
U02-L10 arithmetic slips ($60 for $61; "most expensive of the three"), the
U03-L01 first-year-interest convention, the U03-L02 "eleven months" count, the
U03-L10 deposits-versus-balance wording, the U04-L11 rounding mismatch, the
U06-L05 overstatement of what a credit freeze prevents, the U06-L07 claim about
replacement cost, the U07-L03 "same tax rules" framing, and the U07-L09 "starts
from" wording.

**Minor findings left open**, recorded rather than silently dropped:

- U02-L10 prices "cost per year of warranty coverage" by dividing the whole
  purchase price by the warranty term, which implicitly treats warranty length
  as useful life — the inference the same lesson's t3-p2 tells the learner to
  resist. Marginal dollars per extra warranty-year, as U02-L09 uses, is the
  better measure and would change the lesson's arithmetic.
- U05-L09 asks for percentage points and the reasoning says so, but the answer
  strings render as "-9.0%" and "7.20%", weakening the distinction.
- U01-L10 uses total compensation including employer-funded benefits as the
  payback denominator; employer-paid premiums cannot pay a tuition bill, and
  U01-L04 used the salary difference. The ranking is unaffected either way, but
  the two lessons should say which denominator they intend.
- U01-L05 credits a tuition reimbursement at face value three lessons before
  U01-L08 makes face-value-versus-realised-value the whole point.
- U01-L02's "260-day work year" is not consistent with 10 paid days off.
- U03-L01 credits a full year of interest on a balance that only exists at year
  end; the lesson now says so explicitly, but U03-L07 and U03-L10 use the
  half-the-year-end convention, so the unit is explicit rather than uniform.

Grades 10-12 have not been reviewed. Grade 10 unit 1 and unit 2 were authored
after this pass and carry no review.
