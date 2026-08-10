import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  STUDY_OPERATION_GATE_IDS,
  deriveStudyOperationsStatus,
  type StudyOperationStatus,
  type StudyOperationsProjection,
} from '../../admin/studyOperationsModel'
import { AdminStudyOperations } from './AdminStudyOperations'

const STATUSES: readonly StudyOperationStatus[] = [
  'ready', 'partial', 'manual_review', 'unavailable', 'not_configured',
  'blocked', 'unknown', 'ready', 'unavailable', 'blocked',
]

function projection(): StudyOperationsProjection {
  const gates = STUDY_OPERATION_GATE_IDS.map((id, index) => ({
    id,
    status: STATUSES[index],
    reasonCode: id === 'provider_cost_accounting'
      ? 'provider_cost_accounting_not_integrated' as const
      : id === 'provider_attempt_coverage'
        ? 'provider_attempt_coverage_not_integrated' as const
        : id === 'adult_review_worker_composition'
          ? 'adult_review_worker_not_composed' as const
          : id === 'adult_review_worker_schedule'
            ? 'adult_review_worker_schedule_absent' as const
            : id === 'production_mount'
              ? 'production_mount_blocked' as const
              : 'unknown_evidence' as const,
    contractVersion: index % 2 === 0 ? 'study-production.v1' : null,
    lastVerifiedAt: index === 0 ? '2026-08-10T15:55:00.000Z' : null,
    operatorAction: id === 'provider_cost_accounting'
      ? 'integrate_cost_accounting' as const
      : id === 'provider_attempt_coverage'
        ? 'complete_attempt_coverage' as const
        : id === 'adult_review_worker_composition'
          ? 'compose_worker' as const
          : id === 'adult_review_worker_schedule'
            ? 'configure_worker_schedule' as const
            : 'retry_evidence' as const,
  }))
  return {
    contractVersion: 2,
    schemaVersion: 1,
    generatedAt: '2026-08-10T16:00:00.000Z',
    overallStatus: deriveStudyOperationsStatus(gates),
    gates,
  }
}

describe('Admin Study Operations dashboard', () => {
  it('renders every separate gate and readiness state with text labels', () => {
    const markup = renderToStaticMarkup(
      <AdminStudyOperations authorized state={{ status: 'ready', projection: projection() }} />,
    )
    for (const label of [
      'Effective Settings V2', 'Curriculum Release Authority / Binding', 'Session Semantics',
      'Bound Content Runtime', 'Adult Review Worker Composition',
      'Adult Review Worker Schedule', 'Study Telemetry', 'Provider Cost Accounting',
      'Provider Attempt Coverage', 'Production Mount',
    ]) expect(markup).toContain(label)
    for (const status of [
      'Ready', 'Partial', 'Manual review', 'Unavailable', 'Not configured', 'Blocked', 'Unknown',
    ]) expect(markup).toContain(status)
  })

  it('keeps worker composition, schedule, and last-run evidence truthful', () => {
    const markup = renderToStaticMarkup(
      <AdminStudyOperations authorized state={{ status: 'ready', projection: projection() }} />,
    )
    expect(markup).toMatch(/Adult Review Worker Composition[\s\S]*?production adult-review worker composition is not available/)
    expect(markup).toMatch(/Adult Review Worker Schedule[\s\S]*?No authoritative worker schedule evidence/)
    expect(markup).toMatch(/Last run<\/dt><dd>Unknown/)
    expect(markup).not.toContain('Worker healthy')
  })

  it('keeps Study cost accounting distinct from provider-attempt coverage', () => {
    const markup = renderToStaticMarkup(
      <AdminStudyOperations authorized state={{ status: 'ready', projection: projection() }} />,
    )
    expect(markup).toMatch(/Provider Cost Accounting[\s\S]*?cost accounting is not integrated/)
    expect(markup).toMatch(/Provider Attempt Coverage[\s\S]*?provider-attempt coverage is not integrated/)
    expect(markup).toContain('without assuming cost-ledger completeness')
  })

  it('renders accessible loading, permission-denied, and error/retry states', () => {
    const loading = renderToStaticMarkup(
      <AdminStudyOperations authorized state={{ status: 'loading' }} />,
    )
    expect(loading).toContain('aria-busy="true"')
    expect(loading).toContain('Loading Study Operations')
    expect(loading).not.toContain('Effective Settings V2')

    const denied = renderToStaticMarkup(
      <AdminStudyOperations authorized={false} state={{ status: 'ready', projection: projection() }} />,
    )
    expect(denied).toContain('health:read capability is required')
    expect(denied).not.toContain('Effective Settings V2')

    const error = renderToStaticMarkup(
      <AdminStudyOperations
        authorized
        state={{ status: 'error', code: 'study_operations_timeout' }}
        onRetry={() => {}}
      />,
    )
    expect(error).toContain('request timed out')
    expect(error).toContain('Try again')
    expect(error).toContain('aria-live="polite"')
  })

  it('uses labelled sections, headings, status live regions, and native details', () => {
    const markup = renderToStaticMarkup(
      <AdminStudyOperations authorized state={{ status: 'ready', projection: projection() }} />,
    )
    expect(markup).toContain('aria-labelledby="study-ops-summary-title"')
    expect(markup).toContain('aria-labelledby="study-core-gates"')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('<dl>')
    expect(markup).toContain('<dt>Contract / version</dt>')
  })

  it('contains no learner surveillance or private-content fields', () => {
    const markup = renderToStaticMarkup(
      <AdminStudyOperations authorized state={{ status: 'ready', projection: projection() }} />,
    )
    expect(markup).not.toMatch(/learner name|learner id|lesson text|answers|Tutor chat|private notes|safety content|raw error|diagnostic inference/i)
  })

  it('declares desktop, tablet, mobile, focus, and reduced-motion behavior', () => {
    const css = readFileSync(new URL('./admin-study-operations.css', import.meta.url), 'utf8')
    expect(css).toContain('grid-template-columns: repeat(3')
    expect(css).toContain('@media (max-width: 1050px)')
    expect(css).toContain('grid-template-columns: repeat(2')
    expect(css).toContain('@media (max-width: 680px)')
    expect(css).toContain('grid-template-columns: 1fr')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
