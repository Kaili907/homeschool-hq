/**
 * Academy wire-compatibility version. This is not a package, AppState,
 * curriculum, service-worker, or deployment-build version.
 */
export const ACADEMY_SYNC_PROTOCOL_VERSION = 2 as const

export type AcademySyncMode = 'normal' | 'maintenance'

export interface AcademySyncV2Envelope {
  readonly syncProtocolVersion: typeof ACADEMY_SYNC_PROTOCOL_VERSION
}

/** Server advertisement used before any versioned synchronization operation. */
export interface AcademySyncProtocolAdvertisement {
  readonly syncProtocolVersion: number
  readonly minimumSupportedSyncVersion: number
  readonly mode: AcademySyncMode
}

export type AcademySyncTerminalState =
  | Readonly<{
      status: 'update-required'
      syncProtocolVersion: number
      minimumSupportedSyncVersion: number
    }>
  | Readonly<{
      status: 'maintenance'
      syncProtocolVersion: number
      minimumSupportedSyncVersion: number
      retryAfter?: string
    }>
