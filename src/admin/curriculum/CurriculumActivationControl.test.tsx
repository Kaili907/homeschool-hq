import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CurriculumActivationCandidate,
  CurriculumActivationStatus,
} from '../curriculum-activation'
import { CurriculumActivationView } from './CurriculumActivationControl'

const REQUEST = '50000000-0000-4000-8000-000000000001'

function status(): CurriculumActivationStatus {
  return {
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    existingLearnersRepinned: false,
    pointer: {
      releaseVersion: '2.0.0', revision: 2, transitionKind: 'activation',
      bindingMode: 'default_authority', transitionedAt: '2026-08-10T16:00:00.000Z',
    },
    candidates: [
      candidate('2.0.0', { active: true, previouslyActive: true }),
      candidate('1.0.0', { previouslyActive: true }),
      candidate('3.0.0'),
      candidate('4.0.0', { eligible: false, artifactState: 'unavailable' }),
    ],
    history: [
      {
        pointerRevision: 2, previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
        transitionKind: 'activation', reasonCode: 'release.activated', correlationId: REQUEST,
        transitionedAt: '2026-08-10T16:00:00.000Z',
      },
      {
        pointerRevision: 1, previousReleaseVersion: null, newReleaseVersion: '1.0.0',
        transitionKind: 'migration_seed', reasonCode: null, correlationId: null,
        transitionedAt: '2026-08-09T16:00:00.000Z',
      },
    ],
    historyTruncated: false,
  }
}

function candidate(
  releaseVersion: string,
  overrides: Partial<CurriculumActivationCandidate> = {},
): CurriculumActivationCandidate {
  return {
    releaseVersion,
    status: 'published',
    registeredAt: '2026-08-10T15:00:00.000Z',
    artifactState: 'available',
    eligible: true,
    previouslyActive: false,
    active: false,
    ...overrides,
  }
}

function render(options: {
  canManage?: boolean
  error?: Parameters<typeof CurriculumActivationView>[0]['error']
  confirmation?: CurriculumActivationCandidate | null
  acknowledged?: boolean
} = {}) {
  return renderToStaticMarkup(
    <CurriculumActivationView
      status={status()}
      canManage={options.canManage ?? true}
      busy={false}
      error={options.error ?? null}
      result={null}
      confirmation={options.confirmation ?? null}
      acknowledged={options.acknowledged ?? false}
      onAcknowledge={vi.fn()}
      onRequestTransition={vi.fn()}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      onRefresh={vi.fn()}
    />,
  )
}

describe('Curriculum Activation & Rollback Admin surface', () => {
  it('shows current authority, revision, published candidates, history, and truthful controls', () => {
    const markup = render()
    expect(markup).toContain('Activation &amp; Rollback')
    expect(markup).toContain('Current active release')
    expect(markup).toContain('<dd>2.0.0</dd>')
    expect(markup).toContain('Pointer revision')
    expect(markup).toContain('<dd>2</dd>')
    expect(markup).toContain('Published candidate releases')
    expect(markup).toContain('Activate this release')
    expect(markup).toContain('Rollback to this release')
    expect(markup).toContain('artifacts unavailable')
    expect(markup).toContain('Append-only history')
    expect(markup).toContain('Revision 1')
    expect(markup).toContain('Revision 2')
  })

  it('warns explicitly that activation does not repin existing learners', () => {
    const markup = render()
    expect(markup).toContain('DOES NOT repin existing learners')
    expect(markup).toContain('Profile.academy.releaseVersion')
    expect(markup).toContain('separate governed migration')
  })

  it('requires explicit acknowledgement in activation and rollback confirmations', () => {
    const activation = render({ confirmation: candidate('3.0.0') })
    expect(activation).toContain('role="alertdialog"')
    expect(activation).toContain('Confirm activation to 3.0.0')
    expect(activation).toContain('production pointer revision 2')
    expect(activation).toContain('release.activated')
    expect(activation).toContain('DOES NOT repin existing learners')
    expect(activation).toMatch(/Confirm activation<\/button>/)
    expect(activation).toContain('disabled=""')

    const rollback = render({
      confirmation: candidate('1.0.0', { previouslyActive: true }), acknowledged: true,
    })
    expect(rollback).toContain('Confirm rollback to 1.0.0')
    expect(rollback).toContain('release.rolled_back')
    expect(rollback).toMatch(/Confirm rollback<\/button>/)
  })

  it('shows authorization, stale conflict, and unavailable states without enabling mutation', () => {
    const viewOnly = render({ canManage: false })
    expect(viewOnly).toContain('exact releases:manage capability')
    expect(viewOnly).toContain('disabled=""')
    const stale = render({ error: 'pointer-conflict' })
    expect(stale).toContain('Stale pointer revision')
    expect(stale).toContain('compare-and-swap')
    const unavailable = render({ error: 'unavailable' })
    expect(unavailable).toContain('No pointer transition occurred')
    expect(unavailable).toContain('Refresh current pointer')
  })
})
