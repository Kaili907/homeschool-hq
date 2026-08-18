/**
 * ELA Production R3 — reference lesson, exercised through the real runtime.
 *
 * This test runs the shipped `.lesson.json` artifact through the canonical
 * `mapLearnerMaterialToStudySegments` and `createRichLessonRenderModel`. It
 * builds no parallel engine, runtime, or lesson model, and it reads the artifact
 * from disk rather than restating its content.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { mapLearnerMaterialToStudySegments } from '../final-app/learner-response'
import { createRichLessonRenderModel } from './renderModel'
import {
  ELA_R3_MIN_PAGES,
  ELA_R3_REQUIRED_RESPONSE_SEQUENCE,
  ELA_R3_REVIEW_TITLES,
  elaProductionLessonFromDocument,
  validateElaProductionLesson,
  type ElaProductionLessonDocument,
} from '../ela-production-r3'

const LESSON_PATH = 'curriculum-production/final/english-language-arts/r3/lessons/grade-03/ma-g3-english-language-arts-u07-l08.lesson.json'
const CANONICAL_PATH = 'curriculum-production/student-work/english-language-arts/packages/grade-03/ma-g3-english-language-arts-u07-l08.package.json'
const LEDGER_PATH = 'curriculum-production/student-work/english-language-arts/source-ledger.jsonl'

const NEXT_ACTIONS = ['Done for today', 'Continue required work', 'Keep learning / Work ahead', 'Waiting for Parent']

const document = JSON.parse(readFileSync(LESSON_PATH, 'utf8')) as ElaProductionLessonDocument
const lesson = elaProductionLessonFromDocument(document)
const material = document.learnerMaterial
const sections = material.sections ?? []

describe('ELA Production R3 reference lesson — contract', () => {
  it('passes the derived R2 contract gate with no errors', () => {
    const result = validateElaProductionLesson(lesson)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('is the Grade 3 lesson it claims to be, and is not the frozen R2 sample', () => {
    expect(lesson.grade).toBe(3)
    expect(lesson.lessonId).toBe('ma-g3-english-language-arts-u07-l08')
    expect(lesson.lessonId).not.toBe('ma-g3-english-language-arts-u03-l04')
    expect(document.productionMetadata.status).toBe('PENDING_DIRECTOR_REVIEW')
  })

  it('preserves the canonical course, unit, day, and standards mapping', () => {
    const canonical = JSON.parse(readFileSync(CANONICAL_PATH, 'utf8')) as {
      readonly lessonRef: {
        readonly courseId: string; readonly grade: number
        readonly unitNumber: number; readonly dayInUnit: number; readonly courseDay: number
      }
      readonly standards: readonly string[]
    }
    const meta = document.productionMetadata
    expect(meta.courseRef).toBe(canonical.lessonRef.courseId)
    expect(meta.grade).toBe(canonical.lessonRef.grade)
    expect(meta.unitNumber).toBe(canonical.lessonRef.unitNumber)
    expect(meta.dayInUnit).toBe(canonical.lessonRef.dayInUnit)
    expect(meta.courseDay).toBe(canonical.lessonRef.courseDay)
    expect(meta.standards).toEqual(canonical.standards)
  })
})

describe('ELA Production R3 reference lesson — real learner-response runtime', () => {
  const projection = mapLearnerMaterialToStudySegments(material)
  const items = projection.segments.flatMap((segment) => segment.items)

  it('delivers exactly the approved required-response sequence', () => {
    expect(items.filter((item) => item.required).map((item) => item.responseType))
      .toEqual([...ELA_R3_REQUIRED_RESPONSE_SEQUENCE])
  })

  it('gives every required response a real control and a prompt', () => {
    const required = items.filter((item) => item.required)
    expect(required.every((item) => Boolean(item.prompt?.trim()))).toBe(true)
    const choice = required.find((item) => item.responseType === 'CHOICE')
    expect(choice?.choices.length).toBeGreaterThanOrEqual(3)
    expect(choice?.choices.every((entry) => entry.label.trim().length > 0)).toBe(true)
  })

  it('keeps the worked example read-only and outside protected learner work', () => {
    const modelItem = items.find((item) => item.sectionRef.endsWith(':model'))
    expect(modelItem).toMatchObject({ responseType: 'READ', instructionalExample: true, required: false })
  })

  it('routes constructed writing to human judgment instead of an invented score', () => {
    expect(items.filter((item) => item.responseType === 'RUBRIC_REVIEW_PENDING')).toHaveLength(1)
    const serialized = JSON.stringify(material)
    expect(serialized).toContain('No automatic essay score is produced')
    expect(serialized).toContain('pending human judgment')
    expect(serialized).not.toMatch(/Tutor V2|tutorRuntime|providerCall/i)
  })
})

describe('ELA Production R3 reference lesson — real Rich Study Player projection', () => {
  const model = createRichLessonRenderModel(material)

  it('projects rich with no legacy fallback', () => {
    expect(model).toMatchObject({
      mode: 'rich',
      lessonRef: lesson.lessonId,
      subject: { subject: 'english-language-arts', label: 'English Language Arts', shortLabel: 'ELA' },
    })
    expect(model.pages.length).toBeGreaterThanOrEqual(ELA_R3_MIN_PAGES)
    expect(new Set(model.pages.map((page) => page.progressRef)).size).toBe(model.pages.length)
  })

  it('releases each feedback page only after its linked response page', () => {
    for (const link of lesson.feedbackLinks) {
      const responseIndex = model.pages.findIndex((page) => page.item?.itemRef === link.responseItemRef)
      const feedbackIndex = model.pages.findIndex((page) => page.sectionRef === link.feedbackSectionRef)
      expect(responseIndex).toBeGreaterThanOrEqual(0)
      expect(feedbackIndex).toBeGreaterThan(responseIndex)
      expect(model.pages[responseIndex]?.role).toBe('PRACTICE')
      expect(model.pages[feedbackIndex]).toMatchObject({ role: 'PRACTICE', kind: 'remediation' })
    }
  })

  it('ends on the complete seven-page review', () => {
    const reviewTitles = sections.filter((section) => section.sectionKind === 'reflection').map((section) => section.title)
    expect(reviewTitles).toEqual([...ELA_R3_REVIEW_TITLES])
    expect(model.pages.at(-1)?.title).toBe('NEXT ACTION')
  })
})

describe('ELA Production R3 reference lesson — COURSE PROGRESS / NEXT ACTION ruling', () => {
  const review = createRichLessonRenderModel(material).review

  it('states course progress as a factual position, not Director-sample copy', () => {
    const body = sections.find((section) => section.title === 'COURSE PROGRESS')?.body ?? ''
    expect(body).toMatch(/^Unit \d+, Lesson \d+ of \d+ in .+\.$/)
    expect(body).not.toMatch(/Director sample|does not change your production course record/i)
    expect(review?.courseProgress).toBe(body)
  })

  it('uses a real runtime next action, and the one that matches pending parent judgment', () => {
    expect(NEXT_ACTIONS).toContain(review?.nextAction)
    expect(review?.nextAction).toBe('Waiting for Parent')
  })

  it('carries a substantive machine-readable review', () => {
    expect(review?.whatYouLearned.length).toBeGreaterThanOrEqual(3)
    expect(review?.whatYouLearned.every((entry) => entry.trim().split(/\s+/).length >= 6)).toBe(true)
  })
})

describe('ELA Production R3 reference lesson — reading integrity', () => {
  const source = sections.find((section) => section.sectionKind === 'source')

  it('delivers a Manuel Academy original in full', () => {
    expect(source?.reference).toMatchObject({ creator: 'Manuel Academy', rightsCategory: 'original' })
    expect(source?.directions?.trim()).toBeTruthy()
    expect((source?.body ?? '').trim().split(/\s+/).length).toBe(document.productionMetadata.reading.wordCount)
  })

  it('matches the canonical source-ledger digest byte for byte', () => {
    const digest = createHash('sha256').update(source?.body ?? '').digest('hex')
    expect(digest).toBe(document.productionMetadata.reading.sha256)
    const entry = readFileSync(LEDGER_PATH, 'utf8').split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { lessonId: string; sha256: string; rightsCategory: string })
      .find((record) => record.lessonId === lesson.lessonId)
    expect(entry?.sha256).toBe(digest)
    expect(entry?.rightsCategory).toBe('original')
  })

  it('models the skill on a microtext separate from the lesson reading', () => {
    const modelBody = sections.find((section) => section.sectionKind === 'worked-example')?.body ?? ''
    const passageBody = source?.body ?? ''
    expect(modelBody.length).toBeGreaterThan(0)
    const shared = modelBody.split(/(?<=\.)\s+/).filter((sentence) => sentence.trim().length > 40)
      .filter((sentence) => passageBody.includes(sentence.trim()))
    expect(shared).toEqual([])
  })

  it('explains every guided option, not only the credited one', () => {
    const feedback = sections.find((section) => section.title === 'FEEDBACK — CHECK THE REASONING')?.body ?? ''
    expect(feedback.trim().split(/\s+/).length).toBeGreaterThanOrEqual(60)
    expect(feedback).toMatch(/restatement/i)
    expect(feedback).toMatch(/true/i)
  })
})
