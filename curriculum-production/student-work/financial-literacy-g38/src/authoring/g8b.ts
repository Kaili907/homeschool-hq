import type { AuthoredLesson } from '../types.ts'
import { crit, diff, div, grow, m, pct, reach, scale, sel, sum } from './dsl.ts'

/** Grade 8 Financial Literacy, units 2-3 (PF2 buying goods and services, PF3 budgeting and saving). */
export const G8B: readonly AuthoredLesson[] = [
  {
    key: 'g8-u02-l01',
    authority: 'FIXED',
    character: 'Kalinda',
    objective:
      'Learners compare two invented uses of the same simulated funds, compute what each leaves, and identify the opportunity cost beyond the cash difference.',
    scenario:
      'Kalinda is a made-up eighth grader with $3,000.00 of simulated savings. Option A is an invented $1,850.00 certification course. Option B is a $900.00 laptop plus $1,100.00 of travel. Only one is possible.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Total Kalinda\'s Option B, which has two invented parts.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does Option B cost in total?', fixed: { expected: '$2,000.00', compute: sum(m(900.0), m(1100.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Work out what each of Kalinda\'s options leaves from the $3,000.00, keeping the two figures side by side.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What remains after Option A?', fixed: { expected: '$1,150.00', compute: diff(m(3000.0), m(1850.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What remains after Option B?', fixed: { expected: '$1,000.00', compute: diff(m(3000.0), sum(m(900.0), m(1100.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Kalinda takes Option A. Quantify the cash difference and the value of the single largest item forgone.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much more does Option A leave than Option B?', fixed: { expected: '$150.00', compute: diff(diff(m(3000.0), m(1850.0)), diff(m(3000.0), sum(m(900.0), m(1100.0)))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the value of the travel Kalinda gave up?', fixed: { expected: '$1,100.00', compute: m(1100.0) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The cash difference was small; the things bought were not comparable.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why the $150.00 difference is a weak basis for Kalinda\'s decision, and identify what would actually settle it.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about opportunity cost',
        'The response settles Kalinda\'s choice on the leftover cash alone.',
        'What is forgone is mentioned for Kalinda but not weighed against what is gained.',
        'The response identifies what Kalinda forgoes under each option and argues that the decision turns on the value of what each option buys, not on the cash residue.',
      ),
    ],
    remediation:
      'If a learner compares only residues, require what each of Kalinda\'s options delivers to be written in words beside its cost before any comparison.',
    extension: 'Ask the learner to design a third option under $3,000.00 that would be harder for Kalinda to reject than either, and to defend it.',
  },
  {
    key: 'g8-u02-l02',
    authority: 'FIXED',
    character: 'Lorcan',
    objective:
      'Learners normalise invented package prices to a common unit, choose the better value, and quantify the saving at a realistic order size.',
    scenario:
      'Lorcan is an invented eighth grader comparing pretend bulk options: 2.4 kilograms for $18.96 and 5 kilograms for $37.50. Working in 100-gram units, that is 24 units and 50 units respectively. All prices are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Lorcan\'s 2.4-kilogram package, which is 24 hundred-gram units, into a price per unit.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD per 100 g', text: 'What is the price per 100 grams in the smaller package?', fixed: { expected: '$0.79', compute: div(m(18.96), 24) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert the 5-kilogram package, which is 50 units, the same way, then compare Lorcan\'s two normalised prices.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD per 100 g', text: 'What is the price per 100 grams in the larger package?', fixed: { expected: '$0.75', compute: div(m(37.5), 50) } },
          {
            ref: 't2-p2',
            promptType: 'fixed-choice',
            text: 'Which package is the better value per 100 grams?',
            choices: ['The 2.4-kilogram package', 'The 5-kilogram package', 'They are equal per unit'],
            fixed: { expected: 'The 5-kilogram package', compute: sel(div(m(37.5), 50), div(m(18.96), 24), 'The 5-kilogram package', 'They are equal per unit', 'The 2.4-kilogram package') },
          },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Lorcan needs 10 kilograms, which is 100 hundred-gram units, and either package can be bought repeatedly at its own rate.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would 10 kilograms cost at the better rate?', fixed: { expected: '$75.00', compute: scale(div(m(37.5), 50), 100) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the better rate save on that order?', fixed: { expected: '$4.00', compute: diff(scale(div(m(18.96), 24), 100), scale(div(m(37.5), 50), 100)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Four dollars on a seventy-five dollar order is a thin margin.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Name two costs of buying in bulk that Lorcan\'s unit-price comparison ignores, and say when they would outweigh the $4.00 saving.' }] },
    ],
    rubric: [
      crit(
        'Limiting unit-price reasoning',
        'The response treats the lower unit price as always correct for Lorcan.',
        'One hidden cost is named for Lorcan but not weighed against the saving.',
        'The response names concrete costs such as spoilage, storage, or cash tied up, and states conditions under which they exceed Lorcan\'s $4.00 saving.',
      ),
    ],
    remediation:
      'If a learner compares package totals, require both of Lorcan\'s options to be written as a price per 100 grams before any comparison is stated.',
    extension: 'Ask the learner what a 1-kilogram package would need to cost to beat Lorcan\'s best rate, and to prove it.',
  },
  {
    key: 'g8-u02-l03',
    authority: 'FIXED',
    character: 'Mireille',
    objective:
      'Learners compare invented subscription structures and evaluate an extended warranty against the cost it is meant to cover.',
    scenario:
      'Mireille is a made-up eighth grader comparing pretend options: a $24.99 monthly subscription or $249.00 for a simulated year, and an invented $89.00 extended warranty covering a repair that would otherwise cost $260.00.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a full simulated year of Mireille\'s invented monthly subscription.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 12 monthly payments come to?', fixed: { expected: '$299.88', compute: scale(m(24.99), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compare that with the $249.00 annual price, then turn to the invented warranty and what it saves if the repair happens.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much cheaper is the annual plan over a full year?', fixed: { expected: '$50.88', compute: diff(scale(m(24.99), 12), m(249.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'If the repair happens, how much does the warranty save?', fixed: { expected: '$171.00', compute: diff(m(260.0), m(89.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model the case where Mireille buys the warranty and the repair never happens, and the case where she pays monthly for only 7 months.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the warranty cost if no repair is ever needed?', fixed: { expected: '$89.00', compute: m(89.0) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 7 monthly subscription payments come to?', fixed: { expected: '$174.93', compute: scale(m(24.99), 7) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Both decisions depend on something not yet known.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what unknown each of Mireille\'s two decisions depends on, and how she should decide when the unknown cannot be resolved in advance.' }] },
    ],
    rubric: [
      crit(
        'Deciding under uncertainty',
        'The response picks options for Mireille as if the outcomes were known.',
        'The uncertainty is noted for Mireille but no decision rule is offered.',
        'The response identifies the length of use and the chance of a repair as Mireille\'s unknowns, and offers a rule such as choosing the option that limits the worst outcome.',
      ),
    ],
    remediation:
      'If a learner assumes full-year use, compute Mireille\'s cost per month actually used under each plan before any recommendation.',
    extension: 'Ask the learner how likely the repair would have to be for Mireille\'s warranty to be worth buying on average, and to justify the reasoning.',
  },
  {
    key: 'g8-u02-l04',
    authority: 'JUDGMENT',
    character: 'Nikolai',
    objective:
      'Learners identify behavioural techniques in invented marketing and explain the mechanism each one uses rather than judging the product.',
    scenario:
      'Nikolai is an invented eighth grader analysing three pretend techniques on a made-up shopping site: a countdown timer on a cart, a default add-on already selected at checkout, and a display showing that 40 other people are viewing the item. All are invented for study.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Work through Nikolai\'s three invented techniques one at a time. Each targets a different tendency. Name the mechanism before saying whether the technique is acceptable.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What tendency does each of Nikolai\'s three techniques target, and how does each one work on a shopper?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Rank Nikolai\'s three techniques from most to least acceptable and defend the ranking, distinguishing persuasion from removing a real choice.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Rank the three techniques by acceptability and justify the ranking, saying where persuasion crosses into taking a decision away.' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'One technique changed what happens if the shopper does nothing.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is a pre-selected default more powerful than an equally visible option the shopper must choose?' }],
      },
    ],
    rubric: [
      crit(
        'Identifying behavioural mechanisms',
        'The response judges Nikolai\'s products rather than naming any mechanism.',
        'One mechanism is named for Nikolai but the others are described only as pushy.',
        'The response names a distinct mechanism for each of Nikolai\'s techniques, such as manufactured urgency, default bias, and social proof, and explains how each operates.',
      ),
      crit(
        'Distinguishing persuasion from removed choice',
        'The response treats all three of Nikolai\'s techniques as equally fine or equally wrong.',
        'A ranking is given for Nikolai but the justification does not turn on choice.',
        'The response ranks Nikolai\'s techniques with a justification grounded in whether the shopper retains a real decision, singling out the pre-selected default.',
      ),
    ],
    lookFors: [
      'Names urgency, default bias, and social proof as distinct mechanisms.',
      'Explains why a default changes the outcome of inaction.',
      'Produces a ranking with a stated principle behind it.',
      'Separates the technique from the quality of the product.',
    ],
    remediation:
      'If a learner rates the products, hide the product details and have them describe only what each of Nikolai\'s techniques does to the shopper.',
    extension: 'Ask the learner to redesign Nikolai\'s checkout so it informs without steering, and to say what they removed.',
  },
  {
    key: 'g8-u02-l05',
    authority: 'JUDGMENT',
    character: 'Ondine',
    objective:
      'Learners construct an escalation path for an invented consumer dispute and identify what evidence supports each step.',
    scenario:
      'Ondine is a made-up eighth grader studying a pretend dispute: a $340.00 invented appliance failed in week three, the seller refers the buyer to the manufacturer, the manufacturer refers them back, and the buyer holds a receipt and a dated fault video.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Lay out Ondine\'s invented dispute: what the buyer paid for, what failed, what evidence exists, and what each party is claiming. Keep evidence separate from assertion.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What evidence does the buyer in Ondine\'s case hold, and what does each piece establish?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Set out the buyer\'s steps in order, from first contact to external escalation, and say what each communication should contain and what it should request.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What steps should the buyer take, in what order, and what should each one contain and ask for?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'Both parties pointed at each other.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why is being passed between seller and manufacturer itself a fact worth recording?' }],
      },
    ],
    rubric: [
      crit(
        'Building an evidence-led case',
        'The response relies on frustration rather than on evidence in Ondine\'s case.',
        'Evidence is mentioned for Ondine but not tied to what it proves.',
        'The response links each piece of Ondine\'s evidence to what it establishes, such as the receipt proving purchase and the dated video proving early failure.',
      ),
      crit(
        'Escalating in a defensible order',
        'The response escalates immediately or gives up on Ondine\'s case.',
        'Steps are listed for Ondine but without content or ordering rationale.',
        'The response orders Ondine\'s steps from a written request to the seller through to an external body, and states what each communication should contain and request.',
      ),
    ],
    lookFors: [
      'Ties the receipt and the dated video to specific claims.',
      'Puts a written, dated request to the seller first.',
      'Records the referrals between the parties as evidence.',
      'Names a concrete external escalation route.',
    ],
    remediation:
      'If a learner starts with an external complaint, ask what that body would ask to see first, and rebuild the order from that answer.',
    extension: 'Ask the learner to draft the opening paragraph of the buyer\'s written request in Ondine\'s case.',
  },
  {
    key: 'g8-u02-l06',
    authority: 'JUDGMENT',
    character: 'Pascale',
    objective:
      'Learners analyse an invented multi-channel scam, identify the mechanism behind each stage, and choose a response that stops the chain.',
    scenario:
      'Pascale is an invented eighth grader studying a pretend sequence: an email warns of unusual activity, a call follows within minutes claiming to be the bank, and the caller asks the household to move money to a safe account. All of it is invented for study.',
    tasks: [
      {
        taskId: 't1',
        kind: 'guided',
        directions:
          'Break Pascale\'s invented sequence into its stages. Each stage prepares the next. Explain what each stage is designed to achieve before deciding anything.',
        prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'What does each stage of Pascale\'s invented sequence achieve, and why does the call arrive so soon after the email?' }],
      },
      {
        taskId: 't2',
        kind: 'independent',
        directions:
          'Write what the household should do at the moment of the call, and explain why a request to move money to a safe account is decisive on its own.',
        prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'What should the household do, and why does the safe-account request settle the question regardless of how convincing the caller is?' }],
      },
      {
        taskId: 't3',
        kind: 'reflection',
        directions: 'The caller knew details from the email.',
        prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Why does a caller knowing accurate details prove nothing about who they are?' }],
      },
    ],
    rubric: [
      crit(
        'Analysing a staged scam',
        'The response treats each stage of Pascale\'s sequence as unrelated.',
        'The sequence is noticed for Pascale but the purpose of the email is not identified.',
        'The response explains that the email in Pascale\'s case primes alarm so the call is expected, and identifies the whole sequence as a single designed chain.',
      ),
      crit(
        'Stopping the chain',
        'The response has the household comply or negotiate with the caller.',
        'The call is doubted for Pascale but no independent verification step is given.',
        'The response has the household end the call and verify through an independently obtained number, treating the safe-account request as decisive.',
      ),
    ],
    lookFors: [
      'Identifies the email as priming for the call.',
      'Treats the safe-account request as conclusive on its own.',
      'Verifies through a channel not supplied by the contact.',
      'States that accurate details do not authenticate a caller.',
    ],
    remediation:
      'If a learner focuses on how convincing the caller sounds, ask what a genuine institution would never need the household to do, and rebuild from that.',
    extension: 'Ask the learner to write the household rule that would defeat every version of Pascale\'s sequence.',
    safetyNotes: ['Never move money or share credentials because of an incoming call or message; this sequence is invented for study.'],
  },
  {
    key: 'g8-u02-l07',
    authority: 'FIXED',
    character: 'Quentin',
    objective:
      'Learners quantify the earnings from an invented part-time commitment and the hours it consumes, in order to price a non-money tradeoff.',
    scenario:
      'Quentin is a made-up eighth grader investigating a pretend part-time job: 4 hours a week at $15.00 an hour, over 30 simulated weeks of the school year. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute Quentin\'s invented weekly earnings from 4 hours at $15.00 an hour.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the job pay each week?', fixed: { expected: '$60.00', compute: scale(m(15.0), 4) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Project the earnings and the hours across the 30 invented weeks, keeping money and time as separate quantities.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the job pay across 30 weeks?', fixed: { expected: '$1,800.00', compute: scale(scale(m(15.0), 4), 30) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'hours', text: 'How many hours does the job consume across 30 weeks?', fixed: { expected: '120', compute: scale({ op: 'count', n: 4 }, 30) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model a second invented offer of 6 hours a week at $13.00 an hour over the same 30 weeks.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the second offer pay across 30 weeks?', fixed: { expected: '$2,340.00', compute: scale(scale(m(13.0), 6), 30) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'hours', text: 'How many more hours would the second offer consume across 30 weeks?', fixed: { expected: '60', compute: diff(scale({ op: 'count', n: 6 }, 30), scale({ op: 'count', n: 4 }, 30)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The better-paying offer cost more of something that cannot be bought back.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Quentin\'s figures, explain how to weigh $540.00 of extra earnings against 60 extra hours, and what information would settle it.' }] },
    ],
    rubric: [
      crit(
        'Pricing a time tradeoff',
        'The response chooses for Quentin on pay alone.',
        'Both quantities are noted for Quentin but not compared as a tradeoff.',
        'The response compares Quentin\'s extra earnings against the extra hours, converts one into terms of the other, and names what would settle it, such as what those hours would otherwise be used for.',
      ),
    ],
    remediation:
      'If a learner merges hours and money, keep two labelled columns for Quentin and require both to be filled before any comparison.',
    extension: 'Ask the learner what hourly rate would make Quentin\'s two offers equally attractive per hour worked, and to show the method.',
  },
  {
    key: 'g8-u02-l08',
    authority: 'FIXED',
    character: 'Rosalie',
    objective:
      'Learners re-practise unit-price conversion on invented liquid measures and apply the better rate to a larger requirement.',
    scenario:
      'Rosalie is an invented eighth grader comparing two pretend bottles: 900 millilitres for $6.30 and 1.5 litres for $9.75. Working in 100-millilitre units, that is 9 units and 15 units. All prices are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Rosalie\'s 900-millilitre bottle, which is 9 units, into a price per 100 millilitres.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD per 100 mL', text: 'What is the price per 100 millilitres in the smaller bottle?', fixed: { expected: '$0.70', compute: div(m(6.3), 9) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert the 1.5-litre bottle, which is 15 units, and compare Rosalie\'s two normalised prices.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD per 100 mL', text: 'What is the price per 100 millilitres in the larger bottle?', fixed: { expected: '$0.65', compute: div(m(9.75), 15) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD per 100 mL', text: 'How much lower is the better rate per 100 millilitres?', fixed: { expected: '$0.05', compute: diff(div(m(6.3), 9), div(m(9.75), 15)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Rosalie needs 3 litres, which is 30 hundred-millilitre units, and either bottle can be bought repeatedly.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would 3 litres cost at the better rate?', fixed: { expected: '$19.50', compute: scale(div(m(9.75), 15), 30) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does the better rate save on 3 litres?', fixed: { expected: '$1.50', compute: diff(scale(div(m(6.3), 9), 30), scale(div(m(9.75), 15), 30)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The rate gap was five cents per unit.', prompts: [{ ref: 't4-p1', promptType: 'short-response', text: 'Explain the general method Rosalie used, in a form that would work for any two package sizes.' }] },
    ],
    rubric: [
      crit(
        'Generalising the unit-price method',
        'The response restates Rosalie\'s answers without describing a method.',
        'A method is described for Rosalie but tied to these specific bottles.',
        'The response states a general method, dividing price by the number of common units and comparing the results, that would apply to any two package sizes.',
      ),
    ],
    remediation:
      'If a learner divides by the raw millilitres, agree the common unit for Rosalie first and count how many of that unit each bottle holds.',
    extension: 'Ask the learner what a 2-litre bottle would need to cost to beat Rosalie\'s best rate, and to show the reasoning.',
  },
  {
    key: 'g8-u02-l09',
    authority: 'FIXED',
    character: 'Sacha',
    objective:
      'Learners compute the cost of exiting an invented fixed-term contract early and compare it with completing the term.',
    scenario:
      'Sacha is a made-up eighth grader modelling a pretend 12-month membership at $39.00 a month with an invented early-exit penalty of three monthly payments. Sacha cancels after 5 months. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute what Sacha has already paid across the first 5 invented months.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What has been paid in the first 5 months?', fixed: { expected: '$195.00', compute: scale(m(39.0), 5) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the invented penalty of three monthly payments, then the total cost of exiting early.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the early-exit penalty?', fixed: { expected: '$117.00', compute: scale(m(39.0), 3) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What does exiting early cost in total?', fixed: { expected: '$312.00', compute: sum(scale(m(39.0), 5), scale(m(39.0), 3)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare that with completing all 12 invented months.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does completing the full term cost?', fixed: { expected: '$468.00', compute: scale(m(39.0), 12) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much does exiting early save against completing the term?', fixed: { expected: '$156.00', compute: diff(scale(m(39.0), 12), sum(scale(m(39.0), 5), scale(m(39.0), 3))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Leaving early still cost three months of nothing.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Sacha\'s figures, explain what the penalty clause is protecting and what a buyer should check before signing a fixed-term agreement.' }] },
    ],
    rubric: [
      crit(
        'Evaluating a fixed-term commitment',
        'The response treats Sacha\'s penalty as arbitrary or ignores it.',
        'The penalty is computed for Sacha but no pre-signing check is proposed.',
        'The response explains that the penalty protects the provider\'s expected revenue, and names checks Sacha should make before signing, such as the exit terms and the realistic length of use.',
      ),
    ],
    remediation:
      'If a learner counts the penalty months as service received, label Sacha\'s months paid-for-use and paid-as-penalty before totalling.',
    extension: 'Ask the learner after how many months exiting early would no longer save Sacha anything, and to justify the answer.',
  },
  {
    key: 'g8-u02-l10',
    authority: 'FIXED',
    character: 'Thandiwe',
    objective:
      'Learners quantify the cumulative cost of invented unplanned purchases and evaluate what a partial reduction would be worth.',
    scenario:
      'Thandiwe is an invented eighth grader tracking a pretend pattern: 3 unplanned purchases a month averaging $42.50 each, prompted by targeted advertising. All figures are invented for practice.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute Thandiwe\'s invented monthly total from 3 purchases at $42.50 each.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the unplanned purchases cost each month?', fixed: { expected: '$127.50', compute: scale(m(42.5), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Project the pattern across a simulated year, then compute what halving the number of purchases would save.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the pattern cost across 12 months?', fixed: { expected: '$1,530.00', compute: scale(scale(m(42.5), 3), 12) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the annual cost be at 1 such purchase a month?', fixed: { expected: '$510.00', compute: scale(m(42.5), 12) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Quantify the annual saving from the reduction and express it as a share of a monthly figure.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much would the reduction save across a year?', fixed: { expected: '$1,020.00', compute: diff(scale(scale(m(42.5), 3), 12), scale(m(42.5), 12)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is that saving per month on average?', fixed: { expected: '$85.00', compute: div(diff(scale(scale(m(42.5), 3), 12), scale(m(42.5), 12)), 12) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'No single purchase looked significant.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain why Thandiwe\'s pattern is invisible at the level of one purchase, and design a practical check that would surface it.' }] },
    ],
    rubric: [
      crit(
        'Making a spending pattern visible',
        'The response treats each of Thandiwe\'s purchases in isolation.',
        'The annual figure is cited for Thandiwe but no check is designed.',
        'The response explains that each purchase is small relative to a month while the pattern is large relative to a year, and designs a concrete check such as a monthly tally or a waiting rule.',
      ),
    ],
    remediation:
      'If a learner scales incorrectly, compute Thandiwe\'s monthly figure first and box it before any annual projection is attempted.',
    extension: 'Ask the learner what the pattern would have to fall to for Thandiwe to save $1,200.00 a year, and to show the reasoning.',
  },
  {
    key: 'g8-u03-l01',
    authority: 'FIXED',
    character: 'Ulric',
    objective:
      'Learners compute invented net cash flow across months including a deficit, and evaluate the combined position rather than any single month.',
    scenario:
      'Ulric is a made-up eighth grader preparing a pretend cash-flow statement. Invented month one has inflows of $3,450.00 against outflows of $3,620.00; month two has inflows of $3,900.00 with outflows unchanged.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the net cash flow for Ulric\'s invented month one.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net cash flow in month one?', fixed: { expected: '-$170.00', compute: diff(m(3450.0), m(3620.0)), note: 'A negative result means outflows exceeded inflows and the gap had to be met from savings or credit.' } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute month two\'s net cash flow and then the combined position across both invented months.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net cash flow in month two?', fixed: { expected: '$280.00', compute: diff(m(3900.0), m(3620.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the combined position across both months?', fixed: { expected: '$110.00', compute: sum(diff(m(3450.0), m(3620.0)), diff(m(3900.0), m(3620.0))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'A third invented month brings inflows of $3,300.00 with outflows unchanged.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net cash flow in month three?', fixed: { expected: '-$320.00', compute: diff(m(3300.0), m(3620.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the combined position across all three months?', fixed: { expected: '-$210.00', compute: sum(diff(m(3450.0), m(3620.0)), diff(m(3900.0), m(3620.0)), diff(m(3300.0), m(3620.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Outflows never moved across the three months.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Ulric\'s figures, explain what is driving the deficit and why fixing it on the outflow side may be more reliable than hoping for a strong month.' }] },
    ],
    rubric: [
      crit(
        'Diagnosing a recurring deficit',
        'The response blames a single weak month in Ulric\'s statement.',
        'Variable inflows are noted for Ulric but the constant outflow level is not examined.',
        'The response identifies Ulric\'s outflow level as fixed against variable inflows, and argues that adjusting outflows or building a buffer is more reliable than counting on strong months.',
      ),
    ],
    remediation:
      'If a learner drops signs, require Ulric\'s inflows and outflows to be written in two columns with the direction of each difference marked.',
    extension: 'Ask the learner what outflow level would leave all three of Ulric\'s months non-negative, and to show the reasoning.',
  },
  {
    key: 'g8-u03-l02',
    authority: 'FIXED',
    character: 'Vashti',
    objective:
      'Learners classify invented expenses, convert a periodic cost to a monthly equivalent, and test the resulting budget against income.',
    scenario:
      'Vashti is an invented eighth grader modelling a pretend month: $1,850.00 of fixed housing, variable costs of $620.00 and $310.00, and an invented $1,440.00 annual insurance bill. Monthly income is $3,200.00.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Vashti\'s invented annual insurance bill into a monthly equivalent.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly equivalent of the $1,440.00 annual bill?', fixed: { expected: '$120.00', compute: div(m(1440.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Total Vashti\'s variable costs, then build a full monthly figure including fixed, variable, and the periodic equivalent.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the variable costs come to?', fixed: { expected: '$930.00', compute: sum(m(620.0), m(310.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the full monthly cost?', fixed: { expected: '$2,900.00', compute: sum(m(1850.0), m(620.0), m(310.0), div(m(1440.0), 12)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare that with Vashti\'s $3,200.00 income, then model the month in which the annual bill actually lands with nothing set aside.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is left each month with the periodic cost spread?', fixed: { expected: '$300.00', compute: diff(m(3200.0), sum(m(1850.0), m(620.0), m(310.0), div(m(1440.0), 12))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net position in the bill month with nothing set aside?', fixed: { expected: '-$1,020.00', compute: diff(m(3200.0), sum(m(1850.0), m(620.0), m(310.0), m(1440.0))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The same year produced both results.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain, using Vashti\'s two figures, why spreading a periodic cost changes the experience of the year without changing the total paid.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about periodic costs',
        'The response treats Vashti\'s annual bill as an unpredictable shock.',
        'Spreading is described for Vashti but the two results are not connected.',
        'The response contrasts Vashti\'s $300.00 surplus with the $1,020.00 deficit in the bill month, and states that the annual total is unchanged while the risk of a shortfall is removed.',
      ),
    ],
    remediation:
      'If a learner omits the periodic line, require every expense in Vashti\'s model to be labelled fixed, variable, or periodic before totalling.',
    extension: 'Ask the learner what monthly set-aside would leave Vashti exactly break-even in the bill month, and to justify it.',
  },
  {
    key: 'g8-u03-l03',
    authority: 'FIXED',
    character: 'Wilhelmina',
    objective:
      'Learners size invented emergency funds at different coverage levels and compute the time each takes to build.',
    scenario:
      'Wilhelmina is a made-up eighth grader modelling a pretend emergency fund. Invented essential monthly costs are $2,750.00 and $450.00 a month can be set aside. She compares three-month and six-month coverage.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Size Wilhelmina\'s invented three-month emergency fund.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the three-month target?', fixed: { expected: '$8,250.00', compute: scale(m(2750.0), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Size the six-month target as well, then compute how long the three-month target takes at $450.00 a month.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the six-month target?', fixed: { expected: '$16,500.00', compute: scale(m(2750.0), 6) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'months', text: 'How many whole months to reach the three-month target?', fixed: { expected: '19', compute: reach(scale(m(2750.0), 3), m(450.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute how long the six-month target takes at the same rate, and what a raised set-aside of $700.00 would do to the three-month target.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'months', text: 'How many whole months to reach the six-month target at $450.00?', fixed: { expected: '37', compute: reach(scale(m(2750.0), 6), m(450.0)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'months', text: 'How many whole months to reach the three-month target at $700.00?', fixed: { expected: '12', compute: reach(scale(m(2750.0), 3), m(700.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The six-month target took over three years at the original rate.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Recommend a coverage target for Wilhelmina using the month counts, and explain what circumstances would justify aiming higher or lower.' }] },
    ],
    rubric: [
      crit(
        'Choosing an emergency-fund target',
        'The response names a target for Wilhelmina with no reference to the month counts.',
        'A target is chosen for Wilhelmina but not justified by circumstances.',
        'The response uses Wilhelmina\'s month counts to recommend a target and names circumstances, such as unstable income or dependents, that would move it up or down.',
      ),
    ],
    remediation:
      'If a learner divides in the wrong direction, restate the question as how many $450.00 steps fit inside Wilhelmina\'s target and count before dividing.',
    extension: 'Ask the learner what monthly set-aside would build Wilhelmina\'s six-month target inside two years, and to show the reasoning.',
  },
  {
    key: 'g8-u03-l04',
    authority: 'FIXED',
    character: 'Xanthe',
    objective:
      'Learners convert invented short, medium, and long goals into monthly requirements and test the combined plan against available funds.',
    scenario:
      'Xanthe is an invented eighth grader planning three pretend goals: $1,800.00 in 6 months, $9,000.00 in 36 months, and $24,000.00 in 120 months. She has $700.00 a month available. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Xanthe\'s invented short goal, $1,800.00 in 6 months, into a monthly amount.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the short goal require?', fixed: { expected: '$300.00', compute: div(m(1800.0), 6) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert Xanthe\'s medium and long goals the same way, keeping each requirement separate.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the $9,000.00 goal require over 36 months?', fixed: { expected: '$250.00', compute: div(m(9000.0), 36) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the $24,000.00 goal require over 120 months?', fixed: { expected: '$200.00', compute: div(m(24000.0), 120) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total Xanthe\'s three monthly requirements and compare them with the $700.00 available.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do the three goals require each month?', fixed: { expected: '$750.00', compute: sum(div(m(1800.0), 6), div(m(9000.0), 36), div(m(24000.0), 120)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much short is the monthly amount available?', fixed: { expected: '$50.00', compute: diff(sum(div(m(1800.0), 6), div(m(9000.0), 36), div(m(24000.0), 120)), m(700.0)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Only the short goal has a hard deadline.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Recommend which of Xanthe\'s timelines to extend to close the $50.00 gap, and explain why the horizon of a goal affects how much it can be stretched.' }] },
    ],
    rubric: [
      crit(
        'Sequencing goals across horizons',
        'The response cuts one of Xanthe\'s goals arbitrarily.',
        'A change is proposed for Xanthe but the horizon of each goal is not considered.',
        'The response chooses which of Xanthe\'s timelines to extend and explains that longer-horizon goals absorb delay more easily than a goal with a near deadline.',
      ),
    ],
    remediation:
      'If a learner divides in the wrong direction, restate each of Xanthe\'s goals as sharing the total across the months and check the units of the answer.',
    extension: 'Ask the learner to extend exactly one of Xanthe\'s timelines so the plan fits $700.00, and to show the new figures.',
  },
  {
    key: 'g8-u03-l05',
    authority: 'FIXED',
    character: 'Yannick',
    objective:
      'Learners total the invented annual cost of banking fees and compare it with the interest a simulated balance earns.',
    scenario:
      'Yannick is a made-up eighth grader comparing pretend account terms: a $12.00 monthly fee, an invented $35.00 overdraft fee incurred 4 times, and $3.50 out-of-network withdrawals used 24 times, against 0.9% annual interest on a $3,000.00 simulated balance.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute a simulated year of Yannick\'s invented monthly account fee.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does a year of the monthly fee cost?', fixed: { expected: '$144.00', compute: scale(m(12.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the invented overdraft and withdrawal charges for the year, keeping each as its own figure.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 4 overdraft fees come to?', fixed: { expected: '$140.00', compute: scale(m(35.0), 4) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do 24 out-of-network withdrawals come to?', fixed: { expected: '$84.00', compute: scale(m(3.5), 24) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Total Yannick\'s annual fees and compare them with the interest earned on the simulated balance.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What do all the fees come to for the year?', fixed: { expected: '$368.00', compute: sum(scale(m(12.0), 12), scale(m(35.0), 4), scale(m(3.5), 24)) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much do the fees exceed the year\'s interest of 0.9% on $3,000.00?', fixed: { expected: '$341.00', compute: diff(sum(scale(m(12.0), 12), scale(m(35.0), 4), scale(m(3.5), 24)), pct(m(3000.0), 90)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Two of the three fee types depended on behaviour.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Sort Yannick\'s three fees by how much control the account holder has over them, and recommend where to act first.' }] },
    ],
    rubric: [
      crit(
        'Prioritising avoidable costs',
        'The response treats all of Yannick\'s fees as equally unavoidable.',
        'The fees are sorted for Yannick but no priority for action is given.',
        'The response sorts Yannick\'s fees by controllability, identifies the overdraft and withdrawal charges as behaviour-driven, and recommends acting on the largest controllable one first.',
      ),
    ],
    remediation:
      'If a learner compares the interest rate with a fee rate, convert everything in Yannick\'s comparison into annual dollar figures before any judgement.',
    extension: 'Ask the learner what balance Yannick would need for 0.9% interest to cover the fees, and what that shows.',
    safetyNotes: ['These account terms are invented for the exercise; real terms should be checked with a trusted adult.'],
  },
  {
    key: 'g8-u03-l06',
    authority: 'FIXED',
    character: 'Zola',
    objective:
      'Learners compute invented compound growth of savings alongside invented inflation of costs, and compare the two to find the real gain.',
    scenario:
      'Zola is an invented eighth grader modelling $5,000.00 over ten simulated years: savings growing at 4% a year, while the cost of the same basket of goods rises at 3% a year. All rates are invented for the exercise.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Grow Zola\'s invented $5,000.00 at 4% a year for ten years, compounding annually.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the savings balance after ten years?', fixed: { expected: '$7,401.21', compute: grow(m(5000.0), 400, 10) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Now grow the cost of the same $5,000.00 basket at the invented 3% inflation rate for the same ten years, and compare the two.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What does the basket cost after ten years?', fixed: { expected: '$6,719.60', compute: grow(m(5000.0), 300, 10) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'By how much does the balance exceed the basket cost?', fixed: { expected: '$681.61', compute: diff(grow(m(5000.0), 400, 10), grow(m(5000.0), 300, 10)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model the same ten years if the savings had earned only 2% while inflation stayed at 3%.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What would the balance be after ten years at 2%?', fixed: { expected: '$6,094.98', compute: grow(m(5000.0), 200, 10) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How far short of the basket cost would that leave Zola?', fixed: { expected: '$624.62', compute: diff(grow(m(5000.0), 300, 10), grow(m(5000.0), 200, 10)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'A growing balance can still lose ground.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what Zola\'s second model shows about a balance that grows more slowly than prices, and why the headline balance can be misleading.' }] },
    ],
    rubric: [
      crit(
        'Reasoning about real versus nominal growth',
        'The response judges Zola\'s outcome by the balance alone.',
        'Inflation is mentioned for Zola but not compared with the growth rate.',
        'The response contrasts Zola\'s two models to show that a balance growing below the inflation rate buys less than at the start, despite a larger number.',
      ),
    ],
    remediation:
      'If a learner applies the rate to the original amount each year, write out the first three of Zola\'s years explicitly with their opening balances.',
    extension: 'Ask the learner what savings rate would exactly keep pace with Zola\'s 3% inflation, and what that implies about a real return.',
  },
  {
    key: 'g8-u03-l07',
    authority: 'FIXED',
    character: 'Anselm',
    objective:
      'Learners build a three-month invented cash-flow investigation, compute each month\'s net, and interpret the combined result.',
    scenario:
      'Anselm is a made-up eighth grader investigating a pretend three-month record. Inflows are $2,900.00, $3,150.00, and $2,750.00; outflows are $3,050.00, $2,980.00, and $3,100.00. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Compute the net for Anselm\'s invented first month.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net in month one?', fixed: { expected: '-$150.00', compute: diff(m(2900.0), m(3050.0)) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Compute the nets for Anselm\'s second and third months, keeping the signs.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net in month two?', fixed: { expected: '$170.00', compute: diff(m(3150.0), m(2980.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the net in month three?', fixed: { expected: '-$350.00', compute: diff(m(2750.0), m(3100.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Combine Anselm\'s three months and compute the average monthly net across the period.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the combined three-month net?', fixed: { expected: '-$330.00', compute: sum(diff(m(2900.0), m(3050.0)), diff(m(3150.0), m(2980.0)), diff(m(2750.0), m(3100.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the average monthly net?', fixed: { expected: '-$110.00', compute: div(sum(diff(m(2900.0), m(3050.0)), diff(m(3150.0), m(2980.0)), diff(m(2750.0), m(3100.0))), 3) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Both inflows and outflows moved.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Anselm\'s figures, identify whether the deficit is driven more by variable inflows or by rising outflows, and say what further data would confirm it.' }] },
    ],
    rubric: [
      crit(
        'Diagnosing a cash-flow pattern',
        'The response reports Anselm\'s totals without diagnosing a cause.',
        'A cause is asserted for Anselm without reference to the month-by-month figures.',
        'The response uses Anselm\'s month-by-month movement on both sides to argue which side drives the deficit, and names further data that would confirm it.',
      ),
    ],
    remediation:
      'If a learner averages the inflows and outflows separately and stops, require Anselm\'s per-month nets to be computed before any averaging.',
    extension: 'Ask the learner what a fourth month would need to look like to bring Anselm\'s combined position back to zero.',
  },
  {
    key: 'g8-u03-l08',
    authority: 'FIXED',
    character: 'Beatrix',
    objective:
      'Learners re-practise expense classification and periodic conversion, and check the resulting budget against invented income.',
    scenario:
      'Beatrix is an invented eighth grader rebuilding a pretend budget: $1,200.00 of fixed costs, $480.00 of variable costs, and an invented $900.00 annual registration bill, against $1,900.00 of monthly income.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Beatrix\'s invented annual registration bill into a monthly equivalent.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the monthly equivalent of the $900.00 annual bill?', fixed: { expected: '$75.00', compute: div(m(900.0), 12) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Build Beatrix\'s full monthly cost from fixed, variable, and the periodic equivalent, then compare it with income.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the full monthly cost?', fixed: { expected: '$1,755.00', compute: sum(m(1200.0), m(480.0), div(m(900.0), 12)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'How much of the $1,900.00 income is left?', fixed: { expected: '$145.00', compute: diff(m(1900.0), sum(m(1200.0), m(480.0), div(m(900.0), 12))) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Model the month Beatrix\'s registration bill actually lands with nothing set aside, and the effect of variable costs rising to $560.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the position in the bill month with nothing set aside?', fixed: { expected: '-$680.00', compute: diff(m(1900.0), sum(m(1200.0), m(480.0), m(900.0))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'With the periodic cost spread and variable costs at $560.00, how much is left?', fixed: { expected: '$65.00', compute: diff(m(1900.0), sum(m(1200.0), m(560.0), div(m(900.0), 12))) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The margin was thin before anything went wrong.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Using Beatrix\'s figures, explain how much room the budget really has and what a single unplanned $200.00 cost would do to it.' }] },
    ],
    rubric: [
      crit(
        'Assessing budget resilience',
        'The response reports Beatrix\'s surplus without testing it.',
        'The thin margin is noticed for Beatrix but not quantified against a shock.',
        'The response tests Beatrix\'s surplus against a specific shock, shows it would be exceeded, and draws a conclusion about the need for a buffer.',
      ),
    ],
    remediation:
      'If a learner mixes the spread and unspread versions, keep two clearly labelled scenarios for Beatrix and complete each separately.',
    extension: 'Ask the learner what variable-cost level would leave Beatrix exactly break-even with the periodic cost spread.',
  },
  {
    key: 'g8-u03-l09',
    authority: 'FIXED',
    character: 'Caspian',
    objective:
      'Learners size an invented emergency fund, measure the existing gap, and compute the time and rate needed to close it.',
    scenario:
      'Caspian is a made-up eighth grader completing a pretend emergency-fund task. Invented essential monthly costs are $3,100.00, the target is three months, $2,400.00 is already saved, and $575.00 a month can be added.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Size Caspian\'s invented three-month target.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the three-month target?', fixed: { expected: '$9,300.00', compute: scale(m(3100.0), 3) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Measure the gap between Caspian\'s existing savings and the target, then convert it into months at $575.00.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What is the remaining gap?', fixed: { expected: '$6,900.00', compute: diff(scale(m(3100.0), 3), m(2400.0)) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'months', text: 'How many whole months at $575.00 close the gap?', fixed: { expected: '12', compute: reach(diff(scale(m(3100.0), 3), m(2400.0)), m(575.0)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compute what monthly amount would close Caspian\'s gap in 8 months, and where the fund stands after 6 months at $575.00.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount closes the gap in 8 months?', fixed: { expected: '$862.50', compute: div(diff(scale(m(3100.0), 3), m(2400.0)), 8) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What is in the fund after 6 months at $575.00?', fixed: { expected: '$5,850.00', compute: sum(m(2400.0), scale(m(575.0), 6)) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'Halfway through, the fund covers under two months of essentials.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Explain what partial coverage is worth to Caspian, and whether a partly built fund changes how he should handle other risks.' }] },
    ],
    rubric: [
      crit(
        'Valuing partial protection',
        'The response treats Caspian\'s fund as worthless until complete.',
        'Partial coverage is acknowledged for Caspian but not quantified in months.',
        'The response converts Caspian\'s partial balance into months of essential coverage and reasons about what risks it does and does not yet absorb.',
      ),
    ],
    remediation:
      'If a learner ignores the existing balance, mark Caspian\'s starting savings on the target line before any gap is computed.',
    extension: 'Ask the learner how many months of essentials Caspian\'s fund covers after 6 months, and to show the reasoning.',
  },
  {
    key: 'g8-u03-l10',
    authority: 'FIXED',
    character: 'Delphina',
    objective:
      'Learners synthesise several invented goals into monthly requirements, confirm the plan fits, and allocate any surplus deliberately.',
    scenario:
      'Delphina is an invented eighth grader synthesising a pretend plan: $2,400.00 in 8 months, $7,200.00 in 24 months, and $15,000.00 in 60 months, with $900.00 a month available. All figures are invented.',
    tasks: [
      {
        taskId: 't1',
        kind: 'warm-up',
        directions: 'Convert Delphina\'s invented short goal, $2,400.00 in 8 months, into a monthly amount.',
        prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the short goal require?', fixed: { expected: '$300.00', compute: div(m(2400.0), 8) } }],
      },
      {
        taskId: 't2',
        kind: 'guided',
        directions: 'Convert Delphina\'s other two goals, then total the three monthly requirements.',
        prompts: [
          { ref: 't2-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount does the $7,200.00 goal require over 24 months?', fixed: { expected: '$300.00', compute: div(m(7200.0), 24) } },
          { ref: 't2-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What do all three goals require each month?', fixed: { expected: '$850.00', compute: sum(div(m(2400.0), 8), div(m(7200.0), 24), div(m(15000.0), 60)) } },
        ],
      },
      {
        taskId: 't3',
        kind: 'independent',
        directions: 'Compare the requirement with Delphina\'s $900.00 available, then test what happens if the long goal must finish in 48 months instead.',
        prompts: [
          { ref: 't3-p1', promptType: 'fixed-numeric', unit: 'USD', text: 'How much is unassigned each month?', fixed: { expected: '$50.00', compute: diff(m(900.0), sum(div(m(2400.0), 8), div(m(7200.0), 24), div(m(15000.0), 60))) } },
          { ref: 't3-p2', promptType: 'fixed-numeric', unit: 'USD', text: 'What monthly amount would the long goal need over 48 months?', fixed: { expected: '$312.50', compute: div(m(15000.0), 48) } },
        ],
      },
      { taskId: 't4', kind: 'reflection', directions: 'The plan fits, with fifty dollars spare.', prompts: [{ ref: 't4-p1', promptType: 'extended-response', text: 'Recommend what Delphina should do with the $50.00 surplus, and explain why leaving it unassigned is itself a decision.' }] },
    ],
    rubric: [
      crit(
        'Allocating surplus deliberately',
        'The response ignores Delphina\'s surplus or treats it as spending money by default.',
        'A use is proposed for Delphina but without reasoning about risk or goals.',
        'The response makes a reasoned recommendation for Delphina\'s surplus, such as a buffer or accelerating a goal, and notes that leaving it unassigned invites unplanned spending.',
      ),
    ],
    remediation:
      'If a learner adds the goal totals rather than the monthly requirements, convert each of Delphina\'s goals to a monthly figure first and box it.',
    extension: 'Ask the learner whether Delphina can afford the 48-month version of the long goal, and to show the arithmetic behind the answer.',
  },
]
