import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * CURR-1 — content-boundary invariants for the generated curriculum chunks.
 * Runs the generator (which itself re-verifies release counts and schedule
 * coverage, failing loudly on drift), then audits what the browser would see.
 */

const ROOT = resolve(__dirname, '..')
const OUT = join(ROOT, 'public/curriculum/1.0.0')
const SOURCE = join(ROOT, 'curriculum-content/manuel-academy/1.0.0')

// Adult/tutor-only fields that must NEVER appear in a student chunk.
const PROTECTED_FIELDS = [
  'answer_or_scoring_guidance',
  'adaptive_tutor_routes',
  'mastery_interpretation',
]

beforeAll(() => {
  execFileSync('node', [join(ROOT, 'scripts/build-curriculum.mjs')], { stdio: 'pipe' })
}, 120_000)

describe('CURR-1 generated curriculum chunks', () => {
  it('release.json carries the verified counts and grades', () => {
    const release = JSON.parse(readFileSync(join(OUT, 'release.json'), 'utf8'))
    expect(release.releaseVersion).toBe('1.0.0')
    expect(release.grades).toEqual(['5', '7', '8'])
    expect(release.counts).toEqual({ courses: 30, units: 232, lessons: 2736 })
    expect(release.courses).toHaveLength(30)
  })

  it('each grade has a catalog with 10 courses and a 36-week schedule', () => {
    for (const grade of ['5', '7', '8']) {
      const catalog = JSON.parse(readFileSync(join(OUT, `grade-${grade}/catalog.json`), 'utf8'))
      expect(catalog.courses).toHaveLength(10)
      const schedule = JSON.parse(readFileSync(join(OUT, `grade-${grade}/schedule.json`), 'utf8'))
      expect(new Set(schedule.days.map((d) => d.week)).size).toBe(36)
      expect(schedule.days).toHaveLength(180)
      // weekday names map to 1 (Mon) … 5 (Fri) — the app's schedule lookup key
      expect(schedule.days.every((d) => [1, 2, 3, 4, 5].includes(d.day))).toBe(true)
      for (let week = 1; week <= 36; week++) {
        expect(schedule.days.filter((d) => d.week === week).map((d) => d.day)).toEqual([1, 2, 3, 4, 5])
      }
    }
  })

  it('every unit chunk exists per catalog, with lessons in course-day order', () => {
    for (const grade of ['5', '7', '8']) {
      const catalog = JSON.parse(readFileSync(join(OUT, `grade-${grade}/catalog.json`), 'utf8'))
      for (const course of catalog.courses) {
        for (const unit of course.units) {
          const nn = String(unit.unitNumber).padStart(2, '0')
          const path = join(OUT, `courses/${course.courseId}/unit-${nn}.json`)
          expect(existsSync(path), path).toBe(true)
          const chunk = JSON.parse(readFileSync(path, 'utf8'))
          expect(chunk.lessons.map((l) => l.lesson_id)).toEqual(unit.lessonIds)
          const days = chunk.lessons.map((l) => l.course_day)
          expect([...days].sort((a, b) => a - b)).toEqual(days)
        }
      }
    }
  })

  it('NO student chunk leaks a protected field (answer keys / scoring / tutor routes)', () => {
    const courseDirs = readdirSync(join(OUT, 'courses'))
    expect(courseDirs).toHaveLength(30)
    let audited = 0
    for (const dir of courseDirs) {
      for (const file of readdirSync(join(OUT, 'courses', dir))) {
        if (file.startsWith('protected-')) continue
        const raw = readFileSync(join(OUT, 'courses', dir, file), 'utf8')
        for (const field of PROTECTED_FIELDS) {
          expect(raw.includes(`"${field}"`), `${dir}/${file} leaks ${field}`).toBe(false)
        }
        audited++
      }
    }
    expect(audited).toBe(232)
  })

  it('student catalogs and schedules are also free of protected fields', () => {
    for (const grade of ['5', '7', '8']) {
      for (const name of ['catalog.json', 'schedule.json']) {
        const raw = readFileSync(join(OUT, `grade-${grade}/${name}`), 'utf8')
        for (const field of PROTECTED_FIELDS) {
          expect(raw.includes(`"${field}"`)).toBe(false)
        }
      }
    }
  })

  it('emits no protected chunks or protected fields into the public curriculum tree', () => {
    const stack = [OUT]
    const files = []
    while (stack.length) {
      const dir = stack.pop()
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) stack.push(path)
        else files.push(path)
      }
    }
    expect(files.some((path) => /protected-unit-\d+\.json$/.test(path))).toBe(false)
    for (const path of files) {
      const raw = readFileSync(path, 'utf8')
      for (const field of PROTECTED_FIELDS) {
        expect(raw.includes(`"${field}"`), `${path} publishes ${field}`).toBe(false)
      }
    }
  })

  it('matches every immutable source file to its raw-byte SHA-256 custody manifest', () => {
    const sums = readFileSync(join(SOURCE, 'SHA256SUMS.txt'), 'utf8')
      .trim()
      .split(/\r?\n/)
    expect(sums).toHaveLength(181)
    for (const line of sums) {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line)
      expect(match, `invalid SHA256SUMS row: ${line}`).not.toBeNull()
      const [, expected, relativePath] = match
      const actual = createHash('sha256')
        .update(readFileSync(join(SOURCE, relativePath)))
        .digest('hex')
      expect(actual, relativePath).toBe(expected)
    }
  })

  it('the release ships no media binaries — text-only operation is native', () => {
    const stack = [SOURCE]
    const seen = []
    while (stack.length) {
      const dir = stack.pop()
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name)
        if (entry.isDirectory()) stack.push(p)
        else seen.push(entry.name)
      }
    }
    const textExt = /\.(md|json|jsonl|csv|txt)$/
    expect(seen.filter((f) => !textExt.test(f))).toEqual([])
  })
})
