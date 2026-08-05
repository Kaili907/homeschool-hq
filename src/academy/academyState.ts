import type {
  AcademyAssessmentAttempt,
  AcademyGrade,
  AcademyLessonState,
  AcademyOccasion,
  AcademyState,
  ISODate,
  Profile,
} from '../types'
import { ACADEMY_RELEASE_VERSION, type AcademyCatalog } from './contentTypes'

/**
 * CURR-1 — pure academy state transitions. All functions return new objects and
 * never touch the source curriculum: content is immutable per release, student
 * state lives here (Profile.academy), and the two never mix.
 *
 * Invariants enforced here (tested in academyState.test.ts):
 *  - completion is idempotent: first completedAt wins, repeats count as revisits
 *  - occasions are append-only; mastery is DERIVED via the release rule
 *  - resume state (segmentIndex) survives pause/navigation/sign-out
 *  - attempts carry the release version (stale-attempt protection)
 */

export function emptyAcademyState(grade: AcademyGrade, now: string): AcademyState {
  return {
    releaseVersion: ACADEMY_RELEASE_VERSION,
    grade,
    enrolledAt: now,
    courseIds: [],
    lessons: {},
    assessments: {},
  }
}

/** Enroll (or re-sync enrollment) in every course of the grade catalog.
 * Existing lesson/assessment state is preserved — enrollment never resets work. */
export function enrollInCatalog(p: Profile, catalog: AcademyCatalog, now: string): Profile {
  const grade = catalog.grade
  const prev = p.academy ?? emptyAcademyState(grade, now)
  return {
    ...p,
    academy: {
      ...prev,
      grade,
      courseIds: catalog.courses.map((c) => c.courseId),
    },
  }
}

const lessonOf = (p: Profile, lessonId: string): AcademyLessonState | undefined =>
  p.academy?.lessons[lessonId]

function patchLesson(
  p: Profile,
  lessonId: string,
  update: (prev: AcademyLessonState | undefined) => AcademyLessonState,
): Profile {
  if (!p.academy) return p
  return {
    ...p,
    academy: {
      ...p.academy,
      lessons: { ...p.academy.lessons, [lessonId]: update(p.academy.lessons[lessonId]) },
    },
  }
}

/** Begin (or resume) a lesson. A fresh start opens at segment 0; an existing
 * attempt is returned untouched so the exact resume point is preserved. */
export function startLesson(p: Profile, lessonId: string, now: string): Profile {
  return patchLesson(p, lessonId, (prev) =>
    prev ?? {
      status: 'in-progress',
      segmentIndex: 0,
      releaseVersion: p.academy!.releaseVersion,
      startedAt: now,
      occasions: [],
    },
  )
}

/** An attempt started under a different release than the enrollment is stale:
 * segment indexes may no longer line up with the content. The UI must restart
 * the lesson (state is kept for the record; resume is refused). */
export function isStaleAttempt(p: Profile, lessonId: string): boolean {
  const lesson = lessonOf(p, lessonId)
  return !!lesson && !!p.academy && lesson.releaseVersion !== p.academy.releaseVersion
}

/** Advance the resume pointer past `segmentIndex`. Out-of-order or repeated
 * segment completions never move the pointer backwards. */
export function completeSegment(p: Profile, lessonId: string, segmentIndex: number): Profile {
  if (!lessonOf(p, lessonId)) return p
  return patchLesson(p, lessonId, (prev) => ({
    ...prev!,
    segmentIndex: Math.max(prev!.segmentIndex, segmentIndex + 1),
  }))
}

/**
 * Record the check-for-understanding outcome and settle the lesson:
 * met → complete; not met → reteach (the lesson re-opens for another pass).
 * Occasions append on every submission; completion itself is idempotent —
 * a second "complete" never overwrites completedAt, it bumps `revisits`.
 */
export function submitLessonCheck(
  p: Profile,
  lessonId: string,
  input: { date: ISODate; mode: 'guided' | 'independent'; met: boolean; now: string },
): Profile {
  if (!lessonOf(p, lessonId)) return p
  const occasion: AcademyOccasion = {
    date: input.date,
    mode: input.mode,
    met: input.met,
    kind: 'lesson-check',
  }
  return patchLesson(p, lessonId, (prev) => {
    const base = { ...prev!, occasions: [...prev!.occasions, occasion] }
    if (!input.met) return { ...base, status: 'reteach' as const }
    if (base.completedAt) {
      return { ...base, status: 'complete' as const, revisits: (base.revisits ?? 0) + 1 }
    }
    return { ...base, status: 'complete' as const, completedAt: input.now }
  })
}

/** Reopen a reteach (or revisit a completed) lesson at a given segment. */
export function reopenLesson(p: Profile, lessonId: string, segmentIndex = 0): Profile {
  if (!lessonOf(p, lessonId)) return p
  return patchLesson(p, lessonId, (prev) => ({
    ...prev!,
    status: 'in-progress',
    segmentIndex,
  }))
}

/** Append a reassessment occasion to a lesson (fresh evidence after reteach). */
export function recordReassessment(
  p: Profile,
  lessonId: string,
  input: { date: ISODate; mode: 'guided' | 'independent'; met: boolean; now: string },
): Profile {
  if (!lessonOf(p, lessonId)) return p
  const occasion: AcademyOccasion = {
    date: input.date,
    mode: input.mode,
    met: input.met,
    kind: 'reassessment',
  }
  return patchLesson(p, lessonId, (prev) => {
    const base = { ...prev!, occasions: [...prev!.occasions, occasion] }
    if (!input.met) return { ...base, status: 'reteach' as const }
    if (base.completedAt) return { ...base, status: 'complete' as const }
    return { ...base, status: 'complete' as const, completedAt: input.now }
  })
}

export type AcademyMastery = 'not-started' | 'developing' | 'mastered'

/**
 * The release's canonical mastery rule (policies/instruction-mastery-…):
 * "A single answer cannot establish mastery … at least two occasions separated
 * by time … guided success is not weighted the same as independent success."
 * Mastered = ≥2 met occasions on ≥2 distinct dates, at least one independent.
 */
export function masteryOf(lesson: AcademyLessonState | undefined): AcademyMastery {
  if (!lesson || lesson.occasions.length === 0) return 'not-started'
  const met = lesson.occasions.filter((o) => o.met)
  const dates = new Set(met.map((o) => o.date))
  const independent = met.some((o) => o.mode === 'independent')
  return met.length >= 2 && dates.size >= 2 && independent ? 'mastered' : 'developing'
}

/** Append one adult-scored unit-assessment attempt (reassessment = call again). */
export function recordAssessmentAttempt(
  p: Profile,
  assessmentId: string,
  attempt: AcademyAssessmentAttempt,
): Profile {
  if (!p.academy) return p
  const prev = p.academy.assessments[assessmentId] ?? []
  return {
    ...p,
    academy: {
      ...p.academy,
      assessments: { ...p.academy.assessments, [assessmentId]: [...prev, attempt] },
    },
  }
}

/** Latest attempt for an assessment, or null. */
export function latestAssessmentAttempt(
  p: Profile,
  assessmentId: string,
): AcademyAssessmentAttempt | null {
  const attempts = p.academy?.assessments[assessmentId]
  return attempts?.length ? attempts[attempts.length - 1] : null
}

export interface AcademyCourseProgress {
  courseId: string
  total: number
  completed: number
  mastered: number
  reteach: number
}

/** Per-course progress summary from the catalog + profile state (parent hub). */
export function courseProgress(p: Profile, catalog: AcademyCatalog): AcademyCourseProgress[] {
  return catalog.courses.map((course) => {
    const lessonIds = course.units.flatMap((u) => u.lessonIds)
    let completed = 0
    let mastered = 0
    let reteach = 0
    for (const id of lessonIds) {
      const lesson = p.academy?.lessons[id]
      if (!lesson) continue
      if (lesson.status === 'complete') completed++
      if (lesson.status === 'reteach') reteach++
      if (masteryOf(lesson) === 'mastered') mastered++
    }
    return { courseId: course.courseId, total: lessonIds.length, completed, mastered, reteach }
  })
}
