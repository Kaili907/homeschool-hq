#!/usr/bin/env node
// Generates student-work packages + scoring guides for every ELA lesson in
// grades 3, 4, 5, 7, 8, 9, 10, 11, 12, from the three read-only source
// branches. Writes only under curriculum-production/student-work/
// english-language-arts/ (packages/, scoring-guides/, corpus-manifest.json).
//
// Usage: node curriculum-production/student-work/english-language-arts/tools/generate.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adaptG34,
  adaptCanonical,
  adaptHs912,
  buildTextBankIndex,
  loadCourse,
  buildStudentPackage,
  buildScoringGuide,
  loadJSON,
} from '../src/lib.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_ROOT = path.resolve(__dirname, '..')

const WORKTREES = '/Users/stephenmanuel/manuel-academy-dev/mac-worktrees'
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

function gradeDir(grade) {
  return `grade-${String(grade).padStart(2, '0')}`
}

function assertSeparation(pkg, guideKeys) {
  const pkgJson = JSON.stringify(pkg)
  for (const forbidden of ['scoringAuthority', 'rubric', 'acceptableAnswerCriteria', 'masteryCriteria', 'doNotUse']) {
    if (pkgJson.includes(`"${forbidden}"`)) {
      throw new Error(`Student package ${pkg.packageId} leaks scoring-guide key "${forbidden}"`)
    }
  }
}

function main() {
  const manifest = { generatedFrom: 'generate.mjs', courses: [], totals: { lessons: 0, packages: 0, scoringGuides: 0 } }

  for (const course of COURSES) {
    const gd = gradeDir(course.grade)
    const pkgDir = path.join(OUT_ROOT, 'packages', gd)
    const guideDir = path.join(OUT_ROOT, 'scoring-guides', gd)
    fs.mkdirSync(pkgDir, { recursive: true })
    fs.mkdirSync(guideDir, { recursive: true })

    const irs = loadCourse({
      courseDir: course.courseDir,
      adapter: course.adapter,
      textBankIndex: course.textBankIndex,
      pdIndex: course.pdIndex,
    })

    let courseId
    const sourceIntegrityCounts = { VERIFIED: 0, GAP: 0, NOT_APPLICABLE: 0, UNKNOWN: 0 }

    for (const ir of irs) {
      courseId = ir.courseId
      const pkg = buildStudentPackage(ir)
      const guide = buildScoringGuide(ir)
      assertSeparation(pkg)

      fs.writeFileSync(path.join(pkgDir, `${ir.lessonId}.package.json`), JSON.stringify(pkg, null, 2) + '\n')
      fs.writeFileSync(path.join(guideDir, `${ir.lessonId}.scoring.json`), JSON.stringify(guide, null, 2) + '\n')

      for (const t of ir.textRefs) {
        sourceIntegrityCounts[t.sourceIntegrityStatus] = (sourceIntegrityCounts[t.sourceIntegrityStatus] || 0) + 1
      }
    }

    manifest.courses.push({
      grade: course.grade,
      courseId,
      lessonCount: irs.length,
      sourceIntegrityCounts,
    })
    manifest.totals.lessons += irs.length
    manifest.totals.packages += irs.length
    manifest.totals.scoringGuides += irs.length

    console.log(`grade ${course.grade}: ${irs.length} lessons -> ${pkgDir}`)
  }

  fs.writeFileSync(
    path.join(OUT_ROOT, 'corpus-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )
  console.log('\nTotals:', manifest.totals)
}

main()
