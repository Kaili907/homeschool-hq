import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { evaluateCourseProductionReadiness } from '../../../../src/curriculum/production-quality/index.ts'
import type { CourseReadinessResult } from '../../../../src/curriculum/production-quality/index.ts'
import {
  adaptCanonical,
  adaptG34,
  adaptHs912,
  buildScoringGuide,
  buildStudentPackage,
  buildTextBankIndex,
  loadCourse,
} from '../src/lib.mjs'
import { projectToLessonProductionInput } from '../src/gateProjection.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_ROOT = path.resolve(__dirname, '..')

const WORKTREES = process.env.ELA_SOURCE_WORKTREES ?? '/Users/stephenmanuel/manuel-academy-dev/mac-worktrees'
const G34_ELA = `${WORKTREES}/mac-g34-ela-r1/curriculum-authoring/full-family-grade34/subjects/english-language-arts`
const CANON_ROOT = `${WORKTREES}/mac-ela-production-r1/curriculum-content/manuel-academy/1.0.0/grades`
const HS_ELA = `${WORKTREES}/mac-hs912-ela-r1/curriculum-authoring/full-family-highschool-9-12/subjects/english-language-arts`

const COURSES = [
  {
    grade: 3,
    courseDir: `${G34_ELA}/grades/grade-3`,
    adapter: adaptG34,
    textBankIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-3/original-text-bank.json`),
    pdIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-3/public-domain-register.json`, 'id'),
  },
  {
    grade: 4,
    courseDir: `${G34_ELA}/grades/grade-4`,
    adapter: adaptG34,
    textBankIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-4/original-text-bank.json`),
    pdIndex: buildTextBankIndex(`${G34_ELA}/grades/grade-4/public-domain-register.json`, 'id'),
  },
  { grade: 5, courseDir: `${CANON_ROOT}/grade-5/courses/english-language-arts`, adapter: adaptCanonical },
  { grade: 7, courseDir: `${CANON_ROOT}/grade-7/courses/english-language-arts`, adapter: adaptCanonical },
  { grade: 8, courseDir: `${CANON_ROOT}/grade-8/courses/english-language-arts`, adapter: adaptCanonical },
  {
    grade: 9,
    courseDir: `${HS_ELA}/courses/english-9`,
    adapter: adaptHs912,
    textBankIndex: buildTextBankIndex(`${HS_ELA}/courses/english-9/text-bank.json`, 'text_id'),
  },
  {
    grade: 10,
    courseDir: `${HS_ELA}/courses/english-10`,
    adapter: adaptHs912,
    textBankIndex: buildTextBankIndex(`${HS_ELA}/courses/english-10/text-bank.json`, 'text_id'),
  },
  {
    grade: 11,
    courseDir: `${HS_ELA}/courses/english-11`,
    adapter: adaptHs912,
    textBankIndex: buildTextBankIndex(`${HS_ELA}/courses/english-11/text-bank.json`, 'text_id'),
  },
  {
    grade: 12,
    courseDir: `${HS_ELA}/courses/english-12`,
    adapter: adaptHs912,
    textBankIndex: buildTextBankIndex(`${HS_ELA}/courses/english-12/text-bank.json`, 'text_id'),
  },
]

let courseResults: Array<{ grade: number; result: CourseReadinessResult }> = []

beforeAll(() => {
  courseResults = COURSES.map((course) => {
    const irs = loadCourse({
      courseDir: course.courseDir,
      adapter: course.adapter,
      textBankIndex: course.textBankIndex,
      pdIndex: course.pdIndex,
    })
    const lessons = irs.map((ir) => {
      const pkg = buildStudentPackage(ir)
      const guide = buildScoringGuide(ir)
      return projectToLessonProductionInput(ir, pkg, guide)
    })
    const result = evaluateCourseProductionReadiness({
      courseId: lessons[0]?.courseId ?? `unknown-grade-${course.grade}`,
      title: `Manuel Academy Grade ${course.grade} English Language Arts`,
      lessons,
    })
    return { grade: course.grade, result }
  })

  writeReport(courseResults)
})

function writeReport(results: Array<{ grade: number; result: CourseReadinessResult }>) {
  const totals = { totalLessons: 0, readyCount: 0, needsHumanReviewCount: 0, notReadyCount: 0 }
  for (const { result } of results) {
    totals.totalLessons += result.gapSummary.totalLessons
    totals.readyCount += result.gapSummary.readyCount
    totals.needsHumanReviewCount += result.gapSummary.needsHumanReviewCount
    totals.notReadyCount += result.gapSummary.notReadyCount
  }

  const jsonReport = {
    generatedBy: 'tests/gate.test.ts',
    subjectFamily: 'ELA_SOCIAL_STUDIES',
    totals,
    courses: results.map(({ grade, result }) => ({
      grade,
      courseId: result.courseId,
      status: result.status,
      gapSummary: result.gapSummary,
    })),
  }

  fs.mkdirSync(path.join(OUT_ROOT, 'validation'), { recursive: true })
  fs.writeFileSync(
    path.join(OUT_ROOT, 'validation', 'gate-report.json'),
    JSON.stringify(jsonReport, null, 2) + '\n',
  )

  const lines: string[] = []
  lines.push('# ELA Student-Work Production Readiness Gate Report')
  lines.push('')
  lines.push(
    `Total lessons: ${totals.totalLessons} | READY: ${totals.readyCount} | NEEDS_HUMAN_REVIEW: ${totals.needsHumanReviewCount} | NOT_READY: ${totals.notReadyCount}`,
  )
  lines.push('')
  lines.push('| Grade | Course | Status | Ready | Needs Review | Not Ready |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  for (const { grade, result } of results) {
    lines.push(
      `| ${grade} | ${result.courseId} | ${result.status} | ${result.gapSummary.readyCount} | ${result.gapSummary.needsHumanReviewCount} | ${result.gapSummary.notReadyCount} |`,
    )
  }
  lines.push('')
  lines.push('## NEEDS_HUMAN_REVIEW reasons (lesson count by code)')
  lines.push('')
  const codeCounts: Record<string, number> = {}
  for (const { result } of results) {
    for (const [code, count] of Object.entries(result.gapSummary.codeCounts)) {
      if (!count) continue
      codeCounts[code] = (codeCounts[code] || 0) + count
    }
  }
  for (const [code, count] of Object.entries(codeCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${code}: ${count}`)
  }
  fs.writeFileSync(path.join(OUT_ROOT, 'validation', 'gate-report.md'), lines.join('\n') + '\n')
}

describe('ELA production readiness gate', () => {
  it('evaluates all 9 courses covering 1,620 lessons', () => {
    expect(courseResults).toHaveLength(9)
    const total = courseResults.reduce((sum, c) => sum + c.result.gapSummary.totalLessons, 0)
    expect(total).toBe(1620)
    for (const { result } of courseResults) {
      expect(result.gapSummary.totalLessons).toBe(180)
    }
  })

  it('has zero NOT_READY lessons — every required component is present for every lesson', () => {
    for (const { grade, result } of courseResults) {
      expect(result.gapSummary.notReadyCount, `grade ${grade} has NOT_READY lessons`).toBe(0)
    }
  })

  it('never claims a fixed ANSWER_KEY for ELA — only RUBRIC scoring authority is used', () => {
    for (const { result } of courseResults) {
      for (const lesson of result.lessonResults) {
        expect(lesson.codes).not.toContain('MISSING_ANSWER_KEY')
      }
    }
  })
})
