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
    expect(model.validationReportedCurriculumVersion).toBe('1.2.3')
    expect(model.validationArtifactVersion).toBe('validation-v2')
    expect(model.validatedAt).toBe('2026-08-08')
    expect(finding(model, 'Lesson schema validation')?.detail)
      .toBe('Lesson schema validation passed the recorded check.')
    expect(JSON.stringify(model)).not.toContain('2736 records')
  })

  it('derives PASS WITH WARNINGS from recorded warning evidence', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      { check: 'schema-validation', result: 'PASS' },
      { check: 'standards-coverage', result: 'WARNING', details: 'One assessment gap' },
    ], 'PASS WITH WARNINGS'))

    expect(model.status).toBe('pass_with_warnings')
    expect(finding(model, 'Standards coverage')?.state).toBe('warning')
  })

  it('derives FAIL from failed evidence and retains safe affected scope', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      {
        check: 'broken-reference',
        result: 'FAIL',
        details: 'Lesson points to an unknown unit.',
        affected: {
          grade: 7,
          course_id: 'ma-g7-science',
          lesson_id: 'ma-g7-science-u01-l09',
        },
      },
    ], 'FAIL'))

    expect(model.status).toBe('fail')
    expect(finding(model, 'Reference integrity')).toMatchObject({
      state: 'failed',
      detail: 'Curriculum reference integrity failed the recorded check.',
      scope: { grade: '7', course: 'ma-g7-science', lesson: 'ma-g7-science-u01-l09' },
    })
  })

  it.each([3, 4, 5, 7, 8, 9, 10, 11, 12])(
    'retains governed grade %s and its two-digit-safe curriculum references',
    (grade) => {
      const course = `ma-g${grade}-language-arts-2`
      const unit = `${course}-u10`
      const lesson = `${unit}-l12`
      const assessment = `${unit}-assessment`
      const model = buildCurriculumValidationReadModel(evidence([{
        check: 'broken-reference', result: 'FAIL',
        affected: { grade, course_id: course, unit_id: unit, lesson_id: lesson, reference: assessment },
      }], 'FAIL'))

      expect(finding(model, 'Reference integrity')?.scope).toEqual({
        grade: String(grade), course, unit, lesson, reference: assessment,
      })
    },
  )

  it('does not present unsupported grade or reference metadata as governed scope', () => {
    const model = buildCurriculumValidationReadModel(evidence([{
      check: 'broken-reference', result: 'FAIL',
      affected: { grade: 6, course_id: 'ma-g6-science', lesson_id: 'ma-g6-science-u10-l12' },
    }], 'FAIL'))

    expect(finding(model, 'Reference integrity')?.scope).toEqual({
      grade: undefined, course: undefined, unit: undefined, lesson: undefined, reference: undefined,
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
      detail: '1 checksum declaration mismatch(es) were found.',
      scope: {},
    })
  })

  it.each([
    ['schema-validation', 'Schema validation', 'Lesson schema validation'],
    ['broken-reference', 'References and indexes', 'Reference integrity'],
    ['duplicate-lesson-id', 'Identifiers', 'Duplicate lesson identifiers'],
  ])('surfaces %s failures in %s', (check, expectedCategory, expectedLabel) => {
    const model = buildCurriculumValidationReadModel(evidence([
      { check, result: 'FAIL', details: 'Controlled failure detail.' },
    ], 'FAIL'))

    const category = model.categories.find((item) => item.label === expectedCategory)
    expect(category?.state).toBe('failed')
    expect(category?.findings[0]?.check).toBe(expectedLabel)
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
      validation: {
        package_id: 'manuel-academy-test',
        version: '9.9.9',
        overall: 'PASS',
        checks: [{ check: 'schema-validation', result: 'PASS' }],
      },
      curriculumManifest: { package_id: 'manuel-academy-test', version: '1.2.3' },
      packageManifest: { version: '1.2.3', files: [] },
    })

    expect(model.status).toBe('fail')
    expect(model.curriculumVersion).toBe('1.2.3')
    expect(model.validationReportedCurriculumVersion).toBe('9.9.9')
    expect(finding(model, 'Curriculum version consistency')?.state).toBe('failed')
    expect(finding(model, 'Curriculum version consistency')?.detail).toContain('9.9.9')
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

  it('replaces raw stack traces and machine-local paths with vetted finding copy', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      {
        check: 'schema-validation',
        result: 'FAIL',
        details: 'Error: private payload\n    at validate (C:\\Users\\Owner\\secret.ts:4:2)',
      },
    ], 'FAIL'))
    const detail = finding(model, 'Lesson schema validation')?.detail

    expect(detail).toBe('Lesson schema validation failed the recorded check.')
    expect(detail).not.toContain('Owner')
    expect(detail).not.toContain('private payload')
  })

  it('does not retain a plain single-line secret or arbitrary exception message', () => {
    const model = buildCurriculumValidationReadModel(evidence([
      {
        check: 'schema-validation',
        result: 'FAIL',
        details: 'sk-live-plain-single-line-secret',
      },
      {
        check: 'future-provider-failure',
        result: 'ERROR',
        message: 'Database exploded because credential=hunter2',
        source: 'Bearer private-token',
        affected: {
          course: 'Bearer another-private-token',
          reference: 'C:\\Users\\Owner\\secret.txt',
        },
      },
    ], 'FAIL'))
    const serialized = JSON.stringify(model)

    expect(serialized).not.toContain('sk-live-plain-single-line-secret')
    expect(serialized).not.toContain('Database exploded')
    expect(serialized).not.toContain('hunter2')
    expect(serialized).not.toContain('Bearer private-token')
    expect(serialized).not.toContain('another-private-token')
    expect(serialized).not.toContain('future-provider-failure')
    expect(serialized).not.toContain('Owner')
    expect(finding(model, 'Unrecognized validation finding')?.detail)
      .toBe('An unrecognized validation check reported a failure; unvetted details were omitted.')
  })
})
