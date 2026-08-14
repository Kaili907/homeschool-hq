import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  compareNonCodeSolutionExposure,
  compareSolutionExposure,
  nonCodeSignatures,
} from './course-payload-solution-equivalence.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS = resolve(HERE, '..')
const PACKAGE_ROOT = resolve(CORPUS, 'packages/technology')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const CODE_FIXTURE = resolve(PACKAGE_ROOT, 'grade-03/ma-g3-tech-cs-u04-l01.task-package.json')
const NON_CODE_FIXTURE = resolve(PACKAGE_ROOT, 'grade-03/ma-g3-tech-cs-u01-l05.task-package.json')

function withExternalCopy(sourcePath, callback) {
  const originalRaw = readFileSync(sourcePath, 'utf8')
  const originalHash = sha256(originalRaw)
  const directory = mkdtempSync(resolve(tmpdir(), 'technology-solution-authority-r3-'))
  const copyPath = resolve(directory, basename(sourcePath))
  copyFileSync(sourcePath, copyPath)
  try {
    return callback(copyPath, JSON.parse(readFileSync(copyPath, 'utf8')))
  } finally {
    assert.equal(sha256(readFileSync(sourcePath, 'utf8')), originalHash, 'canonical clean fixture changed')
    rmSync(directory, { recursive: true, force: true })
  }
}

function codeRecord(pkg, overrides = {}) {
  const setup = pkg.activity_setup
  return {
    lessonId: pkg.lesson_id,
    courseRef: pkg.source_course_id,
    workMode: pkg.work_mode,
    scoringStance: pkg.scoring_stance,
    protected: true,
    analyzer: 'JAVASCRIPT_DEPENDENCY_SLICED_STRUCTURE_R3',
    starterCode: setup.central_input.starter_code,
    tests: setup.test_cases,
    exactRepair: 'Iteration begins at index 0; all tests retain every step in order.',
    visibleSolutions: [],
    ...overrides,
  }
}

function nonCodeRecord(pkg, overrides = {}) {
  const record = {
    lessonId: pkg.lesson_id,
    courseRef: pkg.source_course_id,
    workMode: pkg.work_mode,
    scoringStance: pkg.scoring_stance,
    protected: true,
    analyzer: 'NON_CODE_DELIVERABLE_SEMANTICS_R3',
    taskType: pkg.task_type,
    focus: pkg.focus,
    centralInput: pkg.activity_setup.central_input,
    deliverable: pkg.deliverable,
    specification: pkg.activity_setup.expected_behavior_and_specification,
    expectedResponse: 'Choose option B, cite the unexplained address and contact requests, preserve no personal information, and ask a trusted adult.',
    visibleSolutions: [],
    ...overrides,
  }
  record.nonCodeSignatures = nonCodeSignatures(record)
  return record
}

test('external mutation: changed story and test vocabulary with the same executable repair is caught', () => {
  withExternalCopy(CODE_FIXTURE, (copyPath, cleanPackage) => {
    const protectedTask = codeRecord(cleanPackage)
    const mutated = structuredClone(cleanPackage)
    mutated.lesson_id = 'external-story-vocabulary-model'
    mutated.work_mode = 'MODEL'
    mutated.activity_setup.central_input.starter_code = mutated.activity_setup.central_input.starter_code
      .replaceAll('controls', 'trailMarkers')
      .replaceAll('control', 'marker')
      .replaceAll('Save', 'North')
      .replaceAll('Cancel', 'South')
    mutated.activity_setup.test_cases = mutated.activity_setup.test_cases.map((entry, index) => ({
      input: `fictional trail case ${index + 1}`,
      expected: `fictional outcome ${index + 1}`,
    }))
    writeFileSync(copyPath, `${JSON.stringify(mutated, null, 2)}\n`)
    const source = codeRecord(mutated, {
      protected: false,
      visibleSolutions: ['Begin the iteration cursor at zero so the first marker is retained.'],
    })
    assert.equal(compareSolutionExposure(source, protectedTask).exposed, true)
  })
})

test('external mutation: moving an irrelevant declaration cannot conceal the same repair', () => {
  withExternalCopy(CODE_FIXTURE, (copyPath, cleanPackage) => {
    const irrelevant = 'const decorative_note = "external mutation only";'
    const protectedTask = codeRecord(cleanPackage, {
      starterCode: `${cleanPackage.activity_setup.central_input.starter_code}\n${irrelevant}`,
    })
    const mutated = structuredClone(cleanPackage)
    mutated.lesson_id = 'external-reordered-model'
    mutated.work_mode = 'MODEL'
    mutated.activity_setup.central_input.starter_code = `${irrelevant}\n${mutated.activity_setup.central_input.starter_code}`
    writeFileSync(copyPath, `${JSON.stringify(mutated, null, 2)}\n`)
    const source = codeRecord(mutated, {
      protected: false,
      visibleSolutions: [protectedTask.exactRepair],
    })
    assert.equal(compareSolutionExposure(source, protectedTask).exposed, true)
  })
})

test('external mutation: injected non-code model response that solves a fixed protected deliverable is caught', () => {
  withExternalCopy(NON_CODE_FIXTURE, (copyPath, cleanPackage) => {
    const protectedTask = nonCodeRecord(cleanPackage)
    const mutated = structuredClone(cleanPackage)
    mutated.lesson_id = 'external-non-code-model'
    mutated.work_mode = 'MODEL'
    mutated.activity_setup.worked_example = protectedTask.expectedResponse
    writeFileSync(copyPath, `${JSON.stringify(mutated, null, 2)}\n`)
    const source = nonCodeRecord(mutated, {
      protected: false,
      visibleSolutions: [mutated.activity_setup.worked_example],
    })
    assert.equal(compareNonCodeSolutionExposure(source, protectedTask).exposed, true)
  })
})
