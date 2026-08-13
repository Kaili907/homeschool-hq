import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  buildNegativeControls,
  classifyLesson,
  compareProjection,
  projectJsonMaterial,
  ROOT,
  runAudit,
} from './audit.mjs'

const packagePath = resolve(ROOT, 'curriculum-production/student-work/technology-arts-lessons/packages/arts-music/grade-03/ma-g3-arts-music-u01-l01.task-package.json')
const guidePath = resolve(ROOT, 'curriculum-production/student-work/technology-arts-lessons/scoring-guides/arts-music/grade-03/ma-g3-arts-music-u01-l01.scoring-guide.json')
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
const guide = JSON.parse(readFileSync(guidePath, 'utf8'))
const binding = { lessonRef: pkg.lesson_id, subject: 'arts-and-music' }

test('the clean sample retains its task, materials, criteria, and steps in the browser projection', () => {
  const material = projectJsonMaterial(pkg, binding, pkg.lesson_title)
  assert.deepEqual(compareProjection(pkg, material), [])
  assert.equal(classifyLesson(pkg, guide).flags.includes('PROJECTION_LOSS'), false)
})

test('all five required negative controls are detected', () => {
  const result = buildNegativeControls(pkg, guide, binding)
  assert.equal(result.passed, true)
  assert.equal(result.controls.length, 5)
  assert.deepEqual(result.controls.map((control) => control.name), [
    'empty project',
    'missing materials',
    'camera-only evidence',
    'missing rubric',
    'browser drops steps',
  ])
})

test('the full admitted population re-derives to 648 and every grade has 72 lessons', () => {
  const result = runAudit()
  assert.equal(result.lessonsAudited, 648)
  assert.deepEqual(result.gradeResults.grades.map((row) => row.lessonsAudited), Array(9).fill(72))
  assert.equal(result.gradeResults.exactCountMatch, true)
})

test('the audit exposes unattached references and confirms no real browser loss', () => {
  const result = runAudit()
  assert.equal(result.flagCounts.MISSING_MATERIALS, 270)
  assert.equal(result.materialsResults.summary.referenceRequired, 270)
  assert.equal(result.materialsResults.summary.referenceSupplied, 0)
  assert.equal(result.browserLoss.summary.projectionResult, 'PASS')
  assert.equal(result.browserLoss.summary.lessonsWithLoss, 0)
})
