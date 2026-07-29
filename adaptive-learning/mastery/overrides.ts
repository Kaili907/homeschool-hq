import {
  type ManualMasteryOverride,
  type MasteryReasonCode,
  type OverrideActor,
  type OverrideAuditEntry,
  type StudentSkillMastery,
} from './contracts.ts'
import type {
  ISODateTime,
  OverrideAuditEntryId,
} from './ids.ts'
import { isStableId } from './ids.ts'
import {
  MasteryValidationError,
  isIsoDateTime,
} from './validation-types.ts'
import {
  validateManualMasteryOverride,
  validateStudentSkillMastery,
} from './validation.ts'
import { validateMasteryTransition } from './engine.ts'

export interface RevokeManualOverrideInput {
  readonly auditEntryId: OverrideAuditEntryId
  readonly actor: OverrideActor
  readonly at: ISODateTime
  readonly reason: string
}

export interface ExpireManualOverrideInput {
  readonly auditEntryId: OverrideAuditEntryId
  readonly at: ISODateTime
  readonly systemActorId?: string
}

function assertRecord(record: StudentSkillMastery): void {
  const result = validateStudentSkillMastery(record)
  if (!result.ok) {
    throw new MasteryValidationError(
      'Cannot modify an invalid mastery record.',
      result.issues,
    )
  }
}

function assertAuditId(id: OverrideAuditEntryId): void {
  if (!isStableId(id)) {
    throw new MasteryValidationError('Invalid override audit entry ID.', [
      {
        path: '$.auditEntryId',
        code: 'invalid_stable_id',
        message: 'Audit entry ID must be stable and opaque.',
      },
    ])
  }
}

function assertChronological(
  record: StudentSkillMastery,
  at: ISODateTime,
): void {
  if (!isIsoDateTime(at)) {
    throw new MasteryValidationError('Invalid override audit time.', [
      {
        path: '$.at',
        code: 'invalid_datetime',
        message: 'Override audit time must be an RFC 3339 date-time.',
      },
    ])
  }
  const latestAudit = record.overrideAuditHistory.at(-1)
  if (
    latestAudit &&
    Date.parse(at) < Date.parse(latestAudit.at)
  ) {
    throw new MasteryValidationError('Override audit history is append-only.', [
      {
        path: '$.at',
        code: 'audit_out_of_order',
        message: 'A new audit entry cannot precede the latest audit entry.',
      },
    ])
  }
}

function ensureUniqueAuditId(
  record: StudentSkillMastery,
  id: OverrideAuditEntryId,
): void {
  if (record.overrideAuditHistory.some((entry) => entry.id === id)) {
    throw new MasteryValidationError('Duplicate override audit entry ID.', [
      {
        path: '$.auditEntryId',
        code: 'duplicate_audit_id',
        message: `Audit entry ID "${id}" has already been used.`,
      },
    ])
  }
}

function withoutManualReason(
  reasons: readonly MasteryReasonCode[],
): readonly MasteryReasonCode[] {
  return reasons.filter((reason) => reason !== 'manual_override_active')
}

/**
 * Applies or replaces a manual state without altering computed evidence,
 * confidence, or independent-demonstration timestamps.
 */
export function applyManualOverride(
  record: StudentSkillMastery,
  override: ManualMasteryOverride,
  auditEntryId: OverrideAuditEntryId,
): StudentSkillMastery {
  assertRecord(record)
  assertAuditId(auditEntryId)
  ensureUniqueAuditId(record, auditEntryId)
  assertChronological(record, override.createdAt)

  const overrideResult = validateManualMasteryOverride(override)
  if (!overrideResult.ok) {
    throw new MasteryValidationError(
      'Cannot apply an invalid manual mastery override.',
      overrideResult.issues,
    )
  }
  if (
    override.studentId !== record.studentId ||
    override.skillId !== record.skillId
  ) {
    throw new MasteryValidationError('Override identity mismatch.', [
      {
        path: '$.override',
        code: 'override_record_mismatch',
        message: 'Override must belong to the mastery record student and skill.',
      },
    ])
  }
  if (
    record.overrideAuditHistory.some(
      (entry) => entry.overrideId === override.id,
    )
  ) {
    throw new MasteryValidationError('Override ID has already been used.', [
      {
        path: '$.override.id',
        code: 'duplicate_override_id',
        message:
          'Override IDs are immutable audit identities and cannot be reused.',
      },
    ])
  }

  validateMasteryTransition(
    record.state,
    override.state,
    'manual_override',
  )
  const entry: OverrideAuditEntry = {
    id: auditEntryId,
    overrideId: override.id,
    studentId: record.studentId,
    skillId: record.skillId,
    action: record.override ? 'replaced' : 'applied',
    actor: override.actor,
    at: override.createdAt,
    reason: override.reason,
    fromState: record.state,
    toState: override.state,
    overrideSnapshot: override,
  }
  const next: StudentSkillMastery = {
    ...record,
    revision: record.revision + 1,
    state: override.state,
    evaluatedAt: override.createdAt,
    reasonCodes: [
      ...new Set<MasteryReasonCode>([
        ...withoutManualReason(record.reasonCodes),
        'manual_override_active',
      ]),
    ],
    override,
    overrideAuditHistory: [...record.overrideAuditHistory, entry],
  }
  const result = validateStudentSkillMastery(next)
  if (!result.ok) {
    throw new MasteryValidationError(
      'Applying the override produced an invalid mastery record.',
      result.issues,
    )
  }
  return next
}

export function revokeManualOverride(
  record: StudentSkillMastery,
  input: RevokeManualOverrideInput,
): StudentSkillMastery {
  assertRecord(record)
  assertAuditId(input.auditEntryId)
  ensureUniqueAuditId(record, input.auditEntryId)
  assertChronological(record, input.at)
  const override = record.override
  if (!override) {
    throw new MasteryValidationError('No manual override to revoke.', [
      {
        path: '$.override',
        code: 'missing_override',
        message: 'A record without an override cannot be revoked.',
      },
    ])
  }
  if (!isStableId(input.actor.actorId)) {
    throw new MasteryValidationError('Invalid override actor ID.', [
      {
        path: '$.actor.actorId',
        code: 'invalid_stable_id',
        message: 'Actor ID must be stable and opaque.',
      },
    ])
  }
  if (input.actor.role !== 'parent' && input.actor.role !== 'teacher') {
    throw new MasteryValidationError('Invalid override actor role.', [
      {
        path: '$.actor.role',
        code: 'invalid_actor_role',
        message: 'A parent or teacher must revoke a manual override.',
      },
    ])
  }
  if (typeof input.reason !== 'string' || input.reason.trim().length === 0) {
    throw new MasteryValidationError('Override revocation reason is required.', [
      {
        path: '$.reason',
        code: 'invalid_reason',
        message: 'Revocation reason must be non-empty.',
      },
    ])
  }

  const entry: OverrideAuditEntry = {
    id: input.auditEntryId,
    overrideId: override.id,
    studentId: record.studentId,
    skillId: record.skillId,
    action: 'revoked',
    actor: input.actor,
    at: input.at,
    reason: input.reason,
    fromState: record.state,
    toState: record.computedState,
    overrideSnapshot: override,
  }
  const next: StudentSkillMastery = {
    ...record,
    revision: record.revision + 1,
    state: record.computedState,
    evaluatedAt: input.at,
    reasonCodes: withoutManualReason(record.reasonCodes),
    override: undefined,
    overrideAuditHistory: [...record.overrideAuditHistory, entry],
  }
  const result = validateStudentSkillMastery(next)
  if (!result.ok) {
    throw new MasteryValidationError(
      'Revoking the override produced an invalid mastery record.',
      result.issues,
    )
  }
  return next
}

/**
 * Explicitly records expiration. Evaluation ignores an expired override even
 * before this cleanup runs, but persistence should call this function so the
 * audit history explains the state change.
 */
export function expireManualOverride(
  record: StudentSkillMastery,
  input: ExpireManualOverrideInput,
): StudentSkillMastery {
  assertRecord(record)
  assertAuditId(input.auditEntryId)
  ensureUniqueAuditId(record, input.auditEntryId)
  assertChronological(record, input.at)
  const override = record.override
  if (!override?.expiresAt) {
    throw new MasteryValidationError('No expiring override is present.', [
      {
        path: '$.override.expiresAt',
        code: 'missing_expiration',
        message: 'Only an override with expiresAt can be expired.',
      },
    ])
  }
  if (Date.parse(input.at) < Date.parse(override.expiresAt)) {
    throw new MasteryValidationError('Override has not expired yet.', [
      {
        path: '$.at',
        code: 'override_not_expired',
        message: 'Expiration cannot be recorded before expiresAt.',
      },
    ])
  }
  const actorId = input.systemActorId ?? 'manuel-mastery-engine'
  if (!isStableId(actorId)) {
    throw new MasteryValidationError('Invalid system actor ID.', [
      {
        path: '$.systemActorId',
        code: 'invalid_stable_id',
        message: 'System actor ID must be stable and opaque.',
      },
    ])
  }

  const entry: OverrideAuditEntry = {
    id: input.auditEntryId,
    overrideId: override.id,
    studentId: record.studentId,
    skillId: record.skillId,
    action: 'expired',
    actor: { role: 'system', actorId },
    at: input.at,
    reason: 'The manual mastery override reached its recorded expiration.',
    fromState: record.state,
    toState: record.computedState,
    overrideSnapshot: override,
  }
  const next: StudentSkillMastery = {
    ...record,
    revision: record.revision + 1,
    state: record.computedState,
    evaluatedAt: input.at,
    reasonCodes: withoutManualReason(record.reasonCodes),
    override: undefined,
    overrideAuditHistory: [...record.overrideAuditHistory, entry],
  }
  const result = validateStudentSkillMastery(next)
  if (!result.ok) {
    throw new MasteryValidationError(
      'Expiring the override produced an invalid mastery record.',
      result.issues,
    )
  }
  return next
}

