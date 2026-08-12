"""Course blueprints for High School Financial Literacy 9-12.

Every course covers all seven Michigan Personal Finance content expectations
(PF1-PF7, plus sub-expectation PF4.1 under PF4). Michigan publishes one 9-12
expectation set rather than four grade-level sets, so the *distribution* here --
full sweep each year at rising sophistication -- is a Manuel Academy curricular
decision, documented in ../progression/rigor-progression-9-12.md.

Shape matches the published Grade 8 course exactly: 7 units, lesson counts
[10, 10, 10, 11, 10, 10, 11] = 72 lessons, so the Grade 8 -> Grade 9 handoff is
structurally seamless.
"""

SUBJECT = "financial-literacy"
GRADES = (9, 10, 11, 12)
UNIT_LESSON_COUNTS = (10, 10, 10, 11, 10, 10, 11)
TOTAL_LESSONS = sum(UNIT_LESSON_COUNTS)  # 72
DAYS_PER_WEEK = 2
WEEKS = 36

PHASES = (
    "Launch and diagnostic",
    "Concept model A",
    "Concept model B",
    "Guided practice",
    "Applied simulation",
    "Comparison and analysis",
    "Error and misconception analysis",
    "Transfer to a new case",
    "Synthesis and review",
    "Unit performance task",
    "Defense and extension",
)

GRADE_THEMES = {
    9:  ("Foundations in Practice",
         "Grade 9 makes each expectation concrete on a single, well-scoped decision with "
         "supplied fictional figures, establishing vocabulary, arithmetic, and habits."),
    10: ("Comparison and Systems",
         "Grade 10 moves from a single decision to comparing options and understanding the "
         "institutions, contracts, and disclosures that structure them."),
    11: ("Analysis and Tradeoffs",
         "Grade 11 quantifies multi-year consequences and reasons about education, career, "
         "and opportunity cost under uncertainty."),
    12: ("Adult Finance Integration",
         "Grade 12 integrates all seven expectations into one coherent simulated adult "
         "financial life, ending in the capstone."),
}

UNITS = {
    "PF1": {"title": "Earning Income", "codes": ["PF1"]},
    "PF2": {"title": "Buying Goods and Services", "codes": ["PF2"]},
    "PF3": {"title": "Budgeting and Saving", "codes": ["PF3"]},
    "PF4": {"title": "Using Credit", "codes": ["PF4", "PF4.1"]},
    "PF5": {"title": "Financial Investing", "codes": ["PF5"]},
    "PF6": {"title": "Protecting and Insuring", "codes": ["PF6"]},
    "PF7": {"title": "Paying Taxes", "codes": ["PF7"]},
}
UNIT_ORDER = ["PF1", "PF2", "PF3", "PF4", "PF5", "PF6", "PF7"]

# grade -> unit code -> {subtitle, essential_question, performance_task, topics[6]}
BLUEPRINTS = {
9: {
 "PF1": dict(
  subtitle="Income, Benefits, and the Cost of Getting Qualified",
  essential_question="What actually determines take-home pay, and what does it cost in time and money to become qualified for a given job?",
  performance_task="Research three fictional entry-level roles and produce an income profile for each showing gross pay, benefits, likely payroll deductions, and the training cost and time to qualify.",
  topics=["gross pay versus take-home pay","employee benefit packages as compensation","payroll deductions a worker is likely to see","cost and time of required education or technical skills","non-income factors in career choice","other possible sources of income"]),
 "PF2": dict(
  subtitle="Comparing a Purchase Before You Make It",
  essential_question="What should a consumer find out before buying, and who is responsible for making that information available?",
  performance_task="Build a simulated pre-purchase dossier for one fictional mid-cost item comparing three options on price, quality, terms, and disclosed information.",
  topics=["price, quality, and fitness for purpose","total cost beyond the sticker price","reading a disclosure, label, or warranty","the role of government in consumer information","advertising claims versus verifiable claims","recording a decision and its reasons"]),
 "PF3": dict(
  subtitle="Building a Budget That Survives a Surprise",
  essential_question="Why set money aside now, and what does time and interest do to the value of what is set aside?",
  performance_task="Build and stress-test a three-month fictional budget with one unexpected expense, showing the effect on savings.",
  topics=["incentives to set aside income for future consumption","fixed, variable, and periodic expenses","simple and compound interest on savings","the effect of time on the value of savings","emergency reserves and stress-testing","tracking a plan against what actually happened"]),
 "PF4": dict(
  subtitle="What Credit Costs and What Aid Is",
  essential_question="What are the real benefits, costs, and consequences of borrowing, and how does student aid differ from a loan?",
  performance_task="Compare two fictional credit offers and one fictional student-aid package, computing total cost and identifying which parts must be repaid.",
  topics=["benefits and costs of using credit","interest rate, APR, term, and total repaid","what a credit history records and why it matters","FAFSA and the aid application process","grants, scholarships, and work study versus loans","consequences of missed or minimum payments"]),
 "PF5": dict(
  subtitle="Risk, Return, and Why Diversification Matters",
  essential_question="Why does a higher expected return usually come with more risk, and what does spreading investments actually protect against?",
  performance_task="Write a fictional goal-based saving-and-investing plan for a stated horizon and justify the risk level chosen.",
  topics=["risk and expected rate of return","how inflation changes real returns","the importance of diversification","time horizon and goal matching","the role of government agencies in investing","tax-advantaged accounts in outline"]),
 "PF6": dict(
  subtitle="Naming Risk and Deciding What to Do About It",
  essential_question="When should a person accept a risk, reduce it, or pay a fee now to transfer it?",
  performance_task="Conduct a fictional household risk audit and recommend accept, reduce, or transfer for each identified risk with reasons.",
  topics=["financial risk to income, assets, health, or identity","accept, reduce, or transfer a risk","how insurance transfers risk for a premium","premium, deductible, and coverage limit","identity protection and everyday safeguards","recognising common scams and pressure tactics"]),
 "PF7": dict(
  subtitle="Taxes, Take-Home Pay, and Your First Forms",
  essential_question="Which taxes is a person likely to pay, and how do they change take-home pay?",
  performance_task="Produce a one-year fictional financial plan showing income, taxes, spending, saving, credit, insurance, and one investing goal, and defend its tradeoffs.",
  topics=["federal, state, and local taxes a person is likely to pay","how withholding changes take-home pay","common IRS tax forms and what each is for","tax benefits and drawbacks in outline","filing responsibilities and recordkeeping","integrating PF1-PF7 into one plan"]),
},
10: {
 "PF1": dict(
  subtitle="Compensation Packages and Career Pathways",
  essential_question="How do two offers with the same salary end up worth very different amounts?",
  performance_task="Compare three fictional job offers with differing benefits, schedules, and advancement, and defend a ranking on total compensation rather than salary alone.",
  topics=["total compensation versus salary","health, retirement, and leave benefits valued","pathway cost: certificate, apprenticeship, or degree","labour market information and how to read it","non-income factors: schedule, stability, location, fit","self-employment and multiple income streams"]),
 "PF2": dict(
  subtitle="Contracts, Disclosures, and Consumer Protection",
  essential_question="What is a consumer actually agreeing to, and what protections exist when something goes wrong?",
  performance_task="Analyse a fictional purchase agreement and subscription contract, flag the terms that change cost or obligation, and write a complaint-and-resolution plan.",
  topics=["reading a contract's cost and obligation terms","subscriptions, renewals, and cancellation terms","returns, warranties, and remedies","the role of government agencies in consumer protection","unit pricing and comparison methods","documenting and escalating a consumer complaint"]),
 "PF3": dict(
  subtitle="Banking Systems, Interest Mechanics, and Inflation",
  essential_question="How do the mechanics of accounts, interest, and inflation change what a saving plan is really worth?",
  performance_task="Model a twelve-month fictional budget across account types and compute the real, inflation-adjusted value of the ending balance.",
  topics=["account types and their fee and access structures","compounding frequency and its effect","nominal versus real value under inflation","automating saving and paying yourself first","irregular and seasonal income planning","comparing savings vehicles on stated terms"]),
 "PF4": dict(
  subtitle="Credit Systems, Scores, and Financing Aid",
  essential_question="How is creditworthiness assessed, and how do aid and loan systems actually decide what a student receives?",
  performance_task="Build a fictional financing comparison for one postsecondary pathway using aid, grants, work study, and loans, showing total cost and repayment shape.",
  topics=["how credit reporting and scoring work","secured, unsecured, revolving, and installment credit","amortisation: how a payment splits into interest and principal","the FAFSA process, dependency, and aid packaging","subsidised, unsubsidised, and private loan terms","predatory lending patterns and warning signs"]),
 "PF5": dict(
  subtitle="Markets, Vehicles, and Regulation",
  essential_question="What are the main investment vehicles, and what does regulation actually protect an investor from?",
  performance_task="Construct and justify a fictional diversified allocation for a stated goal and horizon, naming the risk each choice accepts.",
  topics=["stocks, bonds, funds, and index vehicles","fees, expense ratios, and their long-run drag","diversification across and within asset classes","the role of government agencies and disclosure rules","tax-advantaged account types compared","investment fraud patterns and red flags"]),
 "PF6": dict(
  subtitle="Insurance Structures and Identity Protection",
  essential_question="How is an insurance policy structured, and how does a person judge whether coverage matches the risk?",
  performance_task="Compare fictional policy options across coverage, deductible, and premium, and recommend a layered protection plan for a fictional household.",
  topics=["health, auto, renters, disability, and life coverage in outline","premium, deductible, co-pay, and coverage limit interacting","matching coverage level to actual exposure","how a claim process works","identity theft response steps","evaluating an insurance offer without a sales frame"]),
 "PF7": dict(
  subtitle="Tax Structure, Withholding, and Filing",
  essential_question="How does the structure of a tax system determine what a specific person owes?",
  performance_task="Prepare a fictional annual financial plan including a simulated tax estimate, withholding check, and a documented filing-readiness checklist.",
  topics=["progressive brackets, marginal versus effective rate","payroll taxes and employer withholding","W-4, W-2, 1099, and 1040 in outline","standard deduction and common credits in outline","state and local tax variation","recordkeeping and filing-readiness"]),
},
11: {
 "PF1": dict(
  subtitle="Education, Career, and Lifetime Earnings Tradeoffs",
  essential_question="Is a given pathway worth its cost, and what evidence would change that answer?",
  performance_task="Model the multi-year cost, debt, and earnings trajectory of three fictional pathways and defend a recommendation with explicit assumptions and a sensitivity check.",
  topics=["return on a pathway: cost, time, debt, and earnings","opportunity cost of years not earning","earnings variation within a field, not just the median","stating and testing assumptions in a projection","risk of non-completion and how to model it","negotiation, advancement, and long-run wage growth"]),
 "PF2": dict(
  subtitle="Major Purchase Analysis Under Constraint",
  essential_question="How does a large purchase interact with everything else in a financial plan?",
  performance_task="Produce a fictional major-purchase analysis (vehicle or housing) with total cost of ownership, financing comparison, and the effect on the rest of the plan.",
  topics=["total cost of ownership over a holding period","buy, finance, lease, or delay compared","depreciation and resale value","how a large purchase constrains other goals","negotiating position and information asymmetry","government consumer-information roles in large purchases"]),
 "PF3": dict(
  subtitle="Multi-Year Planning, Inflation, and Goal Conflict",
  essential_question="How does a plan hold up across years when goals compete and prices move?",
  performance_task="Build a multi-year fictional plan with competing goals, model inflation and one income shock, and document the reprioritisation decisions.",
  topics=["sequencing competing multi-year goals","inflation compounding across a decade","income shocks and recovery planning","time value of money applied to real choices","behavioural pressures on a savings plan","revising a plan without abandoning it"]),
 "PF4": dict(
  subtitle="Debt Strategy and Repayment Analysis",
  essential_question="Given several debts and limited money, what repayment strategy actually costs least?",
  performance_task="Compare fictional repayment strategies across a debt set, compute total interest under each, and justify a strategy including its non-financial tradeoffs.",
  topics=["amortisation schedules and total interest","repayment ordering strategies compared","refinancing, consolidation, and their tradeoffs","student loan repayment plan structures in outline","debt-to-income and borrowing capacity","delinquency, default, and available remedies"]),
 "PF5": dict(
  subtitle="Portfolio Reasoning, Inflation, and Tax Effects",
  essential_question="How do fees, taxes, and inflation together change what an investor actually keeps?",
  performance_task="Build a fictional long-horizon investing policy statement with allocation, rebalancing rule, and an after-fee, after-inflation projection.",
  topics=["expected return, volatility, and horizon interacting","after-fee and after-tax return","real return net of inflation","rebalancing rules and why they are written in advance","retirement account structures in outline","distinguishing evidence from prediction in claims"]),
 "PF6": dict(
  subtitle="Risk Management Across a Household",
  essential_question="How should limited protection money be allocated across many uncovered risks?",
  performance_task="Produce a fictional household risk-management plan allocating a fixed protection budget across coverage, reserves, and prevention, with justification.",
  topics=["quantifying exposure: likelihood times severity","allocating a limited protection budget","self-insuring through reserves versus buying coverage","coverage gaps and overlapping policies","disability and income-loss protection","fraud, scam escalation, and recovery procedures"]),
 "PF7": dict(
  subtitle="Tax Planning and Its Interaction With Everything Else",
  essential_question="How do tax rules change which financial decision is actually better?",
  performance_task="Produce an integrated fictional annual plan in which a tax consideration measurably changes at least two decisions, and defend the reasoning.",
  topics=["marginal rate effects on a decision","tax-advantaged accounts as a planning tool","credits versus deductions in outline","self-employment and multiple-income tax obligations","tax consequences of investing decisions","integrating tax reasoning into a whole plan"]),
},
12: {
 "PF1": dict(
  subtitle="Entering the Workforce: Offers, Onboarding, and Pay",
  essential_question="What does a person actually do, in order, when an offer arrives and work begins?",
  performance_task="Work a fictional offer end to end: evaluate total compensation, complete simulated onboarding paperwork, and verify the first simulated pay statement.",
  topics=["evaluating and responding to an offer","simulated onboarding paperwork and elections","reading and verifying a pay statement","benefit enrolment decisions and deadlines","income changes across a career stage","documenting employment records"]),
 "PF2": dict(
  subtitle="Running a Household's Spending",
  essential_question="How does an adult keep recurring spending under control across a whole year?",
  performance_task="Operate a fictional household's annual spending: recurring obligations, one major purchase, one dispute, and a documented year-end review.",
  topics=["recurring obligations and renewal management","a major purchase inside a live plan","resolving a billing error or dispute","subscription and service audits","consumer rights and where to escalate","annual spending review and adjustment"]),
 "PF3": dict(
  subtitle="Running the Adult Budget",
  essential_question="What makes a real adult budget survive contact with an actual year?",
  performance_task="Operate a twelve-month fictional adult budget through irregular income, one emergency, and one goal, and report what the plan got wrong.",
  topics=["operating a budget month over month","irregular income and cash-flow timing","emergency fund sizing and use","paying down debt while saving","adjusting after a plan fails a month","year-end reconciliation and lessons"]),
 "PF4": dict(
  subtitle="Financing Adult Life and Postsecondary Costs",
  essential_question="How does a person finance a major life stage without borrowing more than it is worth?",
  performance_task="Produce a complete fictional financing plan for a postsecondary or major-life pathway, including aid, work, borrowing limits, and a repayment projection.",
  topics=["completing a simulated aid application workflow","setting a personal borrowing limit before shopping","comparing full financing packages","repayment projection against expected income","building and protecting credit responsibly","what to do when repayment becomes difficult"]),
 "PF5": dict(
  subtitle="Long-Horizon Investing as an Adult",
  essential_question="What investing decisions actually need to be made in the first years of adult life?",
  performance_task="Write a fictional first-decade investing plan with account choices, contribution rate, allocation, and a written rule for market declines.",
  topics=["employer retirement plans and matching in outline","setting a contribution rate inside a real budget","allocation for a decades-long horizon","a written rule for market declines","fee awareness across account choices","avoiding fraud and high-pressure offers"]),
 "PF6": dict(
  subtitle="Protecting an Adult Household",
  essential_question="What protection does an independent adult actually need in place, and by when?",
  performance_task="Build a fictional first-year protection plan: coverage selections, reserve targets, document security, and an identity-incident response procedure.",
  topics=["coverage an independent adult typically needs","enrolment timing and coverage gaps","reserve targets alongside coverage","securing documents and accounts safely","identity-incident response, step by step","reviewing protection after a life change"]),
 "PF7": dict(
  subtitle="Taxes and the Simulated Adult Finance Capstone",
  essential_question="Can the learner run a coherent simulated adult financial year across all seven expectations and defend every tradeoff in it?",
  performance_task="ADULT FINANCE CAPSTONE: operate one fictional adult financial year end to end -- income and onboarding, spending, budget, credit and financing, investing, protection, and a simulated tax filing -- then present and defend the whole plan, including what it sacrificed and what would break it.",
  topics=["completing a simulated tax return from fictional documents","withholding accuracy and adjusting it","integrating all seven expectations into one year","documenting assumptions and tradeoffs","stress-testing the plan against a shock","presenting and defending the capstone plan"]),
},
}
