import type {
  ParentDeviceSyncApplyResult,
  ParentDeviceSyncIntent,
  ParentDeviceSyncPrepareResult,
  ParentDeviceSyncPreview,
  ParentDeviceSyncSetupRuntime,
} from './types'

const SIMULATION_ENVIRONMENTS = Object.freeze(['local', 'test', 'staging'] as const)

/** Runtime defense in depth for JavaScript callers outside TypeScript. */
export function isParentDeviceSyncSetupSimulation(
  runtime: ParentDeviceSyncSetupRuntime | undefined,
): runtime is ParentDeviceSyncSetupRuntime {
  return Boolean(runtime && SIMULATION_ENVIRONMENTS.includes(runtime.environment))
}

const EXACT_PREVIEW_KEYS = Object.freeze([
  'previewRef', 'intent', 'thisDevice', 'acrossDevices', 'preservation',
] as const)
const EXACT_SUMMARY_KEYS = Object.freeze(['learners', 'assignments', 'savedProgressItems'] as const)

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && [...expected].sort().every((key, index) => key === actual[index])
}

function safeCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000
}

function safeSummary(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, EXACT_SUMMARY_KEYS)) return false
  const summary = value as Record<string, unknown>
  return safeCount(summary.learners) && safeCount(summary.assignments) && safeCount(summary.savedProgressItems)
}

/** Fail closed before any adapter-provided preview reaches React. */
export function isSafeParentDeviceSyncPreview(value: unknown, intent: ParentDeviceSyncIntent): value is ParentDeviceSyncPreview {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, EXACT_PREVIEW_KEYS)) return false
  const preview = value as Record<string, unknown>
  return (
    typeof preview.previewRef === 'string' && preview.previewRef.length > 0 && preview.previewRef.length <= 200 &&
    preview.intent === intent &&
    preview.preservation === 'PRESERVE_THIS_DEVICE' &&
    safeSummary(preview.thisDevice) &&
    safeSummary(preview.acrossDevices)
  )
}

function validAuthority(value: Awaited<ReturnType<ParentDeviceSyncSetupRuntime['authority']['authorize']>>): value is Extract<typeof value, { status: 'AUTHORIZED_PARENT_FAMILY_DEVICE' }> {
  return value.status === 'AUTHORIZED_PARENT_FAMILY_DEVICE' && Boolean(value.familyRef) &&
    Number.isFinite(Date.parse(value.expiresAt)) && Date.parse(value.expiresAt) > Date.now()
}

export class ParentDeviceSyncSetupCoordinator {
  readonly #runtime: ParentDeviceSyncSetupRuntime

  constructor(runtime: ParentDeviceSyncSetupRuntime) {
    if (!isParentDeviceSyncSetupSimulation(runtime)) {
      throw new Error('Parent device sync setup is limited to local, test, and staging simulation.')
    }
    this.#runtime = runtime
  }

  async prepare(intent: ParentDeviceSyncIntent): Promise<ParentDeviceSyncPrepareResult> {
    const authority = await this.#runtime.authority.authorize()
    if (!validAuthority(authority)) return Object.freeze({ status: 'NEEDS_ATTENTION', reason: 'AUTHORITY' })
    let result: ParentDeviceSyncPrepareResult
    try {
      result = await this.#runtime.adapter.preview({ authority, intent })
    } catch {
      return Object.freeze({ status: 'NEEDS_ATTENTION', reason: 'PREVIEW_UNAVAILABLE' })
    }
    if (result.status !== 'READY') return result
    return isSafeParentDeviceSyncPreview(result.preview, intent)
      ? result
      : Object.freeze({ status: 'NEEDS_ATTENTION', reason: 'UNSAFE_PREVIEW' })
  }

  async connect(preview: ParentDeviceSyncPreview): Promise<ParentDeviceSyncApplyResult> {
    if (!isSafeParentDeviceSyncPreview(preview, preview.intent)) {
      return Object.freeze({ status: 'NEEDS_ATTENTION', reason: 'CONNECT_UNAVAILABLE' })
    }
    const authority = await this.#runtime.authority.authorize()
    if (!validAuthority(authority)) return Object.freeze({ status: 'NEEDS_ATTENTION', reason: 'AUTHORITY' })
    try {
      return await this.#runtime.adapter.connect({
        authority,
        intent: preview.intent,
        previewRef: preview.previewRef,
      })
    } catch {
      return Object.freeze({ status: 'NEEDS_ATTENTION', reason: 'CONNECT_UNAVAILABLE' })
    }
  }
}
