#!/usr/bin/env node
/**
 * Proves the lesson corpus is not the unit task repeated 6 or 12 times.
 *
 * Three independent checks:
 *   1. EXACT     — no two lessons share byte-identical student-facing task text.
 *   2. SIBLING   — within a unit, no two lessons' task text exceeds the
 *                  near-duplicate similarity ceiling (5-gram Jaccard).
 *   3. UNIT-ECHO — no lesson's task text is a restatement of its own unit's
 *                  unit-level task package in ../technology-arts.
 *
 * Writes duplicate-report.json. Exits non-zero on any violation.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COURSES } from '../src/courses.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const UNIT_CORPUS = resolve(ROOT, '../technology-arts/packages')

/** Similarity at or above this is treated as a near-duplicate. */
const SIBLING_CEILING = 0.6
const UNIT_ECHO_CEILING = 0.6

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

function studentFacingText(pkg) {
  return [
    pkg.task_brief,
    pkg.primary_task,
    pkg.requirements.join(' '),
    pkg.deliverable,
    (pkg.test_or_check_criteria ?? pkg.critique_criteria).join(' '),
  ].join(' ')
}

function unitFacingText(pkg) {
  return [
    pkg.project_brief,
    pkg.primary_task,
    pkg.requirements.join(' '),
    (pkg.test_or_check_criteria ?? pkg.critique_criteria).join(' '),
  ].join(' ')
}

const tokenize = (text) =>
  text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)

function shingles(text, n = 5) {
  const words = tokenize(text)
  const set = new Set()
  for (let i = 0; i + n <= words.length; i += 1) set.add(words.slice(i, i + n).join(' '))
  return set
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const s of small) if (large.has(s)) shared += 1
  return shared / (a.size + b.size - shared)
}

// ---- load every generated lesson package ----------------------------------

const lessons = []
for (const course of COURSES) {
  const dir = resolve(ROOT, 'packages', course.subjectKey, course.gradeDir)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.task-package.json')).sort()) {
    const pkg = readJson(resolve(dir, file))
    lessons.push({
      lessonId: pkg.lesson_id,
      unitId: pkg.unit_id,
      subject: pkg.subject,
      gradeDir: pkg.grade_dir,
      phase: pkg.phase,
      mode: pkg.work_mode,
      text: studentFacingText(pkg),
    })
  }
}

// ---- 1. exact duplicates ---------------------------------------------------

const byText = new Map()
for (const l of lessons) {
  const key = l.text.replace(/\s+/g, ' ').trim()
  if (!byText.has(key)) byText.set(key, [])
  byText.get(key).push(l.lessonId)
}
const exactDuplicates = [...byText.values()].filter((ids) => ids.length > 1)

// ---- 2. sibling similarity within each unit --------------------------------

const shingleCache = new Map(lessons.map((l) => [l.lessonId, shingles(l.text)]))
const byUnit = new Map()
for (const l of lessons) {
  if (!byUnit.has(l.unitId)) byUnit.set(l.unitId, [])
  byUnit.get(l.unitId).push(l)
}

let siblingMax = { similarity: 0, pair: null }
const siblingViolations = []
const siblingSimilarities = []
for (const [unitId, group] of byUnit) {
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      const sim = jaccard(shingleCache.get(group[i].lessonId), shingleCache.get(group[j].lessonId))
      siblingSimilarities.push(sim)
      if (sim > siblingMax.similarity) {
        siblingMax = { similarity: sim, pair: [group[i].lessonId, group[j].lessonId], unitId }
      }
      if (sim >= SIBLING_CEILING) {
        siblingViolations.push({
          unitId,
          lessons: [group[i].lessonId, group[j].lessonId],
          phases: [group[i].phase, group[j].phase],
          similarity: Number(sim.toFixed(4)),
        })
      }
    }
  }
}

// ---- 3. lesson vs its own unit-level task package ---------------------------

let unitEchoMax = { similarity: 0, lessonId: null }
const unitEchoViolations = []
let unitPackagesCompared = 0
const unitTextCache = new Map()

for (const l of lessons) {
  const unitPath = resolve(UNIT_CORPUS, l.subject, l.gradeDir, `${l.unitId}.task-package.json`)
  if (!existsSync(unitPath)) continue
  if (!unitTextCache.has(l.unitId)) {
    unitTextCache.set(l.unitId, shingles(unitFacingText(readJson(unitPath))))
  }
  const sim = jaccard(shingleCache.get(l.lessonId), unitTextCache.get(l.unitId))
  unitPackagesCompared += 1
  if (sim > unitEchoMax.similarity) unitEchoMax = { similarity: sim, lessonId: l.lessonId, unitId: l.unitId }
  if (sim >= UNIT_ECHO_CEILING) {
    unitEchoViolations.push({ lessonId: l.lessonId, unitId: l.unitId, similarity: Number(sim.toFixed(4)) })
  }
}

// ---- report ----------------------------------------------------------------

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

const report = {
  generatedFor: 'curriculum-production/student-work/technology-arts-lessons',
  method: '5-gram word-shingle Jaccard similarity over student-facing task text (brief + primary task + requirements + deliverable + check/critique criteria)',
  totals: {
    lessons: lessons.length,
    units: byUnit.size,
    siblingPairsCompared: siblingSimilarities.length,
    unitPackagesCompared,
  },
  exactDuplicates: { count: exactDuplicates.length, groups: exactDuplicates },
  siblingSimilarity: {
    ceiling: SIBLING_CEILING,
    max: Number(siblingMax.similarity.toFixed(4)),
    maxPair: siblingMax.pair,
    mean: Number(mean(siblingSimilarities).toFixed(4)),
    violations: siblingViolations,
  },
  unitEcho: {
    ceiling: UNIT_ECHO_CEILING,
    max: Number(unitEchoMax.similarity.toFixed(4)),
    maxLesson: unitEchoMax.lessonId,
    violations: unitEchoViolations,
  },
}

writeFileSync(resolve(ROOT, 'duplicate-report.json'), JSON.stringify(report, null, 2) + '\n')

console.log(`Lessons: ${lessons.length} across ${byUnit.size} units`)
console.log(`1. exact duplicate task texts:      ${exactDuplicates.length}`)
console.log(
  `2. sibling similarity within unit:  max ${siblingMax.similarity.toFixed(4)} / mean ${mean(siblingSimilarities).toFixed(4)} (ceiling ${SIBLING_CEILING}) — ${siblingViolations.length} violations`,
)
console.log(
  `3. lesson vs unit-level task echo:  max ${unitEchoMax.similarity.toFixed(4)} (ceiling ${UNIT_ECHO_CEILING}) over ${unitPackagesCompared} comparisons — ${unitEchoViolations.length} violations`,
)

const failed = exactDuplicates.length + siblingViolations.length + unitEchoViolations.length
if (failed > 0) {
  console.error(`DUPLICATE_CONTENT_CHECK: FAIL (${failed} violations)`)
  process.exitCode = 1
} else {
  console.log('DUPLICATE_CONTENT_CHECK: PASS')
}
