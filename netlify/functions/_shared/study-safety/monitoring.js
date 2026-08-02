import { randomUUID } from 'node:crypto'

const SPECS = Object.freeze({
  'study_safety.classifier_unavailable': {
    severity: 'critical', metricName: 'study_safety_classifier_unavailable_total', runbookId: 'classifier-failure',
    codes: ['provider-not-configured', 'provider-network-failure', 'provider-http-failure'],
  },
  'study_safety.classifier_malformed_response': {
    severity: 'critical', metricName: 'study_safety_classifier_malformed_response_total', runbookId: 'classifier-failure',
    codes: ['provider-malformed-json', 'provider-malformed-classification'],
  },
  'study_safety.classification_urgent': {
    severity: 'critical', metricName: 'study_safety_classification_total', runbookId: 'urgent-classification',
    codes: ['urgent-classification'], fields: ['adultReviewState'],
  },
  'study_safety.classification_uncertain': {
    severity: 'warning', metricName: 'study_safety_classification_total', runbookId: 'uncertain-classification',
    codes: ['uncertain-classification'], fields: ['adultReviewState'],
  },
  'study_safety.outbox_backlog': {
    severity: 'warning', metricName: 'study_safety_outbox_pending_jobs', runbookId: 'outbox-backlog',
    codes: ['outbox-backlog'], fields: ['backlogCount', 'oldestAgeSeconds'],
  },
  'study_safety.delivery_repeated_failure': {
    severity: 'warning', metricName: 'study_safety_delivery_failure_total', runbookId: 'delivery-failure',
    codes: ['delivery-repeated-failure'], fields: ['attemptCount'],
  },
  'study_safety.proposal_duplicate': {
    severity: 'info', metricName: 'study_safety_duplicate_proposal_total', runbookId: 'duplicate-proposal',
    codes: ['duplicate-proposal-attempt'],
  },
  'study_safety.recipient_resolution_failure': {
    severity: 'warning', metricName: 'study_safety_recipient_resolution_failure_total', runbookId: 'recipient-resolution',
    codes: ['recipient-resolution-failure'],
  },
  'study_safety.request_unauthorized': {
    severity: 'warning', metricName: 'study_safety_request_unauthorized_total', runbookId: 'unauthorized-request',
    codes: ['request-unauthorized', 'learner-not-authorized'],
  },
  'study_safety.request_rate_limited': {
    severity: 'warning', metricName: 'study_safety_request_rate_limited_total', runbookId: 'rate-limit',
    codes: ['request-rate-limited'],
  },
  'study_safety.provider_timeout': {
    severity: 'warning', metricName: 'study_safety_provider_timeout_total', runbookId: 'classifier-failure',
    codes: ['provider-timeout'], fields: ['attemptCount'],
  },
  'study_safety.circuit_breaker_open': {
    severity: 'critical', metricName: 'study_safety_circuit_breaker_transition_total', runbookId: 'classifier-failure',
    codes: ['provider-circuit-open'],
  },
})

const ADULT_REVIEW_STATES = new Set(['recorded-not-delivered', 'duplicate-not-delivered', 'not-confirmed'])

function sanitizeAttributes(spec, fields) {
  const allowed = new Set(spec.fields ?? [])
  if (Object.keys(fields).some((key) => !allowed.has(key))) throw new TypeError('invalid_monitoring_attributes')
  const attributes = {}
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'adultReviewState') {
      if (!ADULT_REVIEW_STATES.has(value)) throw new TypeError('invalid_monitoring_adult_review_state')
    } else if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
      throw new TypeError('invalid_monitoring_number')
    }
    attributes[key] = value
  }
  return Object.freeze(attributes)
}

export function createMonitoringEvent(name, severity, code, fields = {}, overrides = {}) {
  const spec = SPECS[name]
  if (!spec || spec.severity !== severity || !spec.codes.includes(code)) throw new TypeError('invalid_monitoring_event_mapping')
  return Object.freeze({
    schemaVersion: 1,
    eventId: (overrides.idFactory ?? randomUUID)(),
    name,
    service: 'study-safety',
    severity: spec.severity,
    occurredAt: new Date((overrides.now ?? Date.now)()).toISOString(),
    code,
    metricName: spec.metricName,
    runbookId: spec.runbookId,
    attributes: sanitizeAttributes(spec, fields),
  })
}

export const NOOP_MONITORING_PORT = Object.freeze({
  isDurable: false,
  isReady: () => true,
  async record() {},
})
