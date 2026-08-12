import {
  upgradeFamilyPilotState,
  type FamilyPilotStateV1,
} from '../core/schema'

// FAMILY-PILOT-BACKUP: a household-portable snapshot of Family Pilot Core state.
//
// A backup is deliberately a thin envelope around FamilyPilotStateV1, the ONE
// schema Family Pilot Core owns. This module invents no second pilot schema and
// adds no fields the core schema does not already carry — a backup can never
// contain more than a fresh export of core state would, so nothing here can
// smuggle in learner prose the core parser already refuses.

export const FAMILY_PILOT_BACKUP_SCHEMA_VERSION = 1 as const

export interface FamilyPilotBackupV1 {
  readonly backupSchemaVersion: typeof FAMILY_PILOT_BACKUP_SCHEMA_VERSION
  readonly createdAt: string
  readonly familyPilotState: FamilyPilotStateV1
}

export interface FamilyPilotBackupSummary {
  readonly createdAt: string
  readonly studentCount: number
  readonly assignmentCount: number
  readonly completedAssignmentCount: number
  readonly activeAssignmentCount: number
}

export type FamilyPilotBackupReasonCode =
  | 'malformed-json'
  | 'wrong-shape'
  | 'backup-version-unsupported'
  | 'backup-version-ahead'
  | 'state-schema-version-ahead'
  | 'state-unreadable'

export type FamilyPilotBackupValidation =
  | { readonly status: 'valid'; readonly backup: FamilyPilotBackupV1 }
  | { readonly status: 'invalid'; readonly reasonCode: FamilyPilotBackupReasonCode }

export type FamilyPilotRestoreOutcome =
  | { readonly status: 'restored'; readonly state: FamilyPilotStateV1; readonly summary: FamilyPilotBackupSummary }
  | { readonly status: 'rejected'; readonly state: FamilyPilotStateV1; readonly reasonCode: FamilyPilotBackupReasonCode }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function isVersionAhead(value: unknown, current: number): boolean {
  return Number.isSafeInteger(value) && (value as number) > current
}

/** Deep, alphabetical key sort. Property order in memory never affects the bytes on disk. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key])
    return sorted
  }
  return value
}

/** Builds a backup envelope from the current Family Pilot Core state. */
export function exportFamilyPilotBackup(state: FamilyPilotStateV1, now: string): FamilyPilotBackupV1 {
  return Object.freeze({
    backupSchemaVersion: FAMILY_PILOT_BACKUP_SCHEMA_VERSION,
    createdAt: now,
    familyPilotState: state,
  })
}

/** Deterministic JSON: same backup contents always produce the same bytes. */
export function serializeFamilyPilotBackup(backup: FamilyPilotBackupV1): string {
  return JSON.stringify(canonicalize(backup))
}

/**
 * Total validator: any input at all yields a typed outcome, never a throw. The
 * reason code distinguishes "not a backup at all" from "a backup from a build
 * this one cannot read yet" from "the state inside it is unreadable" — restore
 * needs each of those to report a clear, recoverable result.
 */
export function validateFamilyPilotBackup(value: unknown): FamilyPilotBackupValidation {
  if (!isRecord(value)) return { status: 'invalid', reasonCode: 'wrong-shape' }
  if (value.backupSchemaVersion !== FAMILY_PILOT_BACKUP_SCHEMA_VERSION) {
    if (isVersionAhead(value.backupSchemaVersion, FAMILY_PILOT_BACKUP_SCHEMA_VERSION)) {
      return { status: 'invalid', reasonCode: 'backup-version-ahead' }
    }
    return { status: 'invalid', reasonCode: 'backup-version-unsupported' }
  }
  if (!isInstant(value.createdAt)) return { status: 'invalid', reasonCode: 'wrong-shape' }

  const upgrade = upgradeFamilyPilotState(value.familyPilotState)
  if (upgrade.status !== 'current') {
    return {
      status: 'invalid',
      reasonCode: upgrade.reasonCode === 'schema-version-ahead'
        ? 'state-schema-version-ahead'
        : 'state-unreadable',
    }
  }

  return {
    status: 'valid',
    backup: Object.freeze({
      backupSchemaVersion: FAMILY_PILOT_BACKUP_SCHEMA_VERSION,
      createdAt: value.createdAt,
      familyPilotState: upgrade.state,
    }),
  }
}

/** Total parser: an already-parsed backup value, or null. Never throws. */
export function parseFamilyPilotBackup(value: unknown): FamilyPilotBackupV1 | null {
  const validated = validateFamilyPilotBackup(value)
  return validated.status === 'valid' ? validated.backup : null
}

export function backupSummary(backup: FamilyPilotBackupV1): FamilyPilotBackupSummary {
  let assignmentCount = 0
  let completedAssignmentCount = 0
  let activeAssignmentCount = 0
  for (const student of backup.familyPilotState.students) {
    assignmentCount += student.assignments.length
    for (const assignment of student.assignments) {
      if (assignment.state === 'completed') completedAssignmentCount += 1
      if (assignment.state === 'active') activeAssignmentCount += 1
    }
  }
  return Object.freeze({
    createdAt: backup.createdAt,
    studentCount: backup.familyPilotState.students.length,
    assignmentCount,
    completedAssignmentCount,
    activeAssignmentCount,
  })
}

/**
 * Restores Family Pilot Core state from a backup, which may be a serialized
 * JSON string (as downloadFamilyPilotBackup writes) or an already-parsed value.
 *
 * The ENTIRE backup is validated before anything is returned. A rejected
 * restore hands back `currentState` unchanged by reference — the caller can
 * always assign `outcome.state` without checking `status` first, and no
 * partial mutation of the household's existing progress is possible.
 */
export function restoreFamilyPilotBackup(
  currentState: FamilyPilotStateV1,
  backup: unknown,
): FamilyPilotRestoreOutcome {
  let candidate: unknown = backup
  if (typeof backup === 'string') {
    try {
      candidate = JSON.parse(backup)
    } catch {
      return { status: 'rejected', state: currentState, reasonCode: 'malformed-json' }
    }
  }

  const validated = validateFamilyPilotBackup(candidate)
  if (validated.status === 'invalid') {
    return { status: 'rejected', state: currentState, reasonCode: validated.reasonCode }
  }

  return {
    status: 'restored',
    state: validated.backup.familyPilotState,
    summary: backupSummary(validated.backup),
  }
}
