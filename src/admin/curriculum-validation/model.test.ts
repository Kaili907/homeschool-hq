import { describe, expect, it } from 'vitest'
import {
  buildCurriculumValidationReadModel,
  type CurriculumValidationEvidenceBundle,
} from './model'

function evidence(
  checks: readonly Record<string, unknown>[],
  overall = 'PASS',
  extra: Omit<CurriculumValidationEvidenceBundle, 'validation'> = {},
): CurriculumValidationEvidenceBundle {
  return {
    validation: {
      package_id: 'manuel-academy-test',
      version: '1.2.3',
      artifact_version: 'validation-v2',
      validated_on: '2026-08-08',
      overall,
      checks,
    },
    curriculumManifest: { package_id: 'manuel-academy-test', version: '1.2.3' },
    ...extra,
  }
}

function finding(model: ReturnType<typeof buildCurriculumValidationReadModel>, check: string) {
  return model.categories.flatMap((category) => category.findings)
    .find((item) => item.check === check)
}

describe('curriculum validation read model', () => {
  it('derives PASS only from known passing validation checks', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      { check: 'schema-validation', result: 'PASS', details: '2736 records' },
      { check: 'unique-lesson-ids', result: 'PASS', details: '2736 unique' },
    ]))

    expect(model.status).toBe('pass')
    expect(model.curriculumVersion).toBe('1.2.3')
    expect(model.validationArtifactVersion).toBe('validation-v2')
    expect(model.validatedAt).toBe('2026-08-08')
  })

  it('derives PASS WITH WARNINGS from recorded warning evidence', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      { check: 'schema-validation', result: 'PASS' },
      { check: 'standards-coverage', result: 'WARNING', details: 'One assessment gap' },
    ], 'PASS WITH WARNINGS'))

    expect(model.status).toBe('pass_with_warnings')
    expect(finding(model, 'standards-coverage')?.state).toBe('warning')
  })

  it('derives FAIL from failed evidence and retains safe affected scope', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      {
        check: 'broken-reference',
        result: 'FAIL',
        details: 'Lesson points to an unknown unit.',
        affected: { grade: 7, course_id: 'ma-g7-science', lesson_id: 'lesson-9' },
      },
    ], 'FAIL'))

    expect(model.status).toBe('fail')
    expect(finding(model, 'broken-reference')).toMatchObject({
      state: 'failed',
      scope: { grade: '7', course: 'ma-g7-science', lesson: 'lesson-9' },
    })
  })

  it('returns UNKNOWN when validation evidence is missing', () => {
    const model = buildCurriculumValidationReadModel({ curriculumManifest: { version: '1.2.3' } })

    expect(model.status).toBe('unknown')
    expect(model.summary.checked).toBe(0)
    expect(model.summary.notChecked).toBe(10)
  })

  it('displays checksum declaration mismatches without claiming byte verification', () => {
    const hashA = 'a'.repeat(64)
    const hashB = 'b'.repeat(64)
    const model = buildCurriculumValidationReadModel(evidence(
      [{ check: 'schema-validation', result: 'PASS' }],
      'PASS',
      {
        packageManifest: { version: '1.2.3', files: [{ path: 'lesson.json', sha256: hashA }] },
        checksumManifest: `${hashB}  lesson.json`,
      },
    ))

    expect(model.status).toBe('fail')
    expect(finding(model, 'Checksum declaration consistency')).toMatchObject({
      state: 'failed',
      scope: { reference: 'lesson.json' },
    })
  })

  it.each([
    ['schema-validation', 'Schema validation'],
    ['broken-reference', 'References and indexes'],
    ['duplicate-lesson-id', 'Identifiers'],
  ])('surfaces %s failures in %s', (check, expectedCategory) => {
    const model = buildCurriculumValidationReadModel(evidence([
      { check, result: 'FAIL', details: 'Controlled failure detail.' },
    ], 'FAIL'))

    const category = model.categories.find((item) => item.label === expectedCategory)
    expect(category?.state).toBe('failed')
    expect(category?.findings[0]?.check).toBe(check)
  })

  it('preserves deterministic standards mappings and coverage gaps', () => {
    const model = buildCurriculumValidationReadModel(evidence(
      [{ check: 'standards-coverage', result: 'WARNING', details: 'Assessment mapping gap.' }],
      'PASS WITH WARNINGS',
      {
        coverage: [
          {
            standard: '5.NBT.1',
            lessons: ['ma-g5-mathematics-u01-l01'],
            assessments: [],
            state: 'gap',
          },
        ],
      },
    ))

    expect(model.coverage).toEqual([{
      standard: '5.NBT.1',
      lessonRefs: ['ma-g5-mathematics-u01-l01'],
      assessmentRefs: [],
      state: 'gap',
    }])
  })

  it('fails on conflicting recorded curriculum versions', () => {
    const model = buildCurriculumValidationReadModel({
      ...evidence([{ check: 'schema-validation', result: 'PASS' }]),
      packageManifest: { version: '9.9.9', files: [] },
    })

    expect(model.status).toBe('fail')
    expect(finding(model, 'Curriculum version consistency')?.state).toBe('failed')
  })

  it('does not treat absent categories as passed', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      { check: 'lesson-count', result: 'PASS' },
    ]))

    expect(model.categories.find((category) => category.id === 'schema')?.state).toBe('not_checked')
    expect(model.categories.find((category) => category.id === 'checksums')?.state).toBe('not_checked')
  })

  it('fails safely when the validation envelope or a check is malformed', () => {
    const malformedEnvelope = buildCurriculumValidationReadModel({ validation: 'not-json' })
    const malformedCheck = buildCurriculumValidationReadModel({
      validation: { overall: 'PASS', checks: [{ check: 'schema-validation' }] },
    })

    expect(malformedEnvelope.status).toBe('unknown')
    expect(malformedEnvelope.evidenceError).toBe('Validation evidence could not be interpreted safely.')
    expect(malformedCheck.status).toBe('unknown')
    expect(malformedCheck.evidenceError).toBe('Validation evidence could not be interpreted safely.')
  })

  it('omits raw stack traces and machine-local paths', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      {
        check: 'schema-validation',
        result: 'FAIL',
        details: 'Error: private payload\n    at validate (C:\\Users\\Owner\\secret.ts:4:2)',
      },
    ], 'FAIL'))
    const detail = finding(model, 'schema-validation')?.detail

    expect(detail).toBe('Unsafe technical detail omitted.')
    expect(detail).not.toContain('Owner')
    expect(detail).not.toContain('private payload')
  })
})
