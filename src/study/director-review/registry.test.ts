import { describe, expect, it } from 'vitest'
import { mapLearnerMaterialToStudySegments } from '../family-pilot/final-app/learner-response'
import { createRichLessonRenderModel } from '../family-pilot/lesson-player'
import convergenceManifest from '../../../curriculum/approvals/director-samples-r2-approved.json'
import {
  DIRECTOR_REVIEW_GRADES,
  DIRECTOR_REVIEW_SAMPLES,
  DIRECTOR_REVIEW_SUBJECTS,
} from './registry'

const interactive = new Set(['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'])
const forbiddenAuthorityKey = /^(?:answer|answerKey|correctAnswer|solution|score|scoring|scoringRule|rubricAnswer|accepted)$/i

function keys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [key, ...keys(nested)])
}

describe('Director Sample R2 convergence gallery', () => {
  it('contains exactly four subjects by nine supported grades in grade-first order', () => {
    expect(convergenceManifest.sampleCount).toBe(36)
    expect(DIRECTOR_REVIEW_SAMPLES).toHaveLength(36)
    expect(new Set(DIRECTOR_REVIEW_SAMPLES.map((sample) => sample.sampleId)).size).toBe(36)
    expect(new Set(DIRECTOR_REVIEW_SAMPLES.map((sample) => sample.subject))).toEqual(new Set(DIRECTOR_REVIEW_SUBJECTS))
    expect(new Set(DIRECTOR_REVIEW_SAMPLES.map((sample) => sample.grade))).toEqual(new Set(DIRECTOR_REVIEW_GRADES))
    expect(DIRECTOR_REVIEW_SAMPLES.some((sample) => Number(sample.grade) === 6)).toBe(false)
    expect(DIRECTOR_REVIEW_SAMPLES.slice(0, 4).map((sample) => sample.subject)).toEqual(DIRECTOR_REVIEW_SUBJECTS)
    expect(DIRECTOR_REVIEW_SAMPLES.every((sample) => sample.directorStatus === 'APPROVED')).toBe(true)
    expect(DIRECTOR_REVIEW_SAMPLES.every((sample) => sample.approvalStatus === 'DIRECTOR_APPROVED_FOR_PRODUCTION')).toBe(true)
  })

  it.each(DIRECTOR_REVIEW_SAMPLES.map((sample) => [sample.sampleId, sample] as const))(
    'parses and renders %s in the real rich model with interaction, feedback, and review',
    (_sampleId, sample) => {
      const responseModel = mapLearnerMaterialToStudySegments(sample.material)
      const renderModel = createRichLessonRenderModel(sample.material)
      const required = responseModel.segments.flatMap((segment) => segment.items).filter((item) => item.required)
      const authored = JSON.stringify(sample.material)
      expect(renderModel.mode).toBe('rich')
      expect(sample.richPlayerCompatible).toBe(true)
      expect(sample.legacyFallbackRequired).toBe(false)
      expect(required.some((item) => interactive.has(item.responseType))).toBe(true)
      expect(/feedback/i.test(authored) || renderModel.pages.some((page) => page.kind === 'remediation')).toBe(true)
      expect(renderModel.review?.whatYouLearned.length).toBeGreaterThan(0)
      expect(renderModel.review?.courseProgress.trim()).toBeTruthy()
      expect(renderModel.review?.nextAction).toBeTruthy()
      expect(keys(sample.material).filter((key) => forbiddenAuthorityKey.test(key))).toEqual([])
    },
  )

  it('preserves the Grade 3 Mathematics worked example and a separate learner response', () => {
    const sample = DIRECTOR_REVIEW_SAMPLES.find((candidate) => candidate.sampleId === 'director-math-r2-g3-place-value')!
    const model = createRichLessonRenderModel(sample.material)
    const example = model.pages.find((page) => page.kind === 'worked-example')
    const yourTurn = model.pages.find((page) => page.item?.itemRef.endsWith(':guided:1'))
    expect(JSON.stringify(example)).toContain('3,000')
    expect(JSON.stringify(example)).toContain('300')
    expect(example?.item?.responseType).toBe('READ')
    expect(yourTurn?.item?.responseType).toBe('NUMERIC')
    expect(model.review).toBeTruthy()
  })

  it('keeps the gallery source isolated from learner, cloud, auth, and production mutation imports', async () => {
    const source = await import('./DirectorReviewGallery.tsx?raw').then((module) => module.default as string)
    expect(source).not.toMatch(/BrowserLearnerResponseStore|FinalFamilyPilotController|FamilyCloud|Supabase|cloud-auth|auto-planner|SchoolPlan/)
    expect(source).toContain('FamilyPilotLessonPlayer')
    expect(source).toContain('localStorage')
  })
})
