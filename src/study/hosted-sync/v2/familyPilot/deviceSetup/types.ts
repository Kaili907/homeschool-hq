import type { ParentSyncStatusR1 } from '../status'

export type ParentDeviceSyncSimulationEnvironment = 'local' | 'test' | 'staging'
export type ParentDeviceSyncIntent = 'FIRST_LINK' | 'OTHER_DEVICE'

/**
 * Non-secret proof that the current app session already has Parent authority
 * for one family. Account/session credentials have no destination in this UX.
 */
export interface ParentFamilyDeviceAuthority {
  readonly status: 'AUTHORIZED_PARENT_FAMILY_DEVICE'
  readonly familyRef: string
  readonly expiresAt: string
}

export type ParentFamilyDeviceAuthorityResult =
  | ParentFamilyDeviceAuthority
  | Readonly<{ status: 'AUTHORITY_REQUIRED' | 'AUTHORITY_EXPIRED' }>

export interface ParentDeviceSyncAuthorityPort {
  authorize(): Promise<ParentFamilyDeviceAuthorityResult>
}

/** Count-only preview. Raw learner work cannot enter the setup presentation. */
export interface ParentDeviceSyncWorkSummary {
  readonly learners: number
  readonly assignments: number
  readonly savedProgressItems: number
}

export interface ParentDeviceSyncPreview {
  readonly previewRef: string
  readonly intent: ParentDeviceSyncIntent
  readonly thisDevice: ParentDeviceSyncWorkSummary
  readonly acrossDevices: ParentDeviceSyncWorkSummary
  readonly preservation: 'PRESERVE_THIS_DEVICE'
}

export type ParentDeviceSyncPrepareResult =
  | Readonly<{ status: 'READY'; preview: ParentDeviceSyncPreview }>
  | Readonly<{ status: 'OFFLINE' }>
  | Readonly<{ status: 'NEEDS_ATTENTION'; reason: 'AUTHORITY' | 'PREVIEW_UNAVAILABLE' | 'UNSAFE_PREVIEW' }>

export type ParentDeviceSyncApplyResult =
  | Readonly<{ status: 'UP_TO_DATE' }>
  | Readonly<{ status: 'CONFLICT' }>
  | Readonly<{ status: 'OFFLINE' }>
  | Readonly<{ status: 'NEEDS_ATTENTION'; reason: 'AUTHORITY' | 'CONNECT_UNAVAILABLE' }>

export interface ParentDeviceSyncAdapter {
  preview(input: Readonly<{
    authority: ParentFamilyDeviceAuthority
    intent: ParentDeviceSyncIntent
  }>): Promise<ParentDeviceSyncPrepareResult>
  connect(input: Readonly<{
    authority: ParentFamilyDeviceAuthority
    intent: ParentDeviceSyncIntent
    previewRef: string
  }>): Promise<ParentDeviceSyncApplyResult>
}

/**
 * No production environment is representable. The normal app does not inject
 * this object, so setup remains absent and Hosted Sync remains mechanically off.
 */
export interface ParentDeviceSyncSetupRuntime {
  readonly environment: ParentDeviceSyncSimulationEnvironment
  readonly authority: ParentDeviceSyncAuthorityPort
  readonly adapter: ParentDeviceSyncAdapter
}

export type ParentDeviceSyncSetupViewState =
  | Readonly<{ step: 'CHOOSE'; status: 'SYNC_READY' }>
  | Readonly<{ step: 'CONNECTING'; status: 'SYNCING'; intent: ParentDeviceSyncIntent }>
  | Readonly<{ step: 'PREVIEW'; status: 'SYNC_READY'; preview: ParentDeviceSyncPreview }>
  | Readonly<{ step: 'UP_TO_DATE'; status: 'UP_TO_DATE'; intent: ParentDeviceSyncIntent }>
  | Readonly<{ step: 'CONFLICT'; status: 'NEEDS_ATTENTION'; intent: ParentDeviceSyncIntent }>
  | Readonly<{ step: 'OFFLINE'; status: 'NEEDS_ATTENTION'; intent: ParentDeviceSyncIntent }>
  | Readonly<{ step: 'ATTENTION'; status: 'NEEDS_ATTENTION'; intent: ParentDeviceSyncIntent | null }>

export interface ParentDeviceSyncSetupViewProps {
  readonly state: ParentDeviceSyncSetupViewState
  readonly onChoose: (intent: ParentDeviceSyncIntent) => void
  readonly onConfirm: () => void
  readonly onBack: () => void
}

export type ParentDeviceSyncStatusListener = (status: ParentSyncStatusR1) => void
