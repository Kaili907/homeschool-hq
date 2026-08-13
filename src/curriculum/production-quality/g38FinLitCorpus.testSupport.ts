import type {
  LessonProductionInput,
  LessonResponseItem,
  ResponseScoringMode,
  ScoringAuthority,
} from './types'

/**
 * Read-only compatibility fixtures: verbatim slices of completed Grade 3-8
 * Financial Literacy production records, copied out of the released
 * `curriculum-production/student-work/financial-literacy-g38` corpus so this
 * gate can be checked against work that already exists rather than only
 * against records written to suit it. The corpus itself is not modified, and
 * nothing here is authored to make the gate pass.
 *
 * Six lessons, chosen to cover both authority classes across grades 3, 5, 7
 * and 8, and deliberately including the two hardest cases in the corpus: the
 * lesson whose open-response prompt reads as quantitative, and the lesson
 * whose fixed prompts are phrased least like computations.
 */
export interface CorpusPrompt {
  readonly ref: string
  readonly promptType: 'fixed-numeric' | 'fixed-choice' | 'short-response' | 'extended-response'
  readonly text: string
}

export interface CorpusTask {
  readonly kind: string
  readonly directions: string
  readonly prompts: readonly CorpusPrompt[]
}

export interface CorpusRubricCriterion {
  readonly dimension: string
  readonly levels: readonly { readonly label: string; readonly descriptor: string }[]
}

export interface CorpusRecord {
  readonly packageId: string
  readonly lessonId: string
  readonly courseId: string
  readonly unitNumber: number
  readonly title: string
  readonly objective: string
  readonly scenario: string
  readonly tasks: readonly CorpusTask[]
  readonly remediation: string
  readonly extension: string
  readonly authorityTag: {
    readonly authorityClass: 'FIXED_ANSWER_KEY' | 'RUBRIC_JUDGMENT'
    readonly fixedItemCount: number
    readonly oracleId: string
    readonly oracleVerdict: string
  }
  readonly scoringAuthority:
    | {
        readonly kind: 'ANSWER_KEY'
        readonly items: readonly {
          readonly ref: string
          readonly promptText: string
          readonly answer: string
          readonly reasoning: string
        }[]
        readonly criteria: readonly CorpusRubricCriterion[]
      }
    | {
        readonly kind: 'RUBRIC'
        readonly criteria: readonly CorpusRubricCriterion[]
        readonly acceptableAnswerCriteria: readonly string[]
      }
}

const FIXED_PROMPT_TYPES = new Set(['fixed-numeric', 'fixed-choice'])

function criteriaText(criteria: readonly CorpusRubricCriterion[]): string {
  return criteria
    .map(
      (criterion) =>
        `${criterion.dimension} — ${criterion.levels
          .map((level) => `${level.label}: ${level.descriptor}`)
          .join(' ')}`,
    )
    .join(' ')
}

function tasksText(record: CorpusRecord, kinds: readonly string[]) {
  const parts = record.tasks
    .filter((task) => kinds.includes(task.kind))
    .map((task) => `${task.directions} ${task.prompts.map((prompt) => prompt.text).join(' ')}`)
  return parts.length > 0 ? { present: true, text: parts.join(' ') } : { present: false }
}

/**
 * Projects a released record into the gate's input contract. The response
 * mode is read off the authored per-prompt `promptType`, never off the
 * scoring authority's kind — reading it off the authority would make the
 * cross-check circular.
 */
export function projectCorpusRecord(record: CorpusRecord): LessonProductionInput {
  const items: LessonResponseItem[] = record.tasks.flatMap((task) =>
    task.prompts.map((prompt) => ({
      ref: prompt.ref,
      responseMode: FIXED_PROMPT_TYPES.has(prompt.promptType) ? ('FIXED' as const) : ('OPEN' as const),
      promptText: prompt.text,
    })),
  )
  const hasFixed = items.some((item) => item.responseMode === 'FIXED')
  const hasOpen = items.some((item) => item.responseMode === 'OPEN')
  const mode: ResponseScoringMode =
    hasFixed && hasOpen ? 'MIXED' : hasFixed ? 'FIXED_OR_COMPUTATIONAL' : 'JUDGMENT_APPLICATION'

  const authority: ScoringAuthority =
    record.scoringAuthority.kind === 'ANSWER_KEY'
      ? {
          kind: 'ANSWER_KEY',
          content: {
            present: true,
            text: record.scoringAuthority.items
              .map((item) => `${item.promptText} ${item.answer} ${item.reasoning}`)
              .join(' '),
          },
          rubric: { present: true, text: criteriaText(record.scoringAuthority.criteria) },
          verification: {
            method: 'INDEPENDENT_ORACLE',
            evidence: `Recomputed by ${record.authorityTag.oracleId} from the figures stated in this task sheet's own fictional scenario and compared against the separately authored answer across all ${record.authorityTag.fixedItemCount} fixed items; verdict ${record.authorityTag.oracleVerdict}.`,
          },
        }
      : {
          kind: 'RUBRIC',
          content: { present: true, text: criteriaText(record.scoringAuthority.criteria) },
          acceptableAnswerCriteria: {
            present: true,
            text: record.scoringAuthority.acceptableAnswerCriteria.join(' '),
          },
        }

  return {
    lessonId: record.lessonId,
    title: record.title,
    courseId: record.courseId,
    unitId: `unit-${record.unitNumber}`,
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    structuredDiscipline: 'FINANCIAL_LITERACY',
    instruction: { present: true, text: `${record.objective} ${record.scenario}` },
    workedExample: tasksText(record, ['warm-up', 'guided']),
    guidedPractice: tasksText(record, ['guided']),
    independentWork: tasksText(record, ['independent', 'performance-task']),
    responseScoring: { mode, items },
    scoringAuthority: authority,
    remediation: { present: true, text: record.remediation },
    extension: { present: true, text: record.extension },
    assessmentAlignment: 'ALIGNED',
    requiresSafetyOrPrivacyReview: false,
  }
}

export const G38_FINLIT_CORPUS_RECORDS: readonly CorpusRecord[] = [
  {
    "packageId": "swk-fl-g3-u01-l05",
    "lessonId": "ma-g3-financial-literacy-u01-l05",
    "courseId": "ma-g3-financial-literacy",
    "unitNumber": 1,
    "title": "Mastery check: private choices and different families",
    "objective": "Learners compare two invented families who spend the same pretend amount very differently, and practise talking about money choices without ranking families or repeating private details.",
    "scenario": "Zuri is a made-up third grader whose class runs a pretend planning activity. Two invented families each plan $10.00 of imaginary market money: the first plans rice, beans, and fruit; the second plans bread, soup, and a birthday candle for a sibling. Both plans are complete and neither family is real.",
    "tasks": [
      {
        "kind": "guided",
        "directions": "Read both invented plans with Zuri. The first family put every pretend dollar into food that lasts the week. The second family kept a little back for a birthday candle. Notice what each plan protects before you say anything about which you prefer.",
        "prompts": [
          {
            "ref": "t1-p1",
            "promptType": "short-response",
            "text": "Name one thing the first invented family's plan takes care of, and one thing the second family's plan takes care of."
          }
        ]
      },
      {
        "kind": "independent",
        "directions": "Zuri's classmate says the second family \"wasted\" money on the candle. Write what you would say back. Remember that both families finished their pretend plan and neither ran out of money.",
        "prompts": [
          {
            "ref": "t2-p1",
            "promptType": "extended-response",
            "text": "Explain why two families can spend the same pretend $10.00 in different ways and both plans can still be good ones."
          }
        ]
      },
      {
        "kind": "reflection",
        "directions": "Money information about a real family belongs to that family.",
        "prompts": [
          {
            "ref": "t3-p1",
            "promptType": "short-response",
            "text": "A friend tells you something about what their family can afford. What is the kind thing to do with what they told you?"
          }
        ]
      }
    ],
    "remediation": "If a learner ranks the families, cover the price column entirely and re-read both plans as stories about what each family cared about, then ask which plan would be missing something if the other family had written it.",
    "extension": "Ask the learner to write a third invented $10.00 plan that protects something neither family protected, and to name what it gives up in exchange.",
    "authorityTag": {
      "authorityClass": "RUBRIC_JUDGMENT",
      "fixedItemCount": 0,
      "oracleId": "finlit-g38-oracle@1",
      "oracleVerdict": "AGREES"
    },
    "scoringAuthority": {
      "kind": "RUBRIC",
      "criteria": [
        {
          "dimension": "Respect for different family choices",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response ranks one of Zuri's two invented families as better with money, or calls a family's choice foolish."
            },
            {
              "label": "Approaching",
              "descriptor": "The response accepts both of Zuri's plans but gives no reason grounded in what each family valued."
            },
            {
              "label": "Meets",
              "descriptor": "The response explains that each family in Zuri's activity protected something different with the same pretend $10.00, and treats both plans as reasonable rather than ranking the families."
            }
          ]
        },
        {
          "dimension": "Handling private money information",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response suggests telling others what a friend of Zuri's said about family money."
            },
            {
              "label": "Approaching",
              "descriptor": "The response says to keep it quiet without naming any trusted adult a worry could go to."
            },
            {
              "label": "Meets",
              "descriptor": "The response says that what Zuri's friend shared stays private, and that a worry about a friend can be brought to a trusted adult instead of to other children."
            }
          ]
        }
      ],
      "acceptableAnswerCriteria": [
        "Names at least one concrete thing each invented plan protects, such as food for the whole week or a sibling's birthday.",
        "Does not rank either invented family as better, smarter, or poorer than the other.",
        "States that a friend's family money information is kept private rather than repeated.",
        "Sends any real worry to a trusted adult rather than to classmates."
      ]
    }
  },
  {
    "packageId": "swk-fl-g3-u02-l05",
    "lessonId": "ma-g3-financial-literacy-u02-l05",
    "courseId": "ma-g3-financial-literacy",
    "unitNumber": 2,
    "title": "Mastery check: gifts, allowance, and earning",
    "objective": "Learners separate invented money that was given from invented money that was earned, total both, and compare the two sources as they change over two pretend weeks.",
    "scenario": "Ben is a made-up third grader keeping a pretend money record. This imaginary week he receives a $5.00 birthday gift, a $3.00 allowance for being part of the family, and $2.00 he earned washing a neighbour's pretend bicycle. None of these amounts are real.",
    "tasks": [
      {
        "kind": "warm-up",
        "directions": "Add everything that came into Ben's pretend record this week.",
        "prompts": [
          {
            "ref": "t1-p1",
            "promptType": "fixed-numeric",
            "text": "How much pretend money does Ben have in total this week?"
          }
        ]
      },
      {
        "kind": "guided",
        "directions": "Not all of Ben's money arrived the same way. Set the $2.00 he earned beside the $5.00 he was given as a gift.",
        "prompts": [
          {
            "ref": "t2-p1",
            "promptType": "fixed-choice",
            "text": "Which is larger in Ben's record this week, the money he earned or the birthday gift?"
          },
          {
            "ref": "t2-p2",
            "promptType": "fixed-numeric",
            "text": "How much larger is it?"
          }
        ]
      },
      {
        "kind": "independent",
        "directions": "The following pretend week, no gift arrives, but Ben earns $4.00 more from washing bicycles on top of the $2.00 he already earned.",
        "prompts": [
          {
            "ref": "t3-p1",
            "promptType": "fixed-numeric",
            "text": "How much has Ben now earned in total from washing bicycles?"
          },
          {
            "ref": "t3-p2",
            "promptType": "fixed-choice",
            "text": "How does Ben's total earned money now compare with the $5.00 gift?"
          }
        ]
      },
      {
        "kind": "reflection",
        "directions": "Gifts and earnings both spend the same, but they do not arrive the same way.",
        "prompts": [
          {
            "ref": "t4-p1",
            "promptType": "short-response",
            "text": "What is the difference between the $5.00 Ben was given and the $6.00 he earned?"
          }
        ]
      }
    ],
    "remediation": "When a learner blends the sources, split the record into two columns headed given and earned, re-enter each pretend amount under the right heading, and only then ask for any comparison between them.",
    "extension": "Have the learner plan how many more pretend bicycle washes at $2.00 Ben needs before his earnings alone reach $10.00.",
    "authorityTag": {
      "authorityClass": "FIXED_ANSWER_KEY",
      "fixedItemCount": 5,
      "oracleId": "finlit-g38-oracle@1",
      "oracleVerdict": "AGREES"
    },
    "scoringAuthority": {
      "kind": "ANSWER_KEY",
      "items": [
        {
          "ref": "t1-p1",
          "promptText": "How much pretend money does Ben have in total this week?",
          "answer": "$10.00",
          "reasoning": "(5.00 + 3.00 + 2.00) = 10.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t2-p1",
          "promptText": "Which is larger in Ben's record this week, the money he earned or the birthday gift?",
          "answer": "The gift is larger",
          "reasoning": "compare 2.00 with 5.00 = The gift is larger. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t2-p2",
          "promptText": "How much larger is it?",
          "answer": "$3.00",
          "reasoning": "(5.00 - 2.00) = 3.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t3-p1",
          "promptText": "How much has Ben now earned in total from washing bicycles?",
          "answer": "$6.00",
          "reasoning": "(2.00 + 4.00) = 6.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t3-p2",
          "promptText": "How does Ben's total earned money now compare with the $5.00 gift?",
          "answer": "Earned money is larger",
          "reasoning": "compare (2.00 + 4.00) with 5.00 = Earned money is larger. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        }
      ],
      "criteria": [
        {
          "dimension": "Distinguishing gifts from earnings",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response treats Ben's gift and earnings as the same thing with no difference named."
            },
            {
              "label": "Approaching",
              "descriptor": "A difference is stated for Ben but only in terms of the amounts rather than how each arrived."
            },
            {
              "label": "Meets",
              "descriptor": "The response explains that Ben's gift came from someone else's choice while the earned money came from work he did, and notes that he can repeat earning but cannot count on gifts."
            }
          ]
        }
      ]
    }
  },
  {
    "packageId": "swk-fl-g5-u02-l06",
    "lessonId": "ma-g5-financial-literacy-u02-l06",
    "courseId": "ma-g5-financial-literacy",
    "unitNumber": 2,
    "title": "Correction and reflection: workplace responsibility",
    "objective": "Learners judge an invented workplace situation involving an uncorrected error and decide what responsibility requires of them.",
    "scenario": "Otis is an invented fifth grader volunteering at a pretend school shop. He notices that a made-up price sign says $4.00 while the till has been charging $3.00 all week, and the shop is short. No one has noticed yet, and nothing here is real.",
    "tasks": [
      {
        "kind": "guided",
        "directions": "Set out the facts of Otis's invented situation: what the sign says, what the till charged, and what the shop is short as a result. Keep facts separate from blame.",
        "prompts": [
          {
            "ref": "t1-p1",
            "promptType": "short-response",
            "text": "What exactly went wrong in Otis's shop, and what is the consequence of leaving it uncorrected?"
          }
        ]
      },
      {
        "kind": "independent",
        "directions": "Otis did not cause the error and is not in charge. Write what he should do anyway, and say what makes it his responsibility even though he did not set the till.",
        "prompts": [
          {
            "ref": "t2-p1",
            "promptType": "extended-response",
            "text": "What should Otis do, and why is it his responsibility to act even though he did not make the mistake?"
          }
        ]
      },
      {
        "kind": "reflection",
        "directions": "Customers paid less than the sign said.",
        "prompts": [
          {
            "ref": "t3-p1",
            "promptType": "short-response",
            "text": "Does the shop owe anything to the customers who were undercharged? Give your reasoning."
          }
        ]
      }
    ],
    "remediation": "If a learner treats silence as acceptable, ask what happens to the shop and to the next customer if the mismatch runs another week, and revisit from there.",
    "extension": "Ask the learner to write the check Otis's shop could add to its routine so the sign and the till are compared before opening.",
    "authorityTag": {
      "authorityClass": "RUBRIC_JUDGMENT",
      "fixedItemCount": 0,
      "oracleId": "finlit-g38-oracle@1",
      "oracleVerdict": "AGREES"
    },
    "scoringAuthority": {
      "kind": "RUBRIC",
      "criteria": [
        {
          "dimension": "Taking responsibility for a noticed problem",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response has Otis stay silent because the error was not his."
            },
            {
              "label": "Approaching",
              "descriptor": "Otis reports the problem but no reason is given for why it is his to raise."
            },
            {
              "label": "Meets",
              "descriptor": "The response has Otis report the mismatch promptly and explains that noticing a problem creates a responsibility to raise it, independent of who caused it."
            }
          ]
        },
        {
          "dimension": "Reasoning about fairness to customers",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response ignores the undercharged customers entirely."
            },
            {
              "label": "Approaching",
              "descriptor": "The customers are mentioned but no position is taken on what is owed."
            },
            {
              "label": "Meets",
              "descriptor": "The response takes a reasoned position on Otis's undercharged customers, weighing fairness to the shop against what customers were told at the point of sale."
            }
          ]
        }
      ],
      "acceptableAnswerCriteria": [
        "States the mismatch between the invented sign and the till.",
        "Has Otis raise the issue with someone responsible for the shop.",
        "Explains responsibility as following from noticing, not from causing.",
        "Takes a defensible position on the undercharged customers."
      ]
    }
  },
  {
    "packageId": "swk-fl-g7-u01-l03",
    "lessonId": "ma-g7-financial-literacy-u01-l03",
    "courseId": "ma-g7-financial-literacy",
    "unitNumber": 1,
    "title": "Guided practice: gross pay and deductions concepts",
    "objective": "Learners apply stated percentage deductions to an invented gross figure, reach net pay, and quantify what the deductions represent as a whole.",
    "scenario": "Sofiane is a made-up seventh grader reading a pretend pay statement with $2,400.00 of invented gross monthly pay. Simulated deductions are 7.75% for payroll taxes and 10% for income tax withholding. This is a teaching example, not a real statement.",
    "tasks": [
      {
        "kind": "warm-up",
        "directions": "Apply the invented 7.75% payroll deduction to Sofiane's $2,400.00 gross.",
        "prompts": [
          {
            "ref": "t1-p1",
            "promptType": "fixed-numeric",
            "text": "How much is withheld for simulated payroll taxes?"
          }
        ]
      },
      {
        "kind": "guided",
        "directions": "Apply the 10% withholding to the same gross figure, then combine the two deductions.",
        "prompts": [
          {
            "ref": "t2-p1",
            "promptType": "fixed-numeric",
            "text": "How much is withheld for simulated income tax?"
          },
          {
            "ref": "t2-p2",
            "promptType": "fixed-numeric",
            "text": "What do both deductions come to together?"
          }
        ]
      },
      {
        "kind": "independent",
        "directions": "Work out Sofiane's net pay, then repeat the whole calculation for a month with $3,000.00 of gross pay.",
        "prompts": [
          {
            "ref": "t3-p1",
            "promptType": "fixed-numeric",
            "text": "What is the net pay on $2,400.00 gross?"
          },
          {
            "ref": "t3-p2",
            "promptType": "fixed-numeric",
            "text": "What is the net pay on $3,000.00 gross?"
          }
        ]
      },
      {
        "kind": "reflection",
        "directions": "Gross pay rose by $600.00 and net pay rose by less.",
        "prompts": [
          {
            "ref": "t4-p1",
            "promptType": "extended-response",
            "text": "Explain why the increase in net pay is smaller than the increase in gross pay, and what that means for planning around a raise."
          }
        ]
      }
    ],
    "remediation": "If a learner applies the second percentage to the already-reduced figure, mark Sofiane's gross as the base for both deductions and recompute each from that marked figure.",
    "extension": "Ask the learner what gross pay Sofiane would need for net pay to reach exactly $2,000.00 under these two rates, and to show the method.",
    "authorityTag": {
      "authorityClass": "FIXED_ANSWER_KEY",
      "fixedItemCount": 5,
      "oracleId": "finlit-g38-oracle@1",
      "oracleVerdict": "AGREES"
    },
    "scoringAuthority": {
      "kind": "ANSWER_KEY",
      "items": [
        {
          "ref": "t1-p1",
          "promptText": "How much is withheld for simulated payroll taxes?",
          "answer": "$186.00",
          "reasoning": "(7.75% of 2,400.00) = 186.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t2-p1",
          "promptText": "How much is withheld for simulated income tax?",
          "answer": "$240.00",
          "reasoning": "(10% of 2,400.00) = 240.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t2-p2",
          "promptText": "What do both deductions come to together?",
          "answer": "$426.00",
          "reasoning": "((7.75% of 2,400.00) + (10% of 2,400.00)) = 426.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t3-p1",
          "promptText": "What is the net pay on $2,400.00 gross?",
          "answer": "$1,974.00",
          "reasoning": "(2,400.00 - ((7.75% of 2,400.00) + (10% of 2,400.00))) = 1,974.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t3-p2",
          "promptText": "What is the net pay on $3,000.00 gross?",
          "answer": "$2,467.50",
          "reasoning": "(3,000.00 - ((7.75% of 3,000.00) + (10% of 3,000.00))) = 2,467.50. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        }
      ],
      "criteria": [
        {
          "dimension": "Reasoning about deductions on a raise",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response treats Sofiane's gross increase as the money gained."
            },
            {
              "label": "Approaching",
              "descriptor": "The smaller net increase is noticed but the percentage mechanism is not explained."
            },
            {
              "label": "Meets",
              "descriptor": "The response explains that Sofiane's deductions are proportional, so part of any raise is withheld too, and warns against planning on the gross figure."
            }
          ]
        }
      ]
    }
  },
  {
    "packageId": "swk-fl-g7-u02-l06",
    "lessonId": "ma-g7-financial-literacy-u02-l06",
    "courseId": "ma-g7-financial-literacy",
    "unitNumber": 2,
    "title": "Correction and reflection: fraud and consumer protection",
    "objective": "Learners work through an invented consumer-protection situation, identifying what evidence matters and what escalation path exists.",
    "scenario": "Kiona is an invented seventh grader studying a pretend case: an online order arrived damaged, the invented seller says the return window closed two days ago, and the customer has photos taken on the day of delivery. Everything here is invented for practice.",
    "tasks": [
      {
        "kind": "guided",
        "directions": "Set out Kiona's invented case in order: what was promised, what arrived, what evidence exists, and what the seller now claims. Keep evidence separate from opinion.",
        "prompts": [
          {
            "ref": "t1-p1",
            "promptType": "short-response",
            "text": "What evidence does the customer in Kiona's case actually hold, and why does the timing of the photos matter?"
          }
        ]
      },
      {
        "kind": "independent",
        "directions": "Write the steps the customer should take, in order, from contacting the seller through to any escalation, and say what each step should include.",
        "prompts": [
          {
            "ref": "t2-p1",
            "promptType": "extended-response",
            "text": "What steps should the customer take, in what order, and what should each communication contain?"
          }
        ]
      },
      {
        "kind": "reflection",
        "directions": "The seller is relying on a deadline.",
        "prompts": [
          {
            "ref": "t3-p1",
            "promptType": "short-response",
            "text": "Why does a damaged-on-arrival item raise a different question from a change-of-mind return?"
          }
        ]
      }
    ],
    "remediation": "If a learner leads with escalation, ask what a complaint body would want to see first, and rebuild the order from that answer.",
    "extension": "Ask the learner to draft the first three sentences of the customer's message to the invented seller.",
    "authorityTag": {
      "authorityClass": "RUBRIC_JUDGMENT",
      "fixedItemCount": 0,
      "oracleId": "finlit-g38-oracle@1",
      "oracleVerdict": "AGREES"
    },
    "scoringAuthority": {
      "kind": "RUBRIC",
      "criteria": [
        {
          "dimension": "Marshalling evidence",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response relies on assertion rather than on the evidence in Kiona's case."
            },
            {
              "label": "Approaching",
              "descriptor": "The photos are mentioned for Kiona but their timing is not connected to the claim."
            },
            {
              "label": "Meets",
              "descriptor": "The response identifies the delivery-day photos as evidence that the damage predates any deadline, and distinguishes documented facts from opinion."
            }
          ]
        },
        {
          "dimension": "Escalating in a workable order",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response jumps straight to a complaint body or gives up."
            },
            {
              "label": "Approaching",
              "descriptor": "Steps are listed for Kiona but out of a sensible order or without content."
            },
            {
              "label": "Meets",
              "descriptor": "The response sets out an ordered path for Kiona, starting with a written approach to the seller including the evidence, and names a next step if that fails."
            }
          ]
        }
      ],
      "acceptableAnswerCriteria": [
        "Identifies the delivery-day photos as the key evidence.",
        "Distinguishes damaged-on-arrival from change-of-mind.",
        "Puts a written approach to the seller first.",
        "Names a concrete escalation route if the seller refuses."
      ]
    }
  },
  {
    "packageId": "swk-fl-g8-u05-l02",
    "lessonId": "ma-g8-financial-literacy-u05-l02",
    "courseId": "ma-g8-financial-literacy",
    "unitNumber": 5,
    "title": "Concept model A: stocks bonds funds and ownership concepts",
    "objective": "Learners compute invented returns from a bond, a dividend-paying holding, and a fund with a fee, and compare what each return depends on.",
    "scenario": "Quillon is an invented eighth grader modelling $5,000.00 in three pretend ways: an invented bond paying 4%, a holding paying a 2.5% dividend that also rose 8% in price, and a fund charging a 0.6% annual fee. All figures are invented.",
    "tasks": [
      {
        "kind": "warm-up",
        "directions": "Compute one simulated year on Quillon's invented 4% bond.",
        "prompts": [
          {
            "ref": "t1-p1",
            "promptType": "fixed-numeric",
            "text": "What does the bond pay in a year?"
          }
        ]
      },
      {
        "kind": "guided",
        "directions": "Compute the dividend and the price gain on Quillon's invented holding, keeping them as separate figures.",
        "prompts": [
          {
            "ref": "t2-p1",
            "promptType": "fixed-numeric",
            "text": "What does the 2.5% dividend pay?"
          },
          {
            "ref": "t2-p2",
            "promptType": "fixed-numeric",
            "text": "What is the 8% price gain worth?"
          }
        ]
      },
      {
        "kind": "independent",
        "directions": "Total the holding's return, then apply the invented fund fee to see what it removes.",
        "prompts": [
          {
            "ref": "t3-p1",
            "promptType": "fixed-numeric",
            "text": "What is the holding's total return for the year?"
          },
          {
            "ref": "t3-p2",
            "promptType": "fixed-numeric",
            "text": "What does the 0.6% annual fund fee cost?"
          }
        ]
      },
      {
        "kind": "reflection",
        "directions": "Only one of the three returns was contractually promised.",
        "prompts": [
          {
            "ref": "t4-p1",
            "promptType": "extended-response",
            "text": "Sort Quillon's three sources of return by how certain each is, and explain what the price gain depends on that the bond payment does not."
          }
        ]
      }
    ],
    "remediation": "If a learner merges dividend and price gain, keep two labelled lines for Quillon's holding and fill each separately.",
    "extension": "Ask the learner what price movement would leave Quillon's holding with the same total return as the bond, and to show the reasoning.",
    "authorityTag": {
      "authorityClass": "FIXED_ANSWER_KEY",
      "fixedItemCount": 5,
      "oracleId": "finlit-g38-oracle@1",
      "oracleVerdict": "AGREES"
    },
    "scoringAuthority": {
      "kind": "ANSWER_KEY",
      "items": [
        {
          "ref": "t1-p1",
          "promptText": "What does the bond pay in a year?",
          "answer": "$200.00",
          "reasoning": "(4% of 5,000.00) = 200.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t2-p1",
          "promptText": "What does the 2.5% dividend pay?",
          "answer": "$125.00",
          "reasoning": "(2.5% of 5,000.00) = 125.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t2-p2",
          "promptText": "What is the 8% price gain worth?",
          "answer": "$400.00",
          "reasoning": "(8% of 5,000.00) = 400.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t3-p1",
          "promptText": "What is the holding's total return for the year?",
          "answer": "$525.00",
          "reasoning": "((2.5% of 5,000.00) + (8% of 5,000.00)) = 525.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        },
        {
          "ref": "t3-p2",
          "promptText": "What does the 0.6% annual fund fee cost?",
          "answer": "$30.00",
          "reasoning": "(0.6% of 5,000.00) = 30.00. Recomputed by finlit-g38-oracle@1 from the figures stated in this task sheet's own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement."
        }
      ],
      "criteria": [
        {
          "dimension": "Distinguishing kinds of return",
          "levels": [
            {
              "label": "Not yet",
              "descriptor": "The response treats all of Quillon's returns as equally reliable."
            },
            {
              "label": "Approaching",
              "descriptor": "The price gain is called uncertain for Quillon but the reason is not given."
            },
            {
              "label": "Meets",
              "descriptor": "The response ranks Quillon's returns by certainty, noting the bond payment is contractual, the dividend is declared, and the price gain depends on what others will pay."
            }
          ]
        }
      ]
    }
  }
]
