const CONTRACT_VERSION = 'study-external-delivery-contract-v1'
const TEMPLATE_CODE = 'study-safety-adult-review-v1'
// The durable estate builds this key as `'delivery:' || study_sha256_json(...)`.
const DELIVERY_KEY = /^delivery:[a-f0-9]{64}$/
const ATTEMPT_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
// Only permissions whose `recipient_ref` matches `^recipient:[0-9a-f]{64}$` are
// ever disclosed by the durable recipient resolution, so no other form can
// reach a delivery job.
const RECIPIENT_REF = /^recipient:[a-f0-9]{64}$/
const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const CONFIG_KEYS = new Set([
  'channel',
  'providerId',
  'providerVersion',
  'configurationVersion',
  'isDurable',
  'isTestProvider',
  'supportsDurableIdempotency',
  'deliver',
  'verifyReceipt',
  'reconcileStatus',
  'timeoutMs',
  'deploymentMode',
])
const REQUIRED_CONFIG_KEYS = [
  'channel',
  'providerId',
  'providerVersion',
  'configurationVersion',
  'isDurable',
  'isTestProvider',
  'supportsDurableIdempotency',
  'deliver',
  'verifyReceipt',
]
const DELIVERY_KEYS = new Set([
  'idempotencyKey', 'attemptId', 'recipientRef', 'routeRef', 'templateCode',
])
const RECONCILIATION_KEYS = new Set([
  'idempotencyKey', 'attemptId', 'recipientRef', 'routeRef', 'providerAcceptanceRef',
])
const RECEIPT_KEYS = new Set([
  'deliveryIdempotencyKey', 'recipientRef', 'routeRef', 'providerReceiptRef',
])
const TIMEOUT = Symbol('provider-timeout')

/**
 * No email or SMS vendor/configuration is approved in this repository. These
 * decisions intentionally contain no vendor names, credentials, or routes.
 */
export const EXTERNAL_PROVIDER_GOVERNANCE = Object.freeze({
  email: Object.freeze({
    status: 'not-ready',
    reasonCode: 'approved-provider-and-configuration-required',
  }),
  sms: Object.freeze({
    status: 'not-ready',
    reasonCode: 'approved-provider-and-configuration-required',
  }),
})

export const EXTERNAL_DELIVERY_CONTRACT_VERSION = CONTRACT_VERSION

function exactObject(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(code)
  const actual = Object.keys(value)
  if (actual.length !== keys.size || actual.some((key) => !keys.has(key))) throw new TypeError(code)
}

function exactConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('invalid_external_provider_config')
  const actual = Object.keys(value)
  if (
    actual.some((key) => !CONFIG_KEYS.has(key)) ||
    REQUIRED_CONFIG_KEYS.some((key) => !Object.hasOwn(value, key))
  ) throw new TypeError('invalid_external_provider_config')
}

function validChannel(channel) {
  return channel === 'email' || channel === 'sms'
}

function routePattern(channel) {
  return new RegExp(`^${channel}-route:[A-Za-z0-9._/-]{1,96}$`)
}

function assertServerRuntime() {
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    throw new Error('external_delivery_adapter_server_only')
  }
}

function productionRuntime(deploymentMode) {
  return deploymentMode === 'production' || process.env.NODE_ENV === 'production'
}

function assertProductionComposition(isTestProvider, deploymentMode) {
  if (isTestProvider === true && productionRuntime(deploymentMode)) {
    throw new Error('test_external_provider_forbidden_in_production')
  }
}

// `RegExp#test` coerces its argument, so the string guard is what stops a
// hostile carrier object from presenting an identifier it does not hold.
function matches(pattern, value) {
  return typeof value === 'string' && pattern.test(value)
}

function validIdentity(value) {
  return matches(OPAQUE_REF, value)
}

function validateDeliveryInput(value, channel) {
  exactObject(value, DELIVERY_KEYS, 'invalid_external_delivery_input')
  if (
    !matches(DELIVERY_KEY, value.idempotencyKey) ||
    !matches(ATTEMPT_REF, value.attemptId) ||
    !matches(RECIPIENT_REF, value.recipientRef) ||
    !matches(routePattern(channel), value.routeRef) ||
    value.templateCode !== TEMPLATE_CODE
  ) throw new TypeError('invalid_external_delivery_input')
  return Object.freeze({ ...value })
}

function validateReconciliationInput(value, channel) {
  exactObject(value, RECONCILIATION_KEYS, 'invalid_external_reconciliation_input')
  if (
    !matches(DELIVERY_KEY, value.idempotencyKey) ||
    !matches(ATTEMPT_REF, value.attemptId) ||
    !matches(RECIPIENT_REF, value.recipientRef) ||
    !matches(routePattern(channel), value.routeRef) ||
    !validIdentity(value.providerAcceptanceRef)
  ) throw new TypeError('invalid_external_reconciliation_input')
  return Object.freeze({ ...value })
}

function validateReceiptInput(value, channel) {
  exactObject(value, RECEIPT_KEYS, 'invalid_external_receipt_input')
  if (
    !matches(DELIVERY_KEY, value.deliveryIdempotencyKey) ||
    !matches(RECIPIENT_REF, value.recipientRef) ||
    !matches(routePattern(channel), value.routeRef) ||
    !validIdentity(value.providerReceiptRef)
  ) throw new TypeError('invalid_external_receipt_input')
  return Object.freeze({ ...value })
}

function frozen(value) {
  return Object.freeze(value)
}

async function withinTimeout(invoke, timeoutMs) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), timeoutMs)
  })
  try {
    return await Promise.race([Promise.resolve().then(invoke), timeout])
  } finally {
    clearTimeout(timer)
  }
}

function normalizeDelivery(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value.state === 'delivered') {
    if (Object.keys(value).length !== 2 || !validIdentity(value.providerReceiptRef)) return null
    return frozen({ state: 'delivered', providerReceiptRef: value.providerReceiptRef })
  }
  if (value.state === 'accepted-awaiting-receipt') {
    if (Object.keys(value).length !== 2 || !validIdentity(value.providerAcceptanceRef)) return null
    return frozen({ state: 'accepted-awaiting-receipt', providerAcceptanceRef: value.providerAcceptanceRef })
  }
  if (value.state === 'temporary-failure' && Object.keys(value).length === 1) {
    return frozen({ state: 'temporary-failure', failureCode: 'provider-temporary-failure' })
  }
  if (value.state === 'permanent-failure' && Object.keys(value).length === 1) {
    return frozen({ state: 'permanent-failure', failureCode: 'provider-permanent-failure' })
  }
  if (value.state === 'indeterminate' && Object.keys(value).length === 1) {
    return frozen({ state: 'indeterminate', failureCode: 'provider-indeterminate' })
  }
  return null
}

function normalizeReconciliation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value.state === 'delivered') {
    if (Object.keys(value).length !== 2 || !validIdentity(value.providerReceiptRef)) return null
    return frozen({ state: 'delivered', providerReceiptRef: value.providerReceiptRef })
  }
  if (value.state === 'pending') {
    if (Object.keys(value).length !== 2 || !validIdentity(value.providerAcceptanceRef)) return null
    return frozen({ state: 'pending', providerAcceptanceRef: value.providerAcceptanceRef })
  }
  if (value.state === 'not-delivered' && Object.keys(value).length === 1) {
    return frozen({ state: 'not-delivered' })
  }
  if (value.state === 'indeterminate' && Object.keys(value).length === 1) {
    return frozen({ state: 'indeterminate', failureCode: 'provider-status-indeterminate' })
  }
  return null
}

function normalizeReceipt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return frozen({ verified: false })
  if (value.verified === false && Object.keys(value).length === 1) return frozen({ verified: false })
  if (
    value.verified === true &&
    Object.keys(value).length === 3 &&
    matches(ATTEMPT_REF, value.attemptId) &&
    validIdentity(value.evidenceRef)
  ) {
    return frozen({ verified: true, attemptId: value.attemptId, evidenceRef: value.evidenceRef })
  }
  return frozen({ verified: false })
}

function notReadyResult() {
  return frozen({ state: 'indeterminate', failureCode: 'provider-not-ready' })
}

/**
 * Fail-closed route placeholder used until provider governance and a versioned
 * configuration have been approved. It is deliberately network-incapable.
 */
export function createNotReadyExternalProvider(channel) {
  if (!validChannel(channel)) throw new TypeError('unsupported_external_delivery_channel')
  const governance = EXTERNAL_PROVIDER_GOVERNANCE[channel]
  const verifyReceipt = async (input) => {
    assertServerRuntime()
    validateReceiptInput(input, channel)
    return frozen({ verified: false })
  }
  return frozen({
    contractVersion: CONTRACT_VERSION,
    channel,
    providerId: 'external-provider:not-configured',
    providerVersion: 'not-configured',
    configurationVersion: 'not-configured',
    isDurable: false,
    isTestProvider: false,
    supportsDurableIdempotency: false,
    supportsStatusReconciliation: false,
    governance,
    isReady: () => false,
    async deliver(input) {
      assertServerRuntime()
      validateDeliveryInput(input, channel)
      return notReadyResult()
    },
    async reconcileStatus(input) {
      assertServerRuntime()
      validateReconciliationInput(input, channel)
      return frozen({ state: 'indeterminate', failureCode: 'provider-status-reconciliation-unsupported' })
    },
    verifyReceipt,
    receiptVerifier: frozen({
      contractVersion: CONTRACT_VERSION,
      channel,
      providerId: 'external-provider:not-configured',
      providerVersion: 'not-configured',
      configurationVersion: 'not-configured',
      isDurable: false,
      isTestProvider: false,
      isReady: () => false,
      verifyReceipt,
    }),
  })
}

export const DEFAULT_EXTERNAL_EMAIL_PROVIDER = createNotReadyExternalProvider('email')
export const DEFAULT_EXTERNAL_SMS_PROVIDER = createNotReadyExternalProvider('sms')

/**
 * Wrap an approved, server-owned provider implementation. The implementation
 * receives only opaque references and the fixed template code; provider
 * credentials and recipient contact resolution remain inside its closure.
 *
 * Provider implementation outputs are intentionally exact:
 * - deliver: {state:'delivered', providerReceiptRef},
 *   {state:'accepted-awaiting-receipt', providerAcceptanceRef}, or a one-field
 *   state object for temporary-failure, permanent-failure, or indeterminate.
 * - reconcileStatus (optional): delivered, pending, not-delivered, or
 *   indeterminate in the exact shapes normalized below.
 * - verifyReceipt: {verified:false} or
 *   {verified:true, attemptId, evidenceRef}.
 */
export function createExternalProviderAdapter(config) {
  assertServerRuntime()
  exactConfig(config)
  if (
    !validChannel(config.channel) ||
    !validIdentity(config.providerId) ||
    !validIdentity(config.providerVersion) ||
    !validIdentity(config.configurationVersion) ||
    typeof config.isTestProvider !== 'boolean' ||
    config.isDurable !== true ||
    config.supportsDurableIdempotency !== true ||
    typeof config.deliver !== 'function' ||
    typeof config.verifyReceipt !== 'function' ||
    (config.reconcileStatus !== undefined && typeof config.reconcileStatus !== 'function') ||
    (config.deploymentMode !== undefined && !['production', 'non-production'].includes(config.deploymentMode))
  ) throw new TypeError('invalid_external_provider_config')

  const timeoutMs = config.timeoutMs ?? 5_000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new TypeError('invalid_external_provider_timeout')
  }
  assertProductionComposition(config.isTestProvider, config.deploymentMode)

  const unresolved = new Set()
  const ensureCallable = () => {
    assertServerRuntime()
    assertProductionComposition(config.isTestProvider, config.deploymentMode)
  }

  async function deliver(untrusted) {
    ensureCallable()
    const input = validateDeliveryInput(untrusted, config.channel)
    if (unresolved.has(input.idempotencyKey)) {
      return frozen({ state: 'indeterminate', failureCode: 'provider-reconciliation-required' })
    }

    let raw
    try {
      raw = await withinTimeout(() => config.deliver(input), timeoutMs)
    } catch {
      unresolved.add(input.idempotencyKey)
      return frozen({ state: 'indeterminate', failureCode: 'provider-response-lost' })
    }
    if (raw === TIMEOUT) {
      unresolved.add(input.idempotencyKey)
      return frozen({ state: 'indeterminate', failureCode: 'provider-timeout' })
    }

    const result = normalizeDelivery(raw)
    if (!result) {
      unresolved.add(input.idempotencyKey)
      return frozen({ state: 'indeterminate', failureCode: 'provider-malformed-response' })
    }
    if (result.state === 'accepted-awaiting-receipt' || result.state === 'indeterminate') {
      unresolved.add(input.idempotencyKey)
    }
    return result
  }

  async function reconcileStatus(untrusted) {
    ensureCallable()
    const input = validateReconciliationInput(untrusted, config.channel)
    if (!config.reconcileStatus) {
      unresolved.add(input.idempotencyKey)
      return frozen({ state: 'indeterminate', failureCode: 'provider-status-reconciliation-unsupported' })
    }

    let raw
    try {
      raw = await withinTimeout(() => config.reconcileStatus(input), timeoutMs)
    } catch {
      unresolved.add(input.idempotencyKey)
      return frozen({ state: 'indeterminate', failureCode: 'provider-status-unavailable' })
    }
    if (raw === TIMEOUT) {
      unresolved.add(input.idempotencyKey)
      return frozen({ state: 'indeterminate', failureCode: 'provider-status-timeout' })
    }

    const result = normalizeReconciliation(raw)
    if (!result) {
      unresolved.add(input.idempotencyKey)
      return frozen({ state: 'indeterminate', failureCode: 'provider-status-malformed' })
    }
    if (result.state === 'delivered' || result.state === 'not-delivered') unresolved.delete(input.idempotencyKey)
    else unresolved.add(input.idempotencyKey)
    return result
  }

  async function verifyReceipt(untrusted) {
    ensureCallable()
    const input = validateReceiptInput(untrusted, config.channel)
    try {
      const raw = await withinTimeout(() => config.verifyReceipt(input), timeoutMs)
      return raw === TIMEOUT ? frozen({ verified: false }) : normalizeReceipt(raw)
    } catch {
      return frozen({ verified: false })
    }
  }

  const identity = {
    contractVersion: CONTRACT_VERSION,
    channel: config.channel,
    providerId: config.providerId,
    providerVersion: config.providerVersion,
    configurationVersion: config.configurationVersion,
    isDurable: true,
    isTestProvider: config.isTestProvider,
  }
  const receiptVerifier = frozen({
    ...identity,
    isReady: () => true,
    verifyReceipt,
  })

  return frozen({
    ...identity,
    supportsDurableIdempotency: true,
    supportsStatusReconciliation: typeof config.reconcileStatus === 'function',
    isReady: () => true,
    deliver,
    reconcileStatus,
    verifyReceipt,
    receiptVerifier,
  })
}
