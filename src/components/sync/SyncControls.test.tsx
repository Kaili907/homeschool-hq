import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SyncControls } from './SyncControls'
import type { SyncApi } from '../../sync/useSync'
import type { SyncDecision, SyncStatus } from '../../sync/types'

const decision = (
  cloud: SyncDecision['cloud'],
  reason: SyncDecision['reason'] = 'first-sync',
): SyncDecision => ({
  reason,
  cloud,
  preview: {
    profiles: [
      {
        id: 'p1',
        name: 'Ada',
        category: cloud === 'empty' ? 'local-only' : 'both-changed',
        localUpdatedAt: 1,
        cloudUpdatedAt: cloud === 'empty' ? null : 2,
      },
    ],
    hasConflicts: cloud === 'data',
    potentiallyDestructive: ['Review Ada before applying.'],
  },
  ...(reason === 'account-switch'
    ? { previousHousehold: { id: 'household-a', email: 'a@example.com' } }
    : {}),
})

const api = (status: Partial<SyncStatus>): SyncApi => {
  const merged: SyncStatus = {
    configured: true,
    online: true,
    user: { id: 'household-b', email: 'b@example.com' },
    binding: 'unbound',
    lastSyncAt: null,
    pendingCount: 0,
    busy: false,
    error: null,
    decision: null,
    ...status,
    provenance: status.provenance ?? 'unbound',
    pauseReason: status.pauseReason ?? null,
  }
  return {
    status: merged,
    signIn: vi.fn(async () => ({ ok: true })),
    signOut: vi.fn(async () => undefined),
    syncNow: vi.fn(async () => undefined),
    uploadLocal: vi.fn(async () => undefined),
    useCloud: vi.fn(async () => undefined),
    applyReviewedMerge: vi.fn(async () => undefined),
    cancelDecision: vi.fn(),
  }
}

describe('safe sync controls', () => {
  it('offers upload only after a successful empty-cloud decision', () => {
    const html = renderToStaticMarkup(
      <SyncControls sync={api({ decision: decision('empty') })} />,
    )
    expect(html).toContain('Upload this device&#x27;s Academy data')
    expect(html).not.toContain('Use cloud data on this device')
  })

  it('offers cloud/merge review but not bulk upload when cloud data exists', () => {
    const html = renderToStaticMarkup(
      <SyncControls sync={api({ decision: decision('data') })} />,
    )
    expect(html).toContain('Use cloud data on this device')
    expect(html).toContain('Review and merge differences')
    expect(html).not.toContain('Upload this device&#x27;s Academy data')
  })

  it('names the previous household in an account-switch warning', () => {
    const html = renderToStaticMarkup(
      <SyncControls
        sync={api({ decision: decision('data', 'account-switch') })}
      />,
    )
    expect(html).toContain('Different household detected')
    expect(html).toContain('a@example.com')
    expect(html).toContain('will not be uploaded')
  })

  it('shows pull failures as retryable without an upload action', () => {
    const html = renderToStaticMarkup(
      <SyncControls
        sync={api({ error: 'Cloud data could not be loaded: timeout' })}
      />,
    )
    expect(html).toContain('Retry cloud check')
    expect(html).not.toContain('Upload this device&#x27;s Academy data')
  })

  it('explains paused provenance after another tab or import changes data', () => {
    const html = renderToStaticMarkup(
      <SyncControls
        sync={api({
          provenance: 'paused',
          pauseReason:
            'Imported Academy data is unbound and requires parent review.',
        })}
      />,
    )
    expect(html).toContain('Data provenance:')
    expect(html).toContain('review required')
    expect(html).toContain(
      'Imported Academy data is unbound and requires parent review.',
    )
  })
})
