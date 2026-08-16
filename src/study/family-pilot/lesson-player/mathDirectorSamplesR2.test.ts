import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mapLearnerMaterialToStudySegments, type LearnerMaterialDto } from '../final-app/learner-response'
import { createRichLessonRenderModel } from './renderModel'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..', 'curriculum-review-samples/director/mathematics-r2')

interface ManifestRow {
  readonly grade: number
  readonly sampleRef: string
  readonly file: string
  readonly courseRef: string
  readonly sourceLessonRef: string
  readonly sourcePackage: string
  readonly topic: string
  readonly standards: readonly string[]
}

interface ReviewSample {
  readonly schemaVersion: number
  readonly namespace: string
  readonly reviewMetadata: {
    readonly grade: number
    readonly courseRef: string
    readonly sourceLessonRef: string
    readonly sourcePackage: string
    readonly standards: readonly string[]
    readonly normalInstructionalLesson: boolean
  }
  readonly learnerMaterial: LearnerMaterialDto
}

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'manifest.json'), 'utf8')) as {
  readonly namespace: string
  readonly supportedGrades: readonly number[]
  readonly intentionallyUnsupportedGrades: readonly number[]
  readonly restrictedAssessmentAuthority: string
  readonly samples: readonly ManifestRow[]
}

const authority = JSON.parse(readFileSync(resolve(ROOT, manifest.restrictedAssessmentAuthority), 'utf8')) as {
  readonly browserImportAllowed: boolean
  readonly lessons: Readonly<Record<string, readonly { readonly itemRef: string }[]>>
}

function load(row: ManifestRow): ReviewSample {
  return JSON.parse(readFileSync(resolve(ROOT, row.file), 'utf8')) as ReviewSample
}

function forbiddenAnswerPaths(value: unknown, path = 'learnerMaterial'): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap((item, index) => forbiddenAnswerPaths(item, `${path}[${index}]`))
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const held = /^(?:answer|answerKey|correctAnswer|scoring|scoringRule)$/i.test(key) ? [`${path}.${key}`] : []
    return [...held, ...forbiddenAnswerPaths(item, `${path}.${key}`)]
  })
}

describe('Mathematics Director samples R2', () => {
  it('contains exactly the nine supported grades and keeps Grade 6 absent', () => {
    expect(manifest.namespace).toBe('director-review:mathematics:r2')
    expect(manifest.supportedGrades).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(manifest.intentionallyUnsupportedGrades).toEqual([6])
    expect(authority.browserImportAllowed).toBe(false)
    expect(manifest.samples.map((sample) => sample.grade)).toEqual(manifest.supportedGrades)
    expect(new Set(manifest.samples.map((sample) => sample.sampleRef)).size).toBe(9)
  })

  for (const row of manifest.samples) {
    describe(`Grade ${row.grade}`, () => {
      const sample = load(row)
      const material = sample.learnerMaterial
      const projected = mapLearnerMaterialToStudySegments(material)
      const model = createRichLessonRenderModel(material)
      const responseItems = projected.segments.flatMap((segment) => segment.items).filter((item) => item.required)
      const workedExamples = projected.segments.flatMap((segment) => segment.items).filter((item) => Boolean(item.example))

      it('matches the canonical course, lesson, package, and unchanged standards mapping', () => {
        const sourcePath = resolve(ROOT, '../../..', row.sourcePackage)
        const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
          readonly lessonRef: { readonly grade: number; readonly courseId: string; readonly lessonId: string }
          readonly standards: readonly string[]
        }
        expect(sample.schemaVersion).toBe(1)
        expect(sample.namespace).toBe(manifest.namespace)
        expect(sample.reviewMetadata).toMatchObject({
          grade: row.grade,
          courseRef: row.courseRef,
          sourceLessonRef: row.sourceLessonRef,
          sourcePackage: row.sourcePackage,
          standards: row.standards,
          normalInstructionalLesson: true,
        })
        expect(source.lessonRef).toMatchObject({ grade: row.grade, courseId: row.courseRef, lessonId: row.sourceLessonRef })
        expect(source.standards).toEqual(row.standards)
      })

      it('parses, projects, and uses the rich player without legacy fallback', () => {
        expect(material.lessonRef).toBe(row.sampleRef)
        expect(material.subject).toBe('mathematics')
        expect(material.format).toBe('structured')
        expect(model.mode).toBe('rich')
        expect(model.review).toEqual(material.lessonReview)
        expect(model.pages.length).toBeGreaterThanOrEqual(10)
        expect(model.pages.some((page) => page.kind === 'remediation')).toBe(true)
        expect(model.pages.some((page) => page.kind === 'mastery-check')).toBe(true)
      })

      it('distinguishes worked examples from learner tasks and provides real response controls', () => {
        expect(workedExamples.length).toBeGreaterThan(0)
        expect(workedExamples.every((item) => item.responseType === 'READ' && !item.required && Boolean(item.example))).toBe(true)
        expect(responseItems.length).toBeGreaterThanOrEqual(5)
        expect(responseItems.every((item) => ['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE'].includes(item.responseType))).toBe(true)
        expect(responseItems.filter((item) => item.responseType === 'CHOICE').every((item) => item.choices.length >= 2)).toBe(true)
        expect(responseItems.every((item) => item.feedback?.correct.trim() && item.feedback.incorrect.trim())).toBe(true)
      })

      it('includes a real review and keeps protected answer authority out of learner material', () => {
        expect(material.lessonReview?.whatYouLearned.length).toBeGreaterThanOrEqual(2)
        expect(material.lessonReview?.courseProgress).toContain('does not change your production-course progress')
        expect(material.lessonReview?.reviewActionLabel).toMatch(/review this lesson/i)
        expect(forbiddenAnswerPaths(material)).toEqual([])
        expect(JSON.stringify(material)).not.toMatch(/diagnostic/i)
        const directions = (material.sections ?? []).map((section) => section.directions?.trim()).filter(Boolean)
        expect(new Set(directions).size).toBe(directions.length)
        expect(authority.lessons[row.sampleRef]?.map((entry) => entry.itemRef).sort()).toEqual(responseItems.map((item) => item.itemRef).sort())
        expect(JSON.stringify(model)).not.toMatch(/acceptedChoiceOrdinal|"accepted"/)
      })
    })
  }

  it('visibly fixes the reported Grade 3 3,000-versus-300 experience', () => {
    const material = load(manifest.samples[0]!).learnerMaterial
    const model = createRichLessonRenderModel(material)
    const example = model.pages.find((page) => page.kind === 'worked-example')
    const guided = model.pages.find((page) => page.item?.itemRef.endsWith(':guided:1'))
    expect(JSON.stringify(example)).toContain('3,000')
    expect(JSON.stringify(example)).toContain('300')
    expect(example?.item?.responseType).toBe('READ')
    expect(guided?.item?.responseType).toBe('NUMERIC')
    expect(guided?.item?.prompt).toContain('4,000')
  })
})
