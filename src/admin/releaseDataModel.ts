import releaseProjectionDocument from './releaseCourseProjection.json'

export interface AdminReleaseCounts {
  readonly grades: number
  readonly courses: number
  readonly units: number
  readonly lessons: number
  readonly assessments: number
}

export interface AdminReleaseCourse {
  readonly courseRef: string
  readonly grade: number
  readonly subject: string
  readonly title: string
  readonly days: number
  readonly unitCount: number
  readonly lessonCount: number
}

export interface AdminReleaseReadModel {
  readonly releaseId: string
  readonly releaseVersion: string
  readonly classification: string
  readonly admissionStatus: string
  readonly sourceCommit: string
  readonly sourcePaths: readonly string[]
  readonly supportedGrades: readonly number[]
  readonly counts: AdminReleaseCounts
  readonly courses: readonly AdminReleaseCourse[]
}

interface ReleaseProjectionSource {
  readonly sourceCommit: string
  readonly manifestSourcePath: string
  readonly catalogSourcePath: string
  readonly releaseId: string
  readonly releaseVersion: string
  readonly classification: string
  readonly admissionStatus: string
  readonly supportedGrades: readonly number[]
  readonly counts: AdminReleaseCounts
  readonly assessmentBindings: { readonly total: number }
  readonly courses: readonly {
    readonly courseRef: string
    readonly grade: string | number
    readonly subject: string
    readonly title: string
    readonly days: number
    readonly unitCount: number
    readonly lessonCount: number
  }[]
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Admin release source has invalid ${label}.`)
  return value
}

/**
 * Builds the small Admin projection from the admitted manifest and browser
 * catalog. Totals are cross-checked against the catalog instead of repeated in
 * presentation code, so source drift fails closed.
 */
export function buildAdminReleaseReadModel(
  source: ReleaseProjectionSource,
): AdminReleaseReadModel {
  if (!/^[0-9a-f]{40}$/.test(source.sourceCommit)) {
    throw new Error('Admin release course projection has invalid source provenance.')
  }

  const courses = source.courses.map((course): AdminReleaseCourse => Object.freeze({
    courseRef: course.courseRef,
    grade: nonNegativeInteger(Number(course.grade), `grade for ${course.courseRef}`),
    subject: course.subject,
    title: course.title,
    days: nonNegativeInteger(course.days, `days for ${course.courseRef}`),
    unitCount: nonNegativeInteger(course.unitCount, `unit count for ${course.courseRef}`),
    lessonCount: nonNegativeInteger(course.lessonCount, `lesson count for ${course.courseRef}`),
  }))
  const courseRefs = new Set(courses.map((course) => course.courseRef))
  if (courseRefs.size !== courses.length) throw new Error('Admin release catalog contains duplicate course refs.')

  const derived = {
    grades: new Set(courses.map((course) => course.grade)).size,
    courses: courses.length,
    units: courses.reduce((total, course) => total + course.unitCount, 0),
    lessons: courses.reduce((total, course) => total + course.lessonCount, 0),
    assessments: source.assessmentBindings.total,
  }
  for (const key of Object.keys(derived) as (keyof AdminReleaseCounts)[]) {
    if (derived[key] !== nonNegativeInteger(source.counts[key], `${key} total`)) {
      throw new Error(`Admin release ${key} total disagrees with its source catalog.`)
    }
  }
  if (source.supportedGrades.length !== derived.grades) {
    throw new Error('Admin release supported grades disagree with its source catalog.')
  }

  return Object.freeze({
    releaseId: source.releaseId,
    releaseVersion: source.releaseVersion,
    classification: source.classification,
    admissionStatus: source.admissionStatus,
    sourceCommit: source.sourceCommit,
    sourcePaths: Object.freeze([source.manifestSourcePath, source.catalogSourcePath]),
    supportedGrades: Object.freeze([...source.supportedGrades]),
    counts: Object.freeze({ ...derived }),
    courses: Object.freeze(courses),
  })
}

export const ADMIN_EXPANDED_RELEASE = buildAdminReleaseReadModel(
  releaseProjectionDocument as ReleaseProjectionSource,
)
