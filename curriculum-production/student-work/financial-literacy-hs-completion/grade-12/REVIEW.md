# Accuracy review — grade 12

One senior high-school personal-finance accuracy reviewer read the grade 12
corpus: all seven authored spec files, the emitted task sheets, and the emitted
scoring records, reading `g12u01`, `g12u04`, `g12u06`, and `g12u07` end to end.

The oracle had already reproduced all 465 fixed answers from each item's own
declared parameters, so pure arithmetic slips were excluded before the review
began. The review therefore targeted what recomputation cannot reach: whether
the formula is the right *model* for the scenario, whether anything contradicts
itself, whether a keyed choice is uniquely correct, whether rubric criteria are
true and achievable from the learner-facing sheet, whether simplifications are
labelled, and whether the capstone is conceptually sound and fairly scored.

The reviewer independently recomputed roughly 120 items across all seven units
in exact arithmetic, deriving the model from the prose rather than re-running
the authored expression.

**Every finding below was re-derived independently before being accepted, and
all of them are fixed in this lane and re-verified by the oracle and the test
suite.**

## Categories with no findings

- **Safety and privacy.** No lesson requests real financial data. No real firm,
  product, institution, regulator, or ticker is named anywhere. No
  individualised advice to a real person. The capstone privacy boundary holds:
  no lesson asks for the learner's own income, balances, credit standing,
  debts, aid, tuition, filings, investments, or insurance.
- **Tax modelling.** Standard deduction applied before brackets, correct
  bracket boundaries, marginal versus effective rate distinguished properly,
  pre-tax elections reducing income tax but not the payroll levy, and the
  self-employment levy charged on the independent income only and in addition
  to income tax.
- **Loan and amortisation wording.** Factors quoted per $1,000 and correctly
  scaled; total repaid, interest, and the longer-term/lower-payment/higher-total
  relationship all stated and priced correctly. The fictional factor table is
  internally consistent with its own stated 5.4% rate.
- **Percentage fall versus the gain needed to recover it.** Correct in both
  places it appears (47.06% and 38.89%), and it is the explicit teaching point
  in each.
- **Insurance payout order.** Deductible, then member share, then cap — correct
  throughout, including the trap where the annual cap replaces rather than adds
  to the deductible.

## Nine critical findings, all fixed

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | u06-l05 t1-p3, t2-p1 | A per-account liability cap of $500 was applied to an account charged only $380, keying $1,500.00. A cap limits liability; it does not create it. The lesson's own extension teaches exactly this principle. | Re-keyed with `min(cap, charge)` per account to **$1,380.00**, and the saving from prompt reporting to **$1,230.00**. Downstream criteria, evidence, misconception, and remediation updated. |
| 2 | u07-l08 t2-p4 | The keyed 32.93% treated the whole $3,160.80 still owed as caused by the side income, but $540.00 of it is wage income tax the employer under-withheld. The rubric criterion's own stated mechanism (12% band plus 15.3% levy) yields 27.30%, so a learner reasoning correctly could not reach the key. | Item re-keyed to the amount genuinely attributable to the side income, **$2,620.80**, with the $540.00 wage shortfall named explicitly in the reasoning, the criteria, and the remediation. |
| 3 | u03-l08 t3-p1 | A look-for asserted the $4,536.00 annual surplus was "barely larger than the two reserves together"; the two reserves total $6,104.00, so the surplus is $1,568.00 *smaller*. It also contradicted the look-for directly above it and double-counted a set-aside already removed. | Rewritten to compare the surplus against the $3,080.00 off-season buffer alone, and to say why the tax set-aside must not be added back. |
| 4 | u07-l10 t1-p2, t1-p3 | The numerator (tax plus elections, $16,505.00) omitted the employer contribution while the denominator ($55,965.00) included it, keying 29.49% — a figure matching neither the take-home gap nor the ~30% the capstone states elsewhere. | Numerator corrected to **$17,870.00**, which is exactly the gap between total resources and take-home pay, giving **31.93%**. Plan criteria and remediation updated. |
| 5 | u03-l02 | The lesson said the income failed in one month; months 1 and 3 both fail, and month 1 fails first. A criterion required a $1,570.00 buffer "before month 3" that the method it described cannot produce — months 1 and 2 net only $1,230.00. | Added an item computing the month-1 position (**-$620.00**), corrected the objective, directions, and prompt to two failing months, and rewrote the criterion to require the correct timing: at least $620.00 in place before month 1. |
| 6 | u05-l06 t3-p1 | A criterion scored the learner on verifying a promoter against a public register and obtaining written terms — neither of which the learner-facing sheet mentioned anywhere. This is the same defect class the grade 9 round found. | Both facts supplied in the task directions, so the criterion is now achievable from the sheet. |
| 7 | Fourteen lessons | Systemic: fourteen learner-facing `remediation` diagnostics named a wrong-answer figure that the stated cause cannot produce, across six of the seven units. A stuck learner was told to look for a mistake they had not made. | Every one recomputed from its stated cause and corrected: u02-l01 ($25,152.00), u02-l03 ($209.70, plus the $204.69 case named separately), u02-l04 ($1,763.40), u02-l10 ($676.76), u03-l05 ($200.00), u03-l09 ($5,830.00), u04-l01 (cause corrected to match $16,000.00), u04-l02 ($32.70), u04-l08 ($24,150.94), u04-l11 (88.25%), u05-l03 (cause corrected; both $91,347.06 and $72,931.77 named), u05-l06 ($1,180.00), u07-l03 ($45,138.40), u07-l09 ($4,332.52 and $3,642.52). |
| 8 | u06-l01 t2-p3 | The stem asked which of *four* policies protected the largest loss per premium, offered *three* choices, and the sheet stated a coverage limit for only one of them — so the question was not answerable from the learner-facing text. | A stated coverage limit added for the auto policy, the item narrowed to the two policies that state one, and converted from an asserted fact to an oracle-**derived** comparison of limit per dollar of premium. |
| 9 | u02-l09 t3-p1 | A criterion asserted that no interest attaches to a disputed amount, contradicting the lesson's own stated rule that interest runs on any balance carried. | The dispute exception added to the stated rule in the directions, which also makes the existing "rather than being disputed" item coherent. |

## Minor findings, all fixed

- **u07-l06** priced the interest saved by clearing the card sooner at "about $110"; simulated against the lesson's own stated order it is about $63.
- **u03-l10** remediation ranked the card claim at "roughly $957", the flat-balance figure, when the lesson's own schedule clears the balance in about ten months at a true cost of about $457.
- **u06-l10** said the time cost was "nearly as large as" document replacement; $432.00 is more than twice $214.00.
- **u05-l10** paired a fee of $49.90 with 1.04%; that percentage belongs to the $63.36 fee, and the two figures also spanned mismatched periods.
- **u06-l09** credited shortening the waiting period with removing "up to $9,360.00"; the net reduction is about $7,920.00, because the monthly shortfall then runs longer.
- **u06-l02** relied on an unstated day-count convention: `79 − 18 = 61` assumed day 18 was uncovered, while the natural reading gives 60 days — which is exactly two periods and exactly the figure the remediation calls the error. The uncovered stretch is now stated explicitly as days 19 to 79 inclusive and counted that way.
- **Rubric criteria that did not fit a path the same item invited**: u07-l10 required Plan-1 figures while its own look-for credits very different plans; u07-l05 required a specific change when "change nothing" is a listed defensible alternative; u01-l10 required naming Plan B as the election to revisit, which a learner who already chose Plan B cannot do; u05-l02 required "locked away" language the sheet never supplies; u03-l07 referred to months the sheet never schedules. All five rewritten.
- **u02-l02** said the reserve rebuilds "in under eight months" when eight transfers are needed; **u05-l05** asked for "the one balance" at which the fee comparison reverses when it reverses over a range; **u04-l09** said borrowing "diverges" when the gap narrows; **u03-l05** left $300 of a $940 repair unsourced; **u03-l08** asked which reserve "grows faster" when one rises and one falls.

## Minor findings recorded and left open

- The investing unit never uses the words *inflation*, *nominal*, or *real
  terms*, while u05-l03 presents 30-year figures of $78,903.08 and $54,015.11.
  The unit is otherwise scrupulous about labelling its simplifications, so the
  omission stands out. Adding a real-terms treatment would change the unit's
  arithmetic and is left for a later round.
- u03 lessons state card rates explicitly but assume reserves earn nothing
  without saying so. This is load-bearing in u03-l03, where the arithmetic
  holds exactly only at 0%.
- u05-l04 t2-p2 assumes every contribution is made at the trough and earns the
  full recovery — best-case timing. The item text says "made at the depressed
  level", but the criterion attributes the whole gap to the recovery assumption
  alone.
- u01-l09 supplies the $10.20 rise in federal tax as a statement line rather
  than a derivable figure; no band rate produces it from the $97.50 increase in
  taxable pay. Acceptable as given data, though the task is framed as
  accounting for every line that moved.
- `defensibleAlternatives` is used throughout unit 7 and nowhere in units 1-6,
  although u03's own header describes its allocation questions as having more
  than one defensible answer. u03-l10 is the clearest candidate.

## Verdict

**Capstone conceptual correctness.** The reviewer recomputed Case R's entire
spine from the prose and traced every figure across all seven capstone lessons.
It is internally consistent: pay, elections, taxable income, federal tax, the
three flat charges, total tax, take-home, monthly take-home, committed costs,
surplus, reserve, both shocks, the annual strands, and the five-month defence
all matched. The one artefact is four cents between two lessons' unallocated
figures, arising from rounding monthly take-home and consistently keyed. Two
defects were found and fixed (findings 4 and the u07-l06 interest figure).

**Capstone scoring fairness.** Judged fair. Every capstone judgment item
carries genuinely distinct defensible alternatives, published in the scoring
record the adult reads, and the look-fors do real work in the right direction —
crediting very different plans and marking down any plan that claims to be the
only sensible course. Two criteria that did not fit a path their own item
invited were found and fixed; with those corrected the reviewer called the
scoring fair without qualification.

**Senior-level integration.** Judged genuine, not grade 9 with larger numbers.
The evidence cited: every lesson is structurally mixed and declares at least two
domains it actually reasons across; the tasks turn on distinctions a grade 9
course can leave implicit — which denominator answers which question, marginal
band versus effective rate, a levy charged on a different base from income tax,
two employers each consuming a once-only deduction, a per-account cap rather
than a total, working backwards from an affordable payment to a borrowing
ceiling, an annual out-of-pocket cap replacing a deductible, and a reserve
derived from a household's own policy terms rather than a months-of-expenses
rule; several items are five to seven links deep with each step consumed by the
next, and the chains cross domains; and uncertainty is scored as a dimension,
with lessons that refuse to convert a priced exposure into a verdict.
