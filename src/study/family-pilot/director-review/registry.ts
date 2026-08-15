import type { ComponentType } from 'react'
import { ARTS_MUSIC_DIRECTOR_PREVIEW_PATH } from '../arts-music-director-preview/route'
import { HEALTH_DIRECTOR_REVIEW_PATH } from '../health-director-preview/route'
import { PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH } from '../physical-education-director-preview/route'

export const DIRECTOR_LESSON_SAMPLE_REVIEW_HOME_PATH = '/__review/lesson-samples' as const

export type DirectorLessonSample = Readonly<{
  id: string
  subject: string
  grade: number
  lessonTitle: string
  lessonRef: string
  demonstrates: string
  route: `/__review/${string}`
  load: () => Promise<{ default: ComponentType }>
}>

export const DIRECTOR_REVIEW_PROMPTS = Object.freeze([
  'Does this teach enough before practice?',
  'Is the language appropriate?',
  'Are examples clear?',
  'Is there enough guided practice?',
  'Does remediation actually reteach?',
  'Would you want your child to learn this way?',
] as const)

/**
 * Development review catalog. A later subject adds one entry with its real
 * review route and lazy component loader; the hub and router need no redesign.
 */
export const DIRECTOR_LESSON_SAMPLES = Object.freeze([
  {
    id: 'arts-music',
    subject: 'Arts/Music',
    grade: 9,
    lessonTitle: 'Concept model A: advanced composition and visual hierarchy',
    lessonRef: 'ma-g9-arts-and-music-u01-l02',
    demonstrates: 'Explicit visual-art concept teaching, a perceptual model, guided skill work, learner-owned creation, critique, and fresh remediation.',
    route: ARTS_MUSIC_DIRECTOR_PREVIEW_PATH,
    load: () => import('../arts-music-director-preview/ArtsMusicDirectorPreview').then((module) => ({
      default: module.ArtsMusicDirectorPreview,
    })),
  },
  {
    id: 'health',
    subject: 'Health',
    grade: 5,
    lessonTitle: 'Launch and diagnostic: dimensions of health',
    lessonRef: 'ma-g5-health-u01-l01',
    demonstrates: 'Concept and vocabulary teaching before decision reasoning, privacy-safe evidence, guided release, and a genuinely different remediation model.',
    route: HEALTH_DIRECTOR_REVIEW_PATH,
    load: () => import('../health-director-preview/HealthDirectorPreview').then((module) => ({
      default: module.HealthDirectorPreview,
    })),
  },
  {
    id: 'physical-education',
    subject: 'Physical Education',
    grade: 12,
    lessonTitle: 'The Stop Rule: Act Without Waiting for a Coach',
    lessonRef: 'ma-g12-physical-education-u08-l07',
    demonstrates: 'A complete safety-stop decision lesson with modeled reasoning, guided-to-independent transfer, equal-credit adaptations, and guardian authority boundaries.',
    route: PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH,
    load: () => import('../physical-education-director-preview/PhysicalEducationDirectorPreview').then((module) => ({
      default: module.PhysicalEducationDirectorPreview,
    })),
  },
] satisfies readonly DirectorLessonSample[])

export function isExactDirectorReviewPath(pathname: string, route: string): boolean {
  return pathname === route || pathname === `${route}/`
}

export function findDirectorLessonSample(pathname: string): DirectorLessonSample | undefined {
  return DIRECTOR_LESSON_SAMPLES.find((sample) => isExactDirectorReviewPath(pathname, sample.route))
}
