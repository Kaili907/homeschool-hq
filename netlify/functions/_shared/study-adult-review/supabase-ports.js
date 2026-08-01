/**
 * Server-only durable Study safety/adult-review ports. Every method delegates
 * to a service-role-only reconciliation RPC; no private table is exposed via
 * PostgREST and no learner text or notification destination is accepted.
 */

function serviceConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || '').trim()
  const serviceKey = (env?.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !serviceKey) return null
    return { url: url.toString().replace(/\/+$/, ''), serviceKey }
  } catch {
    return null
  }
}

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('durable_port_contract')
  const actual = Object.keys(value)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error('durable_port_contract')
  }
  return value
}

function array(value) {
  if (!Array.isArray(value)) throw new Error('durable_port_contract')
  return value
}

const PROPOSAL_KEYS = [
  'schemaVersion', 'proposalId', 'householdId', 'studentId', 'sessionId', 'category', 'classification',
  'urgency', 'reasonCodes', 'classifierVersion', 'occurredAt', 'idempotencyKey', 'deliveryState',
  'authorizedRecipientResolutionState',
]

export function createSupabaseServiceRpc(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 3_000
  const config = serviceConfig(env)

  return Object.freeze({
    isConfigured: () => config !== null && typeof fetchImpl === 'function',
    async call(name, parameters = {}) {
      if (!config || typeof fetchImpl !== 'function') throw new Error('durable_port_not_configured')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response
      try {
        response = await fetchImpl(`${config.url}/rest/v1/rpc/${name}`, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            apikey: config.serviceKey,
            Authorization: `Bearer ${config.serviceKey}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(parameters),
        })
      } catch {
        throw new Error('durable_port_unavailable')
      } finally {
        clearTimeout(timer)
      }
      if (!response.ok) throw new Error('durable_port_unavailable')
      try {
        return await response.json()
      } catch {
        throw new Error('durable_port_contract')
      }
    },
  })
}

export function createSupabaseStudySafetyPorts(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)
  let schemaReady = false
  const ready = () => schemaReady && rpc.isConfigured?.() === true
  const durable = { isDurable: true, isReady: ready }

  async function refreshReadiness() {
    try {
      const result = exactObject(
        await rpc.call('academy_study_safety_durable_readiness_v1'),
        ['status', 'schemaVersion'],
      )
      schemaReady = result.status === 'ready' && result.schemaVersion === 1
    } catch {
      schemaReady = false
    }
    return schemaReady
  }

  const store = Object.freeze({
    ...durable,
    async createProposal({ proposal }) {
      const minimizedProposal = exactObject(proposal, PROPOSAL_KEYS)
      const result = await rpc.call('academy_study_create_adult_review_proposal_v1', { p_proposal: minimizedProposal })
      if (result?.created === true && Object.keys(result).length === 1) return { created: true }
      const duplicate = exactObject(result, result?.conflict === true
        ? ['created', 'duplicateProposalId', 'conflict']
        : ['created', 'duplicateProposalId'])
      if (duplicate.created !== false || typeof duplicate.duplicateProposalId !== 'string') throw new Error('durable_port_contract')
      return duplicate
    },
    async claimUnresolvedProposals({ now, limit, leaseMs }) {
      return array(await rpc.call('academy_study_claim_adult_review_proposals_v1', {
        p_now: now,
        p_limit: limit,
        p_lease_seconds: Math.max(1, Math.ceil(leaseMs / 1000)),
      }))
    },
    async recordRecipientResolutionAndEnqueue(input) {
      const result = exactObject(
        await rpc.call('academy_study_record_recipient_resolution_v1', { p_resolution: { ...input, state: 'resolved' } }),
        ['jobs'],
      )
      return array(result.jobs)
    },
    async recordRecipientResolutionFailure(input) {
      const result = exactObject(
        await rpc.call('academy_study_record_recipient_resolution_v1', { p_resolution: input }),
        ['jobs'],
      )
      if (array(result.jobs).length !== 0) throw new Error('durable_port_contract')
    },
    async claim({ now, limit, leaseMs }) {
      return array(await rpc.call('academy_study_claim_delivery_jobs_v1', {
        p_now: now,
        p_limit: limit,
        p_lease_seconds: Math.max(1, Math.ceil(leaseMs / 1000)),
      }))
    },
    async recordAttempt(input) {
      const result = exactObject(
        await rpc.call('academy_study_record_delivery_attempt_v1', { p_attempt: input }),
        ['attemptCount'],
      )
      if (!Number.isSafeInteger(result.attemptCount) || result.attemptCount < 1) throw new Error('durable_port_contract')
      return result
    },
    async recordDeliveryReceipt(input) {
      const result = exactObject(
        await rpc.call('academy_study_record_delivery_receipt_v1', { p_receipt: input }),
        ['recorded'],
      )
      if (result.recorded !== true) throw new Error('durable_port_contract')
    },
    async recordDelivered(input) {
      return recordOutcome({ ...input, state: 'delivered' })
    },
    async recordTemporaryFailure(input) {
      return recordOutcome({ ...input, state: 'retry-scheduled' })
    },
    async recordPermanentFailure(input) {
      return recordOutcome({ ...input, state: 'permanent-failure' })
    },
    async recordIndeterminate(input) {
      return recordOutcome({ ...input, state: 'indeterminate' })
    },
  })

  async function recordOutcome(input) {
    const outcome = {
      outboxId: input.outboxId,
      leaseToken: input.leaseToken,
      state: input.state,
      attemptId: input.attemptId ?? null,
      occurredAt: input.deliveredAt ?? input.failedAt,
      retryAt: input.retryAt ?? null,
      failureCode: input.failureCode ?? null,
    }
    const result = exactObject(
      await rpc.call('academy_study_record_delivery_outcome_v1', { p_outcome: outcome }),
      ['recorded'],
    )
    if (result.recorded !== true) throw new Error('durable_port_contract')
  }

  const recipientResolver = Object.freeze({
    ...durable,
    async resolve({ proposalRef }) {
      return rpc.call('academy_study_resolve_adult_recipients_v1', { p_proposal_id: proposalRef })
    },
    async reauthorizeForDelivery(input) {
      return rpc.call('academy_study_reauthorize_adult_route_v1', { p_input: input })
    },
  })

  const rateLimiter = Object.freeze({
    ...durable,
    async reserve(input) {
      const result = await rpc.call('academy_study_reserve_safety_rate_limit_v1', { p_reservation: input })
      if (result?.allowed === true && Object.keys(result).length === 1) return result
      const denied = exactObject(result, ['allowed', 'retryAfterSeconds'])
      if (denied.allowed !== false || !Number.isSafeInteger(denied.retryAfterSeconds) || denied.retryAfterSeconds < 1) {
        throw new Error('durable_port_contract')
      }
      return denied
    },
  })

  const monitoring = Object.freeze({
    ...durable,
    async record(event) {
      const result = exactObject(
        await rpc.call('academy_study_record_safety_monitoring_event_v1', { p_event: event }),
        ['recorded'],
      )
      if (result.recorded !== true) throw new Error('durable_port_contract')
    },
  })

  return Object.freeze({
    refreshReadiness,
    proposalPersistence: store,
    outbox: store,
    recipientResolver,
    rateLimiter,
    monitoring,
  })
}
