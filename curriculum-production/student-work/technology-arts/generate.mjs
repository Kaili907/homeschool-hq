#!/usr/bin/env node
/**
 * Generates every task-package.json + scoring-guide.json in packages/ and
 * scoring-guides/ from the source units.json/assessments.json listed in
 * src/courses.mjs. Run with: node generate.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COURSES } from './src/courses.mjs'
import { buildUnitMaterials } from './src/generateUnitMaterials.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

let unitCount = 0
const summary = []

for (const course of COURSES) {
  if (!existsSync(course.unitsPath)) {
    throw new Error(`missing units.json for ${course.subjectKey} grade ${course.grade}: ${course.unitsPath}`)
  }
  if (!existsSync(course.assessmentsPath)) {
    throw new Error(`missing assessments.json for ${course.subjectKey} grade ${course.grade}: ${course.assessmentsPath}`)
  }

  const units = readJson(course.unitsPath)
  const assessments = readJson(course.assessmentsPath)
  const assessmentById = new Map(assessments.map((a) => [a.assessment_id, a]))

  let courseUnitCount = 0

  for (const unit of units) {
    const assessment = assessmentById.get(unit.assessment_id)
    if (!assessment) {
      throw new Error(`no assessment found for ${unit.unit_id} (expected ${unit.assessment_id})`)
    }

    const { taskPackage, scoringGuide } = buildUnitMaterials({
      unit,
      assessment,
      subjectKey: course.subjectKey,
      band: course.band,
      grade: course.grade,
      gradeDir: course.gradeDir,
    })

    const packagePath = resolve(
      HERE,
      'packages',
      course.subjectKey,
      course.gradeDir,
      `${unit.unit_id}.task-package.json`,
    )
    const scoringPath = resolve(
      HERE,
      'scoring-guides',
      course.subjectKey,
      course.gradeDir,
      `${unit.unit_id}.scoring-guide.json`,
    )

    writeJson(packagePath, taskPackage)
    writeJson(scoringPath, scoringGuide)
    unitCount += 1
    courseUnitCount += 1
  }

  summary.push({
    subjectKey: course.subjectKey,
    band: course.band,
    grade: course.grade,
    units: courseUnitCount,
  })
}

console.log(`Generated ${unitCount} units across ${COURSES.length} courses.`)
for (const row of summary) {
  console.log(`  ${row.subjectKey} grade ${row.grade} (${row.band}): ${row.units} units`)
}
