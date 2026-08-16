import type {
  LearnerMaterialDto,
  LearnerMaterialItemDto,
  LearnerMaterialSectionDto,
  LearnerResponseType,
} from '../final-app/learner-response'
import type {
  ElaDirectorReadability,
  ElaDirectorSample,
  ElaDirectorSampleGrade,
} from './types'

interface ChoiceConfig {
  readonly type: 'CHOICE'
  readonly prompt: string
  readonly choices: readonly string[]
}
interface ConstructedConfig {
  readonly type: 'CONSTRUCTED_RESPONSE' | 'TEXT'
  readonly prompt: string
}

type ResponseConfig = ChoiceConfig | ConstructedConfig

interface ElaDirectorSampleConfig {
  readonly grade: ElaDirectorSampleGrade
  readonly canonicalLessonRef: string
  readonly topic: string
  readonly standards: readonly string[]
  readonly textType: string
  readonly title: string
  readonly welcome: string
  readonly instruction: string
  readonly vocabulary: readonly { readonly term: string; readonly definition: string }[]
  readonly model: string
  readonly modelPrompt: string
  readonly passageTitle: string
  readonly passage: string
  readonly passageDirections: string
  readonly guidedDirections: string
  readonly guided: ResponseConfig
  readonly guidedFeedback: string
  readonly independentDirections: string
  readonly independent: ConstructedConfig
  readonly processFeedback: string
  readonly revisionDirections: string
  readonly revision: ConstructedConfig
  readonly rubricCriteria: readonly string[]
  readonly review: {
    readonly learned: string
    readonly howYouDid: string
    readonly didWell: string
    readonly practice: string
    readonly reviewLesson: string
    readonly courseProgress: string
    readonly nextAction: string
  }
  readonly readability: ElaDirectorReadability
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function readItem(itemRef: string, prompt: string): LearnerMaterialItemDto {
  return Object.freeze({ itemRef, responseKind: 'READ' as const, prompt })
}

function responseItem(itemRef: string, response: ResponseConfig): LearnerMaterialItemDto {
  return Object.freeze({
    itemRef,
    itemKind: response.type === 'CHOICE' ? 'multiple-choice' : 'constructed-response',
    responseKind: response.type,
    prompt: response.prompt,
    ...(response.type === 'CHOICE' ? { choices: Object.freeze(response.choices) } : {}),
  })
}

function section(input: LearnerMaterialSectionDto): LearnerMaterialSectionDto {
  return Object.freeze(input)
}

function reviewSection(base: string, suffix: string, title: string, body: string): LearnerMaterialSectionDto {
  return section({
    sectionRef: `${base}:review:${suffix}`,
    sectionKind: 'reflection',
    title,
    body,
    items: Object.freeze([readItem(`${base}:review:${suffix}:read`, `Read this ${title.toLowerCase()} note, then continue.`)]),
  })
}

export function buildElaDirectorSample(config: ElaDirectorSampleConfig): ElaDirectorSample {
  const base = `director-ela-r2-g${config.grade}`
  const guidedItemRef = `${base}:guided:response`
  const guidedFeedbackRef = `${base}:guided:feedback`
  const independentItemRef = `${base}:independent:response`
  const processFeedbackRef = `${base}:independent:feedback`
  const revisionItemRef = `${base}:revision:response`
  const courseId = `ma-g${config.grade}-english-language-arts`
  const sections: readonly LearnerMaterialSectionDto[] = Object.freeze([
    section({
      sectionRef: `${base}:welcome`, sectionKind: 'teaching', title: 'WELCOME / PURPOSE', body: config.welcome,
      items: Object.freeze([readItem(`${base}:welcome:read`, 'Read the lesson purpose and choose Continue when you are ready.')]),
    }),
    section({
      sectionRef: `${base}:instruction`, sectionKind: 'teaching', title: 'SHORT INSTRUCTION', body: config.instruction,
      items: Object.freeze([readItem(`${base}:instruction:read`, 'Study the reading move you will use in this lesson.')]),
    }),
    section({
      sectionRef: `${base}:vocabulary`, sectionKind: 'vocabulary', title: 'WORDS TO KNOW',
      vocabulary: Object.freeze(config.vocabulary.map((entry) => Object.freeze(entry))),
      items: Object.freeze([readItem(`${base}:vocabulary:read`, 'Use these definitions while you read and write.')]),
    }),
    section({
      sectionRef: `${base}:model`, sectionKind: 'worked-example', title: "EXAMPLE / LET'S LOOK AT ONE", body: config.model,
      items: Object.freeze([readItem(`${base}:model:read`, config.modelPrompt)]),
    }),
    section({
      sectionRef: `${base}:passage`, sectionKind: 'source', title: `READ: ${config.passageTitle}`,
      directions: config.passageDirections,
      body: config.passage,
      reference: Object.freeze({
        creator: 'Manuel Academy', rightsCategory: 'original', deliveryMode: 'inline full text',
        rightsStatement: 'Original Manuel Academy instructional text for this isolated Director sample.',
      }),
      items: Object.freeze([readItem(`${base}:passage:read`, `Read “${config.passageTitle}” in full before responding.`)]),
    }),
    section({
      sectionRef: `${base}:guided`, sectionKind: 'guided-practice', title: 'YOUR TURN — GUIDED PRACTICE',
      directions: config.guidedDirections,
      items: Object.freeze([responseItem(guidedItemRef, config.guided)]),
    }),
    section({
      sectionRef: guidedFeedbackRef, sectionKind: 'remediation feedback-after-response', title: 'FEEDBACK — CHECK THE REASONING',
      body: config.guidedFeedback,
      items: Object.freeze([readItem(`${guidedFeedbackRef}:read`, 'Use this feedback to check the response you just saved.')]),
    }),
    section({
      sectionRef: `${base}:independent`, sectionKind: 'independent-practice', title: 'YOUR TURN — INDEPENDENT RESPONSE',
      directions: config.independentDirections,
      items: Object.freeze([responseItem(independentItemRef, config.independent)]),
    }),
    section({
      sectionRef: processFeedbackRef, sectionKind: 'remediation feedback-after-response', title: 'FEEDBACK — PREPARE TO REVISE',
      body: config.processFeedback,
      items: Object.freeze([readItem(`${processFeedbackRef}:read`, 'Apply this process guidance to the response you just saved.')]),
    }),
    section({
      sectionRef: `${base}:revision`, sectionKind: 'independent-practice additional-practice revision', title: 'YOUR TURN — REVISE',
      directions: config.revisionDirections,
      items: Object.freeze([responseItem(revisionItemRef, config.revision)]),
    }),
    section({
      sectionRef: `${base}:parent-review`, sectionKind: 'rubric-review-pending', title: 'PARENT REVIEW',
      body: `Your independent response and revision are saved for Parent Review. No automatic essay score is produced. The reviewer will use these dimensions: ${config.rubricCriteria.join('; ')}.`,
      items: Object.freeze([Object.freeze({
        itemRef: `${base}:parent-review:pending`, responseKind: 'RUBRIC_REVIEW_PENDING' as const,
        prompt: 'Continue to the lesson review while your constructed response remains pending human judgment.',
      })]),
    }),
    reviewSection(base, 'learned', 'WHAT YOU LEARNED', config.review.learned),
    reviewSection(base, 'how', 'HOW YOU DID', config.review.howYouDid),
    reviewSection(base, 'well', 'WHAT YOU DID WELL', config.review.didWell),
    reviewSection(base, 'practice', 'WHAT TO PRACTICE', config.review.practice),
    reviewSection(base, 'lesson', 'REVIEW THIS LESSON', config.review.reviewLesson),
    reviewSection(base, 'progress', 'COURSE PROGRESS', config.review.courseProgress),
    reviewSection(base, 'next', 'NEXT ACTION', config.review.nextAction),
  ])

  const material: LearnerMaterialDto = Object.freeze({
    lessonRef: config.canonicalLessonRef,
    title: config.title,
    subject: 'english-language-arts',
    format: 'structured',
    sections,
  })
  const responseTypes: readonly LearnerResponseType[] = Object.freeze(Array.from(new Set([
    config.guided.type,
    config.independent.type,
    config.revision.type,
    'RUBRIC_REVIEW_PENDING' as const,
  ])))

  return Object.freeze({
    sampleId: base,
    grade: config.grade,
    courseId,
    courseTitle: `Grade ${config.grade} English Language Arts`,
    canonicalLessonRef: config.canonicalLessonRef,
    canonicalPackagePath: `curriculum-production/student-work/english-language-arts/packages/grade-${String(config.grade).padStart(2, '0')}/${config.canonicalLessonRef}.package.json`,
    topic: config.topic,
    standards: Object.freeze(config.standards),
    textType: config.textType,
    responseTypes,
    passageWordCount: countWords(config.passage),
    readability: Object.freeze(config.readability),
    feedbackLinks: Object.freeze([
      Object.freeze({ responseItemRef: guidedItemRef, feedbackSectionRef: guidedFeedbackRef }),
      Object.freeze({ responseItemRef: independentItemRef, feedbackSectionRef: processFeedbackRef }),
    ]),
    reviewPresent: true,
    parentReviewRequired: true,
    material,
  })
}
