import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { projectJsonLearnerMaterial } from '../../../../scripts/learner-projection/structured-projection-r1.mjs'
import {
  classifySolutionAuthority,
  compareSolutionExposure,
  findCoursePayloadExposures,
  recordFromMaterial,
} from './course-payload-solution-equivalence.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS = resolve(HERE, '..')
const PACKAGE_ROOT = resolve(CORPUS, 'packages/technology')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const CODE_FIXTURE = resolve(PACKAGE_ROOT, 'grade-03/ma-g3-tech-cs-u04-l01.task-package.json')
const NON_CODE_FIXTURE = resolve(PACKAGE_ROOT, 'grade-03/ma-g3-tech-cs-u01-l05.task-package.json')
const NON_CODE_GUIDE = resolve(CORPUS, 'scoring-guides/technology/grade-03/ma-g3-tech-cs-u01-l05.scoring-guide.json')

function withExternalCopy(sourcePath, callback) {
  const originalRaw = readFileSync(sourcePath, 'utf8')
  const originalHash = sha256(originalRaw)
  const directory = mkdtempSync(resolve(tmpdir(), 'technology-solution-authority-r4-'))
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
    analyzer: 'JAVASCRIPT_SCOPE_BINDING_AST_R4',
    starterCode: setup.central_input.starter_code,
    tests: setup.test_cases,
    exactRepair: 'Iteration begins at index 0; all tests retain every step in order.',
    visibleSolutions: [],
    ...overrides,
  }
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

test('external mutation: authority-first full gate catches a non-code fixed response and direct learner exemplar', () => {
  withExternalCopy(NON_CODE_FIXTURE, (copyPath, cleanPackage) => {
    const mutated = structuredClone(cleanPackage)
    const fixedResponse = 'Choose option B, cite the unexplained address and contact requests, preserve no personal information, and ask a trusted adult.'
    mutated.activity_setup.worked_example = fixedResponse
    writeFileSync(copyPath, `${JSON.stringify(mutated, null, 2)}\n`)
    const guide = JSON.parse(readFileSync(NON_CODE_GUIDE, 'utf8'))
    guide.fixed_response_authority = {
      authority_kind: 'FIXED_RESPONSE',
      expected_response: fixedResponse,
    }
    const material = projectJsonLearnerMaterial(
      mutated,
      { lessonRef: mutated.lesson_id, subject: 'technology' },
      mutated.lesson_title,
    ).material
    const authorityClassification = classifySolutionAuthority({ material, guide, packageData: mutated })
    const record = recordFromMaterial({
      material,
      courseRef: mutated.source_course_id,
      authorityClassification,
      scoringStance: mutated.scoring_stance,
      taskType: mutated.task_type,
      focus: mutated.focus,
      deliverable: mutated.deliverable,
    })
    assert.equal(authorityClassification.protected, true)
    assert.equal(findCoursePayloadExposures([record]).length, 1)
  })
})

test('external mutation: authority-first full gate passes an analogous non-code exemplar requiring independent reasoning', () => {
  withExternalCopy(NON_CODE_FIXTURE, (copyPath, cleanPackage) => {
    const mutated = structuredClone(cleanPackage)
    const fixedResponse = 'Choose option B, cite the unexplained address and contact requests, preserve no personal information, and ask a trusted adult.'
    mutated.activity_setup.worked_example = 'For a fictional weather siren, compare an audio-only alert with a captioned alert and justify a new design using the printed constraints.'
    writeFileSync(copyPath, `${JSON.stringify(mutated, null, 2)}\n`)
    const guide = JSON.parse(readFileSync(NON_CODE_GUIDE, 'utf8'))
    guide.fixed_response_authority = {
      authority_kind: 'FIXED_RESPONSE',
      expected_response: fixedResponse,
    }
    const material = projectJsonLearnerMaterial(
      mutated,
      { lessonRef: mutated.lesson_id, subject: 'technology' },
      mutated.lesson_title,
    ).material
    const authorityClassification = classifySolutionAuthority({ material, guide, packageData: mutated })
    const record = recordFromMaterial({
      material,
      courseRef: mutated.source_course_id,
      authorityClassification,
      scoringStance: mutated.scoring_stance,
      taskType: mutated.task_type,
      focus: mutated.focus,
      deliverable: mutated.deliverable,
    })
    assert.equal(authorityClassification.protected, true)
    assert.equal(findCoursePayloadExposures([record]).length, 0)
  })
})
