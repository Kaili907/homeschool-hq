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
