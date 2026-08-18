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
  readonly lessons: { readonly authored: number; readonly admitted: number }
  readonly humanAuthority: { readonly promotionIsAutomatic: boolean }
}

interface PromotionRules {
  readonly supportedGrades: readonly number[]
  readonly grade6Supported: boolean
  readonly contract: { readonly lessonReviewDefinition: string }
  readonly rhythm: { readonly orderedRule: readonly { readonly id: string }[] }
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
    expect(manifest.status).toBe('FRAMEWORK_ONLY')
    expect(manifest.humanAuthority.promotionIsAutomatic).toBe(false)
    expect(frozen).toHaveLength(manifest.modelInput.socialStudiesSampleCount)
    const lessonRoot = resolve(process.cwd(), manifest.storageBoundary.lessonRoot)
    const authored = existsSync(lessonRoot)
      ? readdirSync(lessonRoot, { recursive: true, encoding: 'utf8' }).filter((entry) => entry.endsWith('.lesson.json'))
      : []
    expect(authored).toHaveLength(manifest.lessons.authored)
    expect(manifest.lessons.authored).toBe(0)
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
