import {
  ADULT_REVIEW_DELIVERY_ROUTES,
  ADULT_REVIEW_DELIVERY_SCHEMA_VERSION,
  DELIVERY_ATTEMPT_STATES,
  type DeliveryAttemptRecordV1,
  type DeliveryContractValidationResult,
  type ExpectedReceiptBindingV1,
  type ProviderReceiptClaimV1,
} from './types'

const ATTEMPT_FIELDS = [
  'schemaVersion', 'attemptId', 'jobId', 'route', 'provider', 'providerConfigVersion',
  'startedAt', 'completedAt', 'state', 'timeoutState', 'providerReceiptRef',
  'retryDecision', 'errorCode', 'idempotencyKey',
] as const

const RECEIPT_BINDING_FIELDS = [
  'schemaVersion', 'provider', 'route', 'jobId', 'attemptId', 'idempotencyKey',
  'recipientRef', 'householdRef', 'learnerRef', 'providerConfigVersion',
  'acceptedAt', 'deliveredAt',
] as const

const RECEIPT_CLAIM_FIELDS = [...RECEIPT_BINDING_FIELDS, 'providerReceiptRef'] as const

const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,199}$/
const PROVIDER_CODE = /^[a-z][a-z0-9-]{0,63}$/
const STRUCTURED_CODE = /^[a-z][a-z0-9._-]{0,95}$/
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

type ExactObject = Record<string, unknown>
type InvalidResult = Exclude<DeliveryContractValidationResult<never>, { valid: true }>

function invalid(code: InvalidResult['code'], field?: string): InvalidResult {
  return field === undefined ? { valid: false, code } : { valid: false, code, field }
}

function exactObject(value: unknown, fields: readonly string[]): DeliveryContractValidationResult<ExactObject> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    return invalid('not-an-exact-object')
  }
  const keys = Object.keys(value)
  if (keys.length !== fields.length || keys.some((key) => !fields.includes(key))) {
    return invalid('unexpected-fields')
  }
  return { valid: true, value: value as ExactObject }
}

function isOpaqueRef(value: unknown): value is string {
  return typeof value === 'string' && OPAQUE_REF.test(value)
}

function isNullableOpaqueRef(value: unknown): value is string | null {
  return value === null || isOpaqueRef(value)
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === 'string' && UTC_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function isNullableUtcTimestamp(value: unknown): value is string | null {
  return value === null || isUtcTimestamp(value)
}

function validateReceiptFields(object: ExactObject): DeliveryContractValidationResult<ExpectedReceiptBindingV1> {
  const validators: Readonly<Record<keyof ExpectedReceiptBindingV1, (value: unknown) => boolean>> = {
    schemaVersion: (value) => value === ADULT_REVIEW_DELIVERY_SCHEMA_VERSION,
    provider: (value) => typeof value === 'string' && PROVIDER_CODE.test(value),
    route: (value) => ADULT_REVIEW_DELIVERY_ROUTES.some((route) => route === value),
    jobId: isOpaqueRef,
    attemptId: isOpaqueRef,
    idempotencyKey: isOpaqueRef,
    recipientRef: isOpaqueRef,
    householdRef: isOpaqueRef,
    learnerRef: isOpaqueRef,
    providerConfigVersion: isOpaqueRef,
    acceptedAt: isNullableUtcTimestamp,
    deliveredAt: isNullableUtcTimestamp,
  }
  for (const field of RECEIPT_BINDING_FIELDS) {
    if (!validators[field](object[field])) {
      return invalid(field === 'schemaVersion' ? 'invalid-schema-version' : 'invalid-field', field)
    }
  }
  if (object.acceptedAt === null && object.deliveredAt === null) {
    return invalid('missing-receipt-timestamp')
  }
  return { valid: true, value: object as unknown as ExpectedReceiptBindingV1 }
}

function hasCoherentAttemptState(attempt: DeliveryAttemptRecordV1): boolean {
  const open = attempt.state === 'created' || attempt.state === 'submitted'
  if ((open && attempt.completedAt !== null) || (!open && attempt.completedAt === null)) return false
  if (open) {
    return attempt.timeoutState === 'not-timed-out' && attempt.providerReceiptRef === null &&
      attempt.retryDecision === 'none' && attempt.errorCode === null
  }
  if (attempt.state === 'provider-accepted') {
    return attempt.retryDecision === 'none' && attempt.errorCode === null
  }
  if (attempt.state === 'provider-rejected') {
    return attempt.providerReceiptRef === null &&
      (attempt.retryDecision === 'retry' || attempt.retryDecision === 'stop') && attempt.errorCode !== null
  }
  if (attempt.state === 'timeout-indeterminate') {
    return attempt.timeoutState === 'indeterminate' && attempt.providerReceiptRef === null &&
      attempt.retryDecision === 'reconcile' && attempt.errorCode !== null
  }
  if (attempt.state === 'receipt-verified') {
    return attempt.providerReceiptRef !== null && attempt.retryDecision === 'none' && attempt.errorCode === null
  }
  if (attempt.state === 'receipt-rejected') {
    return attempt.providerReceiptRef !== null &&
      (attempt.retryDecision === 'reconcile' || attempt.retryDecision === 'stop') && attempt.errorCode !== null
  }
  return attempt.retryDecision === 'stop' && attempt.errorCode !== null
}

export function validateDeliveryAttemptRecordV1(
  value: unknown,
): DeliveryContractValidationResult<DeliveryAttemptRecordV1> {
  const exact = exactObject(value, ATTEMPT_FIELDS)
  if (!exact.valid) return exact
  const object = exact.value
  const fieldsValid = object.schemaVersion === ADULT_REVIEW_DELIVERY_SCHEMA_VERSION &&
    isOpaqueRef(object.attemptId) && isOpaqueRef(object.jobId) &&
    ADULT_REVIEW_DELIVERY_ROUTES.some((route) => route === object.route) &&
    typeof object.provider === 'string' && PROVIDER_CODE.test(object.provider) &&
    isOpaqueRef(object.providerConfigVersion) && isUtcTimestamp(object.startedAt) &&
    isNullableUtcTimestamp(object.completedAt) &&
    DELIVERY_ATTEMPT_STATES.some((state) => state === object.state) &&
    (object.timeoutState === 'not-timed-out' || object.timeoutState === 'indeterminate') &&
    isNullableOpaqueRef(object.providerReceiptRef) &&
    ['none', 'retry', 'reconcile', 'stop'].includes(object.retryDecision as string) &&
    (object.errorCode === null ||
      (typeof object.errorCode === 'string' && STRUCTURED_CODE.test(object.errorCode))) &&
    isOpaqueRef(object.idempotencyKey)
  if (!fieldsValid) {
    if (object.schemaVersion !== ADULT_REVIEW_DELIVERY_SCHEMA_VERSION) {
      return invalid('invalid-schema-version', 'schemaVersion')
    }
    return invalid('invalid-field')
  }
  const attempt = object as unknown as DeliveryAttemptRecordV1
  return hasCoherentAttemptState(attempt)
    ? { valid: true, value: attempt }
    : invalid('incoherent-attempt-state')
}

export function validateExpectedReceiptBindingV1(
  value: unknown,
): DeliveryContractValidationResult<ExpectedReceiptBindingV1> {
  const exact = exactObject(value, RECEIPT_BINDING_FIELDS)
  return exact.valid ? validateReceiptFields(exact.value) : exact
}

export function validateProviderReceiptClaimV1(
  value: unknown,
): DeliveryContractValidationResult<ProviderReceiptClaimV1> {
  const exact = exactObject(value, RECEIPT_CLAIM_FIELDS)
  if (!exact.valid) return exact
  const binding = validateReceiptFields(exact.value)
  if (!binding.valid) return binding
  if (!isOpaqueRef(exact.value.providerReceiptRef)) {
    return invalid('invalid-field', 'providerReceiptRef')
  }
  return { valid: true, value: exact.value as unknown as ProviderReceiptClaimV1 }
}
