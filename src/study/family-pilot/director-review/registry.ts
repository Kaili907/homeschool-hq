import type { ComponentType } from 'react'
import { ARTS_MUSIC_DIRECTOR_PREVIEW_PATH } from '../arts-music-director-preview/route'
import { FINANCIAL_LITERACY_DIRECTOR_PREVIEW_PATH } from '../financial-literacy-director-preview/route'
import { HEALTH_DIRECTOR_REVIEW_PATH } from '../health-director-preview/route'
import { PHYSICAL_EDUCATION_DIRECTOR_PREVIEW_PATH } from '../physical-education-director-preview/route'
import { READY_FOR_LIFE_DIRECTOR_PREVIEW_PATH } from '../ready-for-life-director-preview/route'
import { TECHNOLOGY_DIRECTOR_PREVIEW_PATH } from '../technology-director-preview/route'

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
  'Does it explain enough before asking questions?',
  'Are the examples clear?',
  'Is the amount of guided practice right?',
  'Does independent work feel appropriate?',
  'Does remediation genuinely reteach?',
  'Would I want my child to learn this way?',
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
    id: 'technology',
    subject: 'Technology',
    grade: 10,
    lessonTitle: 'Mastery check: algorithms, efficiency, and correctness',
    lessonRef: 'ma-g10-technology-u02-l05',
    demonstrates: 'Explicit algorithm teaching, an analogous worked example, guided coding, protected independent work, debugging evidence, and misconception-specific reteaching.',
    route: TECHNOLOGY_DIRECTOR_PREVIEW_PATH,
    load: () => import('../technology-director-preview/TechnologyDirectorPreview').then((module) => ({
      default: module.TechnologyDirectorPreview,
    })),
  },
  {
    id: 'ready-for-life',
    subject: 'Ready for Life',
    grade: 3,
    lessonTitle: 'Spot, Stop, Ask: A Safe-Space Check',
    lessonRef: 'ma-g3-ready-for-life-u01-l04',
    demonstrates: 'Safety reasoning before action, a complete modeled and guided release, equal-credit real-life and simulation paths, privacy-bounded evidence, and adult authority boundaries.',
    route: READY_FOR_LIFE_DIRECTOR_PREVIEW_PATH,
    load: () => import('../ready-for-life-director-preview/ReadyForLifeDirectorPreview').then((module) => ({
      default: module.ReadyForLifeDirectorPreview,
    })),
  },
  {
    id: 'financial-literacy',
    subject: 'Financial Literacy',
    grade: 8,
    lessonTitle: 'Guided practice A: credit cards and minimum payments',
    lessonRef: 'ma-g8-financial-literacy-u04-l03',
    demonstrates: 'Credit-cost concepts, transparent calculations, worked and guided examples, independent decision evidence, and a parallel reteaching route without automatic scoring.',
    route: FINANCIAL_LITERACY_DIRECTOR_PREVIEW_PATH,
    load: () => import('../financial-literacy-director-preview/FinancialLiteracyDirectorPreview').then((module) => ({
      default: module.FinancialLiteracyDirectorPreview,
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
