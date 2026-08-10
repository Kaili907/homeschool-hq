import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurriculumDraftValidationResult } from '../curriculum-authoring/contracts'
import type { CurriculumApprovalStatusResult } from '../curriculum-approval/contracts'
import { CurriculumApprovalReview } from './CurriculumApprovalReview'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const VALIDATION = '20000000-0000-4000-8000-000000000001'

const validationSnapshot = {
  validationSnapshotId: VALIDATION,
  draftRevision: 4,
  engineVersion: 'curriculum-validation-v2',
  resultDigest: 'a'.repeat(64),
  status: 'invalid' as const,
  publicationReady: false,
  blockingCount: 1,
  blockingErrorCount: 1,
  humanReviewBlockerCount: 1,
  validatedAt: '2026-08-10T12:00:00Z',
}

const approval: CurriculumApprovalStatusResult = {
  schemaVersion: 1,
  draftId: DRAFT,
  draftRevision: 4,
  baseReleaseVersion: '1.0.0',
  targetVersion: '2.0.0-draft.1',
  schemaSetVersion: '2.0.0',
  status: 'stale',
  latestValidation: validationSnapshot,
  currentDecision: null,
  staleApproval: {
    approvalId: '30000000-0000-4000-8000-000000000001',
    draftRevision: 3,
    decision: 'approved',
    reasonCode: 'approval.ready',
    validationSnapshotId: VALIDATION,
    validationResultDigest: 'a'.repeat(64),
    reviewerRole: 'owner',
    decidedAt: '2026-08-10T11:00:00Z',
    bindingStatus: 'superseded',
  },
  history: [],
  publishGate: {
    eligible: false, reason: 'approval_stale', approvalId: null,
    draftRevision: 4, validationSnapshotId: null,
  },
}

const validation: CurriculumDraftValidationResult = {
  schemaVersion: 1,
  draftId: DRAFT,
  draftRevision: 4,
  baseReleaseVersion: '1.0.0',
  targetVersion: '2.0.0-draft.1',
  validationSnapshot,
  run: {
    engineVersion: 'curriculum-validation-v2',
    status: 'invalid',
    statusMessage: 'Human review is unresolved.',
    publicationReady: false,
    source: { origin: 'draft', snapshotId: `${DRAFT}@4`, curriculumVersion: '2.0.0-draft.1', schemaSetVersion: '2.0.0' },
    summary: { total: 1, errors: 1, warnings: 0, info: 0, blocking: 1, nonBlocking: 0 },
    findings: [{
      id: 'cvf-1234567890abcdef', severity: 'error', category: 'standards',
      entity: { type: 'course', id: 'physical-education-5' },
      path: 'courses[0].standards[0]', rule: 'standards.human_review_required',
      explanation: 'The preserved Michigan PE label requires human mapping approval.',
      blocking: true,
    }],
  },
}

describe('Curriculum Approval review surface', () => {
  it('shows revision, blockers, stale approval, history seam, and accessible decision controls', () => {
    const markup = renderToStaticMarkup(
      <CurriculumApprovalReview
        draftId={DRAFT}
        draftRevision={4}
        approval={approval}
        validation={validation}
        canApprove
        busy={false}
        error={null}
        changeReason="changes.standards"
        onChangeReason={vi.fn()}
        onDecision={vi.fn()}
      />,
    )
    expect(markup).toContain('aria-labelledby="curriculum-approval-title"')
    expect(markup).toContain('Review draft revision 4')
    expect(markup).toContain('Approval is stale')
    expect(markup).toContain('standards.human_review_required')
    expect(markup).toContain('Michigan PE')
    expect(markup).toContain('aria-label="Blocking validation issues"')
    expect(markup).toContain('Request-changes reason')
    expect(markup).toContain('Request changes')
    expect(markup).toContain(`/academy/admin/curriculum/preview?draft=${DRAFT}&amp;revision=4`)
    expect(markup).not.toMatch(/publish curriculum|activate|rollback/i)
    expect(markup).toMatch(/Approve revision 4<\/button>/)
    expect(markup).toContain('disabled=""')
  })

  it('hides mutation controls without the exact approval capability', () => {
    const markup = renderToStaticMarkup(
      <CurriculumApprovalReview
        draftId={DRAFT}
        draftRevision={4}
        approval={approval}
        validation={validation}
        canApprove={false}
        busy={false}
        error={null}
        changeReason="changes.other"
        onChangeReason={vi.fn()}
        onDecision={vi.fn()}
      />,
    )
    expect(markup).toContain('curriculum:approve')
    expect(markup).not.toContain('Request changes</button>')
    expect(markup).not.toContain('Approve revision 4</button>')
  })

  it('explains staleness caused by a superseded validation identity', () => {
    const validationStaleApproval = {
      ...approval,
      currentDecision: { ...approval.staleApproval!, draftRevision: 4 },
      staleApproval: { ...approval.staleApproval!, draftRevision: 4 },
    }
    const markup = renderToStaticMarkup(
      <CurriculumApprovalReview
        draftId={DRAFT}
        draftRevision={4}
        approval={validationStaleApproval}
        validation={validation}
        canApprove
        busy={false}
        error={null}
        changeReason="changes.validation"
        onChangeReason={vi.fn()}
        onDecision={vi.fn()}
      />,
    )
    expect(markup).toContain('The validation identity changed for revision 4')
  })

  it('rejects same-number evidence from a different draft identity', () => {
    const markup = renderToStaticMarkup(
      <CurriculumApprovalReview
        draftId={DRAFT}
        draftRevision={4}
        approval={{
          ...approval,
          draftId: '10000000-0000-4000-8000-000000000002',
          status: 'approved',
          staleApproval: null,
        }}
        validation={{ ...validation, draftId: '10000000-0000-4000-8000-000000000002' }}
        canApprove
        busy={false}
        error={null}
        changeReason="changes.validation"
        onChangeReason={vi.fn()}
        onDecision={vi.fn()}
      />,
    )
    expect(markup).toContain('Approval evidence is stale')
    expect(markup).toContain('disabled=""')
    expect(markup).not.toContain('Approved</span>')
  })
})
