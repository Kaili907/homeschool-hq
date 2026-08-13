import type { LessonProductionInput } from './types'

export function readyMathLesson(
  overrides: Partial<LessonProductionInput> = {},
): LessonProductionInput {
  return {
    lessonId: 'math-g5-u1-l1',
    title: 'Comparing Multi-Digit Numbers Using Place Value',
    courseId: 'grade5-math',
    unitId: 'unit-1',
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    instruction: {
      present: true,
      text: 'Students compare multi-digit whole numbers by examining the value of digits in each place, starting from the highest place value and working right until the digits differ. For example, when comparing 48,352 and 48,325, both numbers share the same ten-thousands, thousands, and hundreds digits, so the comparison comes down to the tens place: 5 tens versus 2 tens, making 48,352 the larger number.',
    },
    workedExample: {
      present: true,
      text: 'Worked example: compare 62,481 and 62,418. Ten-thousands match at 6, thousands match at 2, hundreds match at 4. The tens place differs: 8 versus 1, so 62,481 is greater than 62,418.',
    },
    guidedPractice: {
      present: true,
      text: 'With a partner, compare 73,502 and 73,520 by underlining the first place value where the digits differ, then circle the greater number and explain the choice out loud.',
    },
    independentWork: {
      present: true,
      text: 'Independent questions 1 through 10 compare pairs of five-digit numbers using the greater-than, less-than, or equal symbol. Mastery questions 11 through 14 require ordering four numbers from least to greatest and justifying the placement of the third number using place-value language.',
    },
    scoringAuthority: {
      kind: 'ANSWER_KEY',
      content: {
        present: true,
        text: 'Item 1: 48,352 greater than 48,325, tens place decides at 5 versus 2. Item 2 through 14 follow with full worked solutions and the specific place value that decided each comparison.',
      },
      verification: {
        method: 'INDEPENDENT_ORACLE',
        evidence: 'Every comparison in the key was recomputed from the item\'s own stated digits by the curriculum build\'s place-value comparison checker, independently of the authored answer text; all fourteen items matched.',
      },
    },
    remediation: {
      present: true,
      text: 'Reteach with a place-value chart and three-digit numbers, having students physically point to each place before comparing, then return to five-digit comparisons once that is fluent.',
    },
    extension: {
      present: true,
      text: 'Challenge students to compare numbers written in expanded form and in word form without first converting either to standard form.',
    },
    assessmentAlignment: 'ALIGNED',
    ...overrides,
  }
}

export function readyElaLesson(
  overrides: Partial<LessonProductionInput> = {},
): LessonProductionInput {
  return {
    lessonId: 'ela-g7-u3-l4',
    title: 'Analyzing Author Bias in Persuasive Editorials',
    courseId: 'grade7-ela',
    unitId: 'unit-3',
    subjectFamily: 'ELA_SOCIAL_STUDIES',
    instruction: {
      present: true,
      text: 'Students read the assigned 1963 newspaper editorial on the proposed highway bypass and identify rhetorical techniques the author uses to influence readers, including loaded language, selective evidence, and appeals to civic pride, before evaluating whether the argument fairly represents the opposing viewpoint.',
    },
    independentWork: {
      present: true,
      text: 'Student task: reread the editorial and annotate every instance of loaded language, appeal to emotion, or omitted counterargument. Independent response: write a two-paragraph analysis identifying the author\'s primary persuasive technique, citing at least two direct quotations from the text as evidence, and explaining how the technique shapes reader perception.',
    },
    scoringAuthority: {
      kind: 'RUBRIC',
      content: {
        present: true,
        text: 'Four-point analytic rubric scoring textual evidence, technique identification, explanation depth, and writing clarity.',
      },
      acceptableAnswerCriteria: {
        present: true,
        text: 'A response earning full credit names a specific technique rather than just "bias", quotes the exact phrase, and explains the intended effect on the reader in the writer\'s own words.',
      },
    },
    remediation: {
      present: true,
      text: 'Provide a sentence-starter frame and a pre-highlighted copy of the editorial for students still building evidence-citation skills.',
    },
    extension: {
      present: true,
      text: 'Have students find a contemporary editorial on a comparable local issue and compare rhetorical strategies across the two eras.',
    },
    requiresSourceIntegrity: true,
    sourceIntegrityStatus: 'VERIFIED',
    assessmentAlignment: 'ALIGNED',
    ...overrides,
  }
}

export function readyScienceLesson(
  overrides: Partial<LessonProductionInput> = {},
): LessonProductionInput {
  return {
    lessonId: 'sci-g8-u2-l5',
    title: 'Measuring Reaction Rate With Temperature Change',
    courseId: 'grade8-science',
    unitId: 'unit-2',
    subjectFamily: 'SCIENCE',
    instruction: {
      present: true,
      text: 'Students review how temperature affects the kinetic energy of reacting particles and predict how a warm-water bath will change the rate of an antacid-tablet dissolving reaction compared to a room-temperature control.',
    },
    independentWork: {
      present: true,
      text: 'Investigation: time how long an antacid tablet takes to fully dissolve in 100 milliliters of water at three temperatures, ten degrees, twenty-two degrees, and forty degrees Celsius, recording elapsed time and observed bubble rate for each trial. Student evidence: a data table of three trials per temperature plus a written claim-evidence-reasoning paragraph.',
    },
    scoringAuthority: {
      kind: 'RUBRIC',
      content: {
        present: true,
        text: 'Rubric scoring data-table completeness, trial-to-trial consistency, and the quality of the claim-evidence-reasoning paragraph.',
      },
    },
    remediation: {
      present: true,
      text: 'Provide a partially completed data table and sentence frames for the claim-evidence-reasoning paragraph.',
    },
    extension: {
      present: true,
      text: 'Have students graph rate against temperature and predict the dissolving time at sixty degrees Celsius from the trend.',
    },
    requiresSafetyOrPrivacyReview: true,
    safetyOrPrivacyStatus: 'VERIFIED',
    safeAlternative: {
      present: true,
      text: 'Students without access to a stovetop or kettle for warm water may use a provided video dataset of the same three trials to complete the data table and analysis.',
    },
    assessmentAlignment: 'ALIGNED',
    ...overrides,
  }
}

export function readyArtsLesson(
  overrides: Partial<LessonProductionInput> = {},
): LessonProductionInput {
  return {
    lessonId: 'art-g6-u4-l2',
    title: 'Composing a Value Study in Charcoal',
    courseId: 'grade6-art',
    unitId: 'unit-4',
    subjectFamily: 'ARTS_RFL_PE_PROJECT',
    independentWork: {
      present: true,
      text: 'Performance task: using charcoal on newsprint, complete a still-life value study of the classroom object arrangement, using at least five distinct value steps from white to near-black. Completion requirements: one finished nine-by-twelve study plus a labeled value scale showing the five steps used.',
    },
    scoringAuthority: {
      kind: 'SCORING_JUDGMENT',
      content: {
        present: true,
        text: 'Parent/teacher scoring guide: check for five distinguishable value steps, a consistent light source, and full page coverage; score as Emerging, Proficient, or Advanced.',
      },
    },
    remediation: {
      present: true,
      text: 'Provide a pre-drawn value scale template and reduce the still life to two objects for students still distinguishing value steps.',
    },
    extension: {
      present: true,
      text: 'Challenge students to complete a second study using a different light source direction and compare shadow placement between the two studies.',
    },
    requiresSafetyOrPrivacyReview: true,
    safetyOrPrivacyStatus: 'VERIFIED',
    safeAlternative: {
      present: true,
      text: 'Students with charcoal sensitivities may complete the same value study using graphite pencils at equivalent grades.',
    },
    assessmentAlignment: 'ALIGNED',
    ...overrides,
  }
}

/**
 * Financial Literacy, purely settleable: every item has one right answer, so
 * the lesson owes a verified fixed key and nothing else.
 */
export function readyFixedFinLitLesson(
  overrides: Partial<LessonProductionInput> = {},
): LessonProductionInput {
  return {
    lessonId: 'finlit-g5-u2-l3',
    title: 'Unit Price and the Better Buy',
    courseId: 'grade5-financial-literacy',
    unitId: 'unit-2',
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    structuredDiscipline: 'FINANCIAL_LITERACY',
    instruction: {
      present: true,
      text: 'Hana is an invented fifth grader comparing two pretend cracker boxes at a made-up store: a small box of 6 crackers for $1.80 and a large box of 20 crackers for $5.40. Students divide the shelf price by the number of crackers to reach a price per cracker, then compare the two figures to decide which box costs less for each cracker.',
    },
    workedExample: {
      present: true,
      text: 'Worked example: the small box costs $1.80 for 6 crackers, so $1.80 divided by 6 is $0.30 per cracker. The large box costs $5.40 for 20 crackers, so $5.40 divided by 20 is $0.27 per cracker, which is the lower unit price.',
    },
    guidedPractice: {
      present: true,
      text: 'With a partner, work out the price per cracker for an invented third box holding 10 crackers at $2.90, then place all three boxes in order from the lowest price per cracker to the highest.',
    },
    independentWork: {
      present: true,
      text: 'Independent items: find the price per cracker for each of the four pretend boxes on the sheet, then state which box has the lowest unit price and what four boxes of the cheapest option would cost altogether.',
    },
    responseScoring: {
      mode: 'FIXED_OR_COMPUTATIONAL',
      items: [
        { ref: 't1-p1', responseMode: 'FIXED', promptText: 'What is the price per cracker in the small box?' },
        { ref: 't2-p1', responseMode: 'FIXED', promptText: 'What is the price per cracker in the large box?' },
        { ref: 't3-p1', responseMode: 'FIXED', promptText: 'How much less does one cracker cost in the cheaper box?' },
        { ref: 't3-p2', responseMode: 'FIXED', promptText: 'What do four of the cheaper boxes cost altogether?' },
      ],
    },
    scoringAuthority: {
      kind: 'ANSWER_KEY',
      content: {
        present: true,
        text: 'Item 1: $1.80 divided by 6 crackers is $0.30 per cracker. Item 2: $5.40 divided by 20 crackers is $0.27 per cracker. Item 3: $0.30 less $0.27 is $0.03 cheaper per cracker in the large box. Item 4: four large boxes at $5.40 each come to $21.60.',
      },
      verification: {
        method: 'INDEPENDENT_ORACLE',
        evidence:
          'Every division and total in the key was recomputed in integer cents by the curriculum build oracle from the figures stated in the task sheet\'s own fictional scenario, independently of the authored answer text; all four items matched.',
      },
    },
    remediation: {
      present: true,
      text: 'Reteach with two pretend boxes holding 2 and 4 crackers so the division stays whole-cent, having the student say the price per cracker aloud before comparing the two figures.',
    },
    extension: {
      present: true,
      text: 'Challenge students to find a pretend box size and price where the larger box is the worse buy, and explain what makes that possible.',
    },
    assessmentAlignment: 'ALIGNED',
    ...overrides,
  }
}

/**
 * Financial Literacy, genuinely a judgment: no item has a settleable answer,
 * so demanding a fixed key would force the author to invent one.
 */
export function readyJudgmentFinLitLesson(
  overrides: Partial<LessonProductionInput> = {},
): LessonProductionInput {
  return {
    lessonId: 'finlit-g7-u2-l6',
    title: 'Recognising a Suspicious Money Request',
    courseId: 'grade7-financial-literacy',
    unitId: 'unit-2',
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    structuredDiscipline: 'FINANCIAL_LITERACY',
    instruction: {
      present: true,
      text: 'Amara is an invented seventh grader studying a pretend message that arrives the evening before a made-up club payment is due. The message is friendly, mentions a detail the sender could plausibly know, and asks for a transfer to a new account before the office opens. Students read the invented message and work out which features of it should raise concern.',
    },
    workedExample: {
      present: true,
      text: 'Worked example with the class: the invented message combines urgency, an unexpected change of account, and a request made outside office hours. Each of those on its own can be innocent; the point of the example is that they arrive together and that none of them can be checked at the moment they are asked for.',
    },
    guidedPractice: {
      present: true,
      text: 'In pairs, list what Amara can verify tonight, what she cannot verify until morning, and what the sender gains from the difference between those two lists.',
    },
    independentWork: {
      present: true,
      text: 'Independent response: explain why this invented request is suspicious, naming the specific features that make it so, and describe what Amara should do about it and who she should tell first.',
    },
    responseScoring: {
      mode: 'JUDGMENT_APPLICATION',
      items: [
        {
          ref: 't1-p1',
          responseMode: 'OPEN',
          promptText: 'Why does a message that arrives just when you are worried deserve more caution, not less?',
        },
        {
          ref: 't2-p1',
          responseMode: 'OPEN',
          promptText: 'What should Amara do about the request, and why does it not matter that the message sounded friendly?',
        },
        {
          ref: 't3-p1',
          responseMode: 'OPEN',
          promptText: 'Who on Amara\'s list is the right person to tell first, and what makes them the right one?',
        },
      ],
    },
    scoringAuthority: {
      kind: 'RUBRIC',
      content: {
        present: true,
        text: 'Naming the warning signs — Not yet: the response calls the invented message suspicious without saying what makes it so. Approaching: one feature such as the urgency is named but not connected to the request. Meets: the response names the urgency, the changed account, and the timing outside office hours, and says why each one blocks checking. Choosing a safe next step — Not yet: the response answers the message. Approaching: it refuses but names no one to tell. Meets: it stops, verifies through a channel the message did not supply, and names a trusted adult to tell first.',
      },
      acceptableAnswerCriteria: {
        present: true,
        text: 'A response earning full credit names at least two specific features of the invented message rather than a general feeling, says that verification must go through a channel the message did not supply, and names a trusted adult rather than replying to the sender.',
      },
    },
    remediation: {
      present: true,
      text: 'Provide the invented message annotated with the three warning signs already circled, and ask the student to say in their own words what each one prevents Amara from checking.',
    },
    extension: {
      present: true,
      text: 'Have students rewrite the invented message so it would be a genuine club reminder, and list what they had to change to make it verifiable.',
    },
    assessmentAlignment: 'ALIGNED',
    ...overrides,
  }
}

/**
 * Financial Literacy, both at once — the shape almost every authored FinLit
 * lesson actually takes: settleable arithmetic plus a reflection that no key
 * can score. Both authorities are required and neither substitutes.
 */
export function readyMixedFinLitLesson(
  overrides: Partial<LessonProductionInput> = {},
): LessonProductionInput {
  return {
    lessonId: 'finlit-g7-u1-l3',
    title: 'Gross Pay, Deductions, and What a Raise Really Adds',
    courseId: 'grade7-financial-literacy',
    unitId: 'unit-1',
    subjectFamily: 'MATH_STRUCTURED_FINLIT',
    structuredDiscipline: 'FINANCIAL_LITERACY',
    instruction: {
      present: true,
      text: 'Sofiane is an invented seventh grader with a pretend monthly gross pay of $2,400.00. An invented payroll deduction of 7.75% and an invented income-tax withholding of 10% both come off that gross figure. Students apply each percentage, combine the two deductions, and find the net pay that remains.',
    },
    workedExample: {
      present: true,
      text: 'Worked example: 7.75% of $2,400.00 is $186.00 in simulated payroll tax. Applying 10% to the same gross figure gives $240.00 in simulated income tax. The two deductions together come to $426.00, which leaves a net pay of $1,974.00.',
    },
    guidedPractice: {
      present: true,
      text: 'With a partner, repeat both deductions on an invented gross figure of $3,000.00, writing the two withheld amounts and the net pay before comparing your totals.',
    },
    independentWork: {
      present: true,
      text: 'Independent items: work out the net pay at both invented gross figures. Reflection: Sofiane\'s gross pay rose by $600.00 and the net pay rose by less, so explain what happened and what it means for planning around a raise.',
    },
    responseScoring: {
      mode: 'MIXED',
      items: [
        { ref: 't1-p1', responseMode: 'FIXED', promptText: 'How much is withheld for simulated payroll taxes?' },
        { ref: 't2-p1', responseMode: 'FIXED', promptText: 'How much is withheld for simulated income tax?' },
        { ref: 't2-p2', responseMode: 'FIXED', promptText: 'What do both deductions come to together?' },
        { ref: 't3-p1', responseMode: 'FIXED', promptText: 'What is the net pay on $2,400.00 gross?' },
        { ref: 't3-p2', responseMode: 'FIXED', promptText: 'What is the net pay on $3,000.00 gross?' },
        {
          ref: 't4-p1',
          responseMode: 'OPEN',
          promptText:
            'Explain why the increase in net pay is smaller than the increase in gross pay, and what that means for planning around a raise.',
        },
      ],
    },
    scoringAuthority: {
      kind: 'ANSWER_KEY',
      content: {
        present: true,
        text: 'Item t1-p1: 7.75% of $2,400.00 is $186.00. Item t2-p1: 10% of $2,400.00 is $240.00. Item t2-p2: $186.00 plus $240.00 is $426.00. Item t3-p1: $2,400.00 less $426.00 is $1,974.00. Item t3-p2: on $3,000.00 the deductions are $232.50 and $300.00, so the net pay is $2,467.50.',
      },
      verification: {
        method: 'INDEPENDENT_ORACLE',
        evidence:
          'Each percentage and difference was recomputed in integer cents by the curriculum build oracle from the figures stated in this task sheet\'s own fictional scenario, then compared against the separately authored answer; the build refuses to emit on any disagreement.',
      },
      rubric: {
        present: true,
        text: 'Reasoning about deductions on a raise — Not yet: the response treats Sofiane\'s gross increase as the money gained. Approaching: the smaller net increase is noticed but the percentage mechanism is not explained. Meets: the response explains that Sofiane\'s deductions are proportional, so part of any raise is withheld too, and warns against planning around the gross figure.',
      },
    },
    remediation: {
      present: true,
      text: 'Reteach with a single 10% deduction on an invented $1,000.00 gross so the arithmetic is one step, then reintroduce the second deduction once the first is fluent.',
    },
    extension: {
      present: true,
      text: 'Have students find the invented gross pay at which the two deductions together first exceed $500.00, and describe how they narrowed it down.',
    },
    assessmentAlignment: 'ALIGNED',
    ...overrides,
  }
}
