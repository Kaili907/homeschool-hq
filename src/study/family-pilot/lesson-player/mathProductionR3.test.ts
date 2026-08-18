import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mapLearnerMaterialToStudySegments, type LearnerMaterialDto } from '../final-app/learner-response'
import { createRichLessonRenderModel } from './renderModel'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const R3 = resolve(REPO, 'curriculum-production/final/mathematics/r3')

interface LessonRow {
  readonly grade: number
  readonly courseRef: string
  readonly lessonRef: string
  readonly file: string
  readonly sourcePackage: string
  readonly standards: readonly string[]
  readonly role: string
}

const manifest = JSON.parse(readFileSync(resolve(R3, 'manifest.json'), 'utf8')) as {
  readonly namespace: string
  readonly supportedGrades: readonly number[]
  readonly intentionallyUnsupportedGrades: readonly number[]
  readonly restrictedAssessmentAuthority: string
  readonly wave1: { readonly courseRef: string; readonly authoredLessonCount: number }
  readonly lessons: readonly LessonRow[]
}

const authority = JSON.parse(readFileSync(resolve(R3, manifest.restrictedAssessmentAuthority), 'utf8')) as {
  readonly browserImportAllowed: boolean
  readonly lessons: Readonly<Record<string, readonly { readonly itemRef: string }[]>>
}

function load(row: LessonRow) {
  return JSON.parse(readFileSync(resolve(R3, row.file), 'utf8')) as {
    readonly namespace: string
    readonly productionMetadata: { readonly grade: number; readonly courseRef: string; readonly lessonRef: string }
    readonly learnerMaterial: LearnerMaterialDto
  }
}

function forbiddenAnswerPaths(value: unknown, path = 'learnerMaterial'): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap((item, index) => forbiddenAnswerPaths(item, `${path}[${index}]`))
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [
    ...(/^(?:answer|answerKey|correctAnswer|scoring|scoringRule)$/i.test(key) ? [`${path}.${key}`] : []),
    ...forbiddenAnswerPaths(item, `${path}.${key}`),
  ])
}

describe('Mathematics Production R3', () => {
  it('is scoped to Wave 1 Grade 3 and keeps Grade 6 absent', () => {
    expect(manifest.namespace).toBe('production:mathematics:r3')
    expect(manifest.supportedGrades).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(manifest.intentionallyUnsupportedGrades).toEqual([6])
    expect(manifest.wave1.courseRef).toBe('ma-g3-mathematics')
    expect(manifest.lessons).toHaveLength(manifest.wave1.authoredLessonCount)
    expect(manifest.lessons.every((row) => row.grade !== 6)).toBe(true)
    expect(authority.browserImportAllowed).toBe(false)
  })

  for (const row of manifest.lessons) {
    describe(row.lessonRef, () => {
      const lesson = load(row)
      const material = lesson.learnerMaterial
      const projected = mapLearnerMaterialToStudySegments(material)
      const model = createRichLessonRenderModel(material)
      const items = projected.segments.flatMap((segment) => segment.items)
      const required = items.filter((item) => item.required)
      const worked = items.filter((item) => Boolean(item.example))

      it('keeps the canonical course, lesson, and standards mapping unchanged', () => {
        const source = JSON.parse(readFileSync(resolve(REPO, row.sourcePackage), 'utf8')) as {
          readonly lessonRef: { readonly grade: number; readonly courseId: string; readonly lessonId: string }
          readonly standards: readonly string[]
        }
        expect(source.lessonRef).toMatchObject({ grade: row.grade, courseId: row.courseRef, lessonId: row.lessonRef })
        expect(source.standards).toEqual(row.standards)
        expect(lesson.productionMetadata).toMatchObject({ grade: row.grade, courseRef: row.courseRef, lessonRef: row.lessonRef })
        expect(material.lessonRef).toBe(row.lessonRef)
      })

      it('renders through the real Rich Study Player with no legacy fallback', () => {
        expect(material.format).toBe('structured')
        expect(material.subject).toBe('mathematics')
        expect(model.mode).toBe('rich')
        expect(model.review).toEqual(material.lessonReview)
        expect(model.pages.some((page) => page.kind === 'teaching')).toBe(true)
        expect(model.pages.some((page) => page.kind === 'worked-example')).toBe(true)
        expect(model.pages.some((page) => page.kind === 'guided-practice')).toBe(true)
        expect(model.pages.some((page) => page.kind === 'independent-practice')).toBe(true)
        expect(model.pages.some((page) => page.kind === 'remediation')).toBe(true)
        expect(model.pages.some((page) => page.kind === 'mastery-check')).toBe(true)
      })

      it('separates the worked example from the learner response and gives every question a control', () => {
        expect(worked.length).toBeGreaterThan(0)
        expect(worked.every((item) => item.responseType === 'READ' && !item.required)).toBe(true)
        expect(required.length).toBeGreaterThan(0)
        expect(required.every((item) => ['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE'].includes(item.responseType))).toBe(true)
        expect(required.filter((item) => item.responseType === 'CHOICE').every((item) => item.choices.length >= 2)).toBe(true)
        const answerable = model.pages.filter((page) => page.item && !page.item.instructionalExample)
        expect(answerable.every((page) => page.item!.responseType !== 'NONE')).toBe(true)
      })

      it('gives every learner response instructional feedback rather than a retry prompt', () => {
        expect(required.every((item) => item.feedback?.correct.trim() && item.feedback.incorrect.trim())).toBe(true)
        expect(required.every((item) => !/^(?:\s*(?:try again|incorrect|wrong|not quite)[.!]*\s*)+$/i.test(item.feedback!.incorrect))).toBe(true)
        expect(required.every((item) => item.feedback!.incorrect.length >= 40)).toBe(true)
      })

      it('follows the Director ruling on learner-facing copy', () => {
        const review = material.lessonReview!
        expect(review.courseProgress).toMatch(/^Unit \d+, Lesson \d+ of \d+ in .+\.$/)
        expect(review.nextAction).toBe('Continue required work')
        // Build-system status is not learner content. A Grade 3 child reads these strings.
        const learnerText = JSON.stringify(material)
        for (const pattern of [
          /\bdirector\b/i, /\breference lesson\b/i, /\b(?:in|part of|during|for) wave \d+\b/i,
          /\bthis sample\b/i, /\bsample lesson\b/i, /\bproduction[- ](?:status|course|model|curriculum)\b/i,
          /\bassessment authority\b/i, /\bassessors?\b/i, /\bthe manifest\b/i,
          /\brich study player\b/i, /\brender model\b/i, /\bnot saved\b/i, /\bonly in memory\b/i,
        ]) expect(learnerText).not.toMatch(pattern)
      })

      it('keeps a real review and holds answer authority outside the learner material', () => {
        expect(material.lessonReview?.whatYouLearned.length).toBeGreaterThanOrEqual(2)
        expect(material.lessonReview?.courseProgress.trim()).toBeTruthy()
        expect(material.lessonReview?.reviewActionLabel).toMatch(/review this lesson/i)
        expect(forbiddenAnswerPaths(material)).toEqual([])
        expect(JSON.stringify(model)).not.toMatch(/acceptedChoiceOrdinal|sourceAnswer/)
        const directions = (material.sections ?? []).map((section) => section.directions?.trim()).filter(Boolean)
        expect(new Set(directions).size).toBe(directions.length)
        expect(authority.lessons[row.lessonRef]?.map((entry) => entry.itemRef).sort())
          .toEqual(required.map((item) => item.itemRef).sort())
      })
    })
  }

  it('teaches rounding concretely and keeps YOUR TURN on a fresh number', () => {
    const material = load(manifest.lessons[0]!).learnerMaterial
    const model = createRichLessonRenderModel(material)
    const teaching = model.pages.find((page) => page.kind === 'teaching' && page.title !== 'Key ideas')
    const workedPages = model.pages.filter((page) => page.kind === 'worked-example')
    const guided = model.pages.find((page) => page.item?.itemRef.endsWith('#gp-01'))
    const tie = model.pages.find((page) => page.item?.itemRef.endsWith('#gp-02'))
    const explain = model.pages.find((page) => page.item?.itemRef.endsWith('#mc-01'))

    // The teaching page shows the contrast the way the controlling Grade 3 sample does.
    expect(JSON.stringify(teaching)).toContain('47')
    expect(JSON.stringify(teaching)).toContain('40')
    expect(JSON.stringify(teaching)).toContain('50')

    // Worked examples are read-only; YOUR TURN is a real control on a number not worked for them.
    expect(workedPages.every((page) => page.item?.responseType === 'READ')).toBe(true)
    expect(JSON.stringify(workedPages)).toContain('73')
    expect(guided?.item?.responseType).toBe('CHOICE')
    expect(guided?.item?.prompt).toContain('89')
    expect(JSON.stringify(workedPages)).not.toContain('89')

    // The tie rule and the explanation demand are both real learner responses.
    expect(tie?.item?.responseType).toBe('NUMERIC')
    expect(explain?.item?.responseType).toBe('CONSTRUCTED_RESPONSE')

    // Feedback names the specific rounding misconception, not a generic retry.
    expect(tie?.item?.feedback?.incorrect).toMatch(/halfway/i)
    const hundreds = model.pages.find((page) => page.item?.itemRef.endsWith('#ip-02'))
    expect(hundreds?.item?.feedback?.incorrect).toMatch(/nearest hundred/i)
  })
})
