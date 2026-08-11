import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CurriculumSnapshotValidationRun,
  CurriculumValidationFinding,
} from '../../admin/curriculum-validation/engine.ts'
import {
  CURRICULUM_VALIDATION_RENDER_BATCH,
  CurriculumValidationWorkspace,
  filterCurriculumValidationFindings,
  groupCurriculumValidationFindings,
} from './CurriculumValidationWorkspace.tsx'

const findings: readonly CurriculumValidationFinding[] = [
  {
    id: 'cvf-blocking',
    severity: 'error',
    category: 'standards',
    entity: { type: 'lesson', id: 'pe-lesson' },
    path: 'lessons[0].standards[0]',
    rule: 'standards.human_review_required',
    explanation: 'A preserved Michigan PE label requires human mapping approval.',
    blocking: true,
    remediation: 'Keep the label in review and do not invent an official ID.',
  },
  {
    id: 'cvf-warning',
    severity: 'warning',
    category: 'standards',
    entity: { type: 'course', id: 'pe-course' },
    path: 'courses[0].standards[0]',
    rule: 'standards.unverified_mapping',
    explanation: 'The mapping has not been verified.',
    blocking: false,
    remediation: 'Obtain authoritative mapping evidence.',
  },
  {
    id: 'cvf-accessibility',
    severity: 'error',
    category: 'accessibility',
    entity: { type: 'resource', id: 'movement-video' },
    path: 'resources[0].caption_or_transcript',
    rule: 'accessibility.required_support',
    explanation: 'Video resources require captions or a transcript.',
    blocking: true,
    remediation: 'Add captions or a transcript.',
  },
]

function run(
  status: CurriculumSnapshotValidationRun['status'] = 'invalid',
): CurriculumSnapshotValidationRun {
  const selected = status === 'valid' ? [] : findings
  return {
    engineVersion: 'curriculum-validation-v2',
    status,
    statusMessage: status === 'valid' ? 'The snapshot is valid.' : 'The snapshot is not ready.',
    publicationReady: status === 'valid',
    source: {
      origin: 'draft',
      snapshotId: 'studio-draft',
      curriculumVersion: '2.1.0-draft',
      schemaSetVersion: '2.0.0',
    },
    summary: {
      total: selected.length,
      errors: selected.filter((finding) => finding.severity === 'error').length,
      warnings: selected.filter((finding) => finding.severity === 'warning').length,
      info: 0,
      blocking: selected.filter((finding) => finding.blocking).length,
      nonBlocking: selected.filter((finding) => !finding.blocking).length,
    },
    findings: selected,
  }
}

describe('CurriculumValidationWorkspace', () => {
  it('renders a clear invalid status, summary counts, blockers, and expandable details', () => {
    const html = renderToStaticMarkup(<CurriculumValidationWorkspace run={run()} />)

    expect(html).toContain('Validation workspace')
    expect(html).toContain('INVALID')
    expect(html).toContain('Not ready — blocking findings')
    expect(html).toContain('Publication gate')
    expect(html).toContain('NOT READY')
    expect(html).toContain('Blocking findings')
    expect(html).toContain('A preserved Michigan PE label requires human mapping approval.')
    expect(html).toContain('<details')
    expect(html).toContain('Safe remediation')
    expect(html).toContain('cvf-blocking')
  })

  it('exposes search, filtering, and grouping controls', () => {
    const html = renderToStaticMarkup(<CurriculumValidationWorkspace run={run()} />)

    expect(html).toContain('id="curriculum-validation-query"')
    expect(html).toContain('id="curriculum-validation-severity"')
    expect(html).toContain('id="curriculum-validation-category"')
    expect(html).toContain('id="curriculum-validation-blocking"')
    expect(html).toContain('id="curriculum-validation-group"')
    expect(html).toContain('All categories')
    expect(html).toContain('Group by')
    expect(html).toContain('Entity')
    expect(html).toContain('Rule')
    expect(html).toContain('Severity')
  })

  it('filters by search, category, severity, and publication impact', () => {
    const visible = filterCurriculumValidationFindings(findings, {
      query: 'Michigan PE',
      severity: 'error',
      category: 'standards',
      blocking: 'blocking',
    })
    const warning = filterCurriculumValidationFindings(findings, {
      query: 'pe-course',
      severity: 'warning',
      category: 'all',
      blocking: 'non-blocking',
    })

    expect(visible.map((finding) => finding.id)).toEqual(['cvf-blocking'])
    expect(warning.map((finding) => finding.id)).toEqual(['cvf-warning'])
  })

  it('groups findings by entity, rule, or severity', () => {
    expect(groupCurriculumValidationFindings(findings, 'entity').map((group) => group.label)).toEqual([
      'Course · pe-course',
      'Lesson · pe-lesson',
      'Resource · movement-video',
    ])
    expect(groupCurriculumValidationFindings(findings, 'rule')).toHaveLength(3)
    expect(groupCurriculumValidationFindings(findings, 'severity').map((group) => group.label)).toEqual([
      'ERROR severity',
      'WARNING severity',
    ])
  })

  it('searches 10,000 deterministic findings while bounding initial DOM materialization', () => {
    const stressFindings = Array.from({ length: 10_000 }, (_, index): CurriculumValidationFinding => ({
      id: `cvf-stress-${index}`,
      severity: index % 2 === 0 ? 'warning' : 'info',
      category: 'schema',
      entity: { type: 'lesson', id: `stress-lesson-${index}` },
      path: `lessons[${index}].schema_set_version`,
      rule: 'schema.entity_valid',
      explanation: `Deterministic validation finding ${index}`,
      blocking: false,
      remediation: undefined,
    }))
    const stressRun: CurriculumSnapshotValidationRun = {
      ...run(),
      status: 'invalid',
      publicationReady: false,
      summary: {
        total: stressFindings.length,
        errors: 0,
        warnings: 5_000,
        info: 5_000,
        blocking: 0,
        nonBlocking: stressFindings.length,
      },
      findings: stressFindings,
    }
    const started = performance.now()
    const filtered = filterCurriculumValidationFindings(stressFindings, {
      query: 'stress-lesson-9999', severity: 'all', category: 'all', blocking: 'all',
    })
    const html = renderToStaticMarkup(<CurriculumValidationWorkspace run={stressRun} />)
    const elapsedMs = performance.now() - started
    console.info(`[admin-performance] 10000 validation findings filter/render ${elapsedMs.toFixed(1)}ms`)

    expect(filtered).toHaveLength(1)
    expect(html.match(/<details/g)).toHaveLength(CURRICULUM_VALIDATION_RENDER_BATCH)
    expect(html).toContain('Rendering 250 of 10000 matching findings (10000 total)')
    expect(html).toContain('Show 250 more findings')
  })

  it('renders the jump-to-entity callback contract only for addressable findings', () => {
    const onJumpToEntity = vi.fn()
    const html = renderToStaticMarkup(
      <CurriculumValidationWorkspace run={run()} onJumpToEntity={onJumpToEntity} />,
    )

    expect(html.match(/Jump to entity/g)).toHaveLength(3)
  })

  it.each([
    ['incomplete', 'INCOMPLETE', 'Not ready — snapshot incomplete'],
    ['unavailable', 'UNAVAILABLE', 'Not ready — validation unavailable'],
    ['error', 'VALIDATION ERROR', 'Not ready — validation did not complete'],
  ] as const)('never shows a false-ready state for %s', (state, label, readiness) => {
    const html = renderToStaticMarkup(<CurriculumValidationWorkspace run={run(state)} />)

    expect(html).toContain(label)
    expect(html).toContain(readiness)
    expect(html).toContain('NOT READY')
    expect(html).not.toContain('Ready for publication checks')
  })
})
