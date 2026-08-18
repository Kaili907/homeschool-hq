/**
 * ELA Production R3 — lesson builder.
 *
 * This is a structural assembler only. It contains no lesson content, no
 * teaching copy, and no defaults that would author on an author's behalf: every
 * learner-visible string is supplied by the caller. Its single job is to place
 * caller-supplied copy into the exact eighteen-section shape the nine frozen
 * ELA Director samples use, so that production lessons project through the same
 * `createRichLessonRenderModel` path with no legacy fallback.
 *
 * The section order, titles, kinds, and item wiring are transcribed from
 * `src/study/family-pilot/ela-director-samples-r2/buildSample.ts`, which is
 * frozen and must not be edited. `elaProductionR3.test.ts` proves the two stay
 * structurally identical.
 */
import type {
  LearnerMaterialDto,
  LearnerMaterialItemDto,
  LearnerMaterialSectionDto,
  LearnerResponseType,
} from '../final-app/learner-response'
import { ELA_R3_GRADES, ELA_R3_REQUIRED_SOURCE_REFERENCE } from './contract'
import type {
  ElaProductionChoiceResponse,
  ElaProductionConstructedResponse,
  ElaProductionLesson,
  ElaProductionLessonInput,
} from './types'

type ResponseConfig = ElaProductionChoiceResponse | ElaProductionConstructedResponse

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

/**
 * Assembles one production ELA lesson.
 *
 * Refs are namespaced by the canonical lesson id, so a production lesson never
 * collides with the frozen `director-ela-r2-g*` sample refs.
 */
export function buildElaProductionLesson(input: ElaProductionLessonInput): ElaProductionLesson {
  const { placement } = input
  if (!(ELA_R3_GRADES as readonly number[]).includes(placement.grade)) {
    throw new Error(`Grade ${placement.grade} is not a supported ELA grade.`)
  }
  const base = placement.lessonId
  const guidedItemRef = `${base}:guided:response`
  const guidedFeedbackRef = `${base}:guided:feedback`
  const independentItemRef = `${base}:independent:response`
  const processFeedbackRef = `${base}:independent:feedback`
  const revisionItemRef = `${base}:revision:response`

  const sections: readonly LearnerMaterialSectionDto[] = Object.freeze([
    section({
      sectionRef: `${base}:welcome`, sectionKind: 'teaching', title: 'WELCOME / PURPOSE', body: input.welcome,
      items: Object.freeze([readItem(`${base}:welcome:read`, 'Read the lesson purpose and choose Continue when you are ready.')]),
    }),
    section({
      sectionRef: `${base}:instruction`, sectionKind: 'teaching', title: 'SHORT INSTRUCTION', body: input.instruction,
      items: Object.freeze([readItem(`${base}:instruction:read`, 'Study the reading move you will use in this lesson.')]),
    }),
    section({
      sectionRef: `${base}:vocabulary`, sectionKind: 'vocabulary', title: 'WORDS TO KNOW',
      vocabulary: Object.freeze(input.vocabulary.map((entry) => Object.freeze(entry))),
      items: Object.freeze([readItem(`${base}:vocabulary:read`, 'Use these definitions while you read and write.')]),
    }),
    section({
      sectionRef: `${base}:model`, sectionKind: 'worked-example', title: "EXAMPLE / LET'S LOOK AT ONE", body: input.model,
      items: Object.freeze([readItem(`${base}:model:read`, input.modelPrompt)]),
    }),
    section({
      sectionRef: `${base}:passage`, sectionKind: 'source', title: `READ: ${input.passageTitle}`,
      directions: input.passageDirections,
      body: input.passage,
      reference: Object.freeze({
        creator: ELA_R3_REQUIRED_SOURCE_REFERENCE.creator,
        rightsCategory: ELA_R3_REQUIRED_SOURCE_REFERENCE.rightsCategory,
        deliveryMode: 'inline full text',
        rightsStatement: 'Original Manuel Academy instructional text delivered in full for enrolled learner course use.',
      }),
      items: Object.freeze([readItem(`${base}:passage:read`, `Read “${input.passageTitle}” in full before responding.`)]),
    }),
    section({
      sectionRef: `${base}:guided`, sectionKind: 'guided-practice', title: 'YOUR TURN — GUIDED PRACTICE',
      directions: input.guidedDirections,
      items: Object.freeze([responseItem(guidedItemRef, input.guided)]),
    }),
    section({
      sectionRef: guidedFeedbackRef, sectionKind: 'remediation feedback-after-response', title: 'FEEDBACK — CHECK THE REASONING',
      body: input.guidedFeedback,
      items: Object.freeze([readItem(`${guidedFeedbackRef}:read`, 'Use this feedback to check the response you just saved.')]),
    }),
    section({
      sectionRef: `${base}:independent`, sectionKind: 'independent-practice', title: 'YOUR TURN — INDEPENDENT RESPONSE',
      directions: input.independentDirections,
      items: Object.freeze([responseItem(independentItemRef, input.independent)]),
    }),
    section({
      sectionRef: processFeedbackRef, sectionKind: 'remediation feedback-after-response', title: 'FEEDBACK — PREPARE TO REVISE',
      body: input.processFeedback,
      items: Object.freeze([readItem(`${processFeedbackRef}:read`, 'Apply this process guidance to the response you just saved.')]),
    }),
    section({
      sectionRef: `${base}:revision`, sectionKind: 'independent-practice additional-practice revision', title: 'YOUR TURN — REVISE',
      directions: input.revisionDirections,
      items: Object.freeze([responseItem(revisionItemRef, input.revision)]),
    }),
    section({
      sectionRef: `${base}:parent-review`, sectionKind: 'rubric-review-pending', title: 'PARENT REVIEW',
      body: `Your independent response and revision are saved for Parent Review. No automatic essay score is produced. The reviewer will use these dimensions: ${input.rubricCriteria.join('; ')}.`,
      items: Object.freeze([Object.freeze({
        itemRef: `${base}:parent-review:pending`, responseKind: 'RUBRIC_REVIEW_PENDING' as const,
        prompt: 'Continue to the lesson review while your constructed response remains pending human judgment.',
      })]),
    }),
    reviewSection(base, 'learned', 'WHAT YOU LEARNED', input.review.learned),
    reviewSection(base, 'how', 'HOW YOU DID', input.review.howYouDid),
    reviewSection(base, 'well', 'WHAT YOU DID WELL', input.review.didWell),
    reviewSection(base, 'practice', 'WHAT TO PRACTICE', input.review.practice),
    reviewSection(base, 'lesson', 'REVIEW THIS LESSON', input.review.reviewLesson),
    reviewSection(base, 'progress', 'COURSE PROGRESS', input.review.courseProgress),
    reviewSection(base, 'next', 'NEXT ACTION', input.review.nextAction),
  ])

  const material: LearnerMaterialDto = Object.freeze({
    lessonRef: placement.lessonId,
    title: input.title,
    subject: 'english-language-arts',
    format: 'structured',
    sections,
  })

  const responseTypes: readonly LearnerResponseType[] = Object.freeze(Array.from(new Set([
    input.guided.type,
    input.independent.type,
    input.revision.type,
    'RUBRIC_REVIEW_PENDING' as const,
  ])))

  return Object.freeze({
    lessonId: placement.lessonId,
    courseId: placement.courseId,
    courseTitle: `Grade ${placement.grade} English Language Arts`,
    grade: placement.grade,
    placement: Object.freeze(placement),
    topic: input.topic,
    standards: Object.freeze([...input.standards]),
    textType: input.textType,
    passageTitle: input.passageTitle,
    passageWordCount: countWords(input.passage),
    responseTypes,
    feedbackLinks: Object.freeze([
      Object.freeze({ responseItemRef: guidedItemRef, feedbackSectionRef: guidedFeedbackRef }),
      Object.freeze({ responseItemRef: independentItemRef, feedbackSectionRef: processFeedbackRef }),
    ]),
    readability: Object.freeze(input.readability),
    reviewPresent: true,
    parentReviewRequired: true,
    material,
  })
}
