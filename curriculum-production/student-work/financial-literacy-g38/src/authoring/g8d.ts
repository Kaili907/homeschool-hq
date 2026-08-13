import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, least, m, most, pct, reach, scale, sel, sum } from './dsl.ts'

/** Grade 8 Financial Literacy, units 6-7 (PF6 protecting and insuring, PF7 taxes and the plan capstone). */
export const G8D: readonly AuthoredLesson[] = [
  {
    key: 'g8-u06-l01',
    authority: 'FIXED',
    character: 'Zephyrine',
    objective:
      'Learners size a set of invented risks, compare them against an existing reserve, and identify which exposures remain uncovered.',
    scenario:
      'Zephyrine is a made-up eighth grader modelling four pretend risks with invented costs of $800.00, $2,500.00, $12,000.00, and $300.00, against a $5,000.00 simulated emergency reserve. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Zephyrine\'s four invented risk costs, assuming every one of them happened.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do all four risks cost together?', fixed: { expected: '$15,600.00', compute: sum(m(800.0), m(2500.0), m(12000.0), m(300.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Identify Zephyrine\'s largest single risk and compare it with the $5,000.00 reserve.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the largest single risk?', fixed: { expected: '$12,000.00', compute: most(m(800.0), m(2500.0), m(12000.0), m(300.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of that largest risk would the reserve fail to cover?', fixed: { expected: '$7,000.00', compute: diff(most(m(800.0), m(2500.0), m(12000.0), m(300.0)), m(5000.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out what the three smaller risks come to together and whether the reserve covers them.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the three smaller risks cost together?', fixed: { expected: '$3,600.00', compute: sum(m(800.0), m(2500.0), m(300.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much reserve would remain after all three?', fixed: { expected: '$1,400.00', compute: diff(m(5000.0), sum(m(800.0), m(2500.0), m(300.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The reserve handled three risks and failed on one.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Zephyrine\'s figures, explain which risks a reserve is suited to and which need insuring instead, and give the principle behind the split.' }] },
    ],
    rubric: [
      crit(
        'Matching a tool to a risk',
        'The response treats Zephyrine\'s reserve as the answer to every risk.',
        'The uncovered risk is identified for Zephyrine but no principle is stated.',
        'The response states a principle for Zephyrine, that reserves suit frequent smaller costs while insurance suits rare costs too large to absorb, and applies it to her four figures.',
      ),
    ],
    remediation:
      'If a learner compares the reserve with the combined total only, require each of Zephyrine\'s risks to be tested against the reserve individually before any conclusion.',
    extension: 'Ask the learner what reserve size would cover Zephyrine\'s three smaller risks twice over, and whether that is a sensible target.',
  },
  {
    key: 'g8-u06-l02',
    authority: 'FIXED',
    character: 'Aurelio',
    objective:
      'Learners total invented insurance premiums across several policy types and express the protection cost on a monthly and annual basis.',
    scenario:
      'Aurelio is an invented eighth grader modelling three pretend policies: renters at $18.00 a month, auto at $145.00 a month, and health at $320.00 a month. All premiums are invented for the exercise.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Aurelio\'s three invented monthly premiums.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the three premiums come to each month?', fixed: { expected: '$483.00', compute: sum(m(18.0), m(145.0), m(320.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert Aurelio\'s renters and auto premiums to an annual basis, keeping each separate.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the renters policy cost in a year?', fixed: { expected: '$216.00', compute: scale(m(18.0), 12) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the auto policy cost in a year?', fixed: { expected: '$1,740.00', compute: scale(m(145.0), 12) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute Aurelio\'s total annual protection cost and compare the largest policy with the smallest.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does all the cover cost in a year?', fixed: { expected: '$5,796.00', compute: scale(sum(m(18.0), m(145.0), m(320.0)), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does health cover cost annually than renters cover?', fixed: { expected: '$3,624.00', compute: diff(scale(m(320.0), 12), scale(m(18.0), 12)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The cheapest policy protected the most replaceable things.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Aurelio\'s policies differ so much in price, connecting each premium to the size and likelihood of what it covers.' }] },
    ],
    rubric: [
      crit(
        'Relating premium to covered risk',
        'The response treats Aurelio\'s premium differences as arbitrary.',
        'A difference is noted for Aurelio but not linked to the risk covered.',
        'The response connects each of Aurelio\'s premiums to the scale and likelihood of the loss it covers, explaining why health cover costs far more than renters cover.',
      ),
    ],
    remediation:
      'If a learner mixes monthly and annual figures, require every line in Aurelio\'s model to be labelled with its period before any total.',
    extension: 'Ask the learner what share of a $4,000.00 monthly income Aurelio\'s total premiums represent, and whether that seems sustainable.',
  },
  {
    key: 'g8-u06-l03',
    authority: 'FIXED',
    character: 'Brigid',
    objective:
      'Learners apply an invented deductible and policy limit to a claim and compute what the policyholder actually bears.',
    scenario:
      'Brigid is a made-up eighth grader modelling a pretend policy: $95.00 a month in invented premiums, a $1,000.00 deductible, and a $5,000.00 payout limit, against an invented $7,500.00 loss. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a simulated year of Brigid\'s invented premiums at $95.00 a month.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 12 months of premiums cost?', fixed: { expected: '$1,140.00', compute: scale(m(95.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out what Brigid\'s insurer pays. The $1,000.00 deductible comes off the loss first, and the policy then pays what remains up to its $5,000.00 limit.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the insurer pay on the claim?', fixed: { expected: '$5,000.00', compute: least(diff(m(7500.0), m(1000.0)), m(5000.0)), note: 'The deductible reduces the loss to $6,500.00, which the $5,000.00 limit then caps.' } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $7,500.00 loss does Brigid bear?', fixed: { expected: '$2,500.00', compute: diff(m(7500.0), least(diff(m(7500.0), m(1000.0)), m(5000.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total Brigid\'s cost for the year including premiums, and compare it with having no policy at all.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Brigid\'s total cost for the year with the policy?', fixed: { expected: '$3,640.00', compute: sum(scale(m(95.0), 12), diff(m(7500.0), least(diff(m(7500.0), m(1000.0)), m(5000.0)))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better off is she than paying the whole loss unprotected?', fixed: { expected: '$3,860.00', compute: diff(m(7500.0), sum(scale(m(95.0), 12), diff(m(7500.0), least(diff(m(7500.0), m(1000.0)), m(5000.0))))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The policy paid its full limit and Brigid still bore thousands.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain how the deductible and the limit each reduced Brigid\'s payout, in that order, and what she should check before assuming a policy covers a loss.' }] },
    ],
    rubric: [
      crit(
        'Reading policy structure',
        'The response assumes Brigid\'s policy covers the full loss.',
        'One of the deductible or limit is applied for Brigid but not the other.',
        'The response explains both mechanisms in Brigid\'s policy in the right order, that the deductible comes off the loss first and the limit then caps what remains, and names both as things to check before relying on cover.',
      ),
    ],
    remediation:
      'If a learner takes the deductible out of the limit rather than out of the loss, write Brigid\'s claim as an ordered sequence, loss then deductible then limit, and work through it one line at a time.',
    extension: 'Ask the learner what limit Brigid would have needed for the insurer to cover the whole loss above the deductible, and to show why $6,500.00 is the answer.',
    safetyNotes: ['This policy is invented for the exercise and describes no real insurance product.'],
  },
  {
    key: 'g8-u06-l04',
    authority: 'FIXED',
    character: 'Ciaran',
    objective:
      'Learners size an invented emergency plan against essential costs and compute the time needed to reach full coverage.',
    scenario:
      'Ciaran is an invented eighth grader building a pretend emergency plan. Invented essential monthly costs are $3,400.00, the target is three months, $4,600.00 is already saved, and $700.00 a month can be added.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Size Ciaran\'s invented three-month target.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the three-month target?', fixed: { expected: '$10,200.00', compute: scale(m(3400.0), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Measure Ciaran\'s remaining gap and convert it into months at $700.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the remaining gap?', fixed: { expected: '$5,600.00', compute: diff(scale(m(3400.0), 3), m(4600.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'months', text: 'How many whole months at $700.00 close the gap?', fixed: { expected: '8', compute: reach(diff(scale(m(3400.0), 3), m(4600.0)), m(700.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out how many months of essentials Ciaran\'s current savings already cover, and where the fund stands after 4 months.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is in the fund after 4 months of contributions?', fixed: { expected: '$7,400.00', compute: sum(m(4600.0), scale(m(700.0), 4)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far from the target is that?', fixed: { expected: '$2,800.00', compute: diff(scale(m(3400.0), 3), sum(m(4600.0), scale(m(700.0), 4))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The plan needs eight months to finish.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Ciaran\'s figures, describe what should happen if an emergency arrives in month four, and how the plan should respond.' }] },
    ],
    rubric: [
      crit(
        'Planning for an emergency mid-build',
        'The response assumes Ciaran\'s plan simply fails if an emergency arrives early.',
        'Partial coverage is acknowledged for Ciaran but not quantified.',
        'The response quantifies what Ciaran\'s month-four balance covers, describes drawing on it as the fund working as intended, and specifies resuming contributions afterwards.',
      ),
    ],
    remediation:
      'If a learner ignores the existing balance, mark Ciaran\'s starting savings on the target line before computing any gap.',
    extension: 'Ask the learner what monthly contribution would complete Ciaran\'s target in five months, and to show the reasoning.',
  },
  {
    key: 'g8-u06-l05',
    authority: 'JUDGMENT',
    character: 'Damaris',
    objective:
      'Learners design a household response to an invented identity-theft incident, sequencing actions and identifying what evidence to preserve.',
    scenario:
      'Damaris is an invented eighth grader studying a pretend incident: a credit alert reports a new account nobody opened, a password reset email arrives for an unrelated service, and a text asks the household to confirm a code. All of it is invented for study.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Sort the three invented signals in Damaris\'s case into evidence of compromise and attempts to exploit it. Explain how each one is classified.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Which signals in Damaris\'s case are evidence of a problem, which is an attack, and how can they be told apart?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Set out the household\'s actions in order, saying what should be preserved as evidence and what should never be shared with an incoming contact.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should the household do, in what order, what should be preserved, and what must never be shared?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Two unrelated services were affected.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why does a problem appearing across unrelated services point to a different cause than a single compromised account?' }],
      },
    ],
    rubric: [
      crit(
        'Distinguishing evidence from exploitation',
        'The response treats the code request in Damaris\'s case as legitimate.',
        'The signals are listed for Damaris but not sorted by what each one is.',
        'The response classifies Damaris\'s credit alert and reset email as evidence and the code request as an attack, and explains how each was classified.',
      ),
      crit(
        'Sequencing and preserving',
        'Actions are listed for Damaris without order or evidence handling.',
        'An order is proposed for Damaris but nothing is preserved as evidence.',
        'The response orders Damaris\'s actions from securing accounts through to reporting, specifies preserving the alert and email, and states that codes are never shared.',
      ),
    ],
    lookFors: [
      'Identifies the code request as the attack.',
      'Preserves the alert and reset email as evidence.',
      'Contacts institutions through independently obtained channels.',
      'Reasons about a shared cause across unrelated services.',
    ],
    remediation:
      'If a learner responds to the text, ask what an attacker gains from the code in Damaris\'s case, and rebuild the sequence from that.',
    extension: 'Ask the learner to write the three preventive measures the household should adopt after Damaris\'s incident.',
    safetyNotes: ['Never share a verification code or password with an incoming contact; this incident is invented for study.'],
  },
  {
    key: 'g8-u06-l06',
    authority: 'JUDGMENT',
    character: 'Evander',
    objective:
      'Learners decide how to verify an invented financial professional and identify which claims can actually be checked.',
    scenario:
      'Evander is an invented eighth grader studying a pretend adviser\'s claims: a professional-sounding title, a testimonial page on the adviser\'s own site, a promise of returns far above typical, and a request to transfer funds to an account the adviser controls. All of it is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Assess each of Evander\'s four invented claims for whether it can be independently checked, and say what checking would involve.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Which of the four claims in Evander\'s case can be independently checked, and how?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Set out the verification steps someone should take before engaging, and explain why the transfer request should end the conversation regardless of the other claims.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What verification steps should be taken, and why is the transfer request decisive on its own?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The title sounded impressive.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is a professional-sounding title weak evidence unless it can be traced to a register?' }],
      },
    ],
    rubric: [
      crit(
        'Testing claims for verifiability',
        'The response accepts Evander\'s title and testimonials as credentials.',
        'One claim is questioned for Evander but no checking method is described.',
        'The response separates Evander\'s checkable claims from self-published ones and describes concrete checking, such as searching an official register.',
      ),
      crit(
        'Recognising a decisive warning',
        'The response weighs the transfer request against the other claims for Evander.',
        'The transfer is doubted for Evander but not treated as decisive.',
        'The response treats the request to transfer funds to an adviser-controlled account in Evander\'s case as sufficient on its own to stop, regardless of the rest.',
      ),
    ],
    lookFors: [
      'Names an official register as the way to verify a credential.',
      'Identifies self-published testimonials as unverifiable.',
      'Flags above-typical guaranteed returns as implausible.',
      'Treats the transfer request as decisive.',
    ],
    remediation:
      'If a learner is persuaded by the title, ask who issued it in Evander\'s case and where that could be confirmed, then revisit.',
    extension: 'Ask the learner to write the two questions that would most quickly separate a genuine adviser from Evander\'s invented one.',
    safetyNotes: ['Never transfer funds to an account controlled by an adviser; this scenario is invented for study.'],
  },
  {
    key: 'g8-u06-l07',
    authority: 'FIXED',
    character: 'Fenella',
    objective:
      'Learners compare invented deductible-and-premium combinations across claim and no-claim years to see which structure suits which situation.',
    scenario:
      'Fenella is a made-up eighth grader comparing two pretend policies: Option A with a $500.00 deductible and $1,320.00 of annual premiums, and Option B with a $1,500.00 deductible and $960.00 of annual premiums. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the annual premium saving Option B offers Fenella over Option A.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less does Option B cost in premiums each year?', fixed: { expected: '$360.00', compute: diff(m(1320.0), m(960.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute each option\'s total cost for Fenella in a year with exactly one claim large enough to exceed both deductibles.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Option A cost in a one-claim year?', fixed: { expected: '$1,820.00', compute: sum(m(1320.0), m(500.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Option B cost in a one-claim year?', fixed: { expected: '$2,460.00', compute: sum(m(960.0), m(1500.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare Fenella\'s two options in a claim year and in a year with no claim at all.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better is Option A in a one-claim year?', fixed: { expected: '$640.00', compute: diff(sum(m(960.0), m(1500.0)), sum(m(1320.0), m(500.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better is Option B in a year with no claim?', fixed: { expected: '$360.00', compute: diff(m(1320.0), m(960.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Each option won a different year.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Recommend one of Fenella\'s options and explain what beliefs about claim frequency and available cash would justify the other.' }] },
    ],
    rubric: [
      crit(
        'Choosing a deductible structure',
        'The response picks an option for Fenella on premium alone.',
        'Both years are computed for Fenella but the recommendation is not justified.',
        'The response recommends one of Fenella\'s options and grounds it in claim likelihood and the ability to pay the higher deductible when needed.',
      ),
    ],
    remediation:
      'If a learner compares only premiums, require both a claim-year and a no-claim-year total for each of Fenella\'s options before any recommendation.',
    extension: 'Ask the learner how many claim-free years would be needed for Option B to come out ahead of Option A over the whole period.',
  },
  {
    key: 'g8-u06-l08',
    authority: 'FIXED',
    character: 'Gulliver',
    objective:
      'Learners compare the cost of invented cover against the value it protects and reason about why the ratio matters.',
    scenario:
      'Gulliver is an invented eighth grader modelling a pretend renters policy at $22.00 a month covering $15,000.00 of invented belongings. All figures are invented for the exercise.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a simulated year of Gulliver\'s invented renters premium.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the policy cost in a year?', fixed: { expected: '$264.00', compute: scale(m(22.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Project Gulliver\'s premium across ten simulated years and compare it with the value protected.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do ten years of premiums come to?', fixed: { expected: '$2,640.00', compute: scale(scale(m(22.0), 12), 10) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much less is that than the $15,000.00 protected?', fixed: { expected: '$12,360.00', compute: diff(m(15000.0), scale(scale(m(22.0), 12), 10)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model a total loss in year three for Gulliver, comparing the protected and unprotected outcomes.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What have premiums cost by the end of year three?', fixed: { expected: '$792.00', compute: scale(scale(m(22.0), 12), 3) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better off is Gulliver than bearing the whole $15,000.00 loss?', fixed: { expected: '$14,208.00', compute: diff(m(15000.0), scale(scale(m(22.0), 12), 3)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Ten years of premiums cost a fraction of the value protected.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Gulliver\'s premium is so much smaller than the protected value, and what that reveals about how insurers price risk.' }] },
    ],
    rubric: [
      crit(
        'Explaining the premium-to-cover ratio',
        'The response treats Gulliver\'s low premium as evidence of poor cover.',
        'The ratio is computed for Gulliver but not explained.',
        'The response explains that a total loss is rare and costs are shared across many policyholders, so Gulliver\'s premium reflects probability rather than the full value protected.',
      ),
    ],
    remediation:
      'If a learner expects the premium to approach the cover value, ask how many policyholders would need to claim in full for that to hold in Gulliver\'s model.',
    extension: 'Ask the learner how many years of Gulliver\'s premiums would equal the protected value, and what that number implies.',
  },
  {
    key: 'g8-u06-l09',
    authority: 'FIXED',
    character: 'Hyacinth',
    objective:
      'Learners apply an invented deductible across multiple claims in a year and compute the policyholder\'s total cost.',
    scenario:
      'Hyacinth is a made-up eighth grader modelling a pretend policy at $110.00 a month with a $750.00 deductible per claim, against two invented claims of $2,200.00 and $900.00 in the same simulated year.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a simulated year of Hyacinth\'s invented premiums.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 12 months of premiums cost?', fixed: { expected: '$1,320.00', compute: scale(m(110.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Apply Hyacinth\'s per-claim deductible to each invented claim and compute what the insurer pays on each.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the insurer pay on the $2,200.00 claim?', fixed: { expected: '$1,450.00', compute: diff(m(2200.0), m(750.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the insurer pay on the $900.00 claim?', fixed: { expected: '$150.00', compute: diff(m(900.0), m(750.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total Hyacinth\'s own costs for the year and compare with bearing both claims unprotected.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is Hyacinth\'s total cost for the year?', fixed: { expected: '$2,820.00', compute: sum(scale(m(110.0), 12), scale(m(750.0), 2)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much better off is that than paying both claims in full?', fixed: { expected: '$280.00', compute: diff(sum(m(2200.0), m(900.0)), sum(scale(m(110.0), 12), scale(m(750.0), 2))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The smaller claim barely paid out at all.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Hyacinth\'s $900.00 claim returned so little, and whether claiming at all on a loss near the deductible is worthwhile.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about claims near the deductible',
        'The response treats every claim in Hyacinth\'s year as equally worth making.',
        'The small payout is noticed for Hyacinth but no consideration beyond the arithmetic is raised.',
        'The response explains that Hyacinth\'s payout barely exceeds the deductible, and weighs the small recovery against consequences such as future premium changes.',
      ),
    ],
    remediation:
      'If a learner applies the deductible once for the year, mark the policy as per-claim and recompute each of Hyacinth\'s claims separately.',
    extension: 'Ask the learner at what claim size Hyacinth\'s payout would exactly equal the deductible, and what that means for claiming.',
  },
  {
    key: 'g8-u06-l10',
    authority: 'FIXED',
    character: 'Ignatius',
    objective:
      'Learners synthesise protection costs and reserve building into a single invented annual plan and evaluate its affordability.',
    scenario:
      'Ignatius is an invented eighth grader building a pretend protection plan: $4,800.00 of annual insurance premiums plus a $9,000.00 emergency reserve target funded at $375.00 a month. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute how long Ignatius\'s invented reserve target takes at $375.00 a month.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'months', text: 'How many whole months to reach the $9,000.00 reserve?', fixed: { expected: '24', compute: reach(m(9000.0), m(375.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute Ignatius\'s first-year reserve contributions and combine them with the annual premiums.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 12 months of reserve contributions come to?', fixed: { expected: '$4,500.00', compute: scale(m(375.0), 12) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the whole first-year plan cost?', fixed: { expected: '$9,300.00', compute: sum(m(4800.0), scale(m(375.0), 12)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Express Ignatius\'s plan on a monthly basis and test it against an invented $3,900.00 monthly income.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the plan cost each month?', fixed: { expected: '$775.00', compute: div(sum(m(4800.0), scale(m(375.0), 12)), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of a $3,900.00 monthly income remains after the plan?', fixed: { expected: '$3,125.00', compute: diff(m(3900.0), div(sum(m(4800.0), scale(m(375.0), 12)), 12)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The plan consumed about a fifth of monthly income.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Evaluate whether Ignatius\'s plan is sustainable on that income, and describe how you would adjust it if it is not.' }] },
    ],
    rubric: [
      crit(
        'Evaluating plan affordability',
        'The response reports Ignatius\'s figures without judging sustainability.',
        'Affordability is asserted for Ignatius but not supported by the share of income.',
        'The response evaluates Ignatius\'s plan against the income share, considers what remains for housing and living costs, and proposes a specific adjustment if it is too heavy.',
      ),
    ],
    remediation:
      'If a learner mixes annual and monthly figures, require every line in Ignatius\'s plan to be converted to the same period before comparison.',
    extension: 'Ask the learner to rebuild Ignatius\'s plan so it costs under $600.00 a month, and to state what is delayed as a result.',
  },
  {
    key: 'g8-u07-l01',
    authority: 'FIXED',
    character: 'Jolanta',
    objective:
      'Learners analyse an invented public budget by category, verify the allocations, and reason about what taxes fund.',
    scenario:
      'Jolanta is a made-up eighth grader studying a pretend community budget of $200,000.00 in simulated funds: $90,000.00 for education, $45,000.00 for roads, $40,000.00 for safety, and $25,000.00 for parks. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Check that Jolanta\'s four invented allocations account for the entire budget.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the four allocations add up to?', fixed: { expected: '$200,000.00', compute: sum(m(90000.0), m(45000.0), m(40000.0), m(25000.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Identify Jolanta\'s largest allocation and compare it with the smallest.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the largest allocation?', fixed: { expected: '$90,000.00', compute: most(m(90000.0), m(45000.0), m(40000.0), m(25000.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much larger is it than the parks allocation?', fixed: { expected: '$65,000.00', compute: diff(most(m(90000.0), m(45000.0), m(40000.0), m(25000.0)), m(25000.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A proposed invented 8% budget cut applies to the whole budget, and Jolanta must find where it lands.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would an 8% cut remove?', fixed: { expected: '$16,000.00', compute: pct(m(200000.0), 800) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'If the whole cut fell on parks, what would remain of the parks allocation?', fixed: { expected: '$9,000.00', compute: diff(m(25000.0), pct(m(200000.0), 800)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The cut would take nearly two-thirds of the parks allocation if it fell there alone.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Recommend how Jolanta\'s community should distribute the $16,000.00 cut, and defend the distribution against those who lose most.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about public allocation',
        'The response distributes Jolanta\'s cut with no reasoning.',
        'A distribution is proposed for Jolanta but no defence is offered.',
        'The response proposes a distribution for Jolanta\'s cut, justifies it in terms of what each category provides, and addresses the position of those who lose most.',
      ),
    ],
    remediation:
      'If a learner computes the cut from a single category, mark that the percentage applies to Jolanta\'s whole budget before any figure is written.',
    extension: 'Ask the learner to distribute Jolanta\'s cut proportionally across all four categories and to state each new allocation.',
  },
  {
    key: 'g8-u07-l02',
    authority: 'FIXED',
    character: 'Kester',
    objective:
      'Learners compute several invented tax types in a single month and see that each is charged on a different base.',
    scenario:
      'Kester is an invented eighth grader tracing a pretend month: $5,000.00 gross pay with 7.65% payroll tax and 12% income tax withholding, an invented $2,400.00 annual property tax, and a $400.00 purchase carrying 7% simulated sales tax.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented payroll and income tax on Kester\'s $5,000.00 gross.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld for simulated payroll tax at 7.65%?', fixed: { expected: '$382.50', compute: pct(m(5000.0), 765) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute Kester\'s income tax withholding and the monthly share of the invented annual property tax.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld for simulated income tax at 12%?', fixed: { expected: '$600.00', compute: pct(m(5000.0), 1200) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly share of the $2,400.00 annual property tax?', fixed: { expected: '$200.00', compute: div(m(2400.0), 12) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute the sales tax on Kester\'s $400.00 purchase and total all the taxes falling in the month.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much simulated sales tax does the purchase carry at 7%?', fixed: { expected: '$28.00', compute: pct(m(400.0), 700) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do all four taxes come to for the month?', fixed: { expected: '$1,210.50', compute: sum(pct(m(5000.0), 765), pct(m(5000.0), 1200), div(m(2400.0), 12), pct(m(400.0), 700)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Four taxes, but fewer bases than there are taxes.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'For each of Kester\'s four taxes, name what it is charged on, and explain why using several bases rather than one is a deliberate design.' }] },
    ],
    rubric: [
      crit(
        'Distinguishing tax bases',
        'The response treats all of Kester\'s taxes as charged on income.',
        'Some bases are identified for Kester but at least one is wrong or missing, or the two wage-based taxes are counted as separate bases.',
        'The response correctly names the base of each of Kester\'s four taxes, notices that the payroll and income taxes are both charged on the same wages, and offers a reason for using several bases, such as spreading the burden or funding different levels of government.',
      ),
    ],
    remediation:
      'If a learner applies the sales tax rate to gross pay, draw Kester\'s month as separate boxes and label which figure each rate applies to.',
    extension: 'Ask the learner what share of Kester\'s gross pay the month\'s taxes represent, and how that share would change if the purchase were larger.',
  },
  {
    key: 'g8-u07-l03',
    authority: 'FIXED',
    character: 'Lucinda',
    objective:
      'Learners compare invented annual withholding against an invented tax liability and compute the refund or amount owed.',
    scenario:
      'Lucinda is a made-up eighth grader modelling a pretend year: $400.00 withheld each month against an invented annual liability of $4,150.00. She also models a lower withholding of $325.00 a month. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute Lucinda\'s total invented withholding across the simulated year at $400.00 a month.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is withheld across the year?', fixed: { expected: '$4,800.00', compute: scale(m(400.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare Lucinda\'s withholding with the $4,150.00 liability and state the resulting position.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What refund results?', fixed: { expected: '$650.00', compute: diff(scale(m(400.0), 12), m(4150.0)) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'What does that comparison mean for Lucinda?',
            choices: ['She owes more tax', 'The amounts match exactly', 'She receives a refund'],
            fixed: { expected: 'She receives a refund', compute: sel(m(4150.0), scale(m(400.0), 12), 'She receives a refund', 'The amounts match exactly', 'She owes more tax') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model Lucinda\'s lower withholding of $325.00 a month against the same liability.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is withheld across the year at the lower rate?', fixed: { expected: '$3,900.00', compute: scale(m(325.0), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would be owed at filing?', fixed: { expected: '$250.00', compute: diff(m(4150.0), scale(m(325.0), 12)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One version produced a refund and the other a bill.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what a large refund actually represents, and argue for the withholding level you would advise Lucinda to choose.' }] },
    ],
    rubric: [
      crit(
        'Interpreting withholding and refunds',
        'The response treats Lucinda\'s refund as extra money earned.',
        'The refund is described for Lucinda as her own money but no advice follows.',
        'The response explains that Lucinda\'s refund is over-withheld income returned without interest, and argues for a withholding level with reasons about cash flow or the risk of a bill.',
      ),
    ],
    remediation:
      'If a learner treats the refund as a gain, mark Lucinda\'s withholding as money already earned before the comparison is made.',
    extension: 'Ask the learner what monthly withholding would leave Lucinda owing nothing and receiving nothing, and to show the method.',
  },
  {
    key: 'g8-u07-l04',
    authority: 'JUDGMENT',
    character: 'Malachy',
    objective:
      'Learners weigh a policy tradeoff over an invented public good, identifying who gains and who bears the cost.',
    scenario:
      'Malachy is an invented eighth grader studying a pretend proposal: fund a new community clinic by raising a local tax, by cutting an existing library service, or by charging users a fee. All options are invented for discussion.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Work through Malachy\'s three invented funding options. For each, identify who pays, who benefits, and who might be excluded.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'For each of Malachy\'s three options, who pays and who could end up excluded from the clinic?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Recommend one of Malachy\'s options and defend it against the strongest objection, taking seriously the interests of those who lose under your choice.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Which option should Malachy\'s community choose, and how does your answer address those who bear the cost?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'A user fee sounds like it charges only those who benefit.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why can a user fee for a clinic produce an outcome the community did not intend?' }],
      },
    ],
    rubric: [
      crit(
        'Analysing who pays and who benefits',
        'The response evaluates Malachy\'s options without identifying who bears each cost.',
        'One option is analysed for Malachy but the others are not.',
        'The response identifies payers, beneficiaries, and potentially excluded groups for each of Malachy\'s three options.',
      ),
      crit(
        'Defending a policy choice',
        'A choice is made for Malachy with no engagement with objections.',
        'An objection is acknowledged for Malachy but not answered.',
        'The response recommends an option for Malachy and answers the strongest objection, addressing the interests of those who bear the cost.',
      ),
    ],
    lookFors: [
      'Identifies who pays under each invented option.',
      'Names a group that could be excluded by a user fee.',
      'Takes a position rather than listing options neutrally.',
      'Engages with the losing side\'s interests.',
    ],
    remediation:
      'If a learner lists options without deciding, ask which group they are willing to disadvantage in Malachy\'s case and why, then build the recommendation from that.',
    extension: 'Ask the learner to design a fourth option for Malachy\'s community that spreads the cost differently, and to name its drawback.',
  },
  {
    key: 'g8-u07-l05',
    authority: 'JUDGMENT',
    character: 'Nadege',
    objective:
      'Learners design a record-keeping system for an invented situation and reason about what deadlines and documentation protect.',
    scenario:
      'Nadege is a made-up eighth grader studying a pretend case: a filing deadline was missed by two weeks, several receipts cannot be found, and one document exists only as a photograph on a phone that has since been replaced. All of it is invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Sort the three problems in Nadege\'s invented case by what each one actually costs: the missed deadline, the lost receipts, and the single-copy document.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What does each of the three problems in Nadege\'s case actually cost, and which is hardest to fix after the fact?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Design a record-keeping system that would have prevented all three problems, specifying what is kept, where, and for how long.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What system would you design, and how does each part prevent one of the three problems?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Only one problem was about time.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why do deadlines and documentation solve different problems, and why does a system need both?' }],
      },
    ],
    rubric: [
      crit(
        'Diagnosing record-keeping failures',
        'The response treats all three problems in Nadege\'s case as the same failure.',
        'The problems are listed for Nadege but not differentiated by cost or reversibility.',
        'The response distinguishes Nadege\'s three problems by what each costs and identifies the lost evidence as the hardest to remedy afterwards.',
      ),
      crit(
        'Designing a preventive system',
        'No system is designed for Nadege, or the design would not prevent any of the problems.',
        'A system is proposed for Nadege but it addresses only one problem.',
        'The response designs a system for Nadege in which each part maps to one of the three problems, specifying what is kept, where, and for how long.',
      ),
    ],
    lookFors: [
      'Separates the deadline failure from the evidence failures.',
      'Identifies the single-copy document as the most fragile.',
      'Specifies retention location and duration.',
      'Maps each part of the system to a problem it prevents.',
    ],
    remediation:
      'If a learner proposes only reminders, ask which of Nadege\'s three problems a reminder would not have prevented, and extend the design from there.',
    extension: 'Ask the learner what Nadege should do now about the missed deadline, and what makes acting quickly matter.',
  },
  {
    key: 'g8-u07-l06',
    authority: 'FIXED',
    character: 'Oisin',
    objective:
      'Learners assemble an invented integrated financial plan from several commitments, verify it against income, and evaluate the remaining margin.',
    scenario:
      'Oisin is an invented eighth grader building a pretend monthly plan on $4,200.00 of income: $1,300.00 housing, $600.00 food, $350.00 transport, $260.00 insurance, a 15% saving commitment, and $400.00 of debt repayment.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute Oisin\'s invented 15% saving commitment from the $4,200.00 income.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the saving commitment come to?', fixed: { expected: '$630.00', compute: pct(m(4200.0), 1500) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total Oisin\'s fixed living commitments before saving and debt, then add those two in.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do housing, food, transport, and insurance come to?', fixed: { expected: '$2,510.00', compute: sum(m(1300.0), m(600.0), m(350.0), m(260.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the whole plan come to?', fixed: { expected: '$3,540.00', compute: sum(m(1300.0), m(600.0), m(350.0), m(260.0), pct(m(4200.0), 1500), m(400.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Check Oisin\'s plan against income and test what a $250.00 rent increase would do.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $4,200.00 income remains unallocated?', fixed: { expected: '$660.00', compute: diff(m(4200.0), sum(m(1300.0), m(600.0), m(350.0), m(260.0), pct(m(4200.0), 1500), m(400.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would remain after a $250.00 rent increase?', fixed: { expected: '$410.00', compute: diff(m(4200.0), sum(m(1550.0), m(600.0), m(350.0), m(260.0), pct(m(4200.0), 1500), m(400.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The plan absorbed the increase without breaking.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Assess the resilience of Oisin\'s plan, naming which commitment you would adjust first if income fell by 10% and why.' }] },
    ],
    rubric: [
      crit(
        'Assessing an integrated plan',
        'The response reports Oisin\'s totals without assessing resilience.',
        'Resilience is asserted for Oisin but no commitment is prioritised for adjustment.',
        'The response evaluates Oisin\'s remaining margin against a 10% income fall and names which commitment to adjust first, with reasons about necessity and reversibility.',
      ),
    ],
    remediation:
      'If a learner applies the saving percentage to the remainder, mark Oisin\'s income as the base for the commitment before any total is formed.',
    extension: 'Ask the learner to rebuild Oisin\'s plan at $3,780.00 of income while keeping the saving commitment intact, and to show each line.',
  },
  {
    key: 'g8-u07-l07',
    authority: 'FIXED',
    character: 'Perpetua',
    objective:
      'Learners compute tax under an invented flat structure and an invented graduated structure and compare the burden at two income levels.',
    scenario:
      'Perpetua is a made-up eighth grader comparing two pretend tax designs on monthly income. The flat design charges 10% of all income. The graduated design charges 5% on the first $3,000.00 and 20% on anything above. She tests incomes of $3,000.00 and $6,000.00. All rates are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute Perpetua\'s invented flat tax at both income levels.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the flat design charge on $6,000.00?', fixed: { expected: '$600.00', compute: pct(m(6000.0), 1000) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute Perpetua\'s graduated design on the $3,000.00 income, where only the lower band applies.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the graduated design charge on $3,000.00?', fixed: { expected: '$150.00', compute: pct(m(3000.0), 500) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the flat design charge on $3,000.00?', fixed: { expected: '$300.00', compute: pct(m(3000.0), 1000) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute the graduated design on $6,000.00, applying 5% to the first $3,000.00 and 20% to the rest.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the graduated design charge on $6,000.00?', fixed: { expected: '$750.00', compute: sum(pct(m(3000.0), 500), pct(m(3000.0), 2000)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more is that than the flat design at the same income?', fixed: { expected: '$150.00', compute: diff(sum(pct(m(3000.0), 500), pct(m(3000.0), 2000)), pct(m(6000.0), 1000)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The two designs swapped which earner they favoured.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Perpetua\'s four figures, describe how each design distributes the burden and argue for the one you find more defensible.' }] },
    ],
    rubric: [
      crit(
        'Comparing tax structures',
        'The response describes only one of Perpetua\'s designs, or asserts a preference without figures.',
        'Both designs are computed for Perpetua but the distribution of burden is not analysed.',
        'The response uses all four of Perpetua\'s figures to show how each design shifts the burden between income levels, and argues a position with reasons.',
      ),
    ],
    remediation:
      'If a learner applies the higher band rate to all income, mark the band boundary in Perpetua\'s design and compute each band separately.',
    extension: 'Ask the learner at what income Perpetua\'s two designs would charge exactly the same, and to show the method.',
  },
  {
    key: 'g8-u07-l08',
    authority: 'FIXED',
    character: 'Quintus',
    objective:
      'Learners re-practise computing invented sales, excise, and property taxes on their different bases.',
    scenario:
      'Quintus is an invented eighth grader computing three pretend taxes: 6.25% sales tax on a $320.00 purchase, an invented excise charge of $0.18 per unit on 400 units, and 1.2% property tax on an invented $150,000.00 valuation. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the invented sales tax on Quintus\'s $320.00 purchase at 6.25%.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much sales tax is charged?', fixed: { expected: '$20.00', compute: pct(m(320.0), 625) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute Quintus\'s invented excise charge on 400 units and the property tax on the stated valuation.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the excise charge come to on 400 units?', fixed: { expected: '$72.00', compute: scale(m(0.18), 400) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the 1.2% property tax come to?', fixed: { expected: '$1,800.00', compute: pct(m(150000.0), 120) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total Quintus\'s three taxes and express the property tax on a monthly basis.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do all three taxes come to?', fixed: { expected: '$1,892.00', compute: sum(pct(m(320.0), 625), scale(m(0.18), 400), pct(m(150000.0), 120)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly share of the property tax?', fixed: { expected: '$150.00', compute: div(pct(m(150000.0), 120), 12) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'One tax was charged per unit rather than per dollar.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain how Quintus\'s excise charge differs from a percentage tax, and what happens to its real burden when prices rise.' }] },
    ],
    rubric: [
      crit(
        'Distinguishing per-unit from percentage taxes',
        'The response treats Quintus\'s excise charge as a percentage.',
        'The difference is asserted for Quintus but the effect of rising prices is not addressed.',
        'The response explains that Quintus\'s excise is fixed per unit regardless of price, so its share of a purchase falls as prices rise unless the charge is changed.',
      ),
    ],
    remediation:
      'If a learner applies a percentage to the unit count, label each of Quintus\'s taxes with its base before any computation.',
    extension: 'Ask the learner what excise rate per unit would raise the same amount as the sales tax on Quintus\'s purchase.',
  },
  {
    key: 'g8-u07-l09',
    authority: 'FIXED',
    character: 'Rhiannon',
    objective:
      'Learners compute invented withholding across a year, compare it with a liability, and evaluate the size of the resulting refund.',
    scenario:
      'Rhiannon is a made-up eighth grader modelling a pretend year: $3,800.00 monthly gross with 14% withheld, against an invented annual liability of $5,900.00. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute Rhiannon\'s invented monthly withholding at 14% of $3,800.00.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is withheld each month?', fixed: { expected: '$532.00', compute: pct(m(3800.0), 1400) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Project Rhiannon\'s withholding across the year and compare it with the $5,900.00 liability.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is withheld across the year?', fixed: { expected: '$6,384.00', compute: scale(pct(m(3800.0), 1400), 12) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What refund results?', fixed: { expected: '$484.00', compute: diff(scale(pct(m(3800.0), 1400), 12), m(5900.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Work out what monthly withholding would have matched the liability exactly, and how much extra was withheld each month.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly withholding would have matched the liability?', fixed: { expected: '$491.67', compute: div(m(5900.0), 12, 'half-up'), note: 'The exact share is $491.666..., rounded to the cent.' } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much extra was withheld each month?', fixed: { expected: '$40.33', compute: diff(pct(m(3800.0), 1400), div(m(5900.0), 12, 'half-up')) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The refund arrived as a lump, having left as small monthly amounts.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Argue whether Rhiannon should adjust her withholding, weighing the value of $40.33 a month against the discipline of a lump-sum refund.' }] },
    ],
    rubric: [
      crit(
        'Evaluating a withholding level',
        'The response treats Rhiannon\'s refund as free money or as automatically bad.',
        'A position is taken for Rhiannon but the monthly figure is not used.',
        'The response weighs Rhiannon\'s $40.33 monthly amount against the behavioural value of a lump refund and reaches a defended position.',
      ),
    ],
    remediation:
      'If a learner computes the refund before the annual withholding, require Rhiannon\'s annual total to be written and boxed before any comparison.',
    extension: 'Ask the learner what withholding percentage would match Rhiannon\'s liability most closely, and to show the method.',
  },
  {
    key: 'g8-u07-l10',
    authority: 'JUDGMENT',
    character: 'Sabelo',
    objective:
      'Learners synthesise the case for and against funding an invented public good collectively, and articulate a defensible position.',
    scenario:
      'Sabelo is an invented eighth grader preparing a pretend position paper on whether a community should fund an invented flood-defence project through taxes, when only some households are at risk but everyone would pay.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Set out the strongest case on each side of Sabelo\'s invented question, without indicating which one you favour. Each case should be one a reasonable person could hold.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What is the strongest argument for collective funding in Sabelo\'s case, and the strongest argument against?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Take a position and defend it, addressing directly the households that would pay without being at risk.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should Sabelo\'s community do, and how does your position answer households that pay without direct benefit?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Flood damage does not stay inside property lines.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'How does the way a risk spreads affect whether it should be funded collectively?' }],
      },
    ],
    rubric: [
      crit(
        'Representing both sides fairly',
        'The response caricatures one side of Sabelo\'s question.',
        'Both sides are stated for Sabelo but one is noticeably weaker than it could be.',
        'The response gives the strongest available case on each side of Sabelo\'s question, in terms a holder of that view would accept.',
      ),
      crit(
        'Defending a position',
        'A position is asserted for Sabelo with no engagement with the objection.',
        'The objection is acknowledged for Sabelo but not answered.',
        'The response defends a position and answers the objection from households paying without direct benefit, using the way the risk spreads as part of the reasoning.',
      ),
    ],
    lookFors: [
      'States both sides in their strongest form.',
      'Takes a clear position rather than surveying.',
      'Addresses households that pay without direct benefit.',
      'Uses the spread of the risk in the reasoning.',
    ],
    remediation:
      'If a learner writes only one side, have them argue Sabelo\'s opposite position in three sentences before writing their own.',
    extension: 'Ask the learner to propose a funding split for Sabelo\'s project that reflects differing exposure, and to name its weakness.',
  },
  {
    key: 'g8-u07-l11',
    authority: 'FIXED',
    character: 'Tullia',
    objective:
      'Learners quantify the financial cost of missing records by computing the tax effect of claimable and unclaimable expenses.',
    scenario:
      'Tullia is an invented eighth grader completing a pretend assessment: $3,600.00 of invented deductible expenses across a simulated year, of which $900.00 has no supporting record. The invented tax rate is 22%. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute how much of Tullia\'s invented expenses can actually be supported by records.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the expenses is documented?', fixed: { expected: '$2,700.00', compute: diff(m(3600.0), m(900.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the invented 22% tax effect of the documented expenses and of the full amount, keeping both figures.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the tax effect of the documented expenses?', fixed: { expected: '$594.00', compute: pct(diff(m(3600.0), m(900.0)), 2200) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the tax effect have been with full records?', fixed: { expected: '$792.00', compute: pct(m(3600.0), 2200) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Quantify what Tullia\'s missing records cost, and project the same failure across three simulated years.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the missing records cost this year?', fixed: { expected: '$198.00', compute: diff(pct(m(3600.0), 2200), pct(diff(m(3600.0), m(900.0)), 2200)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the same failure cost across three years?', fixed: { expected: '$594.00', compute: scale(diff(pct(m(3600.0), 2200), pct(diff(m(3600.0), m(900.0)), 2200)), 3) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The lost benefit was smaller than the expenses themselves.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Tullia\'s missing records cost $198.00 rather than $900.00, and design the minimum record-keeping habit that would prevent it.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about the value of records',
        'The response treats Tullia\'s missing $900.00 as the amount lost.',
        'The tax effect is computed for Tullia but not explained.',
        'The response explains that Tullia loses only the tax effect of the undocumented expenses, not their full value, and designs a minimum habit that would prevent the loss.',
      ),
    ],
    remediation:
      'If a learner reports the full expense as the loss, compute Tullia\'s two tax effects side by side and subtract before drawing any conclusion.',
    extension: 'Ask the learner what level of missing records would cost Tullia over $300.00 in a year, and to show the reasoning.',
  },
]
