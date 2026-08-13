import type { AcademyGrade, AcademySubject } from '../../../types'

/**
 * FF-M11 — the browser-safe catalog contract.
 *
 * The pilot Curriculum module's only loader (src/curriculum/family-pilot/
 * source.node.ts) reads the frozen release with node:fs, so a deployed browser
 * cannot use it. This module is the browser's way in: the same frozen release,
 * projected at authoring time into generated ES modules under ./generated, read
 * back through the provider below.
 *
 * Scope is deliberately the CATALOG — refs, structure, and the display metadata
 * a planner or schedule needs. Full lesson BODIES stay where they already live:
 * the frozen source and the Study content pipeline that projects it
 * (see src/study/contracts/production/content.ts and scripts/build-curriculum.mjs).
 * Nothing here duplicates an 18MB payload the app already has a path to.
 */

/** A course's stable ref, e.g. 'ma-g5-science'. */
export type CourseRef = string
/** A unit's stable ref, e.g. 'ma-g5-science-u01'. */
export type UnitRef = string
/** A lesson's stable ref, e.g. 'ma-g5-science-u01-l01'. */
export type LessonRef = string

/** Course-level summary. Held in the eager index — no lesson bodies. */
export interface CatalogCourse {
  readonly courseRef: CourseRef
  readonly grade: AcademyGrade
  readonly subject: AcademySubject
  /** Display title from the release, e.g. 'Grade 5 Technology and Computer Science'. */
  readonly title: string
  /** Instructional days the release schedules for this course. */
  readonly days: number
  readonly unitCount: number
  readonly lessonCount: number
}

/** Unit-level summary. Held in the eager index — lesson refs only, no bodies. */
export interface CatalogUnit {
  readonly unitRef: UnitRef
  readonly courseRef: CourseRef
  readonly grade: AcademyGrade
  readonly subject: AcademySubject
  readonly unitNumber: number
  readonly title: string
  readonly days: number
  readonly essentialQuestion: string
  /** Null when the release publishes no assessment for the unit. */
  readonly assessmentRef: string | null
  /** Lesson refs in this unit, in completion order. */
  readonly lessonRefs: readonly LessonRef[]
}

/** Lesson-level catalog record. Loaded lazily, per course. */
export interface CatalogLesson {
  readonly lessonRef: LessonRef
  readonly courseRef: CourseRef
  readonly unitRef: UnitRef
  readonly grade: AcademyGrade
  readonly subject: AcademySubject
  readonly unitNumber: number
  /** 1..N within the unit. */
  readonly dayInUnit: number
  /** 1..N across the whole course — the completion order. */
  readonly courseDay: number
  readonly title: string
  /** The release's own range string, e.g. '45–65'. Not parsed here. */
  readonly estimatedMinutes: string
}

/**
 * The generic catalog provider. Written against this interface, the assignment
 * planner, daily schedule, subject adapters, Study content bridge, and parent
 * assignment controls stay independent of how the catalog is stored — this
 * generated-module provider today, something else later.
 *
 * Grade/subject/course/unit reads are synchronous because their index is eager
 * and small. Lesson reads are async because lesson payloads load per course, on
 * demand. That split IS the performance contract, so it is visible in the types
 * rather than hidden behind a uniformly async facade.
 */
export interface FamilyPilotCatalogProvider {
  readonly releaseVersion: string

  listGrades: () => readonly AcademyGrade[]
  listSubjects: (grade: AcademyGrade) => readonly AcademySubject[]
  /** Every course, or just one grade's, in the release's own order. */
  listCourses: (grade?: AcademyGrade) => readonly CatalogCourse[]
  getCourse: (courseRef: CourseRef) => CatalogCourse | undefined
  listUnits: (courseRef: CourseRef) => readonly CatalogUnit[]
  getUnit: (unitRef: UnitRef) => CatalogUnit | undefined

  /** A course's lessons in completion order. Loads that course's payload. */
  listLessons: (courseRef: CourseRef) => Promise<readonly CatalogLesson[]>
  /** One lesson by stable ref. Loads only the owning course's payload. */
  getLesson: (lessonRef: LessonRef) => Promise<CatalogLesson | undefined>
}
