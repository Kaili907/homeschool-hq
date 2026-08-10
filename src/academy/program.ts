import type { AcademyGrade } from '../types'
import {
  AcademyContentVersionError,
  assertSupportedAcademyRelease,
  loadCatalog,
  loadSchedule,
} from './contentClient'
import type {
  AcademyCatalog,
  AcademyCatalogCourse,
  AcademySchedule,
  AcademyScheduleDay,
} from './contentTypes'
import { levelsOf, type AcademyProgramEntry } from './workingLevel'

/**
 * ACADEMY-LEVEL-DECOUPLE — a girl's academy PROGRAM: the courses she actually
 * receives, composed from one catalog per distinct working level and filtered to
 * the subjects assigned to that level. A grade-6 girl with mathematics at level
 * 5 and ELA at level 7 gets exactly two courses, drawn from two releases-worth of
 * catalog, in one program.
 *
 * Course ids are globally unique across levels (`ma-g5-…` / `ma-g7-…`), so the
 * merged catalog is a valid AcademyCatalog and every existing consumer
 * (academyState.enrollInCatalog, courseProgress, the router views) works on it
 * unchanged. `levelOf` carries the per-course level the merged `grade` field
 * cannot express.
 */

export interface AcademyProgramSource {
  level: AcademyGrade
  catalog: AcademyCatalog
  schedule: AcademySchedule
}

export interface AcademyProgram {
  entries: AcademyProgramEntry[]
  /** distinct levels represented, ascending. */
  levels: AcademyGrade[]
  /** merged catalog. `grade` is the LOWEST level, present only because
   * AcademyCatalog requires one — `levelOf` is authoritative per course. */
  catalog: AcademyCatalog
  /** merged year schedule, filtered to lessons this program actually contains. */
  schedule: AcademySchedule
  /** courseId → the academy level its content came from. */
  levelOf: Record<string, AcademyGrade>
}

const dayKey = (week: number, day: number) => `${week}:${day}`

/** Compose the program. Pure: no fetching, so the merge rules are directly testable. */
export function composeProgram(
  entries: readonly AcademyProgramEntry[],
  sources: readonly AcademyProgramSource[],
  expectedReleaseVersion?: string,
): AcademyProgram {
  const releaseVersion = expectedReleaseVersion ?? sources[0]?.catalog.releaseVersion ?? ''
  for (const source of sources) {
    for (const actualVersion of [source.catalog.releaseVersion, source.schedule.releaseVersion]) {
      if (actualVersion !== releaseVersion) {
        throw new AcademyContentVersionError(
          'release-mismatch',
          releaseVersion,
          actualVersion,
        )
      }
    }
  }

  const byLevel = new Map(sources.map((s) => [s.level, s]))
  const courses: AcademyCatalogCourse[] = []
  const levelOf: Record<string, AcademyGrade> = {}

  for (const entry of entries) {
    const source = byLevel.get(entry.level)
    if (!source) continue
    for (const course of source.catalog.courses) {
      if (course.subject !== entry.subject || levelOf[course.courseId]) continue
      courses.push(course)
      levelOf[course.courseId] = entry.level
    }
  }

  // A schedule day may only offer lessons this program actually enrolls, or the
  // girl would be sent at a course she does not have.
  const ownLessons = new Set(
    courses.flatMap((c) => c.units.flatMap((u) => u.lessonIds)),
  )
  const merged = new Map<string, AcademyScheduleDay>()
  for (const source of sources) {
    for (const day of source.schedule.days) {
      const lessons = day.lessons.filter((l) => ownLessons.has(l.lessonId))
      if (lessons.length === 0) continue
      const key = dayKey(day.week, day.day)
      const existing = merged.get(key)
      if (existing) existing.lessons.push(...lessons)
      else merged.set(key, { week: day.week, day: day.day, lessons: [...lessons] })
    }
  }

  const levels = levelsOf(entries.filter((e) => byLevel.has(e.level)))
  const primary = levels[0] ?? sources[0]?.level ?? '5'

  return {
    entries: entries.filter((e) => byLevel.has(e.level)),
    levels,
    catalog: { releaseVersion, grade: primary, courses },
    schedule: {
      releaseVersion,
      grade: primary,
      days: [...merged.values()].sort((a, b) => a.week - b.week || a.day - b.day),
    },
    levelOf,
  }
}

/** Fetch every level this program needs (one catalog + schedule each), then compose. */
export async function loadProgram(
  entries: readonly AcademyProgramEntry[],
  releaseVersion: string,
): Promise<AcademyProgram> {
  assertSupportedAcademyRelease(releaseVersion)
  const levels = levelsOf(entries)
  const sources = await Promise.all(
    levels.map(async (level): Promise<AcademyProgramSource> => {
      const [catalog, schedule] = await Promise.all([
        loadCatalog(level, releaseVersion),
        loadSchedule(level, releaseVersion),
      ])
      return { level, catalog, schedule }
    }),
  )
  return composeProgram(entries, sources, releaseVersion)
}
