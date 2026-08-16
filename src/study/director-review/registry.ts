import type { LearnerMaterialDto, LearnerLessonReview } from '../family-pilot/final-app/learner-response'
import { ELA_DIRECTOR_SAMPLES_R2 } from '../family-pilot/ela-director-samples-r2'

import math3 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-3.json'
import math4 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-4.json'
import math5 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-5.json'
import math7 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-7.json'
import math8 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-8.json'
import math9 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-9.json'
import math10 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-10.json'
import math11 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-11.json'
import math12 from '../../../curriculum-review-samples/director/mathematics-r2/samples/grade-12.json'

import science3 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-03-patterns-in-motion.json'
import science4 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-04-tracing-energy-paths.json'
import science5 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-05-daily-shadow-patterns.json'
import science7 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-07-energy-transfer.json'
import science8 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-08-force-and-mass.json'
import science9 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-09-natural-selection.json'
import science10 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-10-balancing-equations.json'
import science11 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-11-newtons-second-law.json'
import science12 from '../../../docs/curriculum-quality/science/director-samples-r2/samples/grade-12-climate-model-uncertainty.json'

import social3 from '../../../curriculum-production/director-samples/social-studies-r2/grade-03/ma-g3-social-studies-u06-l03.lesson.json'
import social4 from '../../../curriculum-production/director-samples/social-studies-r2/grade-04/ma-g4-social-studies-u02-l06.lesson.json'
import social5 from '../../../curriculum-production/director-samples/social-studies-r2/grade-05/ma-g5-social-studies-u03-l06.lesson.json'
import social7 from '../../../curriculum-production/director-samples/social-studies-r2/grade-07/ma-g7-social-studies-u02-l06.lesson.json'
import social8 from '../../../curriculum-production/director-samples/social-studies-r2/grade-08/ma-g8-social-studies-u01-l07.lesson.json'
import social9 from '../../../curriculum-production/director-samples/social-studies-r2/grade-09/ma-g9-social-studies-u05-l06.lesson.json'
import social10 from '../../../curriculum-production/director-samples/social-studies-r2/grade-10/ma-g10-social-studies-u02-l03.lesson.json'
import social11 from '../../../curriculum-production/director-samples/social-studies-r2/grade-11/ma-g11-social-studies-u08-l06.lesson.json'
import social12 from '../../../curriculum-production/director-samples/social-studies-r2/grade-12/ma-g12-social-studies-u03-l03.lesson.json'

import convergenceManifest from '../../../curriculum-review-samples/director/r2-convergence/manifest.json'

export const DIRECTOR_REVIEW_PATH = '/director-review/curriculum-r2'
export const DIRECTOR_REVIEW_GRADES = Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12] as const)
export const DIRECTOR_REVIEW_SUBJECTS = Object.freeze(['Mathematics', 'ELA', 'Science', 'Social Studies'] as const)

export type DirectorReviewGrade = typeof DIRECTOR_REVIEW_GRADES[number]
export type DirectorReviewSubject = typeof DIRECTOR_REVIEW_SUBJECTS[number]
export type DirectorReviewStatus = 'PENDING_DIRECTOR_REVIEW' | 'APPROVED' | 'NEEDS_CHANGES'

interface ManifestEntry {
  readonly sampleId: string
  readonly subject: DirectorReviewSubject
  readonly grade: DirectorReviewGrade
  readonly course: string
  readonly topic: string
  readonly standard: readonly string[]
  readonly sourceBranch: string
  readonly sourceSha: string
  readonly samplePath: string
  readonly richPlayerCompatible: true
  readonly legacyFallbackRequired: false
  readonly directorStatus: 'PENDING_DIRECTOR_REVIEW'
}

export interface DirectorReviewSample extends ManifestEntry {
  readonly material: LearnerMaterialDto
}

const mathMaterials = [math3, math4, math5, math7, math8, math9, math10, math11, math12]
  .map((sample) => sample.learnerMaterial as LearnerMaterialDto)
const scienceMaterials = [science3, science4, science5, science7, science8, science9, science10, science11, science12]
  .map((sample) => sample as unknown as LearnerMaterialDto)
const socialMaterials = [social3, social4, social5, social7, social8, social9, social10, social11, social12]
  .map((sample) => sample as unknown as LearnerMaterialDto)

const materials = new Map<string, LearnerMaterialDto>([
  ...mathMaterials.map((material) => [material.lessonRef, material] as const),
  ...ELA_DIRECTOR_SAMPLES_R2.map((sample) => [sample.sampleId, sample.material] as const),
  ...scienceMaterials.map((material) => [material.lessonRef, material] as const),
  ...socialMaterials.map((material) => [material.lessonRef, material] as const),
])

function textFromSection(material: LearnerMaterialDto, title: RegExp): string | null {
  const section = material.sections?.find((candidate) => title.test(candidate.title))
  if (section?.body?.trim()) return section.body.trim()
  if (section?.reference && typeof section.reference === 'object') {
    const record = section.reference as Readonly<Record<string, unknown>>
    const key = Object.keys(record).find((candidate) => title.test(candidate.replaceAll('_', ' ')))
    const value = key ? record[key] : undefined
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
  return null
}

function reviewFor(material: LearnerMaterialDto): LearnerLessonReview {
  const existing = material.lessonReview
  if (existing && Array.isArray(existing.whatYouLearned)) return existing
  const learned = textFromSection(material, /what you learned/i) ?? `You completed the key learning sequence in ${material.title}.`
  const progress = textFromSection(material, /course progress/i) ?? 'This Director sample does not change production course progress.'
  const next = textFromSection(material, /next action/i) ?? 'Return to the Director gallery.'
  return Object.freeze({
    whatYouLearned: Object.freeze([learned]),
    courseProgress: progress,
    nextAction: /waiting for parent/i.test(next) ? 'Waiting for Parent' : 'Done for today',
    reviewActionLabel: 'Review this lesson',
  })
}

function reviewReadyMaterial(material: LearnerMaterialDto): LearnerMaterialDto {
  return Object.freeze({ ...material, lessonReview: reviewFor(material) })
}

const rows = convergenceManifest.samples as readonly ManifestEntry[]

export const DIRECTOR_REVIEW_SAMPLES: readonly DirectorReviewSample[] = Object.freeze(rows.map((entry) => {
  const material = materials.get(entry.sampleId)
  if (!material) throw new Error(`Director sample material is missing for ${entry.sampleId}.`)
  return Object.freeze({ ...entry, material: reviewReadyMaterial(material) })
}))

export function directorReviewSample(sampleId: string | null): DirectorReviewSample | null {
  return DIRECTOR_REVIEW_SAMPLES.find((sample) => sample.sampleId === sampleId) ?? null
}
