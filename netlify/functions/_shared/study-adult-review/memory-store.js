import { randomUUID } from 'node:crypto'
import { STUDY_SAFETY_REASON_CODES, validUuid } from '../study-safety/contracts.js'

const REASON_CODES = new Set(STUDY_SAFETY_REASON_CODES)
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const PROPOSAL_KEYS = new Set([
  'schemaVersion', 'proposalId', 'householdId', 'studentId', 'sessionId', 'category', 'classification', 'urgency',
  'reasonCodes', 'classifierVersion', 'occurredAt', 'idempotencyKey', 'deliveryState', 'authorizedRecipientResolutionState',
])
const ATTEMPT_KEYS = new Set([
  'outboxId', 'leaseToken', 'attemptId', 'deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'channel',
  'providerVersion', 'authorizationEvidenceRef', 'attemptedAt',
])
const RECEIPT_KEYS = new Set([...ATTEMPT_KEYS, 'deliveredAt', 'providerReceiptRef', 'receiptEvidenceRef'])
const MONITORING_KEYS = new Set([
  'schemaVersion', 'eventId', 'name', 'service', 'severity', 'occurredAt', 'code', 'metricName', 'runbookId', 'attributes',
])
const FAILURE_CODES = new Set([
  'proposal-not-found', 'recipient-reauthorization-indeterminate', 'recipient-route-revoked',
  'delivery-provider-not-ready', 'delivery-attempts-exhausted', 'delivery-response-lost',
  'delivery-temporary-failure', 'delivery-permanent-failure', 'delivery-evidence-indeterminate',
])
const RESOLUTION_FAILURE_CODES = new Set(['no-authorized-recipient', 'resolver-malformed-or-unavailable'])

function copy(value) {
  return structuredClone(value)
}

function exactKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === allowed.size && Object.keys(value).every((key) => allowed.has(key))
}

function validRef(value) {
  return typeof value === 'string' && REF.test(value)
}

function sanitizeProposal(value) {
  if (
    !exactKeys(value, PROPOSAL_KEYS) || value.schemaVersion !== 1 || !validRef(value.proposalId) ||
    !validUuid(value.householdId) || !validUuid(value.studentId) || !validUuid(value.sessionId) ||
    value.category !== 'student-support' || !['urgent', 'uncertain', 'invalid'].includes(value.classification) ||
    !['urgent', 'uncertain', 'review-required'].includes(value.urgency) ||
    !Array.isArray(value.reasonCodes) || value.reasonCodes.length < 1 || value.reasonCodes.length > 16 ||
    value.reasonCodes.some((code) => !REASON_CODES.has(code)) || !validRef(value.classifierVersion) ||
    !/^(?:anthropic-safety-v1:claude-haiku-4-5:study-safety-config-v1|study-safety-validation-v1|test-safety-classifier-v1)$/.test(value.classifierVersion) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.occurredAt) ||
    !/^study-safety:[a-f0-9]{64}$/.test(value.idempotencyKey) ||
    value.deliveryState !== 'proposed-not-delivered' || value.authorizedRecipientResolutionState !== 'pending'
  ) throw new TypeError('invalid_adult_review_proposal')
  return {
    schemaVersion: 1,
    proposalId: value.proposalId,
    householdId: value.householdId,
    studentId: value.studentId,
    sessionId: value.sessionId,
    category: value.category,
    classification: value.classification,
    urgency: value.urgency,
    reasonCodes: [...value.reasonCodes],
    classifierVersion: value.classifierVersion,
    occurredAt: value.occurredAt,
    idempotencyKey: value.idempotencyKey,
    deliveryState: value.deliveryState,
    authorizedRecipientResolutionState: value.authorizedRecipientResolutionState,
  }
}

function sanitizeAttempt(value) {
  if (
    !exactKeys(value, ATTEMPT_KEYS) ||
    ['outboxId', 'leaseToken', 'attemptId', 'deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'providerVersion', 'authorizationEvidenceRef']
      .some((key) => !validRef(value[key])) ||
    !/^authorization-evidence:[a-f0-9]{64}$/.test(value.authorizationEvidenceRef) ||
    !['email', 'in-app', 'sms'].includes(value.channel) || !Number.isFinite(Date.parse(value.attemptedAt))
  ) throw new TypeError('invalid_delivery_attempt_evidence')
  return Object.fromEntries([...ATTEMPT_KEYS].map((key) => [key, value[key]]))
}

function sanitizeReceipt(value) {
  if (
    !exactKeys(value, RECEIPT_KEYS) ||
    !Number.isFinite(Date.parse(value.deliveredAt)) ||
    !validRef(value.providerReceiptRef) ||
    !validRef(value.receiptEvidenceRef)
  ) throw new TypeError('invalid_delivery_receipt_evidence')
  return Object.fromEntries([...RECEIPT_KEYS].map((key) => [key, value[key]]))
}

function requireFailureCode(value) {
  if (!FAILURE_CODES.has(value)) throw new TypeError('invalid_failure_code')
  return value
}

/** Test-only Session 13 seam. It deliberately does not satisfy durable readiness. */
export function createInMemoryAdultReviewStore(options = {}) {
  const proposals = new Map()
  const proposalByKey = new Map()
  const outbox = new Map()
  const receipts = new Map()
  const attempts = new Map()
  const monitoring = []
  const idFactory = options.idFactory ?? randomUUID

  function requireProposalLease(entry, token) {
    if (!entry || entry.resolutionState !== 'claimed' || entry.resolutionLeaseToken !== token) {
      throw new Error('proposal_lease_lost')
    }
  }

  function requireOutboxLease(record, token) {
    if (!record || record.state !== 'claimed' || record.leaseToken !== token) throw new Error('outbox_lease_lost')
  }

  return Object.freeze({
    isDurable: false,
    isReady: () => true,
    async createProposal({ proposal }) {
      const sanitized = sanitizeProposal(proposal)
      const duplicateId = proposalByKey.get(sanitized.idempotencyKey)
      if (duplicateId) return { created: false, duplicateProposalId: duplicateId }
      if (proposals.has(sanitized.proposalId)) throw new Error('proposal_identifier_collision')
      proposals.set(sanitized.proposalId, {
        proposal: copy(sanitized),
        resolutionState: 'pending',
        resolutionLeaseToken: null,
        resolutionLeaseExpiresAt: null,
      })
      proposalByKey.set(sanitized.idempotencyKey, sanitized.proposalId)
      return { created: true }
    },
    async getProposal(proposalId) {
      const value = proposals.get(proposalId)
      return value ? copy(value.proposal) : null
    },
    async claimUnresolvedProposals({ now, limit = 10, leaseMs = 30_000 }) {
      const claimed = []
      const nowMs = Date.parse(now)
      for (const entry of proposals.values()) {
        if (claimed.length >= limit) break
        const claimable = entry.resolutionState === 'pending' ||
          (entry.resolutionState === 'claimed' && Date.parse(entry.resolutionLeaseExpiresAt) <= nowMs)
        if (!claimable) continue
        entry.resolutionState = 'claimed'
        entry.resolutionLeaseToken = idFactory()
        entry.resolutionLeaseExpiresAt = new Date(nowMs + leaseMs).toISOString()
        claimed.push({
          proposal: copy(entry.proposal),
          leaseToken: entry.resolutionLeaseToken,
          leaseExpiresAt: entry.resolutionLeaseExpiresAt,
        })
      }
      return claimed
    },
    async recordRecipientResolutionAndEnqueue({ proposalId, proposalLeaseToken, resolutionRef, policyVersion, routes, enqueuedAt }) {
      const entry = proposals.get(proposalId)
      requireProposalLease(entry, proposalLeaseToken)
      if (
        !/^resolution:[A-Za-z0-9._/-]{1,96}$/.test(resolutionRef) ||
        !/^policy:[A-Za-z0-9._/-]{1,96}$/.test(policyVersion) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(enqueuedAt) ||
        !Array.isArray(routes) || routes.length < 1
      ) throw new Error('recipient_routes_required')
      const jobs = []
      const routeKeys = new Set()
      for (const route of routes) {
        if (
          !route || Object.keys(route).length !== 4 ||
          !/^recipient:[A-Za-z0-9._/-]{1,96}$/.test(route.recipientRef) ||
          !/^(?:email|in-app|sms)-route:[A-Za-z0-9._/-]{1,96}$/.test(route.routeRef) ||
          !['email', 'in-app', 'sms'].includes(route.channel) ||
          !/^study-safety-delivery:[a-f0-9]{64}$/.test(route.deliveryIdempotencyKey)
        ) throw new TypeError('invalid_recipient_route_job')
        const uniqueRoute = `${route.recipientRef}:${route.routeRef}:${route.channel}`
        if (routeKeys.has(uniqueRoute)) throw new Error('duplicate_recipient_route')
        routeKeys.add(uniqueRoute)
        const outboxId = `outbox-${route.deliveryIdempotencyKey.slice(-48)}`
        const existing = outbox.get(outboxId)
        if (existing) {
          if (existing.deliveryIdempotencyKey !== route.deliveryIdempotencyKey) throw new Error('outbox_identifier_collision')
          jobs.push(copy(existing))
          continue
        }
        const record = {
          schemaVersion: 1,
          outboxId,
          proposalId,
          deliveryIdempotencyKey: route.deliveryIdempotencyKey,
          recipientRef: route.recipientRef,
          routeRef: route.routeRef,
          channel: route.channel,
          templateCode: 'study-safety-adult-review-v1',
          enqueuedAt,
          state: 'pending',
          attemptCount: 0,
          retryAt: null,
          version: 1,
          leaseToken: null,
          leaseExpiresAt: null,
          receiptRef: null,
        }
        outbox.set(outboxId, record)
        jobs.push(copy(record))
      }
      entry.resolutionState = 'resolved'
      entry.resolutionRef = resolutionRef
      entry.policyVersion = policyVersion
      entry.resolutionLeaseToken = null
      entry.resolutionLeaseExpiresAt = null
      return jobs
    },
    async recordRecipientResolutionFailure({ proposalId, proposalLeaseToken, state, reasonCode }) {
      const entry = proposals.get(proposalId)
      requireProposalLease(entry, proposalLeaseToken)
      if (!['unavailable', 'indeterminate'].includes(state) || !RESOLUTION_FAILURE_CODES.has(reasonCode)) {
        throw new TypeError('invalid_recipient_resolution_failure')
      }
      entry.resolutionState = state
      entry.resolutionFailureCode = reasonCode
      entry.resolutionLeaseToken = null
      entry.resolutionLeaseExpiresAt = null
    },
    async claim({ now, limit = 10, leaseMs = 30_000 }) {
      const claimed = []
      const nowMs = Date.parse(now)
      for (const record of outbox.values()) {
        if (claimed.length >= limit) break
        const claimable = record.state === 'pending' ||
          (record.state === 'retry-scheduled' && Date.parse(record.retryAt) <= nowMs) ||
          (record.state === 'claimed' && Date.parse(record.leaseExpiresAt) <= nowMs)
        if (!claimable) continue
        record.state = 'claimed'
        record.version += 1
        record.leaseToken = idFactory()
        record.leaseExpiresAt = new Date(nowMs + leaseMs).toISOString()
        claimed.push({ record: copy(record), leaseToken: record.leaseToken, leaseExpiresAt: record.leaseExpiresAt })
      }
      return claimed
    },
    async recordAttempt(input) {
      const sanitized = sanitizeAttempt(input)
      const record = outbox.get(sanitized.outboxId)
      requireOutboxLease(record, sanitized.leaseToken)
      for (const key of ['deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'channel']) {
        if (record[key] !== sanitized[key]) throw new Error('immutable_delivery_binding_mismatch')
      }
      if (!attempts.has(sanitized.attemptId)) {
        record.attemptCount += 1
        attempts.set(sanitized.attemptId, copy(sanitized))
      }
      return { attemptCount: record.attemptCount }
    },
    async recordDeliveryReceipt(input) {
      const sanitized = sanitizeReceipt(input)
      const record = outbox.get(sanitized.outboxId)
      requireOutboxLease(record, sanitized.leaseToken)
      const attempt = attempts.get(sanitized.attemptId)
      if (!attempt) throw new Error('attempt_not_found')
      for (const key of ['deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'channel', 'providerVersion']) {
        if (attempt[key] !== sanitized[key]) throw new Error('receipt_binding_mismatch')
      }
      const receiptKey = `${sanitized.providerVersion}:${sanitized.providerReceiptRef}`
      const existing = receipts.get(receiptKey)
      if (existing && existing.deliveryIdempotencyKey !== sanitized.deliveryIdempotencyKey) throw new Error('receipt_reuse')
      if (!existing) receipts.set(receiptKey, copy(sanitized))
      record.receiptRef = receiptKey
    },
    async recordTemporaryFailure({ outboxId, leaseToken, retryAt, failedAt, failureCode }) {
      const record = outbox.get(outboxId)
      requireOutboxLease(record, leaseToken)
      record.state = 'retry-scheduled'
      record.retryAt = retryAt
      record.failedAt = failedAt
      record.failureCode = requireFailureCode(failureCode)
      record.leaseToken = null
      record.leaseExpiresAt = null
      record.version += 1
    },
    async recordDelivered({ outboxId, leaseToken, deliveredAt }) {
      const record = outbox.get(outboxId)
      requireOutboxLease(record, leaseToken)
      if (!record.receiptRef || !receipts.has(record.receiptRef)) throw new Error('verified_receipt_required')
      record.state = 'delivered'
      record.deliveredAt = deliveredAt
      record.retryAt = null
      record.leaseToken = null
      record.leaseExpiresAt = null
      record.version += 1
    },
    async recordPermanentFailure({ outboxId, leaseToken, failedAt, failureCode }) {
      const record = outbox.get(outboxId)
      requireOutboxLease(record, leaseToken)
      record.state = 'permanent-failure'
      record.failedAt = failedAt
      record.failureCode = requireFailureCode(failureCode)
      record.leaseToken = null
      record.leaseExpiresAt = null
      record.version += 1
    },
    async recordIndeterminate({ outboxId, leaseToken, failedAt, failureCode }) {
      const record = outbox.get(outboxId)
      requireOutboxLease(record, leaseToken)
      record.state = 'indeterminate'
      record.failedAt = failedAt
      record.failureCode = requireFailureCode(failureCode)
      record.leaseToken = null
      record.leaseExpiresAt = null
      record.version += 1
    },
    async recordMonitoringAlert(event) {
      if (!event || typeof event !== 'object' || Array.isArray(event) || Object.keys(event).some((key) => !MONITORING_KEYS.has(key))) {
        throw new TypeError('invalid_monitoring_event')
      }
      monitoring.push(copy(Object.fromEntries(Object.entries(event).filter(([key]) => MONITORING_KEYS.has(key)))))
    },
    operationalSnapshot(now = new Date().toISOString()) {
      const active = [...outbox.values()].filter((record) => ['pending', 'claimed', 'retry-scheduled'].includes(record.state))
      const nowMs = Date.parse(now)
      const oldest = active.reduce((value, record) => Math.min(value, Date.parse(record.enqueuedAt)), nowMs)
      return {
        backlogCount: active.length,
        oldestAgeSeconds: active.length === 0 ? 0 : Math.max(0, Math.floor((nowMs - oldest) / 1000)),
      }
    },
    snapshot() {
      return copy({
        proposals: [...proposals.values()],
        outbox: [...outbox.values()],
        attempts: [...attempts.values()],
        receipts: [...receipts.values()],
        monitoring,
      })
    },
  })
}
