# Financial Literacy Director Sample R1

## Review status

`FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`

This is one deep, learner-ready Director sample. It is not approval of the
Financial Literacy Lesson Standard R1, a corpus-wide rewrite, a production
deployment, or a release-admission change.

## Identity and scope

| Field | Value |
| --- | --- |
| Requested base | `a7c6edee867e0d3f546aaa6e0442fac434b75c84` |
| Standard input | `origin/mac/financial-literacy-lesson-standard-r1` at `71d9e124e95b1f2f4d83bc1473d46ff80c3c316d` |
| Lesson | `ma-g8-financial-literacy-u04-l03` |
| Catalog title | Guided practice A: credit cards and minimum payments |
| Grade / course day | Grade 8 / Day 33 |
| Standard labels | `PF4`, `PF4.1` |
| Primary financial focus | `CREDIT_BORROWING` |
| Secondary focuses | `INTEREST`, `DECISION_SCENARIO` |
| Instructional profile | `GUIDED_APPLICATION` |

The standard's documentation commit was transplanted without merging its older
release base. The deterministic Financial Literacy reconciliation declares one
sample overlay for this lesson. The other 503 learner cores remain byte-for-byte
preserved by the reconciliation check.

## Learner-ready composition

| Layer | Authored supply |
| --- | --- |
| Concept teaching | Three connected explanations, three labelled relationships, one material misconception, and complete calculation conditions |
| Worked example | Jordan's separate fictional `$800.00` case with four labelled steps, interpretation, reasonableness check, tradeoff, and limitation |
| Concept check | One choice item that distinguishes payment allocation from plausible confusions |
| Guided calculation | Mika's fictional case: three exact-cent calculations plus one explanation, with four fading cues |
| Independent calculation | Ari's fresh `$975.50` case: interest, principal reduction, and ending balance without step cues |
| Independent decision | Ari compares `$45.00` and `$70.00` payments against a stated fictional goal and constraint |
| Fresh mastery | Taylor's distinct `$1,140.25` case: three protected calculations and a transfer explanation |
| Remediation | Observable misconception routes, a different three-box explanation, Bo's parallel worked case, Nia's supported retry, and Omar's fresh retry |
| Authority | 17 fixed items independently recomputed from integer cents and basis points; three open items aligned to three rubric dimensions |

The learner package has 20 response prompts total: 17 fixed and three open. The
worked example is instruction, not protected evidence. Guided cues end before
independent work. The mastery case reuses neither Jordan's name nor Jordan's
values. Remediation uses different fictional cases and ends with a fresh retry.

## Financial concept and decision rule

The lesson teaches these relationships in order:

1. `statement interest = starting balance × monthly periodic rate`
2. `principal reduction = payment − rounded statement interest`
3. `ending balance = starting balance − principal reduction`

The core misconception is treating the whole payment as principal reduction.
The learner checks the split with:

`rounded interest + principal reduction = payment`

The decision task does not declare one lifestyle preference correct. A response
may recommend either fictional payment when it uses the computed balance
effect, Ari's `$35.00` stated fee constraint, the cash-available tradeoff, and a
changed fact that could change the recommendation.

## Exact-cent, rate, and timing authority

Every case uses the same learner-visible contract:

- USD money is represented as integer cents in adult computation authority.
- Rates are represented as integer basis points.
- The stated percentage is an invented monthly periodic rate, not an APR.
- There are no new purchases or fees.
- Interest is computed from the starting statement balance for one period.
- Interest posts before the payment.
- The interest line is rounded exactly once to the nearest cent, half up.
- The payment covers rounded interest first and then principal.
- No other intermediate result is rounded.
- A calculator, scratch paper, and an unfilled three-line organizer are allowed
  where declared.

The adult-only oracle recomputes every fixed result independently. For example,
Ari's interest numerator is `97,550 cents × 160 basis points = 15,608,000`;
dividing by `10,000` gives `1,560.8 cents`, which rounds half up to `1,561`
cents. Binary floating-point output is never the final authority.

## Fiction, privacy, and advice boundary

Every person, balance, rate, payment, activity budget, fee, and statement is
invented. The learner surface expressly says not to enter or discuss real:

- household income or debt;
- account or card balances and payment history;
- card or account numbers, credentials, PINs, passwords, Social Security
  numbers, or tax identifiers;
- credit scores or financial hardship.

The lesson is education, not individualized financial, legal, tax, credit,
investment, or repayment advice. It directs no learner to apply for credit,
open an account, make a real payment, or enter an agreement.

## Learner/adult separation

- Canonical learner package:
  `curriculum-production/final/financial-literacy/packages/grade-08/swk-fl-g8-u04-l03.package.json`
- Authored sample source:
  `curriculum-production/final/financial-literacy/samples/grade-08/swk-fl-g8-u04-l03.sample.package.json`
- Adult-only generated authority:
  `curriculum-production/final/financial-literacy/scoring/grade-08/swk-fl-g8-u04-l03.scoring.json`
- Independent authority source:
  `curriculum-production/final/financial-literacy/samples/grade-08/financial-literacy-director-sample-r1-authority.mjs`

The learner package and Director preview contain no fixed answers, correct-answer
fields, scoring-authority locators, or adult rubric. Worked-example results are
learner-visible instruction on a separate case. The preview imports only the
learner package. Responses remain in React memory for the current tab and are
not written to IndexedDB, local storage, a server, or a production record.

## Director preview

From this worktree:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open:

`http://127.0.0.1:5173/__review/financial-literacy`

The route is exact-path and development-build-only. The production build does
not import the preview component. Existing Family Pilot and legacy routes are
unchanged.

The learner flow is:

1. Learn the interest/principal relationship.
2. Read Jordan's complete worked example.
3. Check the concept.
4. Complete Mika's guided calculation with fading support.
5. Complete Ari's independent statement.
6. Make and defend Ari's payment decision.
7. Complete Taylor's fresh mastery case.
8. Finish for adult review or choose the alternate remediation path.
9. If chosen, read the three-box model, complete Nia's supported retry, and
   complete Omar's fresh retry without boxes.

## Rendered evidence

- Desktop concept view:
  [financial-literacy-director-preview-desktop.png](./financial-literacy-director-preview-desktop.png)
- Separate worked example:
  [financial-literacy-director-preview-worked-example.png](./financial-literacy-director-preview-worked-example.png)
- Guided calculation:
  [financial-literacy-director-preview-guided.png](./financial-literacy-director-preview-guided.png)
- Alternate remediation model:
  [financial-literacy-director-preview-remediation.png](./financial-literacy-director-preview-remediation.png)
- 390px mobile view:
  [financial-literacy-director-preview-mobile-390.png](./financial-literacy-director-preview-mobile-390.png)

Browser checks recorded:

- Desktop viewport `1280px`; body and document scroll widths `1280px`.
- Mobile viewport `390px`; body and document scroll widths `390px`.
- Mobile content card width `366px` at `x = 12px`.
- Mobile primary button height `50px`.
- All learner controls have visible labels; choice work uses a labelled
  fieldset and radios; numeric work uses decimal input mode; written reasoning
  uses labelled textareas.
- An incomplete task produces an alert and cannot advance.
- Guided practice renders three numeric inputs, one reasoning textarea, and the
  declared open support block.
- The full primary and remediation paths reached completion with 20 responses
  held only in the preview tab, `100%` progress, zero visible response controls
  after completion, zero console errors, and no exposed protected authority.
- At 1280px, the worked example rendered four read-only steps and no response
  controls.

## Verification commands

```sh
node --experimental-strip-types --import ./curriculum-production/final/financial-literacy/tooling/register.mjs curriculum-production/final/financial-literacy/tooling/reconcile.mjs
node --experimental-strip-types --import ./curriculum-production/final/financial-literacy/tooling/register.mjs curriculum-production/final/financial-literacy/tooling/verify.mjs
npx vitest run --project root-app tests/financial-literacy-director-sample-r1.test.js
npm run typecheck
VITE_FAMILY_PILOT_ENABLED=true npm run build
```

## Explicit non-goals

- No bulk Financial Literacy rewrite.
- No change to source curriculum scheduling or lesson identity.
- No Tutor V2 implementation or provider call.
- No runtime scoring or mastery-state implementation.
- No production admission, binding, database, Supabase, Netlify, or deployment
  action.
- No real learner or household financial data.

## Director review questions

1. Is the distinction among interest, principal reduction, and ending balance
   clear enough before guided work?
2. Is the worked example sufficiently separate from Ari and Taylor while still
   modelling the same financial relationship?
3. Does the Ari decision scenario balance calculation and real-world tradeoff
   without implying one universally correct payment choice?
4. Is Taylor's fresh mastery evidence sufficient for this lesson profile?
5. Does the alternate balance-box remediation reveal the underlying distinction
   without disclosing any protected response?
6. Are the calculation, privacy, advice, and future Tutor metadata boundaries
   strict enough for adoption?

**Classification: `FINANCIAL_LITERACY_DIRECTOR_SAMPLE_R1_READY_FOR_REVIEW`**
