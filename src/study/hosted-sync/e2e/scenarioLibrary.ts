import { HostedStudyE2EHarness, type HostedStudyDevice } from './harness'
import type { HostedSyncHarnessInjection } from './contracts'

export const HOSTED_SYNC_ACCEPTANCE_SCENARIOS = Object.freeze([
  'fresh Device A signs in and hydrates household',
  'Device A starts real-shaped Study state and syncs',
  'fresh Device B signs into the same household',
  'Device B hydrates exact student assignment lesson and progress',
  'Device B resumes exactly where Device A stopped',
  'Device A goes offline and advances',
  'Device A reconnects and uploads',
  'Device B refreshes and receives the update',
  'both devices modify the same Study document from the same base',
  'stale write is rejected and reconciled safely',
  'normal completion propagates',
  'completed lesson never regresses',
  'Ready-for-Life learner finish remains pending',
  'parent attestation propagates across devices',
  'student device cannot self-attest',
  'social dynamic-source attachment propagates',
  'pending-source device cannot start early',
  'safety hold is created and received across devices',
  'offline stale device cannot clear or bypass a hold after reconnect',
  'parent clear propagates',
  'two siblings remain isolated',
  'wrong household is forbidden',
  'auth expiration is handled as auth and not safety',
  'duplicate network retry is idempotent',
  'temporary server outage preserves local progress',
  'device clock skew does not decide truth',
  'logout clears ephemeral authorization',
  'no raw Tutor or private answer content reaches the server fixture',
] as const)

export interface ParentDevicePair {
  readonly harness: HostedStudyE2EHarness
  readonly deviceA: HostedStudyDevice
  readonly deviceB: HostedStudyDevice
}

export async function createParentDevicePair(
  injection: HostedSyncHarnessInjection,
  hydrateB = true,
): Promise<ParentDevicePair> {
  const harness = new HostedStudyE2EHarness(injection)
  const deviceA = harness.createDevice('device-a')
  const deviceB = harness.createDevice('device-b')
  await deviceA.signIn('parent-alpha')
  await deviceB.signIn('parent-alpha')
  const hydratedA = await deviceA.hydrate()
  if (hydratedA.status !== 'hydrated') throw new Error(`device-a-hydration-failed:${hydratedA.status}`)
  if (hydrateB) {
    const hydratedB = await deviceB.hydrate()
    if (hydratedB.status !== 'hydrated') throw new Error(`device-b-hydration-failed:${hydratedB.status}`)
  }
  return { harness, deviceA, deviceB }
}

/** A convergence adapter fails immediately if two device factories alias storage. */
export function assertFreshDeviceIsIndependent(device: HostedStudyDevice): void {
  if (device.state.household !== null || device.state.pending.length !== 0) {
    throw new Error('fresh-device-shares-local-state')
  }
}
