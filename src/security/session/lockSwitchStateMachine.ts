import type { SecurityLifecycleEvent, SecurityLifecycleEventType } from '../contracts/lifecycle'
import { parseProfileId, type ProfileId } from '../contracts/profileId'
import type { LocalSessionId } from '../contracts/sessions'
import { studyCancellationReasonFor } from '../contracts/studyBridge'
import type { StudyCancellationReason } from '../../study/lifecycle/StudyLifecycle'
import type {
  GlobalRevocationCause,
  GlobalRevocationNotice,
  GlobalRevocationSource,
} from './revocation'

export type LearnerAccessState =
  | Readonly<{ status: 'locked'; reason: 'initial' | 'lock' | 'logout' | 'switch-cancelled' | 'session-expired' | 'authorization-loss' | 'household-switch' }>
  | Readonly<{ status: 'active'; profileId: ProfileId; sessionId: LocalSessionId }>
  | Readonly<{ status: 'switching'; previousProfileId: ProfileId; targetProfileId: ProfileId }>

export type AuthorizationLossLifecycleType = Extract<
  SecurityLifecycleEventType,
  'learner-credential-reset' | 'import-or-replacement' | 'provenance-loss' | 'global-revocation'
>

export type LearnerAccessEvent =
  | Readonly<{ type: 'authenticated'; profileId: ProfileId; sessionId: LocalSessionId; occurredAt: string }>
  | Readonly<{ type: 'lock'; occurredAt: string }>
  | Readonly<{ type: 'logout'; occurredAt: string }>
  | Readonly<{ type: 'learner-switch'; targetProfileId: ProfileId; occurredAt: string }>
  | Readonly<{ type: 'cancel-switch' }>
  | Readonly<{ type: 'session-expired'; occurredAt: string }>
  | Readonly<{ type: 'authorization-loss'; source: AuthorizationLossLifecycleType; occurredAt: string }>
  | Readonly<{ type: 'household-switch'; occurredAt: string }>

export type LearnerAccessAction =
  | Readonly<{
      type: 'security-lifecycle'
      event: SecurityLifecycleEvent
      studyCancellationReason: StudyCancellationReason | null
      clearLocal: boolean
      revokeCause: GlobalRevocationCause | null
    }>
  | Readonly<{ type: 'request-learner-pin'; profileId: ProfileId }>

export interface LearnerAccessTransition {
  readonly state: LearnerAccessState
  readonly actions: readonly LearnerAccessAction[]
}

export const INITIAL_LEARNER_ACCESS_STATE: LearnerAccessState = Object.freeze({
  status: 'locked',
  reason: 'initial',
})

function lifecycle(
  type: SecurityLifecycleEventType,
  occurredAt: string,
  options: Readonly<{
    clearLocal?: boolean
    revokeCause?: GlobalRevocationCause
  }> = {},
): LearnerAccessAction {
  const event: SecurityLifecycleEvent = Object.freeze({ type, occurredAt })
  return Object.freeze({
    type: 'security-lifecycle',
    event,
    studyCancellationReason: studyCancellationReasonFor(type),
    clearLocal: options.clearLocal ?? false,
    revokeCause: options.revokeCause ?? null,
  })
}

function locked(
  reason: Extract<LearnerAccessState, { status: 'locked' }>['reason'],
): LearnerAccessState {
  return Object.freeze({ status: 'locked', reason })
}

/** Pure transition function; action order is the required integration order. */
export function transitionLearnerAccess(
  state: LearnerAccessState,
  event: LearnerAccessEvent,
): LearnerAccessTransition {
  if (state.status === 'active' && !parseProfileId(state.profileId)) {
    throw new Error('Active learner profile ID is invalid.')
  }
  if (
    state.status === 'switching' &&
    (!parseProfileId(state.previousProfileId) || !parseProfileId(state.targetProfileId))
  ) throw new Error('Switching learner profile ID is invalid.')
  switch (event.type) {
    case 'authenticated': {
      const profileId = parseProfileId(event.profileId)
      if (!profileId) throw new Error('Learner profile ID is invalid.')
      return Object.freeze({
        state: Object.freeze({ status: 'active', profileId, sessionId: event.sessionId }),
        actions: Object.freeze([lifecycle('learner-authenticated', event.occurredAt)]),
      })
    }
    case 'lock':
      return Object.freeze({
        state: locked('lock'),
        actions: Object.freeze([
          lifecycle('learner-lock', event.occurredAt, {
            clearLocal: true,
            revokeCause: 'learner-lock',
          }),
        ]),
      })
    case 'logout':
      return Object.freeze({
        state: locked('logout'),
        actions: Object.freeze([
          lifecycle('learner-sign-out', event.occurredAt, {
            clearLocal: true,
            revokeCause: 'learner-sign-out',
          }),
        ]),
      })
    case 'learner-switch': {
      const targetProfileId = parseProfileId(event.targetProfileId)
      if (!targetProfileId) throw new Error('Learner target profile ID is invalid.')
      if (state.status !== 'active') return Object.freeze({ state, actions: Object.freeze([]) })
      return Object.freeze({
        state: Object.freeze({
          status: 'switching',
          previousProfileId: state.profileId,
          targetProfileId,
        }),
        actions: Object.freeze([
          lifecycle('learner-switch-start', event.occurredAt, {
            clearLocal: true,
            revokeCause: 'learner-switch-start',
          }),
          Object.freeze({ type: 'request-learner-pin', profileId: targetProfileId }),
        ]),
      })
    }
    case 'cancel-switch':
      return Object.freeze({
        state: state.status === 'switching' ? locked('switch-cancelled') : state,
        actions: Object.freeze([]),
      })
    case 'session-expired':
      return Object.freeze({
        state: locked('session-expired'),
        actions: Object.freeze([lifecycle('learner-session-expired', event.occurredAt)]),
      })
    case 'authorization-loss':
      return Object.freeze({
        state: locked('authorization-loss'),
        actions: Object.freeze([
          lifecycle(event.source, event.occurredAt, event.source === 'global-revocation'
            ? { clearLocal: true }
            : { clearLocal: true, revokeCause: event.source }),
        ]),
      })
    case 'household-switch':
      return Object.freeze({
        state: locked('household-switch'),
        actions: Object.freeze([
          lifecycle('household-switch', event.occurredAt, {
            clearLocal: true,
            revokeCause: 'household-switch',
          }),
        ]),
      })
  }
}

export interface LearnerAccessActionPorts {
  readonly learnerSession: Readonly<{
    clearLocal: () => void | Promise<void>
    deliverLifecycle: (
      event: SecurityLifecycleEvent,
      beforeDelivery?: () => void | Promise<void>,
    ) => Promise<void>
  }>
  readonly revocation: GlobalRevocationSource & Readonly<{
    revoke: (
      cause: GlobalRevocationCause,
    ) => GlobalRevocationNotice | Promise<GlobalRevocationNotice>
    close: () => void
  }>
  readonly requestLearnerPin: (profileId: ProfileId) => void | Promise<void>
}

/** Executes the pure effects in sequence; it never imports or calls Study. */
export async function executeLearnerAccessActions(
  actions: readonly LearnerAccessAction[],
  ports: LearnerAccessActionPorts,
): Promise<void> {
  for (const action of actions) {
    if (action.type === 'request-learner-pin' && !parseProfileId(action.profileId)) {
      throw new Error('Learner action profile ID is invalid.')
    }
  }
  for (const action of actions) {
    switch (action.type) {
      case 'security-lifecycle':
        await ports.learnerSession.deliverLifecycle(action.event, async () => {
          if (action.clearLocal) await ports.learnerSession.clearLocal()
          if (action.revokeCause) await ports.revocation.revoke(action.revokeCause)
        })
        break
      case 'request-learner-pin':
        await ports.requestLearnerPin(action.profileId)
        break
    }
  }
}
