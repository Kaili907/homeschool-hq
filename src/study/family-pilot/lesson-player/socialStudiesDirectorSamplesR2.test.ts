import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LEARNER_RESPONSE_TYPES,
  mapLearnerMaterialToStudySegments,
  type LearnerMaterialDto,
} from '../final-app/learner-response'
import { createRichLessonRenderModel } from './renderModel'

const root = resolve(process.cwd(), 'curriculum-production/director-samples/social-studies-r2')
const manifestPath = resolve(root, 'SOCIAL_STUDIES_DIRECTOR_SAMPLES_R2.manifest.json')

interface SampleLesson extends LearnerMaterialDto {
  readonly schemaVersion: string
  readonly sampleStatus: string
  readonly grade: number
  readonly courseRef: string
  readonly unitRef: string
  readonly canonicalLessonPath: string
  readonly standards: readonly string[]
  readonly sourceIntegrity: {
    readonly policy: string
    readonly sources: readonly string[]
  }
}

interface ManifestSample {
  readonly grade: number
  readonly courseRef: string
  readonly lessonRef: string
  readonly standards: readonly string[]
  readonly canonicalLessonPath: string
  readonly samplePath: string
  readonly responseTypes: readonly string[]
  readonly reviewPresent: boolean
  readonly readabilityNotes: string
}

interface Manifest {
  readonly sampleCount: number
  readonly grades: readonly number[]
  readonly storageBoundary: {
    readonly root: string
    readonly productionSocialStudiesRoot: string
    readonly productionCurriculumChanged: boolean
  }
  readonly playerContract: {
    readonly richPlayerCompatible: boolean
    readonly legacyFallbackRequired: boolean
  }
  readonly samples: readonly ManifestSample[]
  readonly lessonReviewModel: readonly string[]
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
const lessons = manifest.samples.map((entry) => ({
  entry,
  lesson: JSON.parse(readFileSync(resolve(process.cwd(), entry.samplePath), 'utf8')) as SampleLesson,
}))

const forbiddenAuthorityKey = /^(?:answer|answerKey|correct|correctAnswer|solution|score|scoring|rubricAnswer)$/i
const reviewKeys = [
  'what_you_learned',
  'evidence_you_used',
  'how_you_did',
  'what_to_review',
  'review_this_lesson',
  'course_progress',
  'next_action',
]

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [key, ...objectKeys(nested)])
}

function authoredStrings(lesson: SampleLesson): string[] {
  return (lesson.sections ?? []).flatMap((section) => [
    section.body,
    section.directions,
    ...(section.items ?? []).map((item) => item.prompt),
  ]).filter((value): value is string => Boolean(value && value.trim().length >= 60))
}

describe('Social Studies Director Samples R2', () => {
  it('provides exactly one isolated sample for every supported requested grade', () => {
    expect(manifest.sampleCount).toBe(9)
    expect(manifest.grades).toEqual([3, 4, 5, 7, 8, 9, 10, 11, 12])
    expect(manifest.samples.map((sample) => sample.grade)).toEqual(manifest.grades)
    expect(new Set(manifest.samples.map((sample) => sample.lessonRef)).size).toBe(9)
    expect(manifest.samples.every((sample) => sample.samplePath.startsWith(`${manifest.storageBoundary.root}/grade-`))).toBe(true)
    expect(manifest.storageBoundary.productionCurriculumChanged).toBe(false)
    expect(manifest.storageBoundary.root).not.toBe(manifest.storageBoundary.productionSocialStudiesRoot)
  })

  it.each(lessons.map(({ entry, lesson }) => [entry.grade, entry, lesson] as const))(
    'keeps Grade %i mapped to its exact canonical lesson and standards',
    (_grade, entry, lesson) => {
      const authority = readFileSync(resolve(process.cwd(), entry.canonicalLessonPath), 'utf8')
      expect(lesson.lessonRef).toBe(entry.lessonRef)
      expect(lesson.courseRef).toBe(entry.courseRef)
      expect(lesson.canonicalLessonPath).toBe(entry.canonicalLessonPath)
      expect(lesson.standards).toEqual(entry.standards)
      expect(authority).toContain(`**Lesson ID:** \`${entry.lessonRef}\``)
      expect(authority).toContain(`**Standards:** ${entry.standards.join(', ')}`)
      expect(authority).toContain(`# ${lesson.title}`)
    },
  )

  it.each(lessons.map(({ entry, lesson }) => [entry.grade, lesson] as const))(
    'projects Grade %i through the Rich Study Player without a legacy fallback',
    (_grade, lesson) => {
      const renderModel = createRichLessonRenderModel(lesson)
      const responseModel = mapLearnerMaterialToStudySegments(lesson)
      const responseTypes = responseModel.segments.flatMap((segment) => segment.items.map((item) => item.responseType))
      expect(lesson.format).toBe('structured')
      expect(lesson.markdown).toBeUndefined()
      expect(lesson.subject).toBe('social-studies')
      expect(renderModel.mode).toBe('rich')
      expect(renderModel.subject.label).toBe('Social Studies')
      expect(responseTypes).toContain('CHOICE')
      expect(responseTypes).toContain('CONSTRUCTED_RESPONSE')
      expect(responseTypes.every((type) => LEARNER_RESPONSE_TYPES.includes(type))).toBe(true)
      expect(renderModel.pages.some((page) => page.kind === 'worked-example' && page.item?.instructionalExample)).toBe(true)
      expect(renderModel.pages.some((page) => ['source', 'map', 'data'].includes(page.kind))).toBe(true)
      expect(renderModel.pages.some((page) => page.kind === 'remediation')).toBe(true)
    },
  )

  it.each(lessons.map(({ entry, lesson }) => [entry.grade, lesson] as const))(
    'gives Grade %i a labeled example, real learner turns, feedback, and a complete final review',
    (_grade, lesson) => {
      const sections = lesson.sections ?? []
      const exampleIndex = sections.findIndex((section) => /EXAMPLE/.test(section.title) && /worked/i.test(section.sectionKind ?? ''))
      const responseIndex = sections.findIndex((section) =>
        (section.items ?? []).some((item) => ['CHOICE', 'CONSTRUCTED_RESPONSE'].includes(item.responseKind ?? '')),
      )
      const feedbackIndex = sections.findIndex((section) => /feedback/i.test(section.title) && /remediation/i.test(section.sectionKind ?? ''))
      const independentIndex = sections.findIndex((section) =>
        /independent/i.test(section.sectionKind ?? '') &&
        (section.items ?? []).some((item) => item.responseKind === 'CONSTRUCTED_RESPONSE'),
      )
      const feedback = sections[feedbackIndex]
      const final = sections.at(-1)
      const reference = final?.reference as Record<string, unknown> | undefined
      expect(exampleIndex).toBeGreaterThanOrEqual(0)
      expect((sections[exampleIndex]?.items?.[0]?.workedSolution?.steps ?? []).length).toBeGreaterThanOrEqual(5)
      expect(responseIndex).toBeGreaterThan(exampleIndex)
      expect(feedbackIndex).toBeGreaterThan(responseIndex)
      expect(feedback?.body?.length).toBeGreaterThan(60)
      expect(feedback?.body).not.toMatch(/^\s*(?:incorrect|try again)[.!]?\s*$/i)
      expect(independentIndex).toBeGreaterThan(feedbackIndex)
      expect(final?.title).toBe('Lesson review')
      expect(final?.sectionKind).toBe('reflection')
      expect(reviewKeys.every((key) => typeof reference?.[key] === 'string' && String(reference[key]).trim().length > 0)).toBe(true)
      expect((final?.items ?? []).some((item) => item.responseKind === 'CHOICE')).toBe(true)
    },
  )

  it('keeps source identity explicit and browser answer/scoring authority absent', () => {
    for (const { lesson } of lessons) {
      expect(lesson.sourceIntegrity.policy.length).toBeGreaterThan(40)
      expect(lesson.sourceIntegrity.sources.length).toBeGreaterThan(0)
      expect(lesson.sourceIntegrity.policy).toMatch(/quotation|paraphrase|fictional|simulation|public/i)
      expect(objectKeys(lesson).filter((key) => forbiddenAuthorityKey.test(key))).toEqual([])
      expect(lesson.sampleStatus).toBe('DIRECTOR_REVIEW_ONLY')
    }
    expect(manifest.playerContract.richPlayerCompatible).toBe(true)
    expect(manifest.playerContract.legacyFallbackRequired).toBe(false)
  })

  it('does not duplicate substantive learner copy across grade samples', () => {
    const rows = lessons.flatMap(({ lesson }) => authoredStrings(lesson).map((text) => ({ lessonRef: lesson.lessonRef, text })))
    const normalized = rows.map(({ text }) => text.toLowerCase().replaceAll(/\s+/g, ' ').trim())
    expect(new Set(normalized).size).toBe(normalized.length)
  })

  it('declares every required lesson-review field and readability note in the manifest', () => {
    expect(manifest.lessonReviewModel).toEqual([
      'WHAT YOU LEARNED',
      'EVIDENCE YOU USED',
      'HOW YOU DID',
      'WHAT TO REVIEW',
      'REVIEW THIS LESSON',
      'COURSE PROGRESS',
      'NEXT ACTION',
    ])
    expect(manifest.samples.every((sample) => sample.reviewPresent && sample.readabilityNotes.length > 40)).toBe(true)
  })
})
