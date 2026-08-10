import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurriculumPublishingStatusResult } from '../curriculum-publishing/contracts'
import { CurriculumReleasePublishing } from './CurriculumReleasePublishing'

const HASH = 'a'.repeat(64)

function status(overrides: Partial<CurriculumPublishingStatusResult> = {}): CurriculumPublishingStatusResult {
  return {
    schemaVersion: 1,
    draftId: '10000000-0000-4000-8000-000000000001',
    draftRevision: 7,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1',
    schemaSetVersion: '2.0.0',
    publicationState: 'eligible',
    eligible: true,
    blockingReasons: [],
    candidate: {
      stagingId: '20000000-0000-4000-8000-000000000001',
      status: 'staged',
      draftRevision: 7,
      validationSnapshotId: '30000000-0000-4000-8000-000000000001',
      validationStatus: 'publication_ready',
      approvalId: '40000000-0000-4000-8000-000000000001',
      approvalStatus: 'current',
      humanReviewStatus: 'clear',
      fileCount: 10,
      byteCount: 23_000_000,
      contentHash: HASH,
      manifestHash: 'b'.repeat(64),
      packageHash: 'c'.repeat(64),
      verification: {
        artifactSetComplete: true,
        contentVerified: true,
        manifestVerified: true,
        packageVerified: true,
        actualFileCount: 10,
        actualByteCount: 23_000_000,
      },
    },
    published: null,
    ...overrides,
  }
}

function render(value: CurriculumPublishingStatusResult | null, canPublish = true, error: string | null = null) {
  return renderToStaticMarkup(
    <CurriculumReleasePublishing
      status={value}
      busy={false}
      error={error}
      canPublish={canPublish}
      onRefresh={vi.fn()}
      onPublish={vi.fn()}
    />,
  )
}

describe('Curriculum release publishing surface', () => {
  it('shows exact staged evidence and an authorized publish-only action', () => {
    const markup = render(status())
    expect(markup).toContain('ELIGIBLE TO PUBLISH')
    expect(markup).toContain('Staged evidence revalidation')
    expect(markup.match(/VERIFIED/g)).toHaveLength(4)
    expect(markup).toContain('Publish 2.0.0-rc.1')
    expect(markup).not.toMatch(/>Activate</i)
  })

  it('uses the exact success wording and proves no active-pointer or learner-pin behavior', () => {
    const eligible = status()
    const published = {
      releaseId: eligible.candidate!.stagingId,
      version: eligible.targetVersion,
      status: 'published' as const,
      activationStatus: 'not_active' as const,
      stagingId: eligible.candidate!.stagingId,
      contentHash: eligible.candidate!.contentHash,
      manifestHash: eligible.candidate!.manifestHash,
      packageHash: eligible.candidate!.packageHash,
      fileCount: 10,
      byteCount: 23_000_000,
      publishedAt: '2026-08-10T14:00:00.000Z',
      authority: 'curriculum:publish' as const,
    }
    const markup = render(status({
      publicationState: 'published', eligible: false, published,
    }))
    expect(markup.match(/PUBLISHED, NOT ACTIVE/g)?.length).toBeGreaterThanOrEqual(2)
    expect(markup).toContain('production pointer and every learner pin are unchanged')
    expect(markup).not.toContain('Publish 2.0.0-rc.1')
  })

  it('shows fail-closed blockers and hides Publish when unauthorized', () => {
    const markup = render(status({
      publicationState: 'blocked',
      eligible: false,
      blockingReasons: ['manifest_mismatch', 'approval_stale', 'human_review_blocked'],
    }), false)
    expect(markup).toContain('Publication is blocked')
    expect(markup).toContain('manifest')
    expect(markup).toContain('approval is no longer current')
    expect(markup).toContain('human-review blocker')
    expect(markup).toContain('Permission denied: curriculum:publish')
    expect(markup).not.toMatch(/>Publish 2\.0\.0/)
  })
})
