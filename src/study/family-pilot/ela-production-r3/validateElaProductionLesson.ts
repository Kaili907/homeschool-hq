/**
 * ELA Production R3 — contract gate.
 *
 * Two severities, deliberately:
 *
 *   `error`       The frozen R2 artifacts state or structurally require this.
 *                 Every error carries the clause it is derived from.
 *   `observation` The nine approved samples all happen to do this, but no
 *                 frozen artifact rules it. Reported, never failed. Promoting
 *                 an observation to an error is a contract decision this
 *                 harness may not make on its own — see OPEN-QUESTIONS.md.
 */
import { mapLearnerMaterialToStudySegments } from '../final-app/learner-response'
import type { LearnerMaterialSectionDto } from '../final-app/learner-response'
import { createRichLessonRenderModel } from '../lesson-player/renderModel'
import {
  ELA_R3_FORBIDDEN_AUTHORITY_KEY,
  ELA_R3_FORBIDDEN_RUNTIME,
  ELA_R3_GRADES,
  ELA_R3_MIN_PAGES,
  ELA_R3_OBSERVED_ENVELOPE,
  ELA_R3_REQUIRED_MATERIAL_PHRASES,
  ELA_R3_REQUIRED_RESPONSE_SEQUENCE,
  ELA_R3_REQUIRED_SOURCE_REFERENCE,
  ELA_R3_REVIEW_TITLES,
  ELA_R3_RUBRIC_REVIEW_ITEM_COUNT,
  ELA_R3_SECTION_PLAN,
  elaR3ObservedEnvelope,
} from './contract'
import type { ElaProductionFinding, ElaProductionLesson, ElaProductionValidation } from './types'

const CONTRACT = 'APPROVED-LESSON-CONTRACTS-R2.md'
const SAMPLES = 'ela-director-samples-r2 (9 frozen samples)'

function nestedKeys(value: unknown): readonly string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap(nestedKeys)
  return Object.entries(value).flatMap(([key, child]) => [key, ...nestedKeys(child)])
}

function instructionalCopy(sections: readonly LearnerMaterialSectionDto[]): readonly string[] {
  return sections.flatMap((section) => [
    section.body,
    section.directions,
    ...(section.items ?? []).map((item) => item.prompt),
  ]).filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim())
}

export function validateElaProductionLesson(lesson: ElaProductionLesson): ElaProductionValidation {
  const errors: ElaProductionFinding[] = []
  const observations: ElaProductionFinding[] = []
  const fail = (code: string, derivedFrom: string, message: string): void => {
    errors.push({ severity: 'error', code, derivedFrom, message, lessonId: lesson.lessonId })
  }
  const note = (code: string, derivedFrom: string, message: string): void => {
    observations.push({ severity: 'observation', code, derivedFrom, message, lessonId: lesson.lessonId })
  }

  if (!(ELA_R3_GRADES as readonly number[]).includes(lesson.grade)) {
    fail('grade-unsupported', `${CONTRACT} / approval manifest grades, grade6Excluded`,
      `Grade ${lesson.grade} is not an approved ELA grade.`)
  }
  if (!lesson.standards.length) {
    fail('standards-missing', `${SAMPLES}: every sample carries the canonical package standards`,
      'A production lesson must carry the canonical standards of its lesson id.')
  }
  if (lesson.material.format !== 'structured') {
    fail('format-not-structured', `${SAMPLES}: every sample is a structured LearnerMaterialDto`,
      'Learner material must be structured; the markdown/legacy path is not approved for ELA.')
  }

  const sections = lesson.material.sections ?? []

  // Section plan: order, titles, kinds.
  if (sections.length !== ELA_R3_SECTION_PLAN.length) {
    fail('section-count', `${SAMPLES}: eighteen-section controlling flow`,
      `Expected ${ELA_R3_SECTION_PLAN.length} sections, found ${sections.length}.`)
  }
  ELA_R3_SECTION_PLAN.forEach((slot, index) => {
    const section = sections[index]
    if (!section) return
    const titleOk = slot.titlePrefixOnly
      ? section.title.startsWith(slot.title) && section.title.length > slot.title.length
      : section.title === slot.title
    if (!titleOk) {
      fail('section-title', `${SAMPLES}: section ${index + 1} is “${slot.title}”`,
        `Section ${index + 1} must be “${slot.title}${slot.titlePrefixOnly ? '<reading title>' : ''}”, found “${section.title}”.`)
    }
    if ((section.sectionKind ?? '') !== slot.sectionKind) {
      fail('section-kind', `${SAMPLES}: section ${index + 1} sectionKind`,
        `Section “${section.title}” must use sectionKind “${slot.sectionKind}”, found “${section.sectionKind ?? ''}”.`)
    }
  })

  // Review pages. Frozen prose lists all seven, in order, and NEXT ACTION last.
  const reviewTitles = sections.filter((section) => section.sectionKind === 'reflection').map((section) => section.title)
  if (JSON.stringify(reviewTitles) !== JSON.stringify(ELA_R3_REVIEW_TITLES)) {
    fail('review-pages', `${CONTRACT}: "LESSON REVIEW is meaningful and includes ..."`,
      `Review pages must be exactly ${ELA_R3_REVIEW_TITLES.join(', ')}; found ${reviewTitles.join(', ') || '(none)'}.`)
  }
  if (sections.at(-1)?.title !== 'NEXT ACTION') {
    fail('review-last-page', `${CONTRACT}: review ends with "Next action"`,
      'The final section must be NEXT ACTION.')
  }
  if (!lesson.reviewPresent || !lesson.parentReviewRequired) {
    fail('review-flags', `${CONTRACT}: ELA model requires Parent Review and a meaningful review`,
      'reviewPresent and parentReviewRequired must both be true.')
  }

  // Response controls. Projection through the real learner-response mapping.
  let projectionFailed = false
  try {
    const projection = mapLearnerMaterialToStudySegments(lesson.material)
    const items = projection.segments.flatMap((segment) => segment.items)
    const required = items.filter((item) => item.required)
    const sequence = required.map((item) => item.responseType)
    if (JSON.stringify(sequence) !== JSON.stringify(ELA_R3_REQUIRED_RESPONSE_SEQUENCE)) {
      fail('response-sequence', `${CONTRACT}: "YOUR TURN always has a real supported response control"; ELA model requires constructed response and revision`,
        `Required responses must be ${ELA_R3_REQUIRED_RESPONSE_SEQUENCE.join(', ')}; found ${sequence.join(', ') || '(none)'}.`)
    }
    if (required.some((item) => !item.prompt?.trim())) {
      fail('response-without-prompt', `${CONTRACT}: "A question must never lead to nowhere to type, choose, or enter a response"`,
        'Every required response item must carry a prompt.')
    }
    const rubricItems = items.filter((item) => item.responseType === 'RUBRIC_REVIEW_PENDING')
    if (rubricItems.length !== ELA_R3_RUBRIC_REVIEW_ITEM_COUNT) {
      fail('parent-review-item', `${CONTRACT}: ELA model, "Where judgment is required, the lesson provides Parent Review"`,
        `Expected ${ELA_R3_RUBRIC_REVIEW_ITEM_COUNT} RUBRIC_REVIEW_PENDING item, found ${rubricItems.length}.`)
    }
    const modelItem = items.find((item) => item.sectionRef.endsWith(':model'))
    if (!modelItem?.instructionalExample || modelItem.required || modelItem.responseType !== 'READ') {
      fail('worked-example-not-separate', `${CONTRACT}: "Looking at an example is not mastery"; "TAUGHT, PRACTICED, and DEMONSTRATED remain distinct"`,
        'The worked example must project as a non-required READ instructional example, separate from learner work.')
    }
    for (const section of sections.filter((entry) => entry.title.startsWith('YOUR TURN'))) {
      if ((section.items ?? []).length !== 1) {
        fail('your-turn-item-count', `${SAMPLES}: each YOUR TURN section carries exactly one item`,
          `“${section.title}” must carry exactly one item, found ${(section.items ?? []).length}.`)
      }
    }
  } catch (error) {
    projectionFailed = true
    fail('projection-throws', `${SAMPLES}: every sample maps cleanly to study segments`,
      `Learner-response mapping rejected this lesson: ${(error as Error).message}`)
  }

  // Rich Study Player projection and feedback release order.
  if (!projectionFailed) {
    try {
      const model = createRichLessonRenderModel(lesson.material)
      if (model.mode !== 'rich') {
        fail('legacy-fallback', `${CONTRACT}: "The learner experiences the lesson through the real Rich Study Player"`,
          'Lesson projects to the legacy renderer instead of the Rich Study Player.')
      }
      if (model.pages.length < ELA_R3_MIN_PAGES) {
        fail('page-count', `${SAMPLES}: eighteen-page controlling flow`,
          `Expected at least ${ELA_R3_MIN_PAGES} pages, found ${model.pages.length}.`)
      }
      if (new Set(model.pages.map((page) => page.progressRef)).size !== model.pages.length) {
        fail('progress-ref-collision', `${SAMPLES}: every page has a distinct progress reference`,
          'Page progress references must be unique so lesson position is recoverable.')
      }
      for (const link of lesson.feedbackLinks) {
        const responseIndex = model.pages.findIndex((page) => page.item?.itemRef === link.responseItemRef)
        const feedbackIndex = model.pages.findIndex((page) => page.sectionRef === link.feedbackSectionRef)
        if (responseIndex < 0 || feedbackIndex < 0) {
          fail('feedback-link-missing', `${CONTRACT}: "FEEDBACK is instructional"`,
            `Feedback link ${link.responseItemRef} → ${link.feedbackSectionRef} does not resolve to pages.`)
          continue
        }
        if (feedbackIndex <= responseIndex) {
          fail('feedback-before-response', `${CONTRACT}: feedback "supports correction or reteaching" after the learner responds`,
            `Feedback ${link.feedbackSectionRef} is released before its response page.`)
        }
        if (model.pages[feedbackIndex]?.kind !== 'remediation' || model.pages[feedbackIndex]?.role !== 'PRACTICE') {
          fail('feedback-page-kind', `${SAMPLES}: feedback pages project as PRACTICE/remediation`,
            `Feedback ${link.feedbackSectionRef} must project as a PRACTICE remediation page.`)
        }
      }
    } catch (error) {
      fail('render-model-throws', `${CONTRACT}: lesson must run in the real Rich Study Player`,
        `Rich render model rejected this lesson: ${(error as Error).message}`)
    }
  }

  // No answer, score, or solution authority anywhere in the learner record.
  const forbiddenKeys = nestedKeys(lesson).filter((key) => ELA_R3_FORBIDDEN_AUTHORITY_KEY.test(key))
  if (forbiddenKeys.length) {
    fail('authority-key-present', `${CONTRACT}: ELA model, "must not pretend to deterministically score an essay"`,
      `Learner record carries scoring/answer authority keys: ${Array.from(new Set(forbiddenKeys)).join(', ')}.`)
  }
  const serialized = JSON.stringify(lesson.material)
  for (const phrase of ELA_R3_REQUIRED_MATERIAL_PHRASES) {
    if (!serialized.includes(phrase)) {
      fail('parent-review-copy-missing', `${CONTRACT}: ELA model, Parent Review where judgment is required`,
        `Learner material must state “${phrase}”.`)
    }
  }
  if (ELA_R3_FORBIDDEN_RUNTIME.test(serialized)) {
    fail('tutor-dependency', `${SAMPLES}: samples carry no Tutor runtime dependency`,
      'Learner material must not reference the AI Tutor runtime.')
  }

  // Reading: original, complete, and actually delivered.
  const source = sections.find((section) => section.sectionKind === 'source')
  if (!source) {
    fail('source-missing', `${CONTRACT}: ELA model, "age-appropriate passages"`,
      'Lesson must carry a source section with the complete reading.')
  } else {
    const reference = source.reference as { creator?: string; rightsCategory?: string } | undefined
    if (reference?.creator !== ELA_R3_REQUIRED_SOURCE_REFERENCE.creator
      || reference?.rightsCategory !== ELA_R3_REQUIRED_SOURCE_REFERENCE.rightsCategory) {
      fail('source-rights', `${SAMPLES}: every source declares creator "Manuel Academy", rightsCategory "original"`,
        'The reading must be declared an original Manuel Academy text. Copyrighted text is not permitted.')
    }
    if (!source.directions?.trim()) {
      fail('source-directions', `${SAMPLES}: every source section carries reading directions`,
        'The reading must carry directions telling the learner how to read it.')
    }
    const bodyWords = (source.body ?? '').trim().split(/\s+/).filter(Boolean).length
    if (bodyWords !== lesson.passageWordCount) {
      fail('source-word-count', `${SAMPLES}: recorded passageWordCount equals the delivered body`,
        `Recorded passageWordCount ${lesson.passageWordCount} does not match the delivered reading (${bodyWords} words).`)
    }
  }

  // No generic template: instructional copy must not repeat inside one lesson.
  const copy = instructionalCopy(sections)
  if (new Set(copy).size !== copy.length) {
    fail('duplicate-copy', `${CONTRACT}: "There is no single generic voice"; freeze rule forbids a generic lesson template`,
      'Instructional copy is repeated within the lesson.')
  }

  // Observations only. The frozen contract sets no bound for any of these.
  if ((ELA_R3_GRADES as readonly number[]).includes(lesson.grade)) {
    const envelope = elaR3ObservedEnvelope(lesson.grade)
    const vocabularyCount = (sections.find((entry) => entry.sectionKind === 'vocabulary')?.vocabulary ?? []).length
    const guidedChoices = (sections.find((entry) => entry.sectionKind === 'guided-practice')?.items ?? [])[0]?.choices?.length ?? 0
    if (vocabularyCount !== envelope.vocabularyTermCount) {
      note('vocabulary-count-off-envelope', 'OBSERVED in the approved samples; no frozen rule (OPEN-QUESTIONS Q5)',
        `Grade ${lesson.grade} approved sample defines ${envelope.vocabularyTermCount} terms; this lesson defines ${vocabularyCount}.`)
    }
    if (guidedChoices !== envelope.guidedChoiceCount) {
      note('choice-count-off-envelope', 'OBSERVED in the approved samples; no frozen rule (OPEN-QUESTIONS Q3)',
        `All approved samples offer ${envelope.guidedChoiceCount} choices; this lesson offers ${guidedChoices}.`)
    }
    const approvedLengths = ELA_R3_OBSERVED_ENVELOPE.map((entry) => entry.passageWordCount)
    const shortest = Math.min(...approvedLengths)
    const longest = Math.max(...approvedLengths)
    if (lesson.passageWordCount < shortest || lesson.passageWordCount > longest) {
      note('passage-length-off-envelope', 'OBSERVED in the approved samples; no frozen rule (OPEN-QUESTIONS Q6)',
        `Approved passages run ${shortest}–${longest} words; this reading is ${lesson.passageWordCount} words.`)
    }
  }

  return Object.freeze({
    lessonId: lesson.lessonId,
    errors: Object.freeze(errors),
    observations: Object.freeze(observations),
    valid: errors.length === 0,
  })
}
