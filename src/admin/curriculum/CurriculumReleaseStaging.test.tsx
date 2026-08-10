import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurriculumStagingStatusResult } from '../curriculum-staging/contracts'
import { CurriculumReleaseStaging } from './CurriculumReleaseStaging'

const HASH = 'a'.repeat(64)

function status(overrides: Partial<CurriculumStagingStatusResult> = {}): CurriculumStagingStatusResult {
  return {
    schemaVersion: 1,
    draftId: '10000000-0000-4000-8000-000000000001',
    draftRevision: 7,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1',
    schemaSetVersion: '2.0.0',
    stageState: 'eligible',
    eligible: true,
    blockingReasons: [],
    validation: { status: 'valid', validationSnapshotId: '20000000-0000-4000-8000-000000000001' },
    approval: { status: 'approved', approvalId: '30000000-0000-4000-8000-000000000001' },
    candidate: null,
    ...overrides,
  }
}

function render(value: CurriculumStagingStatusResult | null, canStage = true, error: string | null = null) {
  return renderToStaticMarkup(
    <CurriculumReleaseStaging
      status={value}
      busy={false}
      error={error}
      canStage={canStage}
      hasUnsavedChanges={false}
      onRefresh={vi.fn()}
      onStage={vi.fn()}
    />,
  )
}

describe('Curriculum release staging surface', () => {
  it('shows exact eligible revision, validation, approval, target, and a stage-only action', () => {
    const markup = render(status())
    expect(markup).toContain('READY TO STAGE')
    expect(markup).toContain('2.0.0-rc.1')
    expect(markup).toContain('/ 7')
    expect(markup).toContain('valid')
    expect(markup).toContain('approved')
    expect(markup).toContain('Stage approved revision')
    expect(markup).not.toMatch(/>Activate</i)
  })

  it('labels success STAGED, NOT PUBLISHED and summarizes immutable checksums', () => {
    const candidate = {
      stagingId: '40000000-0000-4000-8000-000000000001',
      status: 'staged' as const,
      publicationStatus: 'not_published' as const,
      validationSnapshotId: '20000000-0000-4000-8000-000000000001',
      approvalId: '30000000-0000-4000-8000-000000000001',
      entityCounts: { courses: 30, lessons: 2736 },
      fileCount: 10,
      byteCount: 23_000_000,
      contentHash: HASH,
      manifestHash: 'b'.repeat(64),
      packageHash: 'c'.repeat(64),
      stagedAt: '2026-08-10T12:00:00Z',
      authority: 'curriculum:publish' as const,
    }
    const markup = render(status({ stageState: 'staged', eligible: false, candidate }))
    expect(markup).toContain('STAGED, NOT PUBLISHED')
    expect(markup).toContain('Content SHA-256')
    expect(markup).toContain('Manifest SHA-256')
    expect(markup).toContain('Package SHA-256')
    expect(markup).toContain('isolated from the published registry and learner runtime')
    expect(markup).not.toContain('Stage approved revision')
  })

  it('never presents revision-N eligibility as current after the workspace mutates', () => {
    const markup = renderToStaticMarkup(
      <CurriculumReleaseStaging
        status={status()}
        busy={false}
        error={null}
        canStage
        hasUnsavedChanges={false}
        currentDraftId="10000000-0000-4000-8000-000000000001"
        currentDraftRevision={8}
        onRefresh={vi.fn()}
        onStage={vi.fn()}
      />,
    )
    expect(markup).toContain('STALE EVIDENCE')
    expect(markup).toContain('loaded candidate belongs to revision 7')
    expect(markup).toContain('disabled=""')
    expect(markup).not.toContain('READY TO STAGE')
  })

  it('shows blocking reasons, permission denied, safe retry, and unavailable states', () => {
    const blocked = render(status({
      stageState: 'blocked',
      eligible: false,
      blockingReasons: ['approval_stale', 'target_version_collision'],
      approval: { status: 'stale', approvalId: '30000000-0000-4000-8000-000000000001' },
    }), false)
    expect(blocked).toContain('Staging is blocked')
    expect(blocked).toContain('approval is stale')
    expect(blocked).toContain('target version already')
    expect(blocked).toContain('Permission denied: curriculum:publish')
    expect(blocked).toContain('Safe retry')
    const unavailable = render(null, true, 'The release staging service is unavailable.')
    expect(unavailable).toContain('NOT ELIGIBLE')
    expect(unavailable).toContain('service is unavailable')
  })
})
