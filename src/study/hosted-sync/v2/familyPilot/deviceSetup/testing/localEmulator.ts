import type {
  ParentDeviceSyncAdapter,
  ParentDeviceSyncApplyResult,
  ParentDeviceSyncAuthorityPort,
  ParentDeviceSyncIntent,
  ParentDeviceSyncPrepareResult,
  ParentDeviceSyncWorkSummary,
  ParentFamilyDeviceAuthorityResult,
} from '../types'

const EMPTY = Object.freeze({ learners: 0, assignments: 0, savedProgressItems: 0 })

export interface LocalParentDeviceSyncEmulator {
  readonly adapter: ParentDeviceSyncAdapter
  readonly calls: readonly string[]
  setOnline(value: boolean): void
  conflictNextConnect(): void
  replaceAcrossDevices(summary: ParentDeviceSyncWorkSummary): void
}

/** Local-only test authority. It does not model an account, credential, or provider. */
export function createLocalParentDeviceAuthority(options: {
  readonly familyRef?: string
  readonly expiresAt?: string
  readonly status?: ParentFamilyDeviceAuthorityResult['status']
} = {}): ParentDeviceSyncAuthorityPort {
  return Object.freeze({
    async authorize(): Promise<ParentFamilyDeviceAuthorityResult> {
      if (options.status === 'AUTHORITY_REQUIRED' || options.status === 'AUTHORITY_EXPIRED') {
        return Object.freeze({ status: options.status })
      }
      return Object.freeze({
        status: 'AUTHORIZED_PARENT_FAMILY_DEVICE',
        familyRef: options.familyRef ?? 'family:local-emulator',
        expiresAt: options.expiresAt ?? '2099-01-01T00:00:00.000Z',
      })
    },
  })
}

export function createLocalParentDeviceSyncEmulator(options: {
  readonly thisDevice?: ParentDeviceSyncWorkSummary
  readonly acrossDevices?: ParentDeviceSyncWorkSummary
} = {}): LocalParentDeviceSyncEmulator {
  let online = true
  let conflict = false
  let acrossDevices = options.acrossDevices ?? EMPTY
  let sequence = 0
  const calls: string[] = []
  const previews = new Map<string, { intent: ParentDeviceSyncIntent; familyRef: string }>()

  const adapter: ParentDeviceSyncAdapter = Object.freeze({
    async preview(
      { authority, intent }: Parameters<ParentDeviceSyncAdapter['preview']>[0],
    ): Promise<ParentDeviceSyncPrepareResult> {
      calls.push(`preview:${intent}`)
      if (!online) return Object.freeze({ status: 'OFFLINE' })
      const previewRef = `local-preview:${++sequence}`
      previews.set(previewRef, { intent, familyRef: authority.familyRef })
      return Object.freeze({
        status: 'READY',
        preview: Object.freeze({
          previewRef,
          intent,
          thisDevice: options.thisDevice ?? EMPTY,
          acrossDevices,
          preservation: 'PRESERVE_THIS_DEVICE',
        }),
      })
    },
    async connect(
      { authority, intent, previewRef }: Parameters<ParentDeviceSyncAdapter['connect']>[0],
    ): Promise<ParentDeviceSyncApplyResult> {
      calls.push(`connect:${intent}`)
      if (!online) return Object.freeze({ status: 'OFFLINE' })
      const preview = previews.get(previewRef)
      if (!preview || preview.intent !== intent || preview.familyRef !== authority.familyRef) {
        return Object.freeze({ status: 'NEEDS_ATTENTION', reason: 'CONNECT_UNAVAILABLE' })
      }
      if (conflict) {
        conflict = false
        return Object.freeze({ status: 'CONFLICT' })
      }
      previews.delete(previewRef)
      if (intent === 'FIRST_LINK') acrossDevices = options.thisDevice ?? EMPTY
      return Object.freeze({ status: 'UP_TO_DATE' })
    },
  })

  return Object.freeze({
    adapter,
    calls,
    setOnline(value: boolean) { online = value },
    conflictNextConnect() { conflict = true },
    replaceAcrossDevices(summary: ParentDeviceSyncWorkSummary) { acrossDevices = summary },
  })
}
