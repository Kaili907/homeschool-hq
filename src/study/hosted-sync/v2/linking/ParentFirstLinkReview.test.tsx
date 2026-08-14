import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PreparedFirstLinkReview } from './coordinator'
import { ParentFirstLinkReview } from './ParentFirstLinkReview'
import { buildFirstLinkPlan } from './plan'
import type { FirstLinkInspection, LocalHouseholdForLink } from './types'

const local: LocalHouseholdForLink = {
  localHouseholdRef: 'household:local', capturedAt: '2026-08-02T00:00:00.000Z',
  students: [{
    localStudentRef: 'student:local', displayName: 'Ada',
    identity: { kind: 'legacy-profile-id', value: 'student:local' },
    assignments: [],
    studyDocument: { localDocumentRef: 'document:local', updatedAt: '2026-08-02T00:00:00.000Z', sessions: [] },
    sources: [], attestations: [], safetyHolds: [],
  }],
}

const inspection: FirstLinkInspection = {
  authority: {
    status: 'authenticated-parent-household-authority', authorityRef: 'secret-internal-authority-ref',
    remoteHouseholdRef: 'household:remote', expiresAt: '2099-01-01T00:00:00.000Z',
  },
  serverBaseRevision: 1,
  remoteStudents: [{
    remoteStudentRef: 'student:remote', displayName: 'Existing Ada', identities: [], assignments: [], sessions: [],
  }],
}

function review(): PreparedFirstLinkReview {
  const plan = buildFirstLinkPlan(local, inspection)
  return { local, inspection, choices: [], plan, planDigest: 'digest' }
}

describe('Parent first-link review UI', () => {
  it('shows what will link, new/existing ambiguity, conflicts, and privacy exclusions without authority tokens', () => {
    const html = renderToStaticMarkup(
      <ParentFirstLinkReview
        review={review()}
        onStudentChoice={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(html).toContain('Link this family’s existing Study work')
    expect(html).toContain('Parent choice required')
    expect(html).toContain('Existing Ada')
    expect(html).toContain('Create a new hosted student')
    expect(html).toContain('PINs')
    expect(html).toContain('Tutor transcripts')
    expect(html).toContain('assessment answer authority')
    expect(html).not.toContain('secret-internal-authority-ref')
    expect(html).toContain('disabled=""')
  })

  it('renders success and failure outcomes explicitly', () => {
    const linked = renderToStaticMarkup(
      <ParentFirstLinkReview
        review={review()}
        result={{
          status: 'linked',
          receipt: {
            localHouseholdRef: 'household:local', remoteHouseholdRef: 'household:remote',
            attemptId: 'attempt:one', manifestDigest: 'digest', serverRevision: 2,
            students: [], confirmedAt: '2026-08-03T00:00:00.000Z',
          },
        }}
        onStudentChoice={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    const failed = renderToStaticMarkup(
      <ParentFirstLinkReview
        review={review()}
        result={{ status: 'failed', code: 'NETWORK_FAILURE', message: 'Try again safely.', resumable: true }}
        onStudentChoice={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(linked).toContain('linked successfully')
    expect(failed).toContain('Try again safely.')
  })
})
