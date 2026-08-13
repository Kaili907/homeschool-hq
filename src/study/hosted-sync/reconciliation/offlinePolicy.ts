import type {
  OfflineStudyCapabilities,
  OfflineStudyDecision,
  StudySyncReplica,
} from './types'
import { classifyConflict } from './reconciliation'

/**
 * Local-first does not mean bypassing final readiness. This gate is pure so a
 * browser can run it without a network and fail closed on unavailable local
 * safety/storage evidence.
 */
export function evaluateOfflineStudyPolicy(input: {
  readonly replica: StudySyncReplica
  readonly capabilities: OfflineStudyCapabilities
}): OfflineStudyDecision {
  // Self-classification runs every binding/privacy check without inventing a
  // second validator. Equal replicas are always merge-compatible when valid.
  if (classifyConflict({ local: input.replica, remote: input.replica }).status !== 'COMPATIBLE') {
    return blocked('IDENTITY_OR_STATE_INVALID')
  }
  if (!input.capabilities.durableStorageAvailable) return blocked('DURABLE_STORAGE_UNAVAILABLE')
  if (!input.capabilities.assignmentAvailable) return blocked('ASSIGNMENT_UNAVAILABLE')
  if (!input.capabilities.productionMaterialAvailable) return blocked('PRODUCTION_MATERIAL_UNAVAILABLE')
  if (!input.capabilities.safetyStateAvailable) return blocked('SAFETY_STATE_UNAVAILABLE')

  const { state } = input.replica
  if (state.safetyHolds.some((hold) => hold.status !== 'cleared')) return blocked('SAFETY_HOLD')
  if (state.session.status === 'stopped') return blocked('SESSION_STOPPED')
  if (state.assignment.state === 'abandoned') return blocked('ASSIGNMENT_ABANDONED')
  if (state.assignment.state === 'completed') return blocked('ASSIGNMENT_COMPLETE')
  if (
    state.readiness.dynamicSourceRequirement === 'SOCIAL_STUDIES_SOURCE_ATTACHMENT' &&
    (!state.sourceAttachment || state.sourceAttachment.status !== 'ATTACHED_SATISFIED')
  ) return blocked('DYNAMIC_SOURCE_REQUIRED')

  const runtimeComplete = state.calendar.block.state === 'completed' || state.session.status === 'completed'
  if (
    state.readiness.completionRequirement === 'GUARDIAN_ATTESTATION' &&
    runtimeComplete && state.attestation?.status !== 'CERTIFIED'
  ) {
    return Object.freeze({
      status: 'WAITING_FOR_GUARDIAN',
      mayRecordProgress: false,
      mayCertifyCompletion: false,
      reasonCode: 'GUARDIAN_ATTESTATION_REQUIRED',
    })
  }
  return Object.freeze({
    status: 'ALLOW_LOCAL_PROGRESS',
    mayRecordProgress: true,
    mayCertifyCompletion: state.readiness.completionRequirement === 'STANDARD',
    reasonCode: null,
  })
}

function blocked(reasonCode: Exclude<OfflineStudyDecision, { readonly status: 'ALLOW_LOCAL_PROGRESS' }>['reasonCode']): OfflineStudyDecision {
  return Object.freeze({
    status: 'BLOCKED',
    mayRecordProgress: false,
    mayCertifyCompletion: false,
    reasonCode,
  })
}
