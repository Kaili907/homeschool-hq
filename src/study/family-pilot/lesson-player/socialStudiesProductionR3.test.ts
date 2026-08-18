import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LEARNER_RESPONSE_TYPES,
  mapLearnerMaterialToStudySegments,
  type LearnerMaterialDto,
  type LearnerResponseType,
} from '../final-app/learner-response'
import { classifyRichLessonSection, createRichLessonRenderModel } from './renderModel'
import type { RichLessonSectionKind } from './types'
import { unsupportedKeywords, validate } from '../../../../curriculum-production/social-studies-r3/tools/schema-validator.mjs'
import { rhythmViolations } from '../../../../curriculum-production/social-studies-r3/tools/rhythm.mjs'
import { SOCIAL_STUDIES_R3_PREVIEW_PATH, isSocialStudiesR3PreviewPath } from '../../social-studies-r3-preview/route'

const r3Root = 'curriculum-production/social-studies-r3'

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), 'utf8')) as T
}

interface PinnedFile {
  readonly path: string
  readonly sha256: string
}

interface R3Manifest {
  readonly status: string
  readonly supportedGrades: readonly number[]
  readonly grade6Present: boolean
  readonly storageBoundary: { readonly lessonRoot: string; readonly frozenModelRoot: string }
  readonly modelInput: PinnedFile & { readonly gallerySha: string; readonly socialStudiesSampleCount: number }
  readonly contract: {
    readonly lessonModelSchema: PinnedFile
    readonly productionEnvelopeSchema: PinnedFile
    readonly promotionRules: PinnedFile
    readonly lessonSchemaVersion: string
    readonly responseTypesUsed: readonly string[]
    readonly legacyFallbackRequired: boolean
    readonly parallelEngineOrRuntimeIntroduced: boolean
  }
  readonly lessons: {
    readonly authored: number
    readonly admitted: number
    readonly rows?: readonly {
      readonly lessonRef: string
      readonly file: string
      readonly canonicalLessonPath: string
      readonly modelledOn: string
      readonly courseDay: number
      readonly productionStatus: string
    }[]
  }
  readonly humanAuthority: { readonly promotionIsAutomatic: boolean }
}

interface PromotionRules {
  readonly supportedGrades: readonly number[]
  readonly grade6Supported: boolean
  readonly contract: { readonly lessonReviewDefinition: string }
  readonly preconditions: readonly { readonly id: string; readonly forbiddenKeyPattern?: string }[]
  readonly rhythm: {
    readonly orderedRule: readonly { readonly id: string }[]
    readonly lessonReviewFields: readonly string[]
  }
  readonly approvedSampleGap: {
    readonly missingProductionFields: readonly string[]
    readonly forbiddenCarryForward: readonly string[]
  }
}

interface SchemaDocument {
  readonly properties: Record<string, { readonly const?: unknown; readonly enum?: readonly unknown[] }>
  readonly required: readonly string[]
  readonly $defs: Record<string, Record<string, unknown>>
}

interface FrozenSample {
  readonly sampleId: string
  readonly subject: string
  readonly samplePath: string
}

/** Mutable so the negative rhythm cases can damage a cloned lesson in place. */
interface MutableSection {
  sectionKind: string
  title: string
  body?: string
  reference?: Record<string, string>
  items?: { itemRef: string; prompt?: string; responseKind?: LearnerResponseType }[]
}

interface SocialStudiesLesson extends Omit<LearnerMaterialDto, 'sections' | 'lessonRef'> {
  sampleStatus?: string
  grade: number
  lessonRef: string
  unitRef: string
  canonicalLessonPath: string
  standards: readonly string[]
  sections: MutableSection[]
}

const manifest = readJson<R3Manifest>(`${r3Root}/SOCIAL_STUDIES_PRODUCTION_R3.manifest.json`)
const rules = readJson<PromotionRules>(manifest.contract.promotionRules.path)
const modelSchema = readJson<SchemaDocument>(manifest.contract.lessonModelSchema.path)
const envelopeSchema = readJson<SchemaDocument>(manifest.contract.productionEnvelopeSchema.path)
const reviewSchema = { ...modelSchema.$defs.lessonReview, $defs: modelSchema.$defs }
const rhythmContext = { rules, reviewSchema }

const approvals = readJson<{ readonly samples: readonly FrozenSample[] }>(manifest.modelInput.path)
const frozen = approvals.samples
  .filter((sample) => sample.subject === 'Social Studies')
  .map((sample) => ({ sample, lesson: readJson<SocialStudiesLesson>(sample.samplePath) }))

/** The authored kind vocabulary, and the canonical player kind each one must classify into. */
const SECTION_KIND_PROJECTION: Record<string, RichLessonSectionKind> = {
  teaching: 'teaching',
  reference: 'reference',
  source: 'source',
  'primary-source': 'source',
  'map-reference': 'map',
  'data-table': 'data',
  'worked-example': 'worked-example',
  'guided-practice': 'guided-practice',
  remediation: 'remediation',
  'independent-practice': 'independent-practice',
  reflection: 'reflection',
}

const sectionKinds = modelSchema.$defs.section as { properties: { sectionKind: { enum: string[] } } }
const itemSchema = modelSchema.$defs.item as { properties: { responseKind: { enum: string[] } } }

describe('Social Studies Production R3 framework', () => {
  it('keeps the authored kind vocabulary inside what the Rich Study Player renders', () => {
    const authored = sectionKinds.properties.sectionKind.enum
    expect(new Set(authored)).toEqual(new Set(Object.keys(SECTION_KIND_PROJECTION)))
    for (const kind of authored) {
      expect(classifyRichLessonSection({ sectionKind: kind, title: 'Section' })).toBe(SECTION_KIND_PROJECTION[kind])
    }
  })

  it('introduces no learner response type beyond the existing runtime contract', () => {
    const authored = itemSchema.properties.responseKind.enum
    expect(authored.every((type) => (LEARNER_RESPONSE_TYPES as readonly string[]).includes(type))).toBe(true)
    expect(new Set(authored)).toEqual(new Set(manifest.contract.responseTypesUsed))
    expect(manifest.contract.lessonSchemaVersion).toBe(modelSchema.properties.schemaVersion.const)
    expect(manifest.contract.parallelEngineOrRuntimeIntroduced).toBe(false)
  })

  it('uses only schema keywords the R3 validator implements', () => {
    expect(unsupportedKeywords(modelSchema)).toEqual([])
    expect(unsupportedKeywords(envelopeSchema)).toEqual([])
  })

  it.each(frozen.map(({ sample, lesson }) => [sample.sampleId, lesson] as const))(
    'describes %s exactly as the Director approved it',
    (_sampleId, lesson) => {
      expect(validate(modelSchema, lesson)).toEqual([])
      expect(rhythmViolations(lesson, rhythmContext)).toEqual([])
      expect(lesson.sampleStatus).toBe('DIRECTOR_REVIEW_ONLY')
      expect(manifest.supportedGrades).toContain(lesson.grade)
    },
  )

  it.each(frozen.map(({ sample, lesson }) => [sample.sampleId, lesson] as const))(
    'projects %s through the Rich Study Player without a legacy fallback',
    (_sampleId, lesson) => {
      const renderModel = createRichLessonRenderModel(lesson)
      const responseTypes = mapLearnerMaterialToStudySegments(lesson)
        .segments.flatMap((segment) => segment.items.map((item) => item.responseType))
      expect(renderModel.mode).toBe('rich')
      expect(renderModel.subject.label).toBe('Social Studies')
      expect(manifest.contract.legacyFallbackRequired).toBe(false)
      expect(responseTypes.every((type) => (LEARNER_RESPONSE_TYPES as readonly string[]).includes(type))).toBe(true)
      expect(renderModel.pages.some((page) => page.kind === 'worked-example' && page.item?.instructionalExample)).toBe(true)
      expect(renderModel.pages.some((page) => ['source', 'map', 'data'].includes(page.kind))).toBe(true)
      expect(renderModel.pages.some((page) => page.kind === 'remediation')).toBe(true)
      expect(renderModel.pages.at(-1)?.kind).toBe('reflection')
    },
  )

  it('holds every approved sample short of production for exactly the documented gap', () => {
    const expected = [
      ...rules.approvedSampleGap.missingProductionFields.map((field) => `missing required property "${field}"`),
      ...rules.approvedSampleGap.forbiddenCarryForward.map(() => 'value matches a forbidden schema'),
    ].sort()
    for (const { lesson } of frozen) {
      expect(validate(envelopeSchema, lesson).map((violation) => violation.message).sort()).toEqual(expected)
    }
  })

  it('leaves the promotion gate passable rather than contradictory', () => {
    const envelope = {
      productionStatus: 'PRODUCTION_ADMITTED',
      provenance: {
        modelAuthority: 'DIRECTOR_SAMPLES_R2_APPROVED',
        modelSampleId: frozen[4].lesson.lessonRef,
        approvalManifestPath: manifest.modelInput.path,
        approvalManifestSha256: manifest.modelInput.sha256,
        approvalFreezeSha: manifest.modelInput.gallerySha,
      },
      runtimeReadiness: 'RUNTIME_READY',
      sourceReview: {
        reviewedByRole: 'CURRICULUM_DIRECTOR',
        reviewedOn: '2026-08-18',
        verifiedAgainst: ['National Archives founding-document transcripts'],
        noInventedQuoteTitleOrUrl: true,
        simulatedEvidenceLabeled: true,
      },
      courseProgress: { day: 7, totalDays: 108 },
      lessonReview: {
        whatYouLearned: ['A record describes a document.', 'A fact is something the source states.'],
        courseProgress: 'Unit 8, Lesson 7 of 12. That is course day 91 of 108.',
        nextAction: 'Continue required work',
        reviewActionLabel: 'Review this lesson',
      },
    }
    expect(validate(envelopeSchema, envelope)).toEqual([])
    const overlap = modelSchema.required.filter((field) => envelopeSchema.required.includes(field))
    expect(overlap).toEqual([])
  })

  it('rejects a lesson that breaks the rhythm', () => {
    const base = frozen[4].lesson
    expect(rhythmViolations(base, rhythmContext)).toEqual([])

    const withoutFeedback = structuredClone(base)
    withoutFeedback.sections = withoutFeedback.sections.filter((section) => section.sectionKind !== 'remediation')
    expect(rhythmViolations(withoutFeedback, rhythmContext).join(' ')).toContain('feedback')

    const reviewNotLast = structuredClone(base)
    reviewNotLast.sections.push({ sectionKind: 'teaching', title: 'Afterword', body: 'x'.repeat(60) })
    expect(rhythmViolations(reviewNotLast, rhythmContext).join(' ')).toContain('must be the final section')

    const modelsLearnerPrompt = structuredClone(base)
    const learnerPrompt = modelsLearnerPrompt.sections
      .find((section) => section.sectionKind === 'independent-practice')?.items?.[0]?.prompt
    const workedItem = modelsLearnerPrompt.sections.find((section) => section.sectionKind === 'worked-example')?.items?.[0]
    expect(learnerPrompt && workedItem).toBeTruthy()
    workedItem!.prompt = learnerPrompt
    expect(rhythmViolations(modelsLearnerPrompt, rhythmContext).join(' ')).toContain('different case')

    const incompleteReview = structuredClone(base)
    delete incompleteReview.sections.at(-1)!.reference!.evidence_you_used
    expect(rhythmViolations(incompleteReview, rhythmContext).join(' ')).toContain('evidence_you_used')

    const bareFeedback = structuredClone(base)
    bareFeedback.sections.find((section) => section.sectionKind === 'remediation')!.body = 'Incorrect.'
    expect(rhythmViolations(bareFeedback, rhythmContext).length).toBeGreaterThan(0)
  })

  it('rejects an out-of-scope lesson identity', () => {
    const grade6 = structuredClone(frozen[4].lesson)
    grade6.grade = 6
    grade6.lessonRef = 'ma-g6-social-studies-u01-l07'
    const messages = validate(modelSchema, grade6).map((violation) => violation.path)
    expect(messages).toContain('#/grade')
    expect(messages).toContain('#/lessonRef')
    expect(manifest.grade6Present).toBe(false)
    expect(rules.grade6Supported).toBe(false)
    expect(manifest.supportedGrades).toEqual(rules.supportedGrades)
  })

  it('reports the framework state honestly', () => {
    expect(manifest.status).toBe('REFERENCE_LESSON')
    expect(manifest.humanAuthority.promotionIsAutomatic).toBe(false)
    expect(frozen).toHaveLength(manifest.modelInput.socialStudiesSampleCount)
    const lessonRoot = resolve(process.cwd(), manifest.storageBoundary.lessonRoot)
    const authored = existsSync(lessonRoot)
      ? readdirSync(lessonRoot, { recursive: true, encoding: 'utf8' }).filter((entry) => entry.endsWith('.lesson.json'))
      : []
    expect(authored).toHaveLength(manifest.lessons.authored)
    expect(manifest.lessons.authored).toBe(manifest.lessons.rows?.length ?? 0)
    expect(manifest.lessons.admitted).toBe(0)
    expect(rules.rhythm.orderedRule.map((step) => step.id)).toEqual([
      'question-context',
      'background',
      'example-evidence',
      'model-thinking',
      'learner-evidence',
      'your-turn-guided',
      'feedback',
      'your-turn-independent',
      'review',
    ])
  })
})

const referenceRow = manifest.lessons.rows?.[0]
const reference = readJson<SocialStudiesLesson & {
  readonly productionStatus: string
  readonly courseProgress: { readonly day: number; readonly totalDays: number }
  readonly sourceReview: { readonly reviewedByRole: string; readonly verifiedAgainst: readonly string[] }
  readonly lessonReview: {
    readonly whatYouLearned: readonly string[]
    readonly courseProgress: string
    readonly nextAction: string
    readonly reviewActionLabel: string
  }
}>(`${r3Root}/${referenceRow!.file}`)

const NO_CREDIT_LANGUAGE = /(?:no course credit|outside production|does not change production|does not change your production|records no production|creates no production|cannot affect live|does not update the live|remains isolated)/i

describe('Social Studies R3 reference lesson: ma-g3-social-studies-u08-l07', () => {
  it('satisfies the model schema, the production envelope, and the rhythm rule', () => {
    expect(validate(modelSchema, reference)).toEqual([])
    expect(validate(envelopeSchema, reference)).toEqual([])
    expect(rhythmViolations(reference, rhythmContext)).toEqual([])
    expect(reference.productionStatus).toBe('READY_FOR_GATE')
  })

  it('reproduces its canonical package identity exactly', () => {
    const canonical = readFileSync(resolve(process.cwd(), reference.canonicalLessonPath), 'utf8')
    expect(canonical).toContain(`**Lesson ID:** \`${reference.lessonRef}\``)
    expect(canonical).toContain(`**Standards:** ${reference.standards.join(', ')}`)
    expect(canonical).toContain(`# ${reference.title}`)
    expect(reference.canonicalLessonPath).toBe(referenceRow!.canonicalLessonPath)
  })

  it('projects through the real render model as a rich Social Studies lesson', () => {
    const renderModel = createRichLessonRenderModel(reference)
    const kinds = renderModel.pages.map((page) => page.kind)
    expect(renderModel.mode).toBe('rich')
    expect(renderModel.subject.label).toBe('Social Studies')
    expect(renderModel.lessonRef).toBe(reference.lessonRef)
    // The approved rhythm has to survive projection, not just exist in the file.
    expect(kinds.indexOf('worked-example')).toBeGreaterThan(kinds.indexOf('source'))
    expect(kinds.indexOf('guided-practice')).toBeGreaterThan(kinds.indexOf('worked-example'))
    expect(kinds.indexOf('remediation')).toBeGreaterThan(kinds.indexOf('guided-practice'))
    expect(kinds.indexOf('independent-practice')).toBeGreaterThan(kinds.indexOf('remediation'))
    expect(kinds.at(-1)).toBe('reflection')
    expect(renderModel.pages.some((page) => page.kind === 'worked-example' && page.item?.instructionalExample)).toBe(true)
  })

  it('gives every learner turn a real control and instructional feedback through the real runtime', () => {
    const items = mapLearnerMaterialToStudySegments(reference).segments.flatMap((segment) => segment.items)
    const worked = items.filter((item) => item.instructionalExample)
    const required = items.filter((item) => item.required)

    // Looking at an example is not mastery.
    expect(worked.length).toBeGreaterThanOrEqual(2)
    expect(worked.every((item) => item.responseType === 'READ' && !item.required && !item.feedback)).toBe(true)

    expect(required.length).toBeGreaterThanOrEqual(5)
    expect(required.every((item) => ['CHOICE', 'CONSTRUCTED_RESPONSE'].includes(item.responseType))).toBe(true)
    expect(required.every((item) => (item.responseType === 'CHOICE' ? item.choices.length >= 2 : item.choices.length === 0))).toBe(true)
    for (const item of required) {
      expect(item.feedback?.correct?.length ?? 0).toBeGreaterThan(20)
      expect(item.feedback?.incorrect?.length ?? 0).toBeGreaterThanOrEqual(40)
      expect(item.feedback!.incorrect).not.toMatch(/^\s*(?:try again|incorrect|wrong|not quite)[.!]*\s*$/i)
    }
    // Feedback is hand-authored per item, not one string reused.
    expect(new Set(required.map((item) => item.feedback!.incorrect)).size).toBe(required.length)
  })

  it('applies the COURSE PROGRESS and NEXT ACTION ruling on both review surfaces', () => {
    const expectedDay = (8 - 1) * 12 + 7
    const sevenField = reference.sections.at(-1)!.reference!
    const review = createRichLessonRenderModel(reference).review

    expect(reference.courseProgress).toEqual({ day: expectedDay, totalDays: 108 })
    expect(referenceRow!.courseDay).toBe(expectedDay)
    for (const progress of [sevenField.course_progress, reference.lessonReview.courseProgress]) {
      expect(progress).toContain(`day ${expectedDay} of 108`)
      expect(progress).not.toMatch(NO_CREDIT_LANGUAGE)
    }
    expect(reference.lessonReview.nextAction).toBe('Continue required work')
    expect(review?.nextAction).toBe('Continue required work')
    expect(review?.whatYouLearned.length).toBeGreaterThanOrEqual(2)
    expect(review?.reviewActionLabel.toLowerCase()).toContain('review this lesson')
    expect(rules.rhythm.lessonReviewFields.every((field) => String(sevenField[field] ?? '').trim().length > 0)).toBe(true)
  })

  it('carries no browser answer or scoring authority', () => {
    const forbidden = new RegExp(
      rules.preconditions.find((rule) => rule.id === 'no-browser-answer-authority')!.forbiddenKeyPattern!,
      'i',
    )
    const keys = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.flatMap(keys)
      if (!value || typeof value !== 'object') return []
      return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [key, ...keys(nested)])
    }
    expect(keys(reference).filter((key) => forbidden.test(key))).toEqual([])
    const renderModel = createRichLessonRenderModel(reference)
    expect(keys(renderModel.pages.map((page) => page.item)).filter((key) => forbidden.test(key))).toEqual([])
    expect(reference.sourceReview.verifiedAgainst.length).toBeGreaterThanOrEqual(1)
    // A repository-verified source set is not a human sign-off.
    expect(reference.sourceReview.reviewedByRole).toBe('PENDING_HUMAN_SOURCE_REVIEW')
    expect(reference.productionStatus).not.toBe('PRODUCTION_ADMITTED')
  })

  it('is a new lesson, not a rewrite of the frozen Grade 3 sample', () => {
    const frozenGrade3 = frozen.find(({ lesson }) => lesson.grade === 3)!.lesson
    expect(reference.lessonRef).not.toBe(frozenGrade3.lessonRef)
    expect(reference.unitRef).not.toBe(frozenGrade3.unitRef)
    expect(referenceRow!.modelledOn).toContain(frozenGrade3.lessonRef)

    const substantive = (lesson: SocialStudiesLesson) =>
      lesson.sections
        .flatMap((section) => [section.body, ...(section.items ?? []).map((item) => item.prompt)])
        .filter((text): text is string => typeof text === 'string' && text.trim().length >= 60)
        .map((text) => text.toLowerCase().replaceAll(/\s+/g, ' ').trim())
    const frozenCopy = new Set(substantive(frozenGrade3))
    expect(substantive(reference).filter((text) => frozenCopy.has(text))).toEqual([])
  })

  it('exposes a preview route that is additive and leaves the R2 gallery alone', () => {
    expect(SOCIAL_STUDIES_R3_PREVIEW_PATH).toBe('/curriculum-preview/social-studies-r3')
    expect(isSocialStudiesR3PreviewPath(SOCIAL_STUDIES_R3_PREVIEW_PATH)).toBe(true)
    expect(isSocialStudiesR3PreviewPath('/director-review/curriculum-r2')).toBe(false)
    expect(isSocialStudiesR3PreviewPath('/')).toBe(false)
  })
})
