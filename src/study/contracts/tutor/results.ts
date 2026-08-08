/**
 * STUDY-A1-TUTOR-CONTRACT — runtime validation of a Tutor result.
 *
 * A production Tutor wrapper is out-of-process work the host does not own, so
 * its output is untrusted the moment it crosses this boundary. This module is
 * where that output stops being unknown.
 *
 * Validate and rebuild in ONE pass, per the pattern that
 * `narrowedInterruption` in src/study/runtimeFacade.ts settled: each field is
 * read exactly once and the value that is KEPT is the value that was CHECKED,
 * so an own accessor cannot answer the check with an approved string and then
 * hand something else to whatever is built afterwards. Only primitives and
 * frozen rebuilt objects leave here, so the caller's object never travels on.
 *
 * Nothing is coerced. A `String(...)` around a check lets an object whose
 * `toString` prints an approved value through, and it is the object — not the
 * text it printed — that then travels, along with everything it closed over.
 *
 * `null` means "not a Tutor result". It is not an error and it is not a stop:
 * the host fails the turn closed and records nothing about the learner, which
 * is the safe direction. Over-rejecting costs a retry; under-rejecting lets an
 * unvouched-for shape reach durable Study state.
 */
import { isStudyBridgeOpaqueId } from '../../studyRequestRef'
import type { StudyRuntimeInterruption } from '../../types'
import type { StudyTutorAdultHelpDelivery, StudyTutorResult } from './runtime'

/**
 * Short, lower-case, machine vocabulary: no spaces, no capitals, no sentence
 * punctuation. The host writes a stop's code straight into the durable
 * safety-stop event, so this is what keeps a learner's words out of it. Every
 * code the preview emits already satisfies it — `mounted-input-safety-urgent`,
 * `bridge-stop-for-uncertain-adult-review`, `identity-binding-mismatch`.
 */
export const STUDY_TUTOR_REASON_CODE_MAX_LENGTH = 64
const REASON_CODE = /^[a-z0-9]+(?:[-:][a-z0-9]+)*$/

export function isStudyTutorReasonCode(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= STUDY_TUTOR_REASON_CODE_MAX_LENGTH &&
    REASON_CODE.test(value)
}

/** Exact per branch. An extra key — including any forbidden one — is a rejection. */
export const STUDY_TUTOR_RESULT_KEYS = Object.freeze({
  accepted: Object.freeze(['status', 'eventRef', 'visibleText']),
  stopped: Object.freeze(['status', 'reasonCode', 'deliveryStatus']),
  interrupted: Object.freeze(['status', 'interruption']),
  quarantined: Object.freeze(['status', 'reasonCode']),
})

const DELIVERY_STATUSES: ReadonlySet<string> =
  new Set<StudyTutorAdultHelpDelivery>(['proposed-not-delivered', 'not-confirmed'])

const SESSION_AUTHORIZATION_REASONS: ReadonlySet<string> =
  new Set<Extract<StudyRuntimeInterruption, { kind: 'session-authorization' }>['reason']>([
    'adult-authentication-rejected',
    'study-session-rejected',
  ])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(candidate: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(candidate)
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(candidate, key))
}

/**
 * The host's interruption set, narrowed and rebuilt. Closed on both sides: an
 * unrecognised kind, an unrecognised reason, a missing reason and any extra
 * field are all rejected.
 *
 * Deliberately re-stated here rather than shared with the preview facade, whose
 * copy is module-private and belongs to a runtime this contract must not know
 * about.
 */
function narrowedInterruption(value: unknown): StudyRuntimeInterruption | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  const kind = value.kind
  if (kind === 'rate-limit') return keys.length === 1 ? Object.freeze({ kind: 'rate-limit' as const }) : null
  if (kind !== 'session-authorization' || keys.length !== 2 || !Object.hasOwn(value, 'reason')) return null
  const reason = value.reason
  return typeof reason === 'string' && SESSION_AUTHORIZATION_REASONS.has(reason)
    ? Object.freeze({ kind: 'session-authorization' as const, reason: reason as 'adult-authentication-rejected' | 'study-session-rejected' })
    : null
}

/**
 * The only way a Tutor result enters the host.
 *
 * Total: a throwing accessor on a hostile or simply broken implementation's
 * output is a rejection, not an exception thrown through the caller. That class
 * is not hypothetical here — a throwing getter has already once kept a stale
 * Study session authorizing — and a validator that can itself throw gives a
 * wrapper a way out of being validated.
 */
export function parseStudyTutorResult(value: unknown): StudyTutorResult | null {
  try {
    if (!isRecord(value)) return null
    const status = value.status

    if (status === 'accepted') {
      if (!hasExactKeys(value, STUDY_TUTOR_RESULT_KEYS.accepted)) return null
      const eventRef = value.eventRef
      const visibleText = value.visibleText
      if (typeof eventRef !== 'string' || !isStudyBridgeOpaqueId(eventRef)) return null
      if (typeof visibleText !== 'string' || visibleText.trim() === '') return null
      return Object.freeze({ status: 'accepted' as const, eventRef, visibleText })
    }

    if (status === 'stopped') {
      if (!hasExactKeys(value, STUDY_TUTOR_RESULT_KEYS.stopped)) return null
      const reasonCode = value.reasonCode
      const deliveryStatus = value.deliveryStatus
      if (!isStudyTutorReasonCode(reasonCode)) return null
      if (typeof deliveryStatus !== 'string' || !DELIVERY_STATUSES.has(deliveryStatus)) return null
      return Object.freeze({
        status: 'stopped' as const,
        reasonCode,
        deliveryStatus: deliveryStatus as StudyTutorAdultHelpDelivery,
      })
    }

    if (status === 'interrupted') {
      if (!hasExactKeys(value, STUDY_TUTOR_RESULT_KEYS.interrupted)) return null
      const interruption = narrowedInterruption(value.interruption)
      return interruption === null ? null : Object.freeze({ status: 'interrupted' as const, interruption })
    }

    if (status === 'quarantined') {
      if (!hasExactKeys(value, STUDY_TUTOR_RESULT_KEYS.quarantined)) return null
      const reasonCode = value.reasonCode
      return isStudyTutorReasonCode(reasonCode) ? Object.freeze({ status: 'quarantined' as const, reasonCode }) : null
    }

    return null
  } catch {
    return null
  }
}
