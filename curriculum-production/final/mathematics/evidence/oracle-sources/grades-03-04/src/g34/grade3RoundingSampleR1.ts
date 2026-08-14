import { blueprintFor } from '../blueprint.ts'
import type { SourceLesson } from '../lessonSources.ts'
import type {
  AnswerKey,
  AnswerKeyEntry,
  ConstructedResponseItem,
  MaterialDifficulty,
  MaterialItem,
  MaterialSection,
  MultipleChoiceItem,
  StudentWorkPackage,
  WorkedExampleItem,
  WorkedSolution,
} from '../types.ts'

export const GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID = 'ma-g3-mathematics-u01-l02'

const SOURCE_REF =
  'curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/g34/grade3RoundingSampleR1.ts'
const ITEM_TYPE = 'round-to-nearest-hundred-sample-r1'
const STANDARD = '3.NBT.1'
const RESPONSE_EXPECTATION = 'Write your answer. Show or tell how you know.'

type OracleTask =
  | 'round'
  | 'bounds'
  | 'tens-digit'
  | 'direction'
  | 'explain'
  | 'error-analysis'
  | 'least-rounds-to'
  | 'range-claim'

export interface RoundingSampleOracleParameters {
  task: OracleTask
  value: number
  claimed?: string
  target?: number
}

interface AuthoredGradedItem {
  refSuffix: string
  kind: 'multiple-choice' | 'constructed-response'
  itemType: string
  difficulty: MaterialDifficulty
  prompt: string
  parameters: RoundingSampleOracleParameters
  choices?: readonly string[]
  responseExpectation?: string
}

function boundingHundreds(value: number): readonly [number, number] {
  const below = Math.floor(value / 100) * 100
  return [below, below + 100]
}

function roundToNearestHundred(value: number): number {
  const [below, above] = boundingHundreds(value)
  return value - below >= 50 ? above : below
}

function tensDigit(value: number): number {
  return Math.floor(value / 10) % 10
}

/**
 * Independent adult answer authority for every graded sample item.
 *
 * The authored item records only the quantities and task. This function
 * recomputes the trusted answer from those quantities, including the halfway
 * convention required by 3.NBT.1. The learner package never receives it.
 */
export function grade3RoundingSampleR1Oracle(
  parameters: RoundingSampleOracleParameters,
): string {
  const [below, above] = boundingHundreds(parameters.value)
  const rounded = roundToNearestHundred(parameters.value)
  switch (parameters.task) {
    case 'round':
      return String(rounded)
    case 'bounds':
      return `${below} and ${above}`
    case 'tens-digit':
      return String(tensDigit(parameters.value))
    case 'direction':
      return rounded === below ? `down to ${below}` : `up to ${above}`
    case 'explain':
      return `${parameters.value} rounds to ${rounded} because its tens digit is ${tensDigit(parameters.value)}, so it is ${rounded === below ? `closer to ${below}` : parameters.value - below === 50 ? `halfway and rounds up to ${above}` : `closer to ${above}`}.`
    case 'error-analysis':
      return `The student is not correct. ${parameters.value} rounds to ${rounded} because its tens digit is ${tensDigit(parameters.value)}, so it is ${rounded === below ? `closer to ${below}` : `closer to ${above}`}.`
    case 'least-rounds-to':
      if (parameters.target === undefined) throw new Error('least-rounds-to needs a target')
      return String(parameters.target - 50)
    case 'range-claim':
      return 'No. 650 through 699 round to 700 because those numbers are halfway or closer to 700.'
  }
}

function reasoningFor(parameters: RoundingSampleOracleParameters): WorkedSolution {
  const answer = grade3RoundingSampleR1Oracle(parameters)
  const [below, above] = boundingHundreds(parameters.value)
  const digit = tensDigit(parameters.value)
  if (parameters.task === 'bounds') {
    return {
      steps: [
        `${below} is the hundred just below ${parameters.value}.`,
        `${above} is the hundred just above ${parameters.value}.`,
        `So the two bounding hundreds are ${answer}.`,
      ],
      answer,
    }
  }
  if (parameters.task === 'tens-digit') {
    return {
      steps: [
        `Read ${parameters.value} by place value.`,
        `The digit directly to the right of the hundreds place is ${digit}.`,
        `That digit is the tens digit.`,
      ],
      answer,
    }
  }
  if (parameters.task === 'direction') {
    return {
      steps: [
        `${parameters.value} is between ${below} and ${above}.`,
        `Its tens digit is ${digit}.`,
        `${digit} is ${digit < 5 ? 'less than 5, so choose the lower hundred' : '5 or more, so choose the higher hundred'}.`,
      ],
      answer,
    }
  }
  if (parameters.task === 'least-rounds-to') {
    const target = parameters.target as number
    return {
      steps: [
        `The halfway point between ${target - 100} and ${target} is ${target - 50}.`,
        'A number at the halfway point rounds up.',
        `So ${target - 50} is the least whole number that rounds to ${target}.`,
      ],
      answer,
    }
  }
  if (parameters.task === 'range-claim') {
    return {
      steps: [
        'Numbers from 600 through 649 are closer to 600.',
        '650 is halfway between 600 and 700, so it rounds up to 700.',
        'Numbers from 651 through 699 are also closer to 700.',
      ],
      answer,
    }
  }
  return {
    steps: [
      `${parameters.value} is between ${below} and ${above}.`,
      `Its tens digit is ${digit}.`,
      `${digit} is ${digit < 5 ? 'less than 5, so round down' : '5 or more, so round up'}.`,
      answer,
    ],
    answer,
  }
}

const REFERENCE_EXAMPLE = {
  prompt: 'Round 243 to the nearest hundred.',
  steps: [
    'Step 1: 243 is between 200 and 300.',
    'Step 2: The tens digit is 4.',
    'Step 3: 4 is less than 5, so choose 200.',
    'Why: 243 is 43 away from 200 and 57 away from 300. It is closer to 200.',
  ],
  answer: '200',
} as const

const WORKED_EXAMPLES: readonly WorkedExampleItem[] = [
  {
    ref: `${GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID}#ex-01`,
    kind: 'worked-example',
    itemType: ITEM_TYPE,
    standard: STANDARD,
    difficulty: 1,
    prompt: 'Example 1 — Round 243 to the nearest hundred.',
    workedSolution: {
      steps: REFERENCE_EXAMPLE.steps,
      answer: '200',
    },
  },
  {
    ref: `${GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID}#ex-02`,
    kind: 'worked-example',
    itemType: ITEM_TYPE,
    standard: STANDARD,
    difficulty: 2,
    prompt: 'Example 2 — Round 678 to the nearest hundred.',
    workedSolution: {
      steps: [
        'Step 1: 678 is between 600 and 700.',
        'Step 2: The tens digit is 7.',
        'Step 3: 7 is 5 or more, so choose 700.',
        'Why: 678 is 78 away from 600 and only 22 away from 700. It is closer to 700.',
      ],
      answer: '700',
    },
  },
  {
    ref: `${GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID}#ex-03`,
    kind: 'worked-example',
    itemType: ITEM_TYPE,
    standard: STANDARD,
    difficulty: 2,
    prompt: 'Example 3 — Round 550 to the nearest hundred.',
    workedSolution: {
      steps: [
        'Step 1: 550 is between 500 and 600.',
        'Step 2: The tens digit is 5.',
        'Step 3: A 5 means the number is halfway, so choose the higher hundred, 600.',
        'Why: 550 is 50 away from both hundreds. When a number is halfway, we round up.',
      ],
      answer: '600',
    },
  },
]

const GUIDED_ITEMS: readonly AuthoredGradedItem[] = [
  {
    refSuffix: 'gp-01',
    kind: 'multiple-choice',
    itemType: 'identify-bounding-hundreds',
    difficulty: 1,
    prompt: '234 is between which two hundreds?',
    choices: ['100 and 200', '200 and 300', '300 and 400', '230 and 240'],
    parameters: { task: 'bounds', value: 234 },
  },
  {
    refSuffix: 'gp-02',
    kind: 'multiple-choice',
    itemType: 'identify-tens-digit',
    difficulty: 1,
    prompt: 'Look at 681. Which digit is in the tens place?',
    choices: ['6', '8', '1', '0'],
    parameters: { task: 'tens-digit', value: 681 },
  },
  {
    refSuffix: 'gp-03',
    kind: 'multiple-choice',
    itemType: 'choose-rounding-direction',
    difficulty: 1,
    prompt: '762 is between 700 and 800. Should you round down or up?',
    choices: ['down to 700', 'up to 800', 'stay at 762', 'down to 760'],
    parameters: { task: 'direction', value: 762 },
  },
  {
    refSuffix: 'gp-04',
    kind: 'constructed-response',
    itemType: ITEM_TYPE,
    difficulty: 2,
    prompt: '419 is between 400 and 500. Round 419 to the nearest hundred.',
    parameters: { task: 'round', value: 419 },
  },
  {
    refSuffix: 'gp-05',
    kind: 'constructed-response',
    itemType: 'round-and-explain',
    difficulty: 2,
    prompt: 'Round 853 to the nearest hundred. Tell how the tens digit helped you decide.',
    parameters: { task: 'explain', value: 853 },
  },
]

const INDEPENDENT_ITEMS: readonly AuthoredGradedItem[] = [
  {
    refSuffix: 'ip-01', kind: 'constructed-response', itemType: ITEM_TYPE, difficulty: 1,
    prompt: 'Round 142 to the nearest hundred.', parameters: { task: 'round', value: 142 },
  },
  {
    refSuffix: 'ip-02', kind: 'constructed-response', itemType: ITEM_TYPE, difficulty: 1,
    prompt: 'Round 684 to the nearest hundred.', parameters: { task: 'round', value: 684 },
  },
  {
    refSuffix: 'ip-03', kind: 'constructed-response', itemType: 'round-halfway', difficulty: 2,
    prompt: 'Round 450 to the nearest hundred.', parameters: { task: 'round', value: 450 },
  },
  {
    refSuffix: 'ip-04', kind: 'multiple-choice', itemType: ITEM_TYPE, difficulty: 1,
    prompt: 'Which is 326 rounded to the nearest hundred?', choices: ['300', '320', '330', '400'],
    parameters: { task: 'round', value: 326 },
  },
  {
    refSuffix: 'ip-05', kind: 'constructed-response', itemType: 'rounding-application', difficulty: 2,
    prompt: 'A museum had 781 visitors. About how many visitors is that, rounded to the nearest hundred?',
    parameters: { task: 'round', value: 781 },
  },
  {
    refSuffix: 'ip-06', kind: 'constructed-response', itemType: 'rounding-error-analysis', difficulty: 2,
    prompt: 'A student says 249 rounds to 300 because 9 is more than 5. Is the student correct? Explain the mistake.',
    parameters: { task: 'error-analysis', value: 249, claimed: '300' },
  },
  {
    refSuffix: 'ip-07', kind: 'constructed-response', itemType: 'round-and-explain', difficulty: 2,
    prompt: 'Round 615 to the nearest hundred. Explain why your answer is nearer than the other hundred.',
    parameters: { task: 'explain', value: 615 },
  },
  {
    refSuffix: 'ip-08', kind: 'constructed-response', itemType: ITEM_TYPE, difficulty: 2,
    prompt: 'Round 999 to the nearest hundred.', parameters: { task: 'round', value: 999 },
  },
  {
    refSuffix: 'ip-09', kind: 'constructed-response', itemType: 'rounding-application', difficulty: 2,
    prompt: 'A food drive collected 352 cans. About how many cans is that, rounded to the nearest hundred?',
    parameters: { task: 'round', value: 352 },
  },
  {
    refSuffix: 'ip-10', kind: 'multiple-choice', itemType: ITEM_TYPE, difficulty: 2,
    prompt: 'Which hundred is closest to 574?', choices: ['500', '570', '600', '700'],
    parameters: { task: 'round', value: 574 },
  },
]

const MASTERY_ITEMS: readonly AuthoredGradedItem[] = [
  {
    refSuffix: 'mc-01', kind: 'constructed-response', itemType: ITEM_TYPE, difficulty: 1,
    prompt: 'Round 214 to the nearest hundred.', parameters: { task: 'round', value: 214 },
  },
  {
    refSuffix: 'mc-02', kind: 'multiple-choice', itemType: ITEM_TYPE, difficulty: 2,
    prompt: 'Which is 863 rounded to the nearest hundred?', choices: ['800', '860', '900', '1,000'],
    parameters: { task: 'round', value: 863 },
  },
  {
    refSuffix: 'mc-03', kind: 'constructed-response', itemType: 'rounding-application', difficulty: 2,
    prompt: 'A school used 547 sheets of paper. About how many sheets is that, rounded to the nearest hundred?',
    parameters: { task: 'round', value: 547 },
  },
  {
    refSuffix: 'mc-04', kind: 'constructed-response', itemType: 'round-and-explain', difficulty: 2,
    prompt: 'Round 650 to the nearest hundred. Explain what happens because the tens digit is 5.',
    parameters: { task: 'explain', value: 650 },
  },
  {
    refSuffix: 'mc-05', kind: 'constructed-response', itemType: 'rounding-error-analysis', difficulty: 2,
    prompt: 'A student says 392 rounds to 300. Is the student correct? Explain how you know.',
    parameters: { task: 'error-analysis', value: 392, claimed: '300' },
  },
]

const REMEDIATION_ITEMS: readonly AuthoredGradedItem[] = [
  {
    refSuffix: 'rm-01', kind: 'multiple-choice', itemType: 'identify-bounding-hundreds', difficulty: 1,
    prompt: '371 is between which two hundreds?', choices: ['200 and 300', '300 and 400', '370 and 380', '400 and 500'],
    parameters: { task: 'bounds', value: 371 },
  },
  {
    refSuffix: 'rm-02', kind: 'multiple-choice', itemType: 'identify-tens-digit', difficulty: 1,
    prompt: 'Look at 526. Which digit helps you round to the nearest hundred?', choices: ['5', '2', '6', '0'],
    parameters: { task: 'tens-digit', value: 526 },
  },
  {
    refSuffix: 'rm-03', kind: 'multiple-choice', itemType: 'choose-rounding-direction', difficulty: 1,
    prompt: '487 is between 400 and 500. Should you round down or up?',
    choices: ['down to 400', 'up to 500', 'stay at 487', 'down to 480'],
    parameters: { task: 'direction', value: 487 },
  },
  {
    refSuffix: 'rm-04', kind: 'constructed-response', itemType: ITEM_TYPE, difficulty: 1,
    prompt: 'Now put the steps together. Round 438 to the nearest hundred.',
    parameters: { task: 'round', value: 438 },
  },
]

const CHALLENGE_ITEMS: readonly AuthoredGradedItem[] = [
  {
    refSuffix: 'xt-01', kind: 'constructed-response', itemType: 'rounding-boundary-challenge', difficulty: 3,
    prompt: 'What is the least whole number that rounds to 800 when rounding to the nearest hundred? Explain why.',
    parameters: { task: 'least-rounds-to', value: 800, target: 800 },
  },
  {
    refSuffix: 'xt-02', kind: 'constructed-response', itemType: 'rounding-range-challenge', difficulty: 3,
    prompt: 'Maya says every whole number from 600 through 699 rounds to 600. Is she right? Explain.',
    parameters: { task: 'range-claim', value: 650 },
  },
]

function buildGradedItem(authored: AuthoredGradedItem): MaterialItem {
  const common = {
    ref: `${GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID}#${authored.refSuffix}`,
    itemType: authored.itemType,
    standard: STANDARD,
    difficulty: authored.difficulty,
    prompt: authored.prompt,
  }
  if (authored.kind === 'multiple-choice') {
    return {
      ...common,
      kind: 'multiple-choice',
      choices: authored.choices as readonly string[],
    } satisfies MultipleChoiceItem
  }
  return {
    ...common,
    kind: 'constructed-response',
    responseExpectation: authored.responseExpectation ?? RESPONSE_EXPECTATION,
  } satisfies ConstructedResponseItem
}

function buildAnswer(authored: AuthoredGradedItem): AnswerKeyEntry {
  const answer = grade3RoundingSampleR1Oracle(authored.parameters)
  const answerIndex = authored.kind === 'multiple-choice'
    ? (authored.choices as readonly string[]).indexOf(answer)
    : undefined
  if (authored.kind === 'multiple-choice' && answerIndex === -1) {
    throw new Error(`${authored.refSuffix}: oracle answer ${answer} is not one of the authored choices`)
  }
  return {
    ref: `${GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID}#${authored.refSuffix}`,
    itemType: authored.itemType,
    standard: STANDARD,
    difficulty: authored.difficulty,
    answerType: 'fixed',
    answer,
    ...(answerIndex === undefined ? {} : { answerIndex }),
    given: { ...authored.parameters },
    solutionReasoning: reasoningFor(authored.parameters),
    referenceExample: REFERENCE_EXAMPLE,
    verification: {
      method: 'recomputed',
      oracle: `${SOURCE_REF}#grade3RoundingSampleR1Oracle`,
      parameters: { ...authored.parameters },
    },
    commonErrors: [
      {
        observed: 'The learner chose the wrong neighboring hundred.',
        likelyCause: 'The learner may have looked at the ones digit or rounded down every time.',
        remediation: 'Name both neighboring hundreds, then use the tens digit to decide which one is nearer.',
      },
    ],
  }
}

function section(
  sectionId: string,
  kind: MaterialSection['kind'],
  title: string,
  directions: string,
  authored: readonly AuthoredGradedItem[],
): MaterialSection {
  return { sectionId, kind, title, directions, items: authored.map(buildGradedItem) }
}

export function emitGrade3RoundingSampleR1(lesson: SourceLesson): {
  package: StudentWorkPackage
  answerKey: AnswerKey
} {
  if (lesson.ref.lessonId !== GRADE3_ROUNDING_SAMPLE_R1_LESSON_ID) {
    throw new Error(`Rounding Sample R1 cannot emit ${lesson.ref.lessonId}`)
  }
  const blueprint = blueprintFor(lesson.ref.phase)
  const sections: readonly MaterialSection[] = [
    {
      sectionId: 'learn-01',
      kind: 'instructional-example',
      title: 'Learn: Find the Nearby Hundreds',
      directions: 'Today you will learn how to round a number to the nearest hundred. Rounding finds a nearby hundred that is easier to use. First, find the two hundreds around the number. For 327, the nearby hundreds are 300 and 400. Picture a number line: 300 — 327 — 400.',
      items: [],
    },
    {
      sectionId: 'learn-02',
      kind: 'instructional-example',
      title: 'Learn: Let the Tens Digit Help',
      directions: 'The tens digit tells which hundred is nearer. A tens digit from 0 through 4 means the number is closer to the lower hundred. A tens digit from 5 through 9 means the number is halfway or closer to the higher hundred. The ones digit does not make this choice.',
      items: [],
    },
    {
      sectionId: 'learn-03',
      kind: 'instructional-example',
      title: 'Learn: What Happens Halfway?',
      directions: 'A number ending in 50 is exactly halfway between two hundreds. It is the same distance from both. Our rounding rule says to choose the higher hundred when the tens digit is 5. So halfway numbers round up.',
      items: [],
    },
    {
      sectionId: 'ex',
      kind: 'instructional-example',
      title: 'Examples',
      directions: 'Read each example. Notice the nearby hundreds, the tens digit, and why the answer is nearer.',
      items: WORKED_EXAMPLES,
    },
    section('gp', 'guided-practice', "Let's Try One", 'Work with your teaching adult. The clues get smaller as you go.', GUIDED_ITEMS),
    section('ip', 'independent-practice', 'Your Turn', 'Work on your own. Show a number line, place-value thinking, or words when a question asks you to explain.', INDEPENDENT_ITEMS),
    section('mc', 'mastery-check', 'Check What You Know', 'Try these fresh problems without help. Show or tell your thinking when asked.', MASTERY_ITEMS),
    section('rm', 'guided-practice', 'Need Help?', 'Remember: find the two hundreds around the number. Then look at the tens digit. 0–4 means choose the lower hundred. 5–9 means choose the higher hundred.', REMEDIATION_ITEMS),
    section('xt', 'extension', 'Challenge', 'These two problems are optional. Use what you know about halfway points and groups of numbers.', CHALLENGE_ITEMS),
  ]
  const allAuthored = [
    ...GUIDED_ITEMS,
    ...INDEPENDENT_ITEMS,
    ...MASTERY_ITEMS,
    ...REMEDIATION_ITEMS,
    ...CHALLENGE_ITEMS,
  ]

  const materialPackage: StudentWorkPackage = {
    schemaVersion: '1.0',
    packageId: `swk-${lesson.ref.lessonId}`,
    lessonRef: lesson.ref,
    standards: lesson.standards,
    blueprint: {
      phase: lesson.ref.phase,
      profile: blueprint.profile,
      sectionKinds: sections.map((entry) => entry.kind),
    },
    sections,
    answerKeyRef: 'answer-keys/grade-03/ma-g3-mathematics-u01-l02.key.json',
    integrity: {
      corpusVersion: '1.0.0',
      itemSource: `${SOURCE_REF}#emitGrade3RoundingSampleR1`,
      seed: '1.0.0|ma-g3-mathematics-u01-l02|sample-r1',
    },
  }

  const answerKey: AnswerKey = {
    schemaVersion: '1.0',
    packageId: materialPackage.packageId,
    lessonRef: {
      lessonId: lesson.ref.lessonId,
      courseId: lesson.ref.courseId,
      grade: lesson.ref.grade,
      unitNumber: lesson.ref.unitNumber,
      phase: lesson.ref.phase,
    },
    answers: allAuthored.map(buildAnswer),
    scoringGuidance: 'Use the separate adult key. Accept equivalent Grade 3 wording on constructed responses when it names the correct rounded hundred and gives mathematically sound reasoning.',
    masteryRule: 'The learner is ready to move on after at least 4 of the 5 Check What You Know items are correct, including one explanation item.',
    remediationGuidance: [
      'Use the four Need Help? items in order: bounding hundreds, tens digit, direction, then the full rounding decision.',
      'Draw a number line and mark the halfway point if the learner still chooses a hundred by the ones digit.',
    ],
    extensionGuidance: [
      'Challenge work is optional. Ask the learner to defend the boundary at 50 instead of introducing a new rounding place.',
    ],
    integrity: {
      corpusVersion: '1.0.0',
      seed: '1.0.0|ma-g3-mathematics-u01-l02|sample-r1',
    },
  }

  return { package: materialPackage, answerKey }
}
