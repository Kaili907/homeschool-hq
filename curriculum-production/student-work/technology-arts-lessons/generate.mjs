#!/usr/bin/env node
/**
 * Generates every lesson task-package.json + scoring-guide.json in packages/
 * and scoring-guides/ from the lessons.jsonl / units.json / assessments.json
 * listed in src/courses.mjs. Run with: node generate.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COURSES } from './src/courses.mjs'
import { buildLessonMaterials } from './src/generateLessonMaterials.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readJsonl = (path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

// Rebuild from scratch so a removed source lesson cannot leave a stale package.
for (const dir of ['packages', 'scoring-guides']) {
  const target = resolve(HERE, dir)
  if (existsSync(target)) rmSync(target, { recursive: true })
}

// Generated visual models are source-owned output too. Remove only the
// generator's *.arts-model.svg files so a deleted/renamed lesson cannot leave
// a phantom resource; preserve separately authored assets such as the approved
// Three Stops anchor SVG.
function removeGeneratedArtsModels(directory) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) removeGeneratedArtsModels(path)
    else if (entry.name.endsWith('.arts-model.svg')) rmSync(path)
  }
}
removeGeneratedArtsModels(resolve(HERE, 'resources', 'arts-music'))

let lessonCount = 0
const summary = []
const modeCounts = new Map()

for (const course of COURSES) {
  for (const [label, path] of [
    ['lessons.jsonl', course.lessonsPath],
    ['units.json', course.unitsPath],
    ['assessments.json', course.assessmentsPath],
  ]) {
    if (!existsSync(path)) {
      throw new Error(`missing ${label} for ${course.subjectKey} grade ${course.grade}: ${path}`)
    }
  }

  const lessons = readJsonl(course.lessonsPath)
  const units = readJson(course.unitsPath)
  const assessments = readJson(course.assessmentsPath)

  const unitByNumber = new Map(units.map((u) => [u.unit_number, u]))
  const assessmentById = new Map(assessments.map((a) => [a.assessment_id, a]))

  let courseLessonCount = 0

  for (const lesson of lessons) {
    const unit = unitByNumber.get(lesson.unit_number)
    if (!unit) {
      throw new Error(`no unit ${lesson.unit_number} for lesson ${lesson.lesson_id}`)
    }
    const assessment = assessmentById.get(unit.assessment_id)
    if (!assessment) {
      throw new Error(`no assessment ${unit.assessment_id} for unit ${unit.unit_id}`)
    }

    const { taskPackage, scoringGuide, mode, generatedAssets } = buildLessonMaterials({
      lesson,
      unit,
      assessment,
      subjectKey: course.subjectKey,
      band: course.band,
      grade: course.grade,
      gradeDir: course.gradeDir,
    })

    writeJson(
      resolve(HERE, 'packages', course.subjectKey, course.gradeDir, `${lesson.lesson_id}.task-package.json`),
      taskPackage,
    )
    writeJson(
      resolve(HERE, 'scoring-guides', course.subjectKey, course.gradeDir, `${lesson.lesson_id}.scoring-guide.json`),
      scoringGuide,
    )
    for (const asset of generatedAssets) {
      const assetPath = resolve(HERE, asset.relativePath)
      mkdirSync(dirname(assetPath), { recursive: true })
      writeFileSync(assetPath, asset.content)
    }

    modeCounts.set(mode, (modeCounts.get(mode) ?? 0) + 1)
    lessonCount += 1
    courseLessonCount += 1
  }

  summary.push({
    subjectKey: course.subjectKey,
    band: course.band,
    grade: course.grade,
    lessons: courseLessonCount,
  })
}

console.log(`Generated ${lessonCount} lessons across ${COURSES.length} courses.`)
for (const row of summary) {
  console.log(`  ${row.subjectKey} grade ${row.grade} (${row.band}): ${row.lessons} lessons`)
}
console.log('Work modes used:')
for (const [mode, count] of [...modeCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${mode}: ${count}`)
}

// Arts/Music repair evidence and subject-only checksums are part of the
// generated production surface, not a hand-maintained afterthought.
await import('./tooling/build-arts-music-repair-evidence.mjs')
