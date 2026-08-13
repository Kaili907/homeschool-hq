import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ACADEMY_SUBJECTS, type AcademyGrade } from '../../../types'
import { createCatalogProvider, familyPilotCatalog } from './provider'
import { COURSES, RELEASE_VERSION, UNITS } from './generated/index'
import { COURSE_LESSON_LOADERS } from './loaders'
import type { CatalogLesson } from './types'

/**
 * FF-M11 — the release the browser runtime must be able to represent.
 * These are the canonical numbers, asserted against the runtime rather than
 * against the generator, so a runtime that silently drops content fails here.
 */
const CANONICAL = {
  grades: ['5', '7', '8'] as readonly AcademyGrade[],
  courses: 30,
  units: 232,
  lessons: 2736,
  lessonsByGrade: { '5': 900, '7': 900, '8': 936 } as Record<AcademyGrade, number>,
} as const

const SOURCE_ROOT = fileURLToPath(
  new URL('../../../../curriculum-content/manuel-academy/', import.meta.url),
)

describe('canonical release coverage', () => {
  it('publishes the release version the frozen registry marks active', () => {
    const registry = JSON.parse(
      readFileSync(join(SOURCE_ROOT, 'production-release-registry.json'), 'utf8'),
    ) as { currentRelease: string }
    expect(familyPilotCatalog.releaseVersion).toBe(registry.currentRelease)
    expect(RELEASE_VERSION).toBe(registry.currentRelease)
  })

  it('lists exactly grades 5, 7 and 8', () => {
    expect(familyPilotCatalog.listGrades()).toEqual(CANONICAL.grades)
  })

  it('lists all ten subjects for every grade', () => {
    for (const grade of CANONICAL.grades) {
      const subjects = familyPilotCatalog.listSubjects(grade)
      expect(subjects).toHaveLength(ACADEMY_SUBJECTS.length)
      expect([...subjects].sort()).toEqual([...ACADEMY_SUBJECTS].sort())
    }
  })

  it('exposes exactly 30 courses, three per subject', () => {
    expect(familyPilotCatalog.listCourses()).toHaveLength(CANONICAL.courses)
    for (const grade of CANONICAL.grades) {
      expect(familyPilotCatalog.listCourses(grade)).toHaveLength(ACADEMY_SUBJECTS.length)
    }
    for (const subject of ACADEMY_SUBJECTS) {
      const forSubject = familyPilotCatalog.listCourses().filter((c) => c.subject === subject)
      expect(forSubject).toHaveLength(CANONICAL.grades.length)
    }
  })

  it('exposes exactly 232 units, each reachable from its course', () => {
    const viaCourses = familyPilotCatalog
      .listCourses()
      .flatMap((course) => familyPilotCatalog.listUnits(course.courseRef))
    expect(viaCourses).toHaveLength(CANONICAL.units)
    expect(new Set(viaCourses.map((u) => u.unitRef)).size).toBe(CANONICAL.units)
    for (const unit of viaCourses) {
      expect(familyPilotCatalog.getUnit(unit.unitRef)).toBe(unit)
    }
  })

  it('reports 2736 lessons and 900/900/936 per grade from the eager index alone', () => {
    const total = familyPilotCatalog.listCourses().reduce((n, c) => n + c.lessonCount, 0)
    expect(total).toBe(CANONICAL.lessons)
    for (const grade of CANONICAL.grades) {
      const forGrade = familyPilotCatalog
        .listCourses(grade)
        .reduce((n, c) => n + c.lessonCount, 0)
      expect(forGrade).toBe(CANONICAL.lessonsByGrade[grade])
    }
  })

  it('loads exactly 2736 distinct lessons, each resolving exactly once', async () => {
    const seen = new Map<string, CatalogLesson>()
    for (const course of familyPilotCatalog.listCourses()) {
      const lessons = await familyPilotCatalog.listLessons(course.courseRef)
      expect(lessons).toHaveLength(course.lessonCount)
      for (const lesson of lessons) {
        expect(seen.has(lesson.lessonRef)).toBe(false)
        seen.set(lesson.lessonRef, lesson)
      }
    }
    expect(seen.size).toBe(CANONICAL.lessons)

    // Every unit's declared lesson refs are exactly the lessons that loaded.
    const viaUnits = familyPilotCatalog
      .listCourses()
      .flatMap((c) => familyPilotCatalog.listUnits(c.courseRef))
      .flatMap((u) => u.lessonRefs)
    expect(viaUnits).toHaveLength(CANONICAL.lessons)
    expect(new Set(viaUnits)).toEqual(new Set(seen.keys()))
  })

  it('orders every course by a dense course_day 1..N', async () => {
    for (const course of familyPilotCatalog.listCourses()) {
      const lessons = await familyPilotCatalog.listLessons(course.courseRef)
      expect(lessons.map((l) => l.courseDay)).toEqual(
        Array.from({ length: course.lessonCount }, (_unused, i) => i + 1),
      )
    }
  })
})

describe('stable refs', () => {
  it('rehydrates every lesson onto the unit that actually declares it', async () => {
    // unitRef is the one field the provider computes rather than copies, so it
    // is checked against unit membership, not against the course it came from
    // (which every unit in the course would satisfy).
    for (const course of familyPilotCatalog.listCourses()) {
      const lessons = await familyPilotCatalog.listLessons(course.courseRef)
      const perUnit = new Map<string, number[]>()

      for (const lesson of lessons) {
        const unit = familyPilotCatalog.getUnit(lesson.unitRef)
        expect(unit, `${lesson.lessonRef} resolved to unknown unit ${lesson.unitRef}`).toBeDefined()
        expect(unit!.lessonRefs).toContain(lesson.lessonRef)
        expect(unit!.unitNumber).toBe(lesson.unitNumber)
        expect(unit!.courseRef).toBe(course.courseRef)
        perUnit.set(lesson.unitRef, [...(perUnit.get(lesson.unitRef) ?? []), lesson.dayInUnit])
      }

      // Every unit in the course received lessons, each numbered 1..N.
      const units = familyPilotCatalog.listUnits(course.courseRef)
      expect([...perUnit.keys()].sort()).toEqual(units.map((u) => u.unitRef).sort())
      for (const unit of units) {
        expect(perUnit.get(unit.unitRef)).toEqual(
          Array.from({ length: unit.lessonRefs.length }, (_unused, i) => i + 1),
        )
      }
    }
  })

  it('resolves a lesson by ref alone, matching the frozen source record', async () => {
    // A provider with a cold cache, so getLesson cannot pass by handing back an
    // object listLessons already produced.
    const fresh = createCatalogProvider({
      releaseVersion: RELEASE_VERSION,
      courses: COURSES,
      units: UNITS,
      loaders: COURSE_LESSON_LOADERS,
    })
    const registry = JSON.parse(
      readFileSync(join(SOURCE_ROOT, 'production-release-registry.json'), 'utf8'),
    ) as { currentRelease: string }
    const index = JSON.parse(
      readFileSync(join(SOURCE_ROOT, registry.currentRelease, 'course-index.json'), 'utf8'),
    ) as { course_id: string; grade: number; subject: string; path: string }[]
    expect(index).toHaveLength(CANONICAL.courses)

    for (const course of index) {
      const rows = readFileSync(
        join(SOURCE_ROOT, registry.currentRelease, course.path, 'lessons.jsonl'),
        'utf8',
      )
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as Record<string, unknown>)

      // First and last of each course: covers both ends of the payload.
      for (const raw of [rows[0], rows[rows.length - 1]]) {
        const lesson = await fresh.getLesson(raw.lesson_id as string)
        expect(lesson, `${String(raw.lesson_id)} did not resolve`).toBeDefined()
        expect(lesson).toMatchObject({
          lessonRef: raw.lesson_id,
          courseRef: course.course_id,
          grade: String(course.grade),
          subject: course.subject,
          unitNumber: raw.unit_number,
          dayInUnit: raw.day_in_unit,
          courseDay: raw.course_day,
          title: raw.title,
          estimatedMinutes: raw.estimated_minutes,
        })
      }
    }
  })

  it('matches the frozen source refs exactly', async () => {
    const sourceRefs = new Set<string>()
    const registry = JSON.parse(
      readFileSync(join(SOURCE_ROOT, 'production-release-registry.json'), 'utf8'),
    ) as { currentRelease: string }
    const index = JSON.parse(
      readFileSync(join(SOURCE_ROOT, registry.currentRelease, 'course-index.json'), 'utf8'),
    ) as { course_id: string; path: string }[]
    for (const course of index) {
      const text = readFileSync(
        join(SOURCE_ROOT, registry.currentRelease, course.path, 'lessons.jsonl'),
        'utf8',
      )
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) sourceRefs.add((JSON.parse(line) as { lesson_id: string }).lesson_id)
      }
    }
    expect(sourceRefs.size).toBe(CANONICAL.lessons)

    const runtimeRefs = new Set(
      (
        await Promise.all(
          familyPilotCatalog.listCourses().map((c) => familyPilotCatalog.listLessons(c.courseRef)),
        )
      ).flat().map((l) => l.lessonRef),
    )
    expect(runtimeRefs).toEqual(sourceRefs)
  })

  it('returns undefined for an unknown ref instead of guessing', async () => {
    expect(await familyPilotCatalog.getLesson('ma-g5-science-u99-l99')).toBeUndefined()
    expect(familyPilotCatalog.getUnit('nope')).toBeUndefined()
    expect(familyPilotCatalog.getCourse('nope')).toBeUndefined()
    expect(await familyPilotCatalog.listLessons('nope')).toEqual([])
    expect(familyPilotCatalog.listUnits('nope')).toEqual([])
  })
})

describe('published daily schedule', () => {
  it('resolves every scheduled lesson ref, with no ref scheduled twice', async () => {
    const registry = JSON.parse(
      readFileSync(join(SOURCE_ROOT, 'production-release-registry.json'), 'utf8'),
    ) as { currentRelease: string }

    for (const grade of CANONICAL.grades) {
      const csv = readFileSync(
        join(SOURCE_ROOT, registry.currentRelease, 'grades', `grade-${grade}`, 'daily-schedule.csv'),
        'utf8',
      ).trim().split('\n')
      const header = csv[0].split(',')
      const periodColumns = header
        .map((name, i) => ({ name, i }))
        .filter(({ name }) => name.startsWith('period_'))

      const scheduled: string[] = []
      for (const line of csv.slice(1)) {
        const cells = line.split(',')
        for (const { i } of periodColumns) {
          for (const ref of (cells[i] ?? '').split(';').map((s) => s.trim()).filter(Boolean)) {
            scheduled.push(ref)
          }
        }
      }

      expect(scheduled.length).toBe(CANONICAL.lessonsByGrade[grade])
      expect(new Set(scheduled).size).toBe(CANONICAL.lessonsByGrade[grade])

      const resolved = await Promise.all(scheduled.map((ref) => familyPilotCatalog.getLesson(ref)))
      const unresolved = scheduled.filter((_ref, i) => resolved[i] === undefined)
      expect(unresolved).toEqual([])
      for (const lesson of resolved) expect(lesson?.grade).toBe(grade)
    }
  })
})

describe('lazy loading', () => {
  const spyProvider = () => {
    const calls: string[] = []
    const loaders = Object.fromEntries(
      Object.entries(COURSE_LESSON_LOADERS).map(([courseRef, load]) => [
        courseRef,
        vi.fn(() => {
          calls.push(courseRef)
          return load()
        }),
      ]),
    )
    return {
      calls,
      provider: createCatalogProvider({
        releaseVersion: RELEASE_VERSION,
        courses: COURSES,
        units: UNITS,
        loaders,
      }),
    }
  }

  it('loads no lesson payload for grade, subject, course or unit reads', () => {
    const { calls, provider } = spyProvider()
    provider.listGrades()
    provider.listSubjects('5')
    provider.listCourses()
    provider.listCourses('8')
    provider.getCourse('ma-g5-science')
    provider.listUnits('ma-g5-science')
    provider.getUnit('ma-g5-science-u01')
    expect(calls).toEqual([])
  })

  it('loads only the owning course when one lesson is requested', async () => {
    const { calls, provider } = spyProvider()
    const lesson = await provider.getLesson('ma-g8-technology-u01-l01')
    expect(lesson?.courseRef).toBe('ma-g8-technology')
    expect(calls).toEqual(['ma-g8-technology'])
  })

  it('loads each course payload at most once, even under concurrency', async () => {
    const { calls, provider } = spyProvider()
    await Promise.all([
      provider.listLessons('ma-g5-mathematics'),
      provider.listLessons('ma-g5-mathematics'),
      provider.getLesson('ma-g5-mathematics-u01-l01'),
    ])
    await provider.listLessons('ma-g5-mathematics')
    expect(calls).toEqual(['ma-g5-mathematics'])
  })

  it('exposes one independently loadable payload per course', () => {
    expect(Object.keys(COURSE_LESSON_LOADERS).sort()).toEqual(
      COURSES.map((c) => c.courseRef).sort(),
    )
    expect(Object.keys(COURSE_LESSON_LOADERS)).toHaveLength(CANONICAL.courses)
  })

  it('fails loudly when an indexed course has no payload loader', async () => {
    // A course the index knows about but cannot load is a partial catalog, and
    // must not read as a course with no lessons.
    const provider = createCatalogProvider({
      releaseVersion: RELEASE_VERSION,
      courses: COURSES,
      units: UNITS,
      loaders: {},
    })
    await expect(provider.listLessons('ma-g7-science')).rejects.toThrow(
      /ma-g7-science is in the index but has no lesson payload loader/,
    )
    await expect(provider.getLesson('ma-g7-science-u01-l01')).rejects.toThrow(
      /no lesson payload loader/,
    )
    // An unknown course is still an ordinary miss.
    expect(await provider.listLessons('not-a-course')).toEqual([])
  })

  it('does not cache a failed load', async () => {
    let attempts = 0
    const provider = createCatalogProvider({
      releaseVersion: RELEASE_VERSION,
      courses: COURSES,
      units: UNITS,
      loaders: {
        'ma-g5-health': () => {
          attempts += 1
          return attempts === 1
            ? Promise.reject(new Error('chunk failed'))
            : COURSE_LESSON_LOADERS['ma-g5-health']()
        },
      },
    })
    await expect(provider.listLessons('ma-g5-health')).rejects.toThrow('chunk failed')
    expect(await provider.listLessons('ma-g5-health')).toHaveLength(36)
    expect(attempts).toBe(2)
  })
})
