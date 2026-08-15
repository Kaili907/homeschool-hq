import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FAMILY_HOSTED_SYNC_CONVERGENCE_R1 } from '../policy'
import {
  ParentDeviceSyncSetupCoordinator,
  isParentDeviceSyncSetupSimulation,
  isSafeParentDeviceSyncPreview,
} from './coordinator'
import { ParentDeviceSyncSetupView } from './ParentDeviceSyncSetup'
import { createLocalParentDeviceAuthority, createLocalParentDeviceSyncEmulator } from './testing/localEmulator'
import type { ParentDeviceSyncPreview, ParentDeviceSyncSetupViewState } from './types'

const LOCAL = Object.freeze({ learners: 2, assignments: 7, savedProgressItems: 4 })
const ACROSS = Object.freeze({ learners: 2, assignments: 9, savedProgressItems: 6 })

function runtime(emulator = createLocalParentDeviceSyncEmulator({ thisDevice: LOCAL, acrossDevices: ACROSS })) {
  return {
    emulator,
    value: Object.freeze({
      environment: 'test' as const,
      authority: createLocalParentDeviceAuthority(),
      adapter: emulator.adapter,
    }),
  }
}

function preview(intent: ParentDeviceSyncPreview['intent'] = 'FIRST_LINK'): ParentDeviceSyncPreview {
  return Object.freeze({
    previewRef: 'local-preview:1',
    intent,
    thisDevice: LOCAL,
    acrossDevices: ACROSS,
    preservation: 'PRESERVE_THIS_DEVICE',
  })
}

function markup(state: ParentDeviceSyncSetupViewState): string {
  return renderToStaticMarkup(
    <ParentDeviceSyncSetupView state={state} onChoose={() => undefined} onConfirm={() => undefined} onBack={() => undefined} />,
  )
}

describe('Parent device-sync setup coordinator', () => {
  it('keeps production default-off and performs no work before an injected action', () => {
    const held = runtime()
    expect(FAMILY_HOSTED_SYNC_CONVERGENCE_R1.enabled).toBe(false)
    expect(held.emulator.calls).toEqual([])
    expect(held.value.environment).toBe('test')
    expect(isParentDeviceSyncSetupSimulation(undefined)).toBe(false)
    expect(isParentDeviceSyncSetupSimulation({ ...held.value, environment: 'production' } as never)).toBe(false)
  })

  it('previews and first-links through only the injected local authority and adapter', async () => {
    const held = runtime()
    const coordinator = new ParentDeviceSyncSetupCoordinator(held.value)
    const prepared = await coordinator.prepare('FIRST_LINK')
    expect(prepared).toEqual({ status: 'READY', preview: preview() })
    if (prepared.status !== 'READY') return
    await expect(coordinator.connect(prepared.preview)).resolves.toEqual({ status: 'UP_TO_DATE' })
    expect(held.emulator.calls).toEqual(['preview:FIRST_LINK', 'connect:FIRST_LINK'])
  })

  it('supports another authenticated family device without inventing account authority', async () => {
    const held = runtime()
    const coordinator = new ParentDeviceSyncSetupCoordinator(held.value)
    const prepared = await coordinator.prepare('OTHER_DEVICE')
    expect(prepared).toMatchObject({ status: 'READY', preview: { intent: 'OTHER_DEVICE', acrossDevices: ACROSS } })
    if (prepared.status !== 'READY') return
    await expect(coordinator.connect(prepared.preview)).resolves.toEqual({ status: 'UP_TO_DATE' })
    expect(held.emulator.calls).toEqual(['preview:OTHER_DEVICE', 'connect:OTHER_DEVICE'])
  })

  it('reports offline before connect and never implies local data loss', async () => {
    const held = runtime()
    held.emulator.setOnline(false)
    await expect(new ParentDeviceSyncSetupCoordinator(held.value).prepare('FIRST_LINK')).resolves.toEqual({ status: 'OFFLINE' })
    expect(markup({ step: 'OFFLINE', status: 'NEEDS_ATTENTION', intent: 'FIRST_LINK' })).toContain(
      "You&#x27;re offline — your work is still saved on this device.",
    )
  })

  it('surfaces concurrent changes and never silently overwrites either side', async () => {
    const held = runtime()
    const coordinator = new ParentDeviceSyncSetupCoordinator(held.value)
    const prepared = await coordinator.prepare('FIRST_LINK')
    if (prepared.status !== 'READY') throw new Error('fixture preview missing')
    held.emulator.conflictNextConnect()
    await expect(coordinator.connect(prepared.preview)).resolves.toEqual({ status: 'CONFLICT' })
    const html = markup({ step: 'CONFLICT', status: 'NEEDS_ATTENTION', intent: 'FIRST_LINK' })
    expect(html).toContain('We found changes from another device.')
    expect(html).toContain('Nothing was overwritten')
  })

  it('requires an injected, unexpired Parent-family authority result', async () => {
    const held = runtime()
    const coordinator = new ParentDeviceSyncSetupCoordinator({
      ...held.value,
      authority: createLocalParentDeviceAuthority({ status: 'AUTHORITY_REQUIRED' }),
    })
    await expect(coordinator.prepare('FIRST_LINK')).resolves.toEqual({ status: 'NEEDS_ATTENTION', reason: 'AUTHORITY' })
    expect(held.emulator.calls).toEqual([])
  })

  it('accepts only an exact count-only preservation preview', () => {
    expect(isSafeParentDeviceSyncPreview(preview(), 'FIRST_LINK')).toBe(true)
    expect(isSafeParentDeviceSyncPreview({ ...preview(), pinVerifier: 'forbidden' }, 'FIRST_LINK')).toBe(false)
    expect(isSafeParentDeviceSyncPreview({ ...preview(), thisDevice: { ...LOCAL, rawResponses: 1 } }, 'FIRST_LINK')).toBe(false)
    expect(isSafeParentDeviceSyncPreview({ ...preview(), preservation: 'REPLACE_LOCAL' }, 'FIRST_LINK')).toBe(false)
  })
})

describe('Parent device-sync setup presentation', () => {
  it('shows both setup paths with Parent language and accessible mobile controls', () => {
    const html = markup({ step: 'CHOOSE', status: 'SYNC_READY' })
    expect(html).toContain('Sync across devices')
    expect(html).toContain('Set up this family')
    expect(html).toContain('Connect another device')
    expect(html).toContain('min-h-11')
    expect(html).not.toMatch(/hydrate|checkpoint|CAS|RPC|revision token/i)
  })

  it('shows the preservation preview before approval and lists every privacy exclusion', () => {
    const html = markup({ step: 'PREVIEW', status: 'SYNC_READY', preview: preview() })
    expect(html).toContain('Existing work on this device will be preserved.')
    expect(html).toContain('Approve and connect')
    expect(html).toContain('PINs and PIN verifiers')
    expect(html).toContain('tokens, secrets, and sign-in credentials')
    expect(html).toContain('answer authority and answer material')
    expect(html).toContain('Tutor transcripts and conversations')
    expect(html).toContain('excluded raw learner responses')
    expect(html).toContain('emotional or personality data')
    expect(html).not.toMatch(/hydrate|checkpoint|CAS|RPC|revision token/i)
  })

  it('keeps the production app seam optional and mounts setup only inside ParentSurface', () => {
    const source = readFileSync(new URL('../../../../family-pilot/final-app/FinalFamilyPilotApp.tsx', import.meta.url), 'utf8')
    expect(source).toContain('deviceSyncSetup?: ParentDeviceSyncSetupRuntime')
    expect(source).toContain("deviceSyncAvailable ? 'SYNC_READY' : currentParentSyncStatusR1()")
    expect(source).toContain('<ParentDeviceSyncSetup runtime={deviceSyncSetup}')
    expect(source.indexOf('function ParentSurface')).toBeLessThan(source.indexOf('<ParentDeviceSyncSetup runtime={deviceSyncSetup}'))
    expect(source).not.toMatch(/createClient|supabaseUrl|VITE_SUPABASE/)
  })
})
