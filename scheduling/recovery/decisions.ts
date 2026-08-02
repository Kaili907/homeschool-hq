import {
  type ApplyRecoveryDecisionInput,
  type RecoveryActor,
  type RecoveryAuditEntry,
  type RecoveryDecision,
  type RecoveryError,
  type RecoveryOption,
  type RecoveryProposal,
  type RecoveryResult,
  type RecoveryState,
  type ScheduleChange,
} from './types'
import { applyScheduleChanges } from './changes'

function auditId(decisionId: string, action: RecoveryAuditEntry['action']): string {
  return `recovery-audit:${decisionId}:${action}`
}

function selectedOption(
  proposal: RecoveryProposal,
  decision: RecoveryDecision,
): RecoveryOption | undefined {
  return proposal.options.find(
    (option) => option.id === decision.selectedOptionId,
  )
}

function markProposal(
  proposals: RecoveryProposal[],
  proposalId: string,
  status: RecoveryProposal['status'],
  currentRevision: number,
): RecoveryProposal[] {
  return proposals.map((proposal) => {
    if (proposal.id === proposalId) return { ...proposal, status }
    if (
      proposal.status === 'pending-parent' &&
      proposal.scheduleRevision < currentRevision
    ) {
      return { ...proposal, status: 'superseded' }
    }
    return proposal
  })
}

function decisionErrors(
  state: RecoveryState,
  decision: RecoveryDecision,
): {
  errors: RecoveryError[]
  proposal?: RecoveryProposal
} {
  const errors: RecoveryError[] = []
  const proposal = state.proposals.find(
    (candidate) => candidate.id === decision.proposalId,
  )
  if (!proposal) {
    errors.push({
      code: 'proposal-not-found',
      message: `Proposal ${decision.proposalId} was not found.`,
    })
    return { errors }
  }
  if (proposal.status !== 'pending-parent') {
    errors.push({
      code: 'proposal-not-pending',
      message: `Proposal ${proposal.id} is ${proposal.status}, not pending.`,
    })
  }
  if (proposal.scheduleRevision !== state.schedule.revision) {
    errors.push({
      code: 'stale-schedule-revision',
      message: `Proposal ${proposal.id} was prepared at revision ${proposal.scheduleRevision}, but the schedule is revision ${state.schedule.revision}.`,
    })
  }
  if (decision.actor.role !== 'parent') {
    errors.push({
      code: 'parent-approval-required',
      message: 'Only a parent actor can approve, reject, or override recovery.',
    })
  }
  if (
    decision.kind === 'approve' &&
    typeof decision.selectedOptionId !== 'string'
  ) {
    errors.push({
      code: 'invalid-decision',
      message: 'Approval requires a selected option ID.',
    })
  }
  if (
    decision.kind === 'override' &&
    (!decision.overrideChanges || decision.overrideChanges.length === 0)
  ) {
    errors.push({
      code: 'invalid-decision',
      message: 'A parent override requires at least one explicit change.',
    })
  }
  return { errors, proposal }
}

/**
 * Parent-gated commit boundary. Proposal generation never mutates a schedule;
 * this function is the only normal path that applies one of its options.
 */
export function applyRecoveryDecision(
  input: ApplyRecoveryDecisionInput,
): RecoveryResult<RecoveryState> {
  const { state, decision } = input
  const checked = decisionErrors(state, decision)
  if (checked.errors.length > 0 || !checked.proposal) {
    return { ok: false, errors: checked.errors }
  }
  const proposal = checked.proposal

  if (decision.kind === 'reject') {
    const audit: RecoveryAuditEntry = {
      id: auditId(decision.id, 'proposal-rejected'),
      proposalId: proposal.id,
      decisionId: decision.id,
      action: 'proposal-rejected',
      actor: decision.actor,
      at: decision.decidedAt,
      ...(decision.reason ? { reason: decision.reason } : {}),
      changes: [],
      beforeSchedule: state.schedule,
      afterSchedule: state.schedule,
    }
    return {
      ok: true,
      value: {
        schedule: state.schedule,
        proposals: markProposal(
          state.proposals,
          proposal.id,
          'rejected',
          state.schedule.revision,
        ),
        auditHistory: [...state.auditHistory, audit],
      },
    }
  }

  let changes: ScheduleChange[]
  let action: RecoveryAuditEntry['action']
  if (decision.kind === 'override') {
    changes = decision.overrideChanges ?? []
    action = 'parent-override-applied'
  } else {
    const option = selectedOption(proposal, decision)
    if (!option) {
      return {
        ok: false,
        errors: [
          {
            code: 'option-not-found',
            message: `Option ${decision.selectedOptionId ?? ''} was not found.`,
          },
        ],
      }
    }
    if (option.availability === 'unavailable' || !option.preservesInvariants) {
      return {
        ok: false,
        errors: [
          {
            code: 'invalid-decision',
            message: `${option.label} is unavailable and cannot be approved.`,
          },
        ],
      }
    }
    if (option.choice === 'parent-manual') {
      return {
        ok: false,
        errors: [
          {
            code: 'invalid-decision',
            message:
              'Parent chooses manually must be submitted as an override with explicit changes.',
          },
        ],
      }
    }
    changes = option.changes
    action = 'proposal-applied'
  }

  const applied =
    changes.length === 0
      ? ({ ok: true, value: state.schedule } as const)
      : applyScheduleChanges(state.schedule, changes, {
          updatedAt: decision.decidedAt,
          ...(decision.explicitlyApproveRequiredWorkRemoval === undefined
            ? {}
            : {
                explicitlyApproveRequiredWorkRemoval:
                  decision.explicitlyApproveRequiredWorkRemoval,
              }),
        })
  if (!applied.ok) return applied

  const nextSchedule = applied.value
  const audit: RecoveryAuditEntry = {
    id: auditId(decision.id, action),
    proposalId: proposal.id,
    decisionId: decision.id,
    action,
    actor: decision.actor,
    at: decision.decidedAt,
    ...(decision.reason ? { reason: decision.reason } : {}),
    changes,
    beforeSchedule: state.schedule,
    afterSchedule: nextSchedule,
  }
  return {
    ok: true,
    value: {
      schedule: nextSchedule,
      proposals: markProposal(
        state.proposals,
        proposal.id,
        'applied',
        nextSchedule.revision,
      ),
      auditHistory: [...state.auditHistory, audit],
    },
  }
}

export function approveRecoveryProposal(
  state: RecoveryState,
  decision: RecoveryDecision,
): RecoveryResult<RecoveryState> {
  if (decision.kind !== 'approve') {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-decision',
          message: 'approveRecoveryProposal requires an approve decision.',
        },
      ],
    }
  }
  return applyRecoveryDecision({ state, decision })
}

export function overrideRecoveryProposal(
  state: RecoveryState,
  decision: RecoveryDecision,
): RecoveryResult<RecoveryState> {
  if (decision.kind !== 'override') {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-decision',
          message: 'overrideRecoveryProposal requires an override decision.',
        },
      ],
    }
  }
  return applyRecoveryDecision({ state, decision })
}

export interface UndoRecoveryInput {
  state: RecoveryState
  auditEntryId: string
  actor: RecoveryActor
  at: string
  undoDecisionId?: string
  reason?: string
}

function reverseChanges(changes: readonly ScheduleChange[]): ScheduleChange[] {
  return [...changes].reverse().map((change) =>
    change.kind === 'event'
      ? {
          ...change,
          before: change.after,
          after: change.before,
          reasonCode: 'undo',
        }
      : {
          ...change,
          before: change.after,
          after: change.before,
          reasonCode: 'undo',
        },
  )
}

function equivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Restores the exact schedule snapshot immediately preceding the latest applied
 * recovery. History remains append-only through a compensating undo entry.
 */
export function undoRecovery(
  input: UndoRecoveryInput,
): RecoveryResult<RecoveryState> {
  const { state, auditEntryId, actor, at } = input
  if (actor.role !== 'parent') {
    return {
      ok: false,
      errors: [
        {
          code: 'parent-approval-required',
          message: 'Only a parent can undo an applied recovery.',
        },
      ],
    }
  }
  const target = state.auditHistory.find((entry) => entry.id === auditEntryId)
  if (
    !target ||
    !['proposal-applied', 'parent-override-applied'].includes(target.action)
  ) {
    return {
      ok: false,
      errors: [
        {
          code: 'nothing-to-undo',
          message: `Applied recovery audit entry ${auditEntryId} was not found.`,
        },
      ],
    }
  }
  if (state.auditHistory.some((entry) => entry.undoOf === target.id)) {
    return {
      ok: false,
      errors: [
        {
          code: 'already-undone',
          message: `Recovery audit entry ${target.id} was already undone.`,
        },
      ],
    }
  }
  const appliedNotUndone = state.auditHistory.filter(
    (entry) =>
      ['proposal-applied', 'parent-override-applied'].includes(entry.action) &&
      !state.auditHistory.some((candidate) => candidate.undoOf === entry.id),
  )
  const latest = appliedNotUndone[appliedNotUndone.length - 1]
  if (latest?.id !== target.id || !equivalent(state.schedule, target.afterSchedule)) {
    return {
      ok: false,
      errors: [
        {
          code: 'undo-not-latest',
          message:
            'Undo is limited to the latest applied recovery so later decisions are never silently lost.',
        },
      ],
    }
  }

  const undoDecisionId =
    input.undoDecisionId ?? `undo:${target.decisionId}:${state.auditHistory.length}`
  const undoEntry: RecoveryAuditEntry = {
    id: auditId(undoDecisionId, 'undo'),
    proposalId: target.proposalId,
    decisionId: undoDecisionId,
    action: 'undo',
    actor,
    at,
    ...(input.reason ? { reason: input.reason } : {}),
    changes: reverseChanges(target.changes),
    beforeSchedule: state.schedule,
    afterSchedule: target.beforeSchedule,
    undoOf: target.id,
  }
  return {
    ok: true,
    value: {
      schedule: target.beforeSchedule,
      proposals: state.proposals.map((proposal) =>
        proposal.id === target.proposalId
          ? { ...proposal, status: 'superseded' }
          : proposal,
      ),
      auditHistory: [...state.auditHistory, undoEntry],
    },
  }
}

export function createRecoveryState(
  schedule: RecoveryState['schedule'],
): RecoveryState {
  return { schedule, proposals: [], auditHistory: [] }
}

export function addRecoveryProposal(
  state: RecoveryState,
  proposal: RecoveryProposal,
): RecoveryResult<RecoveryState> {
  if (proposal.scheduleRevision !== state.schedule.revision) {
    return {
      ok: false,
      errors: [
        {
          code: 'stale-schedule-revision',
          message: `Proposal revision ${proposal.scheduleRevision} does not match schedule revision ${state.schedule.revision}.`,
        },
      ],
    }
  }
  if (state.proposals.some((candidate) => candidate.id === proposal.id)) {
    return {
      ok: false,
      errors: [
        {
          code: 'invalid-decision',
          message: `Proposal ${proposal.id} already exists.`,
        },
      ],
    }
  }
  return {
    ok: true,
    value: { ...state, proposals: [...state.proposals, proposal] },
  }
}

export function recoveryAuditForStudent(
  state: RecoveryState,
  studentId: string,
): RecoveryAuditEntry[] {
  const proposalIds = new Set(
    state.proposals
      .filter((proposal) => proposal.studentId === studentId)
      .map((proposal) => proposal.id),
  )
  return state.auditHistory.filter((entry) =>
    proposalIds.has(entry.proposalId),
  )
}
