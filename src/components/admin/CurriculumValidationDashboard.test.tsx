import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildCanonicalCurriculumValidationReadModel } from '../../admin/curriculum-validation/canonicalEvidence'
import { buildCurriculumValidationReadModel } from '../../admin/curriculum-validation/model'
import { CurriculumValidationDashboard } from './CurriculumValidationDashboard'

const authorized = { state: 'authorized', capability: 'curriculum:read' } as const

function render(model = buildCanonicalCurriculumValidationReadModel()) {
  return renderToStaticMarkup(
    <CurriculumValidationDashboard authorization={authorized} model={model} />,
  )
}

describe('CurriculumValidationDashboard', () => {
  it('renders the canonical package status, version, recorded checks, and explicit absent checks', () => {
    const html = render()

    expect(html).toContain('Overall validation status: PASS')
    expect(html).toContain('1.0.0')
    expect(html).toContain('2026-08-03')
    expect(html).toContain('Content manifest verification')
    expect(html).toContain('Checksum declaration consistency')
    expect(html).toContain('Schema validation')
    expect(html).toContain('NOT CHECKED')
    expect(html).toContain('Granular standard-to-lesson and standard-to-assessment coverage was not recorded')
  })

  it('renders failures, affected references, duplicate IDs, and standards gaps', () => {
    const declaredHash = 'a'.repeat(64)
    const conflictingHash = 'b'.repeat(64)
    const model = buildCurriculumValidationReadModel({
      validation: {
        package_id: 'test-package',
        version: '2.0.0',
        overall: 'FAIL',
        checks: [
          {
            check: 'schema-validation',
            result: 'FAIL',
            details: 'Required field standards is missing.',
            affected: { lesson: 'ma-g5-mathematics-u01-l02' },
          },
          {
            check: 'broken-reference',
            result: 'FAIL',
            details: 'Unit reference does not resolve.',
            affected: { reference: 'ma-g7-science-u09' },
          },
          {
            check: 'duplicate-lesson-id',
            result: 'FAIL',
            details: 'ID appears twice.',
            affected: {
              grade: 5,
              course: 'ma-g5-mathematics',
              unit: 'ma-g5-mathematics-u01',
              lesson: 'ma-g5-mathematics-u01-l01',
            },
          },
          {
            check: 'standards-coverage',
            result: 'FAIL',
            details: 'Assessment mapping is missing.',
            affected: { reference: '5.NBT.1' },
          },
        ],
      },
      packageManifest: {
        version: '2.0.0',
        files: [{ path: 'lesson.json', sha256: declaredHash }],
      },
      checksumManifest: `${conflictingHash}  lesson.json`,
      coverage: [{
        standard: '5.NBT.1',
        lessons: ['ma-g5-mathematics-u01-l01'],
        assessments: [],
        state: 'gap',
      }],
    })
    const html = render(model)

    expect(html).toContain('Overall validation status: FAIL')
    expect(html).toContain('Lesson schema validation failed the recorded check.')
    expect(html).toContain('Curriculum reference integrity failed the recorded check.')
    expect(html).not.toContain('Required field standards is missing.')
    expect(html).not.toContain('Unit reference does not resolve.')
    expect(html).toContain('Checksum declaration consistency')
    expect(html).toContain('checksum declaration mismatch')
    expect(html).toContain('Duplicate lesson identifiers')
    expect(html).toContain('grade: 5')
    expect(html).toContain('course: ma-g5-mathematics')
    expect(html).toContain('No mapped assessments')
    expect(html).toContain('GAP')
  })

  it('does not expose privileged evidence while authorization is unresolved or denied', () => {
    const secretModel = buildCurriculumValidationReadModel({
      validation: {
        package_id: 'hidden-package',
        version: 'secret-version',
        overall: 'FAIL',
        checks: [{ check: 'schema-validation', result: 'FAIL', details: 'hidden finding' }],
      },
    })
    const unresolved = renderToStaticMarkup(
      <CurriculumValidationDashboard authorization={{ state: 'unresolved' }} model={secretModel} />,
    )
    const denied = renderToStaticMarkup(
      <CurriculumValidationDashboard authorization={{ state: 'denied' }} model={secretModel} />,
    )

    expect(unresolved).toContain('Authorization is still being verified')
    expect(denied).toContain('does not include curriculum:read')
    for (const html of [unresolved, denied]) {
      expect(html).not.toContain('hidden-package')
      expect(html).not.toContain('secret-version')
      expect(html).not.toContain('hidden finding')
    }
  })

  it('is a navigable read-only surface with no repair or publishing controls', () => {
    const html = render()

    expect(html).toMatch(/<main[^>]+aria-labelledby="validation-title"/)
    expect(html).toContain('<details')
    expect(html).toContain('<summary')
    expect(html).toContain('for="validation-search"')
    expect(html).toContain('for="validation-state"')
    expect(html).not.toContain('<button')
    expect(html).not.toMatch(/>\s*(Fix|Repair|Regenerate|Publish)\s*</i)
  })

  it('renders controlled error text instead of arbitrary exception content', () => {
    const model = buildCurriculumValidationReadModel({
      validation: {
        overall: 'FAIL',
        checks: [{
          check: 'schema-validation',
          result: 'FAIL',
          details: 'sk-live-plain-single-line-secret',
        }],
      },
    })
    const html = render(model)

    expect(html).toContain('Lesson schema validation failed the recorded check.')
    expect(html).not.toContain('sk-live-plain-single-line-secret')
  })

  it('shows the authoritative package version and retains a conflicting validation version as evidence', () => {
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
    const html = render(model)

    expect(html).toContain('Overall validation status: FAIL')
    expect(html).toContain('Curriculum version</dt><dd')
    expect(html).toContain('Validation-reported curriculum version</dt><dd')
    expect(html).toContain('>1.2.3</dd>')
    expect(html).toContain('>9.9.9</dd>')
    expect(html).toContain('Curriculum version consistency')
    expect(html).toContain('Conflicting recorded versions')
  })
})
