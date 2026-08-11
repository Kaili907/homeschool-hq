import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES } from '../../admin/contracts'
import type { AdminAccessHttpSource } from '../../admin/accessHttpSource'
import type { AdminAccessReadState } from '../../admin/accessModel'
import { AdminAccessPermissions } from './AdminAccessPermissions'

const OWNER_REF = '00000000-0000-4000-8000-000000000341'
const VIEWER_REF = '00000000-0000-4000-8000-000000000342'
const OWNER_ASSIGNMENT = '10000000-0000-4000-8000-000000000341'
const VIEWER_ASSIGNMENT = '10000000-0000-4000-8000-000000000342'
const source = { mutate: vi.fn(), read: vi.fn() } as unknown as AdminAccessHttpSource

const ready = {
  status: 'ready' as const,
  projection: {
    schemaVersion: 2 as const,
    principals: [
      {
        principalRef: OWNER_REF, assignmentRef: OWNER_ASSIGNMENT,
        role: 'owner' as const, status: 'active' as const, revision: '1',
        isCurrent: true, capabilities: ADMIN_ROLE_CAPABILITIES.owner,
      },
      {
        principalRef: VIEWER_REF, assignmentRef: VIEWER_ASSIGNMENT,
        role: 'viewer' as const, status: 'active' as const, revision: '1',
        isCurrent: false, capabilities: ADMIN_ROLE_CAPABILITIES.viewer,
      },
    ],
  },
}

function render(role: 'owner' | 'admin' | 'viewer', state: AdminAccessReadState = ready) {
  return renderToStaticMarkup(
    <AdminAccessPermissions
      authorization={{ role, capabilities: ADMIN_ROLE_CAPABILITIES[role] }}
      state={state}
      source={source}
      onMutated={() => {}}
    />,
  )
}

describe('Admin Access & Permissions UI', () => {
  it.each(['owner', 'admin', 'viewer'] as const)('shows the safe principal, role, status, and capability view to %s', (role) => {
    const markup = render(role)
    expect(markup).toContain('Access &amp; Permissions')
    expect(markup).toContain(OWNER_REF)
    expect(markup).toContain('Current session')
    expect(markup).toContain('Active')
    expect(markup).toContain('10 read capabilities')
    expect(markup).not.toMatch(/email|password|token|session identifier/i)
  })

  it('renders mutation controls only for owner authority', () => {
    const owner = render('owner')
    expect(owner).toContain('Review role change')
    expect(owner).toContain('Revoke access')
    expect(owner).toContain('Owner management')
    for (const role of ['admin', 'viewer'] as const) {
      const readonly = render(role)
      expect(readonly).toContain('Read-only access')
      expect(readonly).not.toContain('Review role change')
      expect(readonly).not.toContain('Revoke access')
    }
  })

  it('marks and disables destructive removal of the sole owner in the browser presentation', () => {
    const soleOwner = { ...ready, projection: { ...ready.projection, principals: [ready.projection.principals[0]] } }
    const markup = render('owner', soleOwner)
    expect(markup).toContain('Sole owner protected')
    expect(markup).toMatch(/class="is-danger" disabled=""/)
  })

  it('provides loading, unavailable, timeout, and malformed-response states without partial data', () => {
    expect(render('viewer', { status: 'loading' })).toContain('Loading Admin access')
    expect(render('viewer', { status: 'unauthorized' })).toContain('Access view unavailable')
    expect(render('viewer', { status: 'error', code: 'access_timeout' })).toContain('Access read timed out')
    const malformed = render('viewer', { status: 'error', code: 'access_malformed' })
    expect(malformed).toContain('No partial or raw data was shown')
    expect(malformed).not.toContain(OWNER_REF)
  })

  it('includes keyboard confirmation, visible focus, reduced motion, and mobile layout safeguards', () => {
    const sourceText = readFileSync(new URL('./AdminAccessPermissions.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('./admin-access-permissions.css', import.meta.url), 'utf8')
    expect(sourceText).toContain('role="alertdialog"')
    expect(sourceText).toContain("event.key === 'Escape'")
    expect(sourceText).toContain("event.key === 'Tab'")
    expect(sourceText).toContain('cancelButtonRef.current?.focus()')
    expect(sourceText).toContain('confirmationTriggerRef.current')
    expect(sourceText).toContain('trigger?.isConnected')
    expect(sourceText).toContain('principalsHeadingRef.current?.focus()')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (max-width: 600px)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
