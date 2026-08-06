import type { StudySafetyClassificationRequestV1 } from '../contracts/safety'
import type { StudySafetyPort } from '../ports'
import type { StudySafetyRequest } from '../types'
import {
  classifyStudySafetyWithCaptureStatus,
  type StudySafetyClientDeps,
  type StudySessionAuthorizationFailure,
} from './client'
import { recordLocalPreAcceptanceSafetyStop } from './localStopLedger'

export type { StudySafetyClientDeps, StudySessionAuthorizationFailure } from './client'

export interface MountedStudySafetyPortDeps extends StudySafetyClientDeps {
  /**
   * Told that this evaluation was refused on authorization, never that anything
   * unsafe happened. The reason code is the entire payload: no bearer, no
   * session reference, no learner or household identifier, no server body, no
   * child or Tutor text. Wiring it is optional and it is fired after the port
   * has already decided — the port fails closed with or without it, and a
   * callback that throws changes nothing about that decision.
   */
  readonly onSessionAuthorizationFailure?: (reason: StudySessionAuthorizationFailure) => void
}

export const MOUNTED_STUDY_SAFETY_CLASSIFIER_VERSION = 'study-safety-http-boundary-v1' as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function deterministicUuid(namespace: string, value: string): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${namespace}\u001f${value}`),
  ))
  const bytes = digest.slice(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function gatewayRequest(request: StudySafetyRequest): Promise<StudySafetyClassificationRequestV1> {
  const sessionId = UUID.test(request.scope.sessionRef)
    ? request.scope.sessionRef.toLowerCase()
    : await deterministicUuid('study-safety-session-v1', [
        request.scope.householdRef,
        request.scope.learnerRef,
        request.scope.sessionRef,
      ].join('|'))
  return {
    schemaVersion: 1,
    requestId: await deterministicUuid(
      'study-safety-request-v1',
      `${request.contentKind}|${request.requestRef}`,
    ),
    studentRef: request.studentRef,
    sessionId,
    transientText: request.transientText,
  }
}

/**
 * Browser-safe adapter for the one existing authenticated safety endpoint.
 * Non-clear server responses are returned only after that endpoint has either
 * confirmed durable proposal capture or reduced the result to invalid.
 */
export function createMountedStudySafetyPort(
  deps: MountedStudySafetyPortDeps = {},
): StudySafetyPort {
  return Object.freeze({
    mode: 'production' as const,
    classifierVersion: MOUNTED_STUDY_SAFETY_CLASSIFIER_VERSION,
    async evaluate(request: StudySafetyRequest) {
      const result = await classifyStudySafetyWithCaptureStatus(await gatewayRequest(request), deps)
      const response = result.response
      // A refused session and a rate limit are lifecycle events, not safety
      // incidents: the classifier never judged this learner, so a durable record
      // would tell her parent she was stopped for something she wrote. Excluding
      // by name rather than admitting only 'classifier' is deliberate — an
      // unrecognised category keeps writing, because losing a real safety stop
      // is the far worse direction to fail in.
      const isSafetyIncident = result.failureCategory !== 'session-authorization' &&
        result.failureCategory !== 'rate-limit'
      // sessionRef is what the A6-5-C durable stop lock keys on. Without it an
      // outage record stays visible to the parent but never locks the session,
      // so a learner stopped by a gateway outage could refresh straight back in.
      if (isSafetyIncident && result.failureMode && result.serverCaptureStatus) await recordLocalPreAcceptanceSafetyStop({
        occurredAt: new Date().toISOString(),
        studentRef: request.scope.learnerRef,
        sessionRef: request.scope.sessionRef,
        failureMode: result.failureMode,
        serverCaptureStatus: result.serverCaptureStatus,
      })
      // Last, and isolated: the decision below is already fixed, so a host
      // callback that throws or re-enters this port cannot reach it.
      if (result.failureCategory === 'session-authorization' && result.sessionAuthorizationFailure) {
        try {
          deps.onSessionAuthorizationFailure?.(result.sessionAuthorizationFailure)
        } catch { /* the host's recovery is its own problem; this evaluation still fails closed */ }
      }
      return Object.freeze({
        outcome: response.classification,
        mayContinue: response.classification === 'clear' &&
          response.continueToTutorCore === true &&
          response.learner.mayContinue === true,
        adultHelpState: response.learner.adultHelpState,
      })
    },
  })
}
