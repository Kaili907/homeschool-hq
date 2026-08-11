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
  'ready', 'partial', 'manual_review', 'unavailable', 'ready',
  'ready', 'ready', 'unknown', 'unavailable', 'blocked', 'not_configured',
]

const WORKER_EVIDENCE = {
  schemaVersion: 1 as const,
  configuredState: 'configured' as const,
  latestRunTimestamp: '2026-08-10T15:55:00.000Z',
  latestSuccessfulRunTimestamp: '2026-08-10T15:55:00.000Z',
  latestResultCategory: 'no_work' as const,
  stalenessClassification: 'healthy' as const,
  workerVersion: 'adult-review-worker.v2',
}

function projection(): StudyOperationsProjection {
  const gates = STUDY_OPERATION_GATE_IDS.map((id, index) => ({
    id,
    status: STATUSES[index],
    reasonCode: id === 'provider_cost_accounting'
      ? 'provider_cost_accounting_not_integrated' as const
      : id === 'provider_attempt_coverage'
        ? 'provider_attempt_coverage_not_integrated' as const
        : id === 'adult_review_worker_composition'
          ? 'adult_review_worker_composed' as const
          : id === 'adult_review_worker_schedule'
            ? 'adult_review_worker_schedule_configured' as const
            : id === 'adult_review_worker_run_evidence'
              ? 'adult_review_worker_no_work' as const
              : id === 'production_mount'
                ? 'production_mount_unverified' as const
                : 'unknown_evidence' as const,
    contractVersion: index % 2 === 0 ? 'study-production.v1' : null,
    lastVerifiedAt: index === 0 ? '2026-08-10T15:55:00.000Z' : null,
    operatorAction: id === 'provider_cost_accounting'
      ? 'integrate_cost_accounting' as const
      : id === 'provider_attempt_coverage'
        ? 'complete_attempt_coverage' as const
        : id === 'adult_review_worker_composition'
          ? 'none' as const
          : id === 'adult_review_worker_schedule'
            ? 'none' as const
            : id === 'adult_review_worker_run_evidence'
              ? 'none' as const
              : 'retry_evidence' as const,
  }))
  return {
    contractVersion: 2,
    schemaVersion: 2,
    generatedAt: '2026-08-10T16:00:00.000Z',
    overallStatus: deriveStudyOperationsStatus(gates),
    workerEvidence: WORKER_EVIDENCE,
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
      'Adult Review Worker Schedule', 'Adult Review Worker Run Evidence',
      'Study Telemetry', 'Provider Cost Accounting',
      'Provider Attempt Coverage', 'Production Mount',
    ]) expect(markup).toContain(label)
    for (const status of [
      'Ready', 'Partial', 'Manual review', 'Unavailable', 'Not configured', 'Blocked', 'Unknown',
    ]) expect(markup).toContain(status)
  })

  it('keeps worker composition, schedule, and durable run evidence separate', () => {
    const markup = renderToStaticMarkup(
      <AdminStudyOperations authorized state={{ status: 'ready', projection: projection() }} />,
    )
    expect(markup).toMatch(/Adult Review Worker Composition[\s\S]*?durable adult-review worker registry has an active production composition/)
    expect(markup).toMatch(/Adult Review Worker Schedule[\s\S]*?private worker deployment manifest declares the five-minute schedule/)
    expect(markup).toMatch(/Adult Review Worker Run Evidence[\s\S]*?Latest run<\/dt><dd><time dateTime="2026-08-10T15:55:00.000Z"/)
    expect(markup).toMatch(/Latest successful run[\s\S]*?2026-08-10T15:55:00.000Z/)
    expect(markup).toMatch(/Latest category<\/dt><dd>No work/)
    expect(markup).toMatch(/Staleness<\/dt><dd>Healthy \(15 minutes or less\)/)
    expect(markup).toMatch(/Worker version<\/dt><dd>adult-review-worker.v2/)
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
    expect(error).toContain('role="alert"')
    expect(error).toContain('aria-live="assertive"')
    expect(error).toContain('tabindex="-1"')
  })

  it('uses labelled sections, headings, status live regions, and native details', () => {
    const markup = renderToStaticMarkup(
      <AdminStudyOperations authorized state={{ status: 'ready', projection: projection() }} />,
    )
    expect(markup).toContain('aria-labelledby="study-ops-summary-title"')
    expect(markup).toContain('aria-labelledby="study-core-gates"')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('Study Operations loaded. 4 of 11 gates ready.')
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
    expect(css).toContain('min-height: 2.75rem')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
