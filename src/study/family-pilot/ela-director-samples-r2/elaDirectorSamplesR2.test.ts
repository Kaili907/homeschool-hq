import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mapLearnerMaterialToStudySegments } from '../final-app/learner-response'
import { createRichLessonRenderModel } from '../lesson-player/renderModel'
import { ELA_DIRECTOR_SAMPLES_R2 } from './index'
import { ELA_DIRECTOR_SAMPLE_GRADES } from './types'

const REQUIRED_REVIEW_TITLES = Object.freeze([
  'WHAT YOU LEARNED',
  'HOW YOU DID',
  'WHAT YOU DID WELL',
  'WHAT TO PRACTICE',
  'REVIEW THIS LESSON',
  'COURSE PROGRESS',
  'NEXT ACTION',
])

function objectKeys(value: unknown): readonly string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap(objectKeys)
  return Object.entries(value).flatMap(([key, child]) => [key, ...objectKeys(child)])
}

function instructionalCopy(sample: typeof ELA_DIRECTOR_SAMPLES_R2[number]): readonly string[] {
  return (sample.material.sections ?? []).flatMap((section) => [
    section.body,
    section.directions,
    ...(section.items ?? []).map((item) => item.prompt),
  ]).filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim())
}

describe('ELA Director Samples R2', () => {
  it('provides exactly one isolated structured sample for every supported grade except Grade 6', () => {
    expect(ELA_DIRECTOR_SAMPLES_R2).toHaveLength(9)
    expect(ELA_DIRECTOR_SAMPLES_R2.map((sample) => sample.grade)).toEqual(ELA_DIRECTOR_SAMPLE_GRADES)
    expect(new Set(ELA_DIRECTOR_SAMPLES_R2.map((sample) => sample.sampleId)).size).toBe(9)
    expect(ELA_DIRECTOR_SAMPLES_R2.every((sample) => sample.material.format === 'structured')).toBe(true)
    expect((ELA_DIRECTOR_SAMPLE_GRADES as readonly number[]).includes(6)).toBe(false)
  })

  it('records the existing canonical course and standards mapping for every selected lesson', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const canonical = JSON.parse(readFileSync(sample.canonicalPackagePath, 'utf8')) as {
        readonly lessonRef: { readonly lessonId: string; readonly courseId: string; readonly grade: number }
        readonly standards: readonly string[]
      }
      expect(canonical.lessonRef).toMatchObject({
        lessonId: sample.canonicalLessonRef,
        courseId: sample.courseId,
        grade: sample.grade,
      })
      expect(sample.material.lessonRef).toBe(canonical.lessonRef.lessonId)
      expect(sample.standards).toEqual(canonical.standards)
    }
  })

  it('projects every sample through the canonical Rich Study Player with no legacy fallback', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const model = createRichLessonRenderModel(sample.material)
      expect(model).toMatchObject({
        mode: 'rich',
        lessonRef: sample.canonicalLessonRef,
        subject: { subject: 'english-language-arts', label: 'English Language Arts', shortLabel: 'ELA' },
      })
      expect(model.pages.length).toBeGreaterThanOrEqual(18)
      expect(new Set(model.pages.map((page) => page.progressRef)).size).toBe(model.pages.length)
      expect(model.pages.every((page) => page.progressRef.startsWith('lesson-cursor:'))).toBe(true)
    }
  })

  it('delivers the required model-to-your-turn flow with real response controls', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const projection = mapLearnerMaterialToStudySegments(sample.material)
      const items = projection.segments.flatMap((segment) => segment.items)
      const required = items.filter((item) => item.required)
      const modelItem = items.find((item) => item.sectionRef.endsWith(':model'))
      expect(sample.material.sections?.[0]?.title).toBe('WELCOME / PURPOSE')
      expect(sample.material.sections?.map((section) => section.title)).toEqual(expect.arrayContaining([
        "EXAMPLE / LET'S LOOK AT ONE",
        'YOUR TURN — GUIDED PRACTICE',
        'YOUR TURN — INDEPENDENT RESPONSE',
        'YOUR TURN — REVISE',
        'PARENT REVIEW',
      ]))
      expect(modelItem).toMatchObject({ responseType: 'READ', instructionalExample: true, required: false })
      expect(required.map((item) => item.responseType)).toEqual(['CHOICE', 'CONSTRUCTED_RESPONSE', 'CONSTRUCTED_RESPONSE'])
      expect(items.filter((item) => item.responseType === 'RUBRIC_REVIEW_PENDING')).toHaveLength(1)
      expect(items.every((item) => !item.required || Boolean(item.prompt?.trim()))).toBe(true)
    }
  })

  it('releases specific feedback only after the linked learner response page', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const model = createRichLessonRenderModel(sample.material)
      for (const link of sample.feedbackLinks) {
        const responseIndex = model.pages.findIndex((page) => page.item?.itemRef === link.responseItemRef)
        const feedbackIndex = model.pages.findIndex((page) => page.sectionRef === link.feedbackSectionRef)
        expect(responseIndex).toBeGreaterThanOrEqual(0)
        expect(feedbackIndex).toBeGreaterThan(responseIndex)
        expect(model.pages[responseIndex]?.role).toBe('PRACTICE')
        expect(model.pages[feedbackIndex]).toMatchObject({ role: 'PRACTICE', kind: 'remediation' })
      }
    }
  })

  it('uses human review for constructed writing without answer, score, or solution authority', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const forbiddenKeys = objectKeys(sample).filter((key) => /answer.?key|correct(?:Choice|Answer)?|solution|score|scoring/i.test(key))
      expect(forbiddenKeys).toEqual([])
      expect(sample.parentReviewRequired).toBe(true)
      const serialized = JSON.stringify(sample.material)
      expect(serialized).toContain('No automatic essay score is produced')
      expect(serialized).toContain('pending human judgment')
      expect(serialized).not.toMatch(/Tutor V2|tutorRuntime|providerCall/i)
    }
  })

  it('ends every lesson with the complete review and a next action', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const sections = sample.material.sections ?? []
      const reviewTitles = sections.filter((section) => section.sectionKind === 'reflection').map((section) => section.title)
      expect(reviewTitles).toEqual(REQUIRED_REVIEW_TITLES)
      expect(sections.at(-1)?.title).toBe('NEXT ACTION')
      expect(sample.reviewPresent).toBe(true)
    }
  })

  it('keeps instructions actionable, sources complete, and instructional copy non-duplicated', () => {
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      const sections = sample.material.sections ?? []
      const source = sections.find((section) => section.sectionKind === 'source')
      const copy = instructionalCopy(sample)
      expect(source?.body?.trim().split(/\s+/)).toHaveLength(sample.passageWordCount)
      expect(source?.directions?.trim()).not.toBe('')
      expect(source?.reference).toMatchObject({ creator: 'Manuel Academy', rightsCategory: 'original' })
      expect(new Set(copy).size).toBe(copy.length)
      expect(sections.filter((section) => section.title.startsWith('YOUR TURN')).every((section) => section.items?.length === 1)).toBe(true)
    }
  })

  it('keeps the nine-grade manifest synchronized with the executable fixtures', () => {
    const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8')) as {
      readonly sampleCount: number
      readonly grades: readonly number[]
      readonly richPlayerCompatible: boolean
      readonly legacyFallbackRequired: boolean
      readonly productionCurriculumChanged: boolean
      readonly samples: readonly {
        readonly grade: number
        readonly canonicalLessonRef: string
        readonly standards: readonly string[]
        readonly passageWordCount: number
        readonly reviewPresent: boolean
        readonly readability: unknown
      }[]
    }
    expect(manifest).toMatchObject({
      sampleCount: 9,
      grades: ELA_DIRECTOR_SAMPLE_GRADES,
      richPlayerCompatible: true,
      legacyFallbackRequired: false,
      productionCurriculumChanged: false,
    })
    for (const sample of ELA_DIRECTOR_SAMPLES_R2) {
      expect(manifest.samples.find((entry) => entry.grade === sample.grade)).toMatchObject({
        canonicalLessonRef: sample.canonicalLessonRef,
        standards: sample.standards,
        passageWordCount: sample.passageWordCount,
        reviewPresent: true,
        readability: sample.readability,
      })
    }
  })

  it('inherits keyboard, focus, hierarchy, width, and non-color-only accessibility from the Rich player', () => {
    const player = readFileSync(new URL('../lesson-player/RichLessonPresentation.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('../lesson-player/rich-lesson-player.css', import.meta.url), 'utf8')
    expect(player).toContain('Skip to current lesson section')
    expect(player).toContain('headingRef.current?.focus()')
    expect(player).toContain('<label')
    expect(player).toContain('<fieldset')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('max-width: 72ch')
    expect(css).toContain('min-height: 3rem')
    expect(css).toContain('@media (forced-colors: active)')
  })
})
