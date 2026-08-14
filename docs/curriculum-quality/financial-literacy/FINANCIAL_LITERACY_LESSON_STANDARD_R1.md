# Manuel Academy Financial Literacy Lesson Standard R1

Status: **DRAFT FOR DIRECTOR REVIEW**

Applies to: Financial Literacy, active Grades 3, 4, 5, 7, 8, 9, 10, 11,
and 12, and future Manuel Academy Financial Literacy authoring. Grade 6 is not
part of the current admitted corpus.

Authoritative base for this draft:
`56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

Audit input: the completed Financial Literacy Learner Depth Audit R1 covered
all 504 active lessons. This standard does not repair or reclassify those
lessons.

## 1. Purpose and authority

This document defines the curriculum content and curriculum metadata required
for a strong Manuel Academy Financial Literacy lesson. It governs what the
curriculum must supply; it does not prescribe one screen layout or one teaching
script.

The central teaching rule is:

> When a lesson teaches a financial concept, calculation, or decision process,
> the learner must see the reasoning demonstrated on a separate example before
> being asked to perform the same kind of work independently.

Financial literacy is not only arithmetic. A conforming lesson teaches learners
to understand financial ideas, calculate safely when calculation is relevant,
identify assumptions, compare alternatives, and explain an age-appropriate
decision.

R1 is a proposed authoring and review standard. It is not yet a production
release gate, does not authorize a corpus-wide rewrite, and does not change any
current lesson, package, schedule, binding, scoring record, or runtime.

The proposed first Director sample is
`ma-g8-financial-literacy-u04-l03` — “Guided practice A: credit cards and
minimum payments.” This session does not rewrite that lesson.

The words **must**, **should**, and **may** have these meanings:

- **Must** is required for draft conformance unless a profile explicitly says
  otherwise.
- **Should** is the expected default; a reviewer may approve a documented,
  instructionally sound exception.
- **May** is optional.

## 2. Audit basis and interpretation

The audit establishes the need for this standard without turning its heuristics
into permanent lesson quotas:

| Audit fact | Result |
| --- | ---: |
| Active lessons reconciled | 504 |
| Meets the type-aware structural heuristic | 115 |
| Has at least one depth gap | 389 |
| Learner-visible solved worked examples | 0 |
| Needs stronger concept explanation | 208 |
| Fixed items with aligned adult-only authority | 2,967 |
| Household-finance collection issues | 0 |
| Unresolved tax/interest condition issues | 0 |

The corpus also contains substantial guided, independent, and decision work.
Its central weakness is therefore not simply question volume. The missing layer
is consistent learner-visible explanation and modeling before independent work,
followed by clear fresh mastery and targeted remediation where applicable.

The 115/389 classification is an audit result, not a declaration that the 115
lessons already conform to this standard. Likewise, the audit's prompt-count
thresholds are not adopted as universal authoring minimums. Conformance depends
on the declared lesson profile, the financial demand, the quality and sequence
of the teaching, and the evidence the lesson is intended to produce.

The audit found important strengths that this standard must preserve:

- complete fictional and privacy-safe canonical packages;
- useful scenarios spanning earning, spending, saving, banking, credit,
  investing, insurance, taxes, consumer protection, education choices, and
  integrated planning;
- exact integer-cent computation authority with no non-integer cent nodes;
- clear conditions for the audited tax and interest calculations;
- aligned fixed and rubric authority kept outside the learner projection; and
- meaningful decision or reasoning prompts in much of the corpus.

## 3. Boundaries

This standard owns curriculum-side content and future curriculum metadata only.
It does not implement or modify Tutor V2, Study Engine, learner UI, provider
selection, memory, hint execution, scoring runtime, mastery state, dashboards,
or release admission.

Curriculum must supply the concept teaching, worked examples, scenarios,
practice, reasoning tasks, remediation, protected answer authority, and stable
metadata relationships. A future runtime may select, order, and pace approved
curriculum supply under separately approved policies. It may not invent missing
financial instruction, silently change calculation assumptions, expose a
protected answer, collect real family financial information, or complete a
learner's graded reasoning.

This draft does not:

- rewrite any of the 504 active lessons;
- require every lesson to use the same teach-practice-assess shape;
- convert financial literacy into a Mathematics course;
- provide individualized financial, tax, legal, credit, or investment advice;
- treat prompt count, response length, or the presence of dollar amounts as
  sufficient evidence of instructional depth; or
- authorize Tutor V2 implementation.

## 4. Two-axis lesson classification

A lesson must declare both its **financial focus** and its **instructional
profile**. These are different decisions. “Banking” describes what the lesson is
about; “remediation” describes what the lesson is doing instructionally.

An integrated lesson may declare more than one financial focus, but it must have
one primary focus and one dominant instructional profile. Authors must not use a
generic “financial literacy” label when a more precise focus is known.

### 4.1 Financial focus taxonomy

The required R1 focus values are:

| Financial focus | Distinct instructional concern |
| --- | --- |
| `MONEY_CONCEPT` | Meaning, representation, value, exchange, scarcity, needs/wants, opportunity cost, or other foundational money ideas |
| `BUDGETING` | Planning inflows and outflows against goals and constraints; a budget is a decision plan, not merely an addition table |
| `EARNING_INCOME` | Ways income is earned; gross/net distinctions; pay, benefits, irregular income, or career-income relationships |
| `SPENDING` | Purchase choices, payment, receipts, recurring costs, needs/wants, and consequences of spending |
| `SAVING` | Goals, time, emergency reserves, delayed consumption, and saving strategies |
| `BANKING` | Account purposes, deposits, withdrawals, statements, fees, access, security, and regulated money tools |
| `CREDIT_BORROWING` | Borrowing, repayment, interest, fees, credit terms, credit records, and debt risk, only where grade appropriate |
| `TAX` | Tax purpose, bases, rates, withholding, filing concepts, or calculations under explicit fictional or sourced assumptions |
| `INTEREST` | Simple or compound interest, yield, borrowing cost, time, rates, compounding, or payment allocation |
| `COMPARISON_SHOPPING` | Total cost, unit price, quality, terms, warranties, fees, reliability, and non-price tradeoffs |
| `ENTREPRENEURSHIP` | Customer need, value proposition, price, cost, revenue, profit/loss, risk, recordkeeping, and ethical operation |
| `DECISION_SCENARIO` | A decision-centered integrated situation in which constraints, alternatives, evidence, uncertainty, or tradeoffs are the primary demand |

The repository contains additional subject matter that is too important to hide
inside generic labels. R1 therefore also recognizes:

| Additional focus | Distinct instructional concern |
| --- | --- |
| `INVESTING` | Risk, return, diversification, time horizon, fees, ownership, and uncertainty without promises of gain |
| `INSURANCE_RISK` | Risk pooling, premiums, deductibles, coverage, exclusions, and retained risk |
| `CONSUMER_PROTECTION` | Fraud, advertising, privacy, contracts, complaints, identity protection, and trustworthy information |
| `EDUCATION_CAREER_FINANCE` | Education/training costs, funding, expected—not guaranteed—outcomes, and career-related tradeoffs |
| `INTEGRATED_FINANCIAL_PLAN` | A multi-domain fictional plan or capstone whose parts must work together over time |

`DECISION_SCENARIO` may be a primary focus when decision quality is itself the
target. Otherwise, decision reasoning is a required task feature inside the
more specific focus where relevant.

### 4.2 Instructional profile taxonomy

R1 retains the repository audit's useful distinctions—diagnostic, concept
instruction, correction/reteach, application/transfer, review/mastery,
performance task, and assessment—but refines combined categories when their
teaching contracts differ.

| R1 instructional profile | Relationship to repository taxonomy | Purpose |
| --- | --- | --- |
| `DIAGNOSTIC` | Diagnostic | Elicit current understanding without teaching the measured target first |
| `CONCEPT_INSTRUCTION` | Concept instruction | Introduce or substantially explain a concept, calculation, or decision process |
| `GUIDED_APPLICATION` | May appear within concept instruction | Apply a known idea with active prompts, feedback, and fading support |
| `APPLICATION_TRANSFER` | Application/transfer | Use established learning in a meaningfully changed financial context |
| `DECISION_SCENARIO` | Application/transfer or concept instruction, depending on intent | Analyze alternatives and justify a choice under stated constraints |
| `REVIEW` | Review/mastery | Retrieve, connect, and practice previously taught learning; may include brief corrective teaching |
| `REMEDIATION` | Correction/reteach | Respond to a defined misconception or breakdown with different teaching and a new attempt |
| `MASTERY` | Review/mastery | Produce fresh, sufficiently independent evidence for a mastery decision |
| `ASSESSMENT` | Assessment | Collect protected evidence under declared conditions without preteaching the measured target |
| `PROJECT` | Performance task | Create or defend a sustained product, plan, analysis, presentation, or simulation |

Review is not mastery: review strengthens and connects learning, while mastery
collects fresh evidence for a decision. Remediation is not review: remediation
targets an observed misconception or prerequisite gap. A project is not merely
a long worksheet: it integrates decisions or products across steps and uses a
declared rubric. Assessment is not concept instruction and must not contain an
answer-revealing model for the protected target.

Legacy phase strings may be preserved for provenance. Future metadata should map
them to the R1 profile rather than treating display labels such as “Guided
practice A” as a complete instructional contract.

## 5. Core teaching terms

### 5.1 Concept explanation

A **concept explanation** is learner-visible teaching that develops meaning. It
must do more than state an objective, repeat a definition, list a formula, or
present a scenario containing numbers.

A conforming explanation:

- names the financial idea in age-appropriate language;
- explains how or why it works and why it matters;
- connects terms, quantities, representations, and real-world meaning;
- distinguishes at least one plausible confusion when that confusion is
  material to the lesson;
- identifies the conditions or limits under which a rule applies; and
- leaves the learner with a usable question, decision rule, representation, or
  process.

For example, teaching minimum payments must explain that interest can consume
part of a payment before the balance is reduced. Merely directing the learner to
“subtract interest first” states an operation but does not fully explain the
financial relationship.

### 5.2 Worked financial example

A **worked financial example** is a complete, learner-visible demonstration on
a separate, non-protected case. It shows the reasoning before the learner is
asked to perform the same kind of task independently.

A conforming worked example must:

1. state the fictional facts, goal, and relevant assumptions;
2. identify what information matters and what does not;
3. choose and explain a method, comparison rule, or decision framework;
4. show each material calculation or reasoning step with labels and units;
5. apply any rate, timing, tax, interest, fee, or rounding condition explicitly;
6. interpret the result in financial language; and
7. check reasonableness, limitation, or tradeoff where relevant.

The answer alone, an adult-only answer key, a formula followed by substituted
numbers, or a narrated summary of completed work does not count. The model must
make visible why each step or consideration follows.

A worked decision example need not contain arithmetic. It may model how to name
a goal, identify constraints, compare relevant benefits and costs, consider
risk or uncertainty, reject an attractive but unsuitable option, and justify a
choice. When calculation and judgment are both part of the target, the example
must connect the computed result to the decision rather than presenting two
unrelated activities.

The model case must differ enough from protected independent or mastery work
that the learner cannot complete the protected task by copying names, numbers,
language, option ranking, or reasoning.

### 5.3 Guided calculation or decision

A **guided calculation/decision** requires the learner to do meaningful work
with temporary support. The lesson may cue a step, ask the learner to identify
the relevant quantity, provide an organizer, request a comparison, or respond to
an attempt. It must not complete every meaningful step for the learner.

Guided work must declare:

- the learner action or response;
- support available before and after that action;
- the expected evidence of understanding;
- feedback tied to an observable response or misconception; and
- how support fades before independent evidence.

“Follow the worked example and change the numbers” is not sufficient guided
reasoning when the learner never chooses an operation, identifies an assumption,
or explains a financial meaning.

### 5.4 Independent scenario

An **independent scenario** is a fictional or provided instructional case in
which the learner applies the target without being supplied the material
calculation, choice, evidence selection, or justification.

It must be fresh enough to require transfer. Freshness may come from different
values, constraints, timing, representations, alternatives, or context. A new
name with the same numbers and identical decision is not meaningfully fresh.
The scenario must declare the permitted tools, supports, response form, and
independence boundary.

### 5.5 Reasoning

**Reasoning** is the learner's explanation of how financial facts, assumptions,
goals, calculations, constraints, risks, and tradeoffs support a conclusion. A
calculation trace can be part of reasoning, but arithmetic alone is not a
complete financial justification when a decision is at issue.

Reasoning evidence should require the learner to do one or more of the
following, as appropriate:

- explain what a result means, not only report it;
- compare alternatives using relevant criteria;
- identify a tradeoff or opportunity cost;
- connect a choice to a stated goal or constraint;
- distinguish certainty from estimate, assumption, or risk;
- explain how a changed condition could change the decision; or
- defend why one consideration matters more than another in the scenario.

### 5.6 Fresh mastery

**Fresh mastery** is protected evidence on a new case that measures the same
target after teaching and guided support have ended. It must require independent
selection or execution of the essential method or reasoning. It must not reuse
the worked example's answer, exact values, decisive wording, or completed
organizer.

Mastery metadata must identify the target concepts, permitted supports,
evidence required, scoring authority, and decision rule. A reflection about how
the learner felt is not mastery evidence. A correct number may be insufficient
when interpretation or decision reasoning is part of the target.

### 5.7 Remediation

**Remediation** is a targeted alternate teaching path for a defined
misconception, prerequisite gap, or process breakdown. It is not repetition of
the same directions, generic encouragement, easier numbers without explanation,
or disclosure of the protected answer.

A remediation path must:

1. connect to an observable response pattern without labeling the learner's
   character, ability, or motivation;
2. name or reveal the underlying distinction in a different way;
3. use a different fictional worked example, representation, or explanation;
4. require a supported learner retry; and
5. end with fresh mastery evidence when a mastery claim is to be made.

Remediation may step back to a declared prerequisite. It must preserve privacy,
calculation safety, and the answer boundary.

## 6. Shared lesson package

Every conforming lesson package must supply the following coherent layers. A
profile may mark a layer not applicable only when the omission follows from its
instructional purpose.

| Layer | Required curriculum supply |
| --- | --- |
| Identity and intent | Stable lesson identity, grade, standards references, primary financial focus, secondary focuses, instructional profile, objective, target concepts, and evidence purpose |
| Scenario and assumptions | Fictional or approved instructional scenario, learner-visible fiction cue, relevant facts, constraints, assumptions, source/year where required, and advice boundary |
| Teaching | Concept explanation and separate worked calculation/decision examples when the profile teaches or reteaches |
| Learner work | Comprehension checks, guided calculation/decision, independent scenario, reasoning, mastery, project, or assessment tasks as the profile requires |
| Support and remediation | Vocabulary/access support, hint references, misconception-linked remediation, and fresh retry routes without answer leakage |
| Calculation contract | Units, integer-cent or exact rational representation, rates, operation order, timing, rounding, estimation tolerance, and verification method as applicable |
| Protected authority | Adult-only fixed answers, computation traces, rubric criteria, acceptable variation, item references, and answer-release rules |
| Future Tutor manifest | Data-only concept, prerequisite, misconception, calculation, scenario, hint, age, and answer policy metadata |
| Provenance and safety | Source provenance, standards-label provenance, privacy declarations, fictional status, individualized-advice boundary, and human review references |

All learner-visible parts must be mutually consistent. A scenario fact cannot be
available only in adult scoring authority if the learner needs it. An answer or
rubric locator cannot appear in learner material. Authored remediation does not
count as available remediation unless an approved learner or Tutor route can
resolve it without exposing adult-only content.

## 7. Type-aware teaching requirements

The standard applies the teaching sequence according to instructional purpose.
It does not force diagnostics or assessments to teach the answer immediately
before measuring it.

| Profile | Explanation/model requirement | Learner work and evidence requirement |
| --- | --- | --- |
| `DIAGNOSTIC` | No target preteaching or worked answer before the protected attempt; directions and non-target access support remain required | Elicit enough independent evidence to locate concepts, strategies, or misconceptions; do not claim mastery from diagnostic evidence alone unless separately authorized |
| `CONCEPT_INSTRUCTION` | Full concept explanation and at least one actual worked financial example before like-kind independent work | Observable check, guided calculation/decision, independent scenario, reasoning where relevant, and fresh mastery evidence or an explicit handoff to a named mastery lesson |
| `GUIDED_APPLICATION` | Brief concept retrieval; worked example required if the application introduces a new process, representation, or decision demand | Meaningful learner steps with feedback and fading support, followed by an independent scenario or explicit handoff |
| `APPLICATION_TRANSFER` | Do not reteach the protected solution; a brief prerequisite reminder is allowed | Meaningfully changed independent scenario requiring transfer, interpretation, and relevant reasoning; declare prior teaching prerequisites |
| `DECISION_SCENARIO` | Explain the decision framework and show a separate worked decision example unless this is protected transfer/assessment | Learner identifies the goal and constraints, compares relevant options, addresses tradeoffs or risk, and justifies a decision; calculation is included only when relevant |
| `REVIEW` | Concise retrieval and connection of previously taught ideas; targeted separate examples may address errors | Varied practice across named concepts with feedback; review must not be mislabeled as mastery merely because it has many questions |
| `REMEDIATION` | Different explanation plus a different worked financial example targeted to a misconception or prerequisite | Supported retry, fading help, and a fresh independent check; no repetition-only route |
| `MASTERY` | No answer-revealing teaching of the measured target during the protected attempt | Fresh independent evidence, declared supports and threshold, aligned authority, and reasoning evidence when the construct includes judgment |
| `ASSESSMENT` | No target preteaching, worked answer, leading hint, or feedback that changes the protected attempt | Protected evidence under declared conditions with fixed/rubric authority, acceptable variation, accessibility rules, and answer-release policy |
| `PROJECT` | Teach and model component skills before their protected use; a model fragment or unrelated exemplar may show quality without supplying the project's solution | Sustained learner-owned plan, product, analysis, presentation, or simulation; checkpoints, source/assumption record, rubric, individual evidence where needed, and final reasoning/defense |

For instruction-bearing profiles, the normal order is:

1. establish the goal and fictional scenario;
2. explain the financial concept or decision process;
3. model it with a separate worked example;
4. check understanding;
5. guide a learner calculation or decision;
6. fade support for an independent scenario;
7. collect fresh mastery evidence; and
8. route a defined misconception to remediation and a fresh retry.

The sequence may span more than one lesson when the handoffs are explicit in
metadata. A single lesson need not become artificially long, but an author may
not omit teaching and assume a future Tutor will invent it.

## 8. Decision reasoning and real-world usefulness

Financial education must not reduce every problem to arithmetic. When a choice,
plan, risk, or recommendation is relevant, the lesson must ask the learner to
reason with the result.

A conforming decision task supplies enough fictional facts to make a reasoned
choice possible while allowing more than one defensible answer when goals or
priorities legitimately differ. It must identify what is fixed, what is a
learner judgment, and what uncertainty remains. The rubric must score the use of
relevant evidence and reasoning rather than agreement with an adult preference.

Age-appropriate expectations are:

| Grade band | Typical reasoning demand |
| --- | --- |
| 3–5 | Compare a small number of concrete choices; name a goal, need/want, cost, benefit, or simple opportunity cost; explain one reason |
| 7–8 | Use multiple stated constraints; connect a calculation to affordability, time, risk, fees, or alternatives; explain a tradeoff and how one changed fact could matter |
| 9–12 | Compare total and recurring cost, risk, uncertainty, time horizon, contractual terms, taxes, credit effects, or opportunity costs; test assumptions and defend a conditional decision |

Age progression must increase the quality and number of interacting
considerations, not merely increase the dollar amounts. Technical vocabulary is
appropriate when it is genuinely taught. Terms such as gross pay, simple
interest, deductible, marginal rate, principal, or diversification must not be
dropped into learner work without explanation or a declared prerequisite.

Lessons must avoid manufactured moral judgments about wealth, debt, employment,
family structure, spending, or access to financial products. Scoring must focus
on the scenario evidence and reasoning, not whether the learner chooses the
author's preferred lifestyle.

## 9. Money and calculation safety

### 9.1 Authoritative representation

Money must use integer minor-unit arithmetic—integer cents for USD—whenever the
currency and task are cent-denominated. Rates, ratios, and intermediate values
must use exact representations such as integers in basis points, rational
values, or validated decimal strings. Binary floating-point output must never be
the final scoring authority for a fixed money answer.

Display formatting and computation authority are separate. Whole-dollar display
may be appropriate when the scenario uses whole dollars, but it must not conceal
an unresolved fractional-cent calculation. Currency, unit, sign, and scale must
be explicit.

### 9.2 Exact-cent conditions

Each fixed calculation must declare whether the result is:

- exact in cents;
- rounded to cents;
- rounded to another stated unit;
- an estimate with a stated tolerance; or
- a comparison whose acceptable relation is defined.

When rounding is required, the lesson and authority must state the rounding
mode and the point in the computation at which rounding occurs. Intermediate
values must not be rounded early unless the financial rule or scenario explicitly
requires it. Learner-facing directions must include any rounding condition the
learner needs; it cannot exist only in the answer key.

Equivalent input forms may be accepted only through a declared normalization
rule. `$4.50`, `4.50`, and `450 cents` are not automatically interchangeable in
every response context.

### 9.3 Tax conditions

A tax problem must state or resolve all conditions material to its answer,
including as applicable:

- the fictional jurisdiction and tax year, or a clear statement that the rates
  are invented for instruction;
- the taxable base and what is included or excluded;
- rates or brackets and whether the task uses a marginal, average, flat, sales,
  payroll, or other model;
- deductions, exemptions, credits, withholding, caps, and filing assumptions
  required by the task;
- order of operations and rounding point; and
- source provenance and effective date when real public rules are used.

The lesson must distinguish a simplified instructional tax model from current
personal tax advice. A learner must never be asked to use a real family return,
income, filing status, taxpayer identifier, or withholding record.

### 9.4 Interest and borrowing conditions

An interest or borrowing problem must state or resolve all conditions material
to its answer, including as applicable:

- principal or starting balance;
- stated rate and whether it is periodic, annual percentage rate, or yield;
- simple or compound method and compounding frequency;
- time period, day-count convention when material, and timing of deposits,
  charges, and payments;
- fees and minimum-payment rule when they affect the result;
- payment allocation or amortization assumptions; and
- rounding timing and method.

Rates and repayment examples must be clearly fictional or accurately sourced
and dated. Lessons must not imply guaranteed investment returns, guaranteed loan
approval, or one universally correct borrowing choice.

### 9.5 Verification and authority

Every fixed item must have separately protected adult-only authority aligned by
stable item reference. Authority must include the expected value or relation,
units, relevant assumptions, verification method, and a reproducible computation
trace where a calculation is involved.

Verification must be independent of the learner-facing answer assertion; copying
the same unverified value into two files is not independent verification. Mixed
tasks must provide both fixed-answer authority and rubric/acceptable-answer
criteria. Judgment tasks must define relevant evidence, acceptable variation,
and misconception or insufficiency boundaries without forcing one personal
preference.

The current corpus's 2,967 aligned fixed items, integer-cent nodes, and resolved
tax/interest conditions are a baseline strength. Future depth work must not
weaken them while adding teaching content.

## 10. Privacy, fiction, and advice boundaries

All learner work must use fictional scenarios or provided instructional data
approved for the lesson. A learner-visible cue must make that boundary clear;
an adult-only `isFictionalSimulation` flag is not enough by itself.

A lesson, hint, Tutor route, project, or remediation must never require a child
to disclose real:

- household or personal income;
- bank, savings, investment, or payment-app balances;
- debts, loans, credit-card balances, or repayment history;
- parent or guardian finances, employment details, taxes, benefits, or bills;
- credit report, credit score, borrowing eligibility, or credit information;
- account, card, routing, PIN, password, Social Security, taxpayer, or other
  credential/identifier information; or
- financial hardship or purchasing history.

The prohibition includes optional prompts, take-home interviews, family-budget
projects, screenshots, document uploads, “ask an adult for the real amount,” and
personalized Tutor follow-ups. Replacing a required disclosure with “if you are
comfortable” does not make the task appropriate.

Projects that benefit from choice may let learners choose among several provided
fictional profiles or generate non-identifying preferences such as prioritizing
time, predictability, or cost. They must not convert those choices into a request
for real family circumstances.

Curriculum must say that scenarios are educational, not individualized
financial, legal, tax, investment, insurance, or credit advice. Where real-world
adult action could follow, the lesson should teach questions to ask and sources
to verify rather than direct a child to open an account, apply for credit, trade
an asset, file a return, or enter a contract.

No error may be used to infer irresponsibility, poverty, dishonesty, motivation,
family behavior, or future financial character.

## 11. Hints, feedback, and answer protection

Hints and feedback must teach reasoning without doing the protected work.
A lesson should provide a staged path such as:

1. restate the goal or identify the type of decision;
2. point to relevant fictional facts or a prerequisite concept;
3. ask for the next representation, comparison, or calculation step;
4. model a parallel case with different facts; and
5. route to remediation after a persistent misconception.

A hint may clarify vocabulary, remind a learner of a stated assumption, prompt a
reasonableness check, or narrow attention to a relevant table or contract term.
It may not reveal the protected result, select the winning option, provide the
decisive justification, or successively disclose every step until only copying
remains.

Feedback must distinguish calculation error, concept misconception, omitted
condition, weak evidence, and defensible alternative reasoning. For open
decisions, it should test the learner's support and consistency, not replace the
learner's values with an adult preference.

Worked examples are learner-visible teaching content and must use separate
example references. Fixed answers, scoring traces, rubrics with protected
locators, and mastery results remain adult-only until the declared answer policy
permits review.

## 12. Future Tutor curriculum metadata

This section defines curriculum metadata only. It does not implement Tutor V2,
provider behavior, memory, adaptive routing, scoring, or learner modeling.

Each future conforming lesson must provide a data-only Tutor manifest with the
following fields or equivalent repository-approved structures:

### 12.1 Concept IDs

`concept_ids` must contain stable, subject-namespaced identifiers for the ideas
the lesson teaches or measures, not generated display labels. Each concept must
have a learner-facing meaning, grade-band applicability, and relationship to the
lesson's financial focus. IDs must remain stable across wording revisions.

### 12.2 Prerequisites

`prerequisite_concept_ids` must identify the concepts genuinely needed to begin
the target work. Each prerequisite must indicate whether it is required or
supporting and point to approved review or remediation supply. Grade placement
alone is not a prerequisite model.

### 12.3 Misconception IDs

`misconception_ids` must name stable, observable financial or calculation
patterns, such as treating an entire credit payment as principal reduction.
Each ID must link to evidence indicators, an alternate explanation or model,
guided retry, and a fresh mastery reference. It must not encode a diagnosis or a
negative label about the learner.

### 12.4 Calculation policy

`calculation_policy` must declare the currency/unit representation, exact-value
model, permitted tools, rate representation, operation order, rounding mode and
point, tolerance if estimation is intended, normalization rules, and protected
verification reference. The policy must forbid floating-point output as sole
fixed-answer authority.

### 12.5 Decision-scenario references

`decision_scenario_refs` must resolve stable fictional scenario IDs and their
facts, alternatives, goals, constraints, assumptions, uncertainty, acceptable
variation, and privacy/advice declarations. A Tutor must be able to discuss the
approved fictional case without asking for an analogous real family fact.

### 12.6 Hint policy

`hint_policy` must declare ordered hint references, availability by task phase,
what each hint may reveal, when a parallel worked example is allowed, when help
invalidates independent or mastery evidence, and when to route to remediation.
It must identify protected items that cannot receive answer-bearing hints.

### 12.7 Age policy

`age_policy` must declare the intended grade band, required vocabulary support,
complexity and reading burden, permitted financial products/topics, fictional
framing, advice boundary, and any adult-context note. It must prohibit requests
for real household financial data at every age.

### 12.8 Answer policy

`answer_policy` must declare whether each item is fixed, judgment, or mixed; the
adult-only authority reference; acceptable formats and variation; rubric
references; answer/review timing; reveal restrictions; and the independence
effect of hints, examples, or feedback. Worked-example answers must be clearly
separate from protected task authority.

Tutor V2 may eventually use approved metadata to select explanations, parallel
examples, questions, and remediation. It must teach the relationship among
facts, calculations, goals, constraints, and tradeoffs. It must never ask a
learner to substitute real family income, balances, debts, taxes, credit data,
or credentials into a scenario. Nothing in this manifest authorizes Tutor V2
implementation.

## 13. Accessibility and language

Financial vocabulary and notation must be taught without diluting the concept.
Learner-facing directions should use plain language while preserving necessary
terms such as income, principal, interest, deductible, credit, tax, and risk.
Authors should define unfamiliar terms in context, use examples/non-examples,
label tables and units clearly, and avoid engineering language such as “integer
cents,” “fixed-numeric,” “item ref,” or “graded prompt” on the learner surface.

Representations should be available in accessible text, table, or structured
form as appropriate. Color, spatial layout, audio, or drag interaction must not
be the sole carrier of a required financial fact. Calculators, scratch work,
read-aloud, or vocabulary support may be allowed when they preserve the
construct; the lesson must declare those conditions.

Reading and arithmetic burden must not obscure the financial target. When the
lesson measures financial reasoning rather than calculation fluency, support may
reduce incidental arithmetic burden while preserving the learner's comparison
and justification. When exact calculation is the target, the support must not
perform that calculation for the learner.

## 14. Authoring and conformance review

A lesson may be classified as conforming to the approved successor of this
draft only after curriculum and authority review confirm all applicable items:

1. The lesson declares a precise financial focus and one instructional profile.
2. Standards, objective, target concepts, scenario, learner work, and scoring
   evidence align.
3. An instruction-bearing profile explains the concept and provides an actual
   separate worked financial example before like-kind independent work.
4. Guided work requires a meaningful learner action and fades support.
5. Independent and fresh mastery scenarios are sufficiently distinct from the
   model and do not contain answer-bearing hints.
6. Relevant decisions require age-appropriate reasoning, constraints, and
   tradeoffs rather than arithmetic alone.
7. Money, rate, tax, interest, timing, unit, and rounding conditions are complete
   and learner-visible where needed.
8. Fixed authority uses safe exact representation and independent verification;
   judgment authority defines acceptable evidence and variation.
9. Fictional framing is learner-visible, no real family financial data is
   requested, and the individualized-advice boundary is explicit.
10. Tutor metadata resolves stable concept, prerequisite, misconception,
    calculation, decision-scenario, hint, age, and answer policies without
    implementing runtime behavior.
11. A human reviewer checks age appropriateness, financial accuracy, privacy,
    decision neutrality, answer protection, and coherence across learner and
    adult-only surfaces.

No automatic word count or item count can establish conformance by itself.
Automated checks may verify required fields, references, arithmetic invariants,
privacy phrases, or separation of learner and adult authority. Human review must
judge the quality of explanation, modeling, transfer, reasoning, and age fit.

## 15. Director sample and adoption path

Before any corpus-scale repair or enforcement, the Director should review one
complete lesson authored against an approved version of this standard.

Proposed sample:

- Lesson: `ma-g8-financial-literacy-u04-l03`
- Topic: credit cards and minimum payments
- Why it is suitable: it is a representative mixed calculation-and-decision
  lesson with exact-cent interest, explicit rounding, guided and independent
  work, protected fixed/rubric authority, and a fictional scenario. It also
  exposes the current missing explanation, worked-example, mastery, and routed
  remediation layers clearly.

The future sample should preserve the lesson identity, standard labels,
financial safety, exact-cent authority, and intended construct while allowing
the Director to judge whether the proposed explanation, worked example, guided
reasoning, independent transfer, fresh mastery, remediation, and Tutor metadata
are appropriate. This draft does not create or rewrite that sample.

Director review should decide:

- whether the two-axis taxonomy is approved;
- whether the type-aware sequence and exceptions are correct;
- whether calculation, privacy, and decision-reasoning rules are sufficiently
  strict;
- whether the future Tutor metadata contract is appropriately curriculum-only;
  and
- what evidence is required before the standard becomes a release gate.

Until those decisions are recorded, this document remains a draft and must not
be used to authorize automated rewriting or production admission changes.

**Draft classification: FINANCIAL_LITERACY_LESSON_STANDARD_DRAFT_R1**
