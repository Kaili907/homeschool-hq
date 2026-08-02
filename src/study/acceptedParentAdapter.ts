import {
  applyParentControlAction,
  createParentRuntimeState,
  type ParentControlAction,
} from '../../adaptive-tutor/study-engine/runtime/src/parent.ts'
import type {
  StudyAdultAuthorization,
  StudyCalendarEntry,
  StudyLearnerScope,
  StudyParentPublicCommand,
  StudyParentSettings,
} from './types'

/**
 * Runs host controls through the accepted RC1 public parent boundary before
 * the provisional port mutates local state. Recommendation decisions are the
 * documented RC1 append-recommendation gap and remain host-validated only.
 */
export function assertAcceptedParentControl(input: {
  readonly scope: StudyLearnerScope
  readonly authorization: StudyAdultAuthorization
  readonly command: StudyParentPublicCommand
  readonly settings: StudyParentSettings
  readonly calendarEntry?: StudyCalendarEntry
  readonly now?: Date
}): void {
  if (input.command.type === 'accept-recommendation' || input.command.type === 'reject-recommendation') return
  const currentTime = input.now ?? new Date()
  const now = new Date(
    input.command.type === 'mark-interruption'
      ? Math.max(currentTime.getTime(), Date.parse(input.command.occurredAt))
      : currentTime.getTime(),
  ).toISOString()
  const state = createParentRuntimeState({
    controlSetId: `controls:${input.scope.learnerRef}`,
    studentRef: input.scope.learnerRef,
    gradeBand: 'elementary-3-5',
    privateRecordRef: `private:${input.scope.learnerRef}`,
    at: now,
    gradeBandDefault: {
      maximumWorkDurationMinutes: input.settings.maximumWorkMinutes,
      breakDurationMinutes: input.settings.breakMinutes,
      timersHidden: input.settings.timerHidden,
    },
    durationPolicyContext: {
      policyVersion: 1,
      integrityValid: true,
      actorAuthorized: input.authorization.adultAuthorized,
      currentMinutes: input.settings.maximumWorkMinutes,
    },
    knownIncompleteBlockIds: input.calendarEntry ? [input.calendarEntry.blockRef] : [],
  })
  const actor = { actorId: input.authorization.actorRef, role: input.authorization.role }
  const eventTime = currentTime.getTime()
  const base = { eventId: `event:${input.command.type}:${eventTime}`, at: now, actor, expectedRevision: state.revision }
  let action: ParentControlAction
  const command = input.command
  if (command.type === 'set-maximum-duration') {
    action = { ...base, type: 'set-maximum-work-duration', minutes: command.minutes, scope: 'hard-maximum', reason: 'parent-hard-maximum' }
  } else if (command.type === 'set-break-duration') {
    action = { ...base, type: 'set-break-duration', minutes: command.minutes, reason: 'parent-break-setting' }
  } else if (command.type === 'hide-timer') {
    action = { ...base, type: 'set-timers-hidden', hidden: command.hidden, reason: 'parent-timer-setting' }
  } else if (command.type === 'add-accommodation') {
    action = {
      ...base,
      type: 'add-accommodation',
      accommodationId: command.accommodation.accommodationRef,
      required: false,
      functionalDescription: command.accommodation.functionalDescription,
      studentMessage: command.accommodation.studentMessage,
      source: 'parent',
      ...(command.accommodation.maximumWorkMinutes ? { maximumWorkDurationMinutes: command.accommodation.maximumWorkMinutes } : {}),
      ...(command.accommodation.breakMinutes ? { breakDurationMinutes: command.accommodation.breakMinutes } : {}),
      ...(command.accommodation.timerHidden === undefined ? {} : { timersHidden: command.accommodation.timerHidden }),
    }
  } else if (command.type === 'reschedule-incomplete-work') {
    action = {
      ...base,
      type: 'reschedule-incomplete-work',
      rescheduleId: `reschedule:${eventTime}`,
      blockId: command.blockRef,
      originalStartAt: input.calendarEntry?.scheduledStart ?? now,
      replacementStartAt: command.replacementStart,
      reason: 'parent-reschedule-incomplete',
    }
  } else if (command.type === 'mark-interruption') {
    action = {
      ...base,
      type: 'mark-interruption',
      interruptionId: `interruption:${eventTime}`,
      kind: command.kind,
      blockId: command.blockRef,
      occurredAt: command.occurredAt,
    }
  } else {
    action = {
      ...base,
      type: 'request-adult-review',
      requestId: command.requestRef,
      audience: command.audience,
      subjectRef: input.scope.learnerRef,
      reason: 'parent-requested-review',
      basisEvidenceIds: command.evidenceRefs,
    }
  }
  applyParentControlAction(state, action, {
    integrityValid: true,
    actorAuthorized: true,
    studentRef: input.scope.learnerRef,
    actorId: input.authorization.actorRef,
    actorRole: input.authorization.role,
  })
}
