/** Authenticated, fail-closed Study safety classification gateway. */

import { createAdultReviewProposalService } from './_shared/study-adult-review/proposal.js'
import { createSupabaseStudySafetyPorts } from './_shared/study-adult-review/supabase-ports.js'
import { readStudySessionReferenceHeader } from './_shared/study-identity/contracts.js'
import {
  createTestStudySessionAuthorizationPort,
  createVerifiedStudySessionAuthorizationPort,
} from './_shared/study-safety/session-authorization.js'
import {
  STUDY_SAFETY_REQUEST_LIMIT_BYTES,
  validateStudySafetyRequest,
} from './_shared/study-safety/contracts.js'
import { learnerWireResult } from './_shared/study-safety/learner-safe.js'
import { createMonitoringEvent, NOOP_MONITORING_PORT } from './_shared/study-safety/monitoring.js'
import { createAnthropicSafetyClassifier } from './_shared/study-safety/provider.js'
import { evaluateStudySafetyReadiness, readinessWireResult } from './_shared/study-safety/readiness.js'
import { rateLimitActorRef, rateLimitSubjectRefs } from './_shared/study-safety/rate-limit.js'
import { classifyTransientSafety } from './_shared/study-safety/service.js'
import {
  envFlagEnabled,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { isAuthorizationInfrastructureFailure, verifySupabaseBearer } from './_shared/supabase-auth.js'

const CLASSIFY_PATHS = new Set(['/api/study/safety/classify', '/.netlify/functions/study-safety-classify'])
const READINESS_PATH = '/api/study/safety/readiness'

function defaultBootLogger(event) {
  console.info(JSON.stringify(event))
}

/**
 * Production boot boundary. The generic factory below remains injectable for
 * tests, but the deployed export must never accept a local/demo classifier.
 */
export function createProductionStudySafetyHandler(overrides = {}) {
  if (overrides.learnerAuthorization !== undefined) {
    throw new Error('STUDY SAFETY STARTUP ABORTED: learner authorization overrides are test-only')
  }
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const productionPorts = overrides.productionPorts ?? createSupabaseStudySafetyPorts({ env, fetchImpl })
  const monitoring = overrides.monitoring ?? productionPorts.monitoring ?? NOOP_MONITORING_PORT
  const classifier = overrides.classifier ?? createAnthropicSafetyClassifier({
    env,
    fetchImpl,
    monitoring,
  })
  if (
    classifier?.mode !== 'production' ||
    typeof classifier.classifierVersion !== 'string' ||
    classifier.classifierVersion.trim() === '' ||
    typeof classifier.classify !== 'function'
  ) {
    throw new Error('STUDY SAFETY STARTUP ABORTED: production handler requires classifier mode "production"')
  }
  const logBoot = overrides.logBoot ?? defaultBootLogger
  logBoot(Object.freeze({
    event: 'study_safety.classifier_boot',
    mode: 'production',
    classifierVersion: classifier.classifierVersion,
  }))
  return createStudySafetyHandler({
    ...overrides,
    env,
    fetchImpl,
    productionPorts,
    monitoring,
    classifier,
  })
}

/** Test-only composition seam. Production code must use the exported handler. */
export function createTestStudySafetyHandler(overrides = {}) {
  const learnerAuthorization = overrides.learnerAuthorization
    ? createTestStudySessionAuthorizationPort(overrides.learnerAuthorization)
    : undefined
  return createStudySafetyHandler({ ...overrides, learnerAuthorization })
}

function createStudySafetyHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const productionPorts = overrides.productionPorts ?? createSupabaseStudySafetyPorts({ env, fetchImpl })
  const effectiveMonitoring = overrides.monitoring ?? productionPorts.monitoring ?? NOOP_MONITORING_PORT
  const classifier = overrides.classifier ?? createAnthropicSafetyClassifier({ env, fetchImpl, monitoring: effectiveMonitoring })
  const learnerAuthorization = overrides.learnerAuthorization
    ? overrides.learnerAuthorization
    : createVerifiedStudySessionAuthorizationPort({ env, fetchImpl })
  const proposalPersistence = overrides.proposalPersistence ?? productionPorts.proposalPersistence
  const outbox = overrides.outbox ?? productionPorts.outbox
  const recipientResolver = overrides.recipientResolver ?? productionPorts.recipientResolver
  const rateLimiter = overrides.rateLimiter ?? productionPorts.rateLimiter
  const deliveryProviders = overrides.deliveryProviders
  const receiptValidators = overrides.receiptValidators
  const authVerifier = overrides.authVerifier ?? verifySupabaseBearer
  const now = overrides.now ?? Date.now
  const usesProductionPorts = [
    overrides.proposalPersistence,
    overrides.outbox,
    overrides.recipientResolver,
    overrides.rateLimiter,
    overrides.monitoring,
  ].some((port) => port === undefined)
  const proposalService = proposalPersistence
    ? createAdultReviewProposalService({ persistence: proposalPersistence, now })
    : null
  const dependencies = {
    classifier,
    learnerAuthorization,
    proposalPersistence,
    outbox,
    recipientResolver,
    rateLimiter,
    monitoring: effectiveMonitoring,
    deliveryProviders,
    receiptValidators,
  }

  async function record(name, severity, code, fields = {}) {
    try {
      await effectiveMonitoring.record(createMonitoringEvent(name, severity, code, fields, { now }))
    } catch {
      // Monitoring failure never permits academic continuation or leaks input.
    }
  }

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (event?.httpMethod === 'GET' && event?.path === READINESS_PATH && !hasQuery(event)) {
      if (usesProductionPorts) await productionPorts.refreshReadiness()
      const readiness = evaluateStudySafetyReadiness(dependencies, env)
      return jsonResponse(readiness.status === 'not-ready' ? 503 : 200, readinessWireResult(readiness))
    }
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    if (!CLASSIFY_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    try {
      const auth = await authVerifier(event, { fetchImpl, env, timeoutMs: 3_000 })
      if (!auth.ok) {
        await record('study_safety.request_unauthorized', 'warning', 'request-unauthorized')
        // STUDY-A1-AUTH-INFRA-BOUNDARY-H2 — the adult bearer verifier is this
        // request's other authorization dependency, and it runs even earlier
        // than the learner-authorization one below. When it cannot answer at
        // all, nothing about this child was evaluated either: the classifier is
        // far downstream of here. It answered 503 `auth_unavailable` and 504
        // `upstream_timeout`, which the host could only read as a safety-service
        // outage and record as a learner safety incident — the same defect the
        // 424 below fixed for the sibling verifier, on the sibling dependency.
        //
        // Both now share one status because they are one semantic category: an
        // authorization dependency of this request was unreachable. Which of the
        // two it was is a server detail the browser must not have to care about.
        //
        // This reads the verifier's own typed failure identity, never its
        // response prose, and it is scoped to that verifier: a 503 or a 504
        // raised anywhere else on this route — `gateway_disabled`,
        // `service_not_ready`, `service_unavailable`, the rate limiter's
        // failures — is untouched and keeps its status and its meaning.
        return isAuthorizationInfrastructureFailure(auth)
          ? errorResponse(424, 'authorization_unavailable')
          : auth.response
      }
      if (usesProductionPorts) await productionPorts.refreshReadiness()
      const readiness = evaluateStudySafetyReadiness(dependencies, env)
      if (readiness.status !== 'ready') return errorResponse(503, 'service_not_ready')

      let reservation
      try {
        const actorRef = rateLimitActorRef(auth.user.id, env)
        if (!actorRef) return errorResponse(503, 'service_not_ready')
        reservation = await rateLimiter.reserve({
          actorRef,
          scope: 'study-safety-classify',
          now: now(),
        })
      } catch {
        return errorResponse(503, 'service_not_ready')
      }
      if (!reservation?.allowed) {
        await record('study_safety.request_rate_limited', 'warning', 'request-rate-limited')
        const retryAfter = Number.isInteger(reservation?.retryAfterSeconds)
          ? String(Math.max(1, Math.min(3600, reservation.retryAfterSeconds)))
          : '60'
        return errorResponse(429, 'rate_limited', { 'retry-after': retryAfter })
      }

      const request = validateStudySafetyRequest(readJsonBody(event, STUDY_SAFETY_REQUEST_LIMIT_BYTES))
      const authorization = await learnerAuthorization.resolve({
        actorUserId: auth.user.id,
        accessToken: auth.accessToken,
        studentRef: request.studentRef,
        sessionId: request.sessionId,
        // A missing or malformed reference resolves to null and is refused by
        // the authorizer, so no privileged operation runs without a session.
        sessionReference: readStudySessionReferenceHeader(event),
      })
      if (authorization?.status !== 'authorized') {
        if (authorization?.status === 'denied') {
          await record('study_safety.request_unauthorized', 'warning', 'learner-not-authorized')
        }
        // STUDY-A1-AUTH-INFRA-BOUNDARY-C — 424 Failed Dependency, and only for
        // this exact case. The learner-authorization verifier is a dependency of
        // this request that could not be reached, so nothing about this child was
        // ever evaluated: the classifier runs strictly after this point. 503 said
        // "this safety service is unavailable", which the host could only read as
        // a safety-classifier outage and record as a learner safety incident.
        // Every other 503 here — `gateway_disabled`, `service_not_ready`, the
        // rate-limiter's own failures — keeps its status and its meaning.
        return authorization?.status === 'unavailable'
          ? errorResponse(424, 'authorization_unavailable')
          : errorResponse(403, 'learner_not_authorized')
      }

      try {
        const subjectRefs = rateLimitSubjectRefs({
          householdId: authorization.context.householdId,
          studentId: authorization.context.studentId,
          route: 'study-safety-classify',
        }, env)
        if (!subjectRefs) return errorResponse(503, 'service_not_ready')
        const subjectReservation = await rateLimiter.reserve({
          actorRef: rateLimitActorRef(auth.user.id, env),
          ...subjectRefs,
          scope: 'study-safety-classify-subject-route',
          now: now(),
        })
        if (!subjectReservation?.allowed) {
          await record('study_safety.request_rate_limited', 'warning', 'request-rate-limited')
          const retryAfter = Number.isInteger(subjectReservation?.retryAfterSeconds)
            ? String(Math.max(1, Math.min(3600, subjectReservation.retryAfterSeconds)))
            : '60'
          return errorResponse(429, 'rate_limited', { 'retry-after': retryAfter })
        }
      } catch {
        return errorResponse(503, 'service_not_ready')
      }

      const decision = await classifyTransientSafety(request.transientText, classifier)
      // The transient text is intentionally not retained beyond this point.
      if (decision.outcome === 'clear') return jsonResponse(200, learnerWireResult('clear'))

      const proposalResult = await proposalService.propose({
        decision,
        context: authorization.context,
        requestId: request.requestId,
        sessionId: authorization.context.sessionId,
      })
      const adultHelpConfirmed = proposalResult.state === 'recorded-not-delivered' || proposalResult.state === 'duplicate-not-delivered'
      if (proposalResult.state === 'duplicate-not-delivered') {
        await record('study_safety.proposal_duplicate', 'info', 'duplicate-proposal-attempt')
      }
      if (decision.outcome === 'urgent') {
        await record('study_safety.classification_urgent', 'critical', 'urgent-classification', { adultReviewState: proposalResult.state })
      } else if (decision.outcome === 'uncertain') {
        await record('study_safety.classification_uncertain', 'warning', 'uncertain-classification', { adultReviewState: proposalResult.state })
      }
      return jsonResponse(200, learnerWireResult(decision.outcome, adultHelpConfirmed))
    } catch (error) {
      return responseForError(error)
    }
  }
}

export const handler = createProductionStudySafetyHandler()
