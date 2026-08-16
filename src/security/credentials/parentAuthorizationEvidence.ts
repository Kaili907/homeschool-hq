import type { ParentCredentialBindingReference } from '../contracts'
import { base64ToBytes, bytesToBase64, LEARNER_PIN_DERIVED_KEY_BYTES } from './pinVerifier'
import {
  ParentCredentialVaultError,
  type ParentCredentialOperationOptions,
} from './parentVault'

export const PARENT_CREDENTIAL_AUTHORIZATION_EVIDENCE_SCHEMA_VERSION = 1 as const

export type ParentCredentialAuthorizationOperation =
  | 'parent-pin:reset-required'
  | 'parent-pin:recover'

export interface ParentCredentialAuthorizationEvidenceInput {
  readonly evidenceId: string
  readonly keyId: string
  readonly operationId: ParentCredentialAuthorizationOperation
  readonly binding: ParentCredentialBindingReference
  readonly priorGeneration: number
  readonly issuedAt: string
  readonly expiresAt: string
  /** Random issuer nonce. It must never be derived from a PIN or verifier. */
  readonly nonceBase64: string
}

export interface ParentCredentialAuthorizationEvidenceRecord
  extends ParentCredentialAuthorizationEvidenceInput {
  readonly schemaVersion: typeof PARENT_CREDENTIAL_AUTHORIZATION_EVIDENCE_SCHEMA_VERSION
  readonly status: 'authorized' | 'consumed'
  readonly consumedAt: string | null
  /** Exact proposed credential-record commitment durably bound at consumption. */
  readonly consumptionCommitmentBase64: string | null
  readonly signatureBase64: string
}

export interface ParentCredentialAuthorizationEvidenceReference {
  readonly evidenceId: string
}

/**
 * This authority must be durable and rollback-resistant. It may be backed by
 * the same server-side authority as Parent credential generations, but never
 * by device-local credential storage.
 */
export interface ParentCredentialAuthorizationEvidenceAuthority {
  read(evidenceId: string): string | null | Promise<string | null>
  compareAndSwap(
    evidenceId: string,
    expectedSerialized: string,
    replacementSerialized: string,
  ): boolean | Promise<boolean>
  readVerificationKey(keyId: string): CryptoKey | null | Promise<CryptoKey | null>
}

const INPUT_KEYS = Object.freeze([
  'evidenceId',
  'keyId',
  'operationId',
  'binding',
  'priorGeneration',
  'issuedAt',
  'expiresAt',
  'nonceBase64',
] as const)

const RECORD_KEYS = Object.freeze([
  'schemaVersion',
  ...INPUT_KEYS,
  'status',
  'consumedAt',
  'consumptionCommitmentBase64',
  'signatureBase64',
] as const)

const BINDING_KEYS = Object.freeze([
  'schemaVersion',
  'installationId',
  'householdId',
] as const)

function authorizationFailure(message: string): never {
  throw new ParentCredentialVaultError('authorization-required', message)
}

function evidenceUnavailable(message: string): never {
  throw new ParentCredentialVaultError('authorization-evidence-unavailable', message)
}

function exactIsoTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string') authorizationFailure(`${field} must be an ISO timestamp.`)
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    authorizationFailure(`${field} must be an exact ISO timestamp.`)
  }
  return value
}

function exactDataFields(
  value: unknown,
  keys: readonly string[],
  label: string,
): ReadonlyMap<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    authorizationFailure(`${label} must be a plain object.`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    authorizationFailure(`${label} must be a plain object.`)
  }
  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
  ) {
    authorizationFailure(`${label} contains missing or unexpected fields.`)
  }
  const fields = new Map<string, unknown>()
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      authorizationFailure(`${label} field ${key} is missing or unsafe.`)
    }
    fields.set(key, descriptor.value)
  }
  return fields
}

function nonEmptyBoundedString(value: unknown, field: string, maximum = 512): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    authorizationFailure(`${field} is invalid.`)
  }
  return value
}

function parseBinding(value: unknown): ParentCredentialBindingReference {
  const fields = exactDataFields(value, BINDING_KEYS, 'Authorization evidence binding')
  const schemaVersion = fields.get('schemaVersion')
  const installationId = nonEmptyBoundedString(
    fields.get('installationId'),
    'Authorization evidence installation ID',
  )
  const householdId = nonEmptyBoundedString(
    fields.get('householdId'),
    'Authorization evidence household ID',
    1_024,
  )
  if (schemaVersion !== 1) authorizationFailure('Authorization evidence binding version is unsupported.')
  return Object.freeze({ schemaVersion, installationId, householdId }) as ParentCredentialBindingReference
}

function parseInput(value: unknown): ParentCredentialAuthorizationEvidenceInput {
  const fields = exactDataFields(value, INPUT_KEYS, 'Authorization evidence input')
  const operationId = fields.get('operationId')
  if (operationId !== 'parent-pin:reset-required' && operationId !== 'parent-pin:recover') {
    authorizationFailure('Authorization evidence operation is unsupported.')
  }
  const priorGeneration = fields.get('priorGeneration')
  if (!Number.isSafeInteger(priorGeneration) || Number(priorGeneration) < 0) {
    authorizationFailure('Authorization evidence generation is invalid.')
  }
  const issuedAt = exactIsoTimestamp(fields.get('issuedAt'), 'Authorization evidence issuedAt')
  const expiresAt = exactIsoTimestamp(fields.get('expiresAt'), 'Authorization evidence expiresAt')
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) {
    authorizationFailure('Authorization evidence expiry must follow issuance.')
  }
  const nonceBase64 = nonEmptyBoundedString(
    fields.get('nonceBase64'),
    'Authorization evidence nonce',
  )
  try {
    base64ToBytes(nonceBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
  } catch {
    authorizationFailure('Authorization evidence nonce is malformed.')
  }
  return Object.freeze({
    evidenceId: nonEmptyBoundedString(fields.get('evidenceId'), 'Authorization evidence ID'),
    keyId: nonEmptyBoundedString(fields.get('keyId'), 'Authorization evidence key ID'),
    operationId,
    binding: parseBinding(fields.get('binding')),
    priorGeneration: Number(priorGeneration),
    issuedAt,
    expiresAt,
    nonceBase64,
  })
}

function canonicalInput(input: ParentCredentialAuthorizationEvidenceInput): string {
  return JSON.stringify({
    evidenceId: input.evidenceId,
    keyId: input.keyId,
    operationId: input.operationId,
    binding: {
      schemaVersion: input.binding.schemaVersion,
      installationId: input.binding.installationId,
      householdId: input.binding.householdId,
    },
    priorGeneration: input.priorGeneration,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    nonceBase64: input.nonceBase64,
  })
}

export function parentCredentialAuthorizationEvidenceSigningBytes(
  input: ParentCredentialAuthorizationEvidenceInput,
): Uint8Array {
  return new TextEncoder().encode(canonicalInput(parseInput(input)))
}

export function serializeAuthorizedParentCredentialEvidence(
  input: ParentCredentialAuthorizationEvidenceInput,
  signature: Uint8Array,
): string {
  const parsed = parseInput(input)
  if (signature.byteLength !== 64) authorizationFailure('Authorization evidence signature is malformed.')
  return JSON.stringify({
    schemaVersion: PARENT_CREDENTIAL_AUTHORIZATION_EVIDENCE_SCHEMA_VERSION,
    ...parsed,
    status: 'authorized',
    consumedAt: null,
    consumptionCommitmentBase64: null,
    signatureBase64: bytesToBase64(signature),
  } satisfies ParentCredentialAuthorizationEvidenceRecord)
}

function parseRecord(serialized: unknown): ParentCredentialAuthorizationEvidenceRecord {
  if (typeof serialized !== 'string' || serialized.length === 0 || serialized.length > 16_384) {
    authorizationFailure('Durable authorization evidence is missing or oversized.')
  }
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    authorizationFailure('Durable authorization evidence is malformed.')
  }
  const fields = exactDataFields(value, RECORD_KEYS, 'Durable authorization evidence')
  if (fields.get('schemaVersion') !== PARENT_CREDENTIAL_AUTHORIZATION_EVIDENCE_SCHEMA_VERSION) {
    authorizationFailure('Durable authorization evidence version is unsupported.')
  }
  const input = parseInput(Object.fromEntries(INPUT_KEYS.map((key) => [key, fields.get(key)])))
  const status = fields.get('status')
  const consumedAt = fields.get('consumedAt')
  const consumptionCommitmentBase64 = fields.get('consumptionCommitmentBase64')
  if (
    (status !== 'authorized' && status !== 'consumed') ||
    (status === 'authorized' && (consumedAt !== null || consumptionCommitmentBase64 !== null)) ||
    (status === 'consumed' &&
      (typeof consumedAt !== 'string' || typeof consumptionCommitmentBase64 !== 'string'))
  ) {
    authorizationFailure('Durable authorization evidence state is invalid.')
  }
  if (typeof consumedAt === 'string') exactIsoTimestamp(consumedAt, 'Authorization evidence consumedAt')
  if (typeof consumptionCommitmentBase64 === 'string') {
    try {
      base64ToBytes(consumptionCommitmentBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
    } catch {
      authorizationFailure('Authorization evidence consumption commitment is malformed.')
    }
  }
  const signatureBase64 = nonEmptyBoundedString(
    fields.get('signatureBase64'),
    'Authorization evidence signature',
  )
  try {
    base64ToBytes(signatureBase64, 64)
  } catch {
    authorizationFailure('Authorization evidence signature is malformed.')
  }
  const record = Object.freeze({
    schemaVersion: PARENT_CREDENTIAL_AUTHORIZATION_EVIDENCE_SCHEMA_VERSION,
    ...input,
    status,
    consumedAt: consumedAt as string | null,
    consumptionCommitmentBase64: consumptionCommitmentBase64 as string | null,
    signatureBase64,
  })
  if (JSON.stringify(record) !== serialized) {
    authorizationFailure('Durable authorization evidence is not canonically encoded.')
  }
  return record
}

function bindingMatches(
  left: ParentCredentialBindingReference,
  right: ParentCredentialBindingReference,
): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.installationId === right.installationId &&
    left.householdId === right.householdId
}

function exactReference(value: unknown): ParentCredentialAuthorizationEvidenceReference {
  const fields = exactDataFields(value, ['evidenceId'], 'Authorization evidence reference')
  return Object.freeze({
    evidenceId: nonEmptyBoundedString(fields.get('evidenceId'), 'Authorization evidence ID'),
  })
}

async function readEvidenceKey(
  authority: ParentCredentialAuthorizationEvidenceAuthority,
  keyId: string,
): Promise<CryptoKey> {
  let key: CryptoKey | null
  try {
    key = await authority.readVerificationKey(keyId)
  } catch {
    evidenceUnavailable('Authorization evidence verification key could not be read.')
  }
  const algorithm = key?.algorithm as EcKeyAlgorithm | undefined
  if (
    !key ||
    key.type !== 'public' ||
    algorithm?.name !== 'ECDSA' ||
    algorithm.namedCurve !== 'P-256' ||
    !key.usages.includes('verify')
  ) {
    authorizationFailure('Authorization evidence verification key is not trusted.')
  }
  return key
}

export async function consumeParentCredentialAuthorizationEvidence(
  reference: ParentCredentialAuthorizationEvidenceReference,
  operationId: ParentCredentialAuthorizationOperation,
  binding: ParentCredentialBindingReference,
  priorGeneration: number,
  proposedRecordCommitmentBase64: string,
  options: ParentCredentialOperationOptions,
): Promise<void> {
  const parsedReference = exactReference(reference)
  const authority = options.authorizationEvidenceAuthority
  if (
    !authority ||
    typeof authority.read !== 'function' ||
    typeof authority.compareAndSwap !== 'function' ||
    typeof authority.readVerificationKey !== 'function'
  ) {
    evidenceUnavailable('Durable authenticated Parent authorization evidence is required.')
  }
  try {
    base64ToBytes(proposedRecordCommitmentBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
  } catch {
    throw new ParentCredentialVaultError(
      'persistence-verification-failed',
      'Proposed Parent credential commitment is malformed.',
    )
  }

  let serialized: string | null
  try {
    serialized = await authority.read(parsedReference.evidenceId)
  } catch {
    evidenceUnavailable('Durable authorization evidence could not be read.')
  }
  const evidence = parseRecord(serialized)
  if (
    evidence.status !== 'authorized' ||
    evidence.evidenceId !== parsedReference.evidenceId ||
    evidence.operationId !== operationId ||
    !bindingMatches(evidence.binding, binding) ||
    evidence.priorGeneration !== priorGeneration
  ) {
    authorizationFailure('Authorization evidence is consumed, stale, or bound to another operation.')
  }
  const now = (options.now ?? (() => new Date()))()
  const nowIso = now.toISOString()
  if (Date.parse(nowIso) < Date.parse(evidence.issuedAt) || Date.parse(nowIso) >= Date.parse(evidence.expiresAt)) {
    authorizationFailure('Authorization evidence is not currently valid.')
  }
  const subtle = options.crypto?.subtle ?? globalThis.crypto?.subtle
  if (!subtle) evidenceUnavailable('Web Crypto is required for authorization evidence verification.')
  const key = await readEvidenceKey(authority, evidence.keyId)
  const signature = base64ToBytes(evidence.signatureBase64, 64)
  let verified = false
  try {
    verified = await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      signature,
      parentCredentialAuthorizationEvidenceSigningBytes({
        evidenceId: evidence.evidenceId,
        keyId: evidence.keyId,
        operationId: evidence.operationId,
        binding: evidence.binding,
        priorGeneration: evidence.priorGeneration,
        issuedAt: evidence.issuedAt,
        expiresAt: evidence.expiresAt,
        nonceBase64: evidence.nonceBase64,
      }),
    )
  } catch {
    authorizationFailure('Authorization evidence signature verification failed.')
  }
  if (!verified) authorizationFailure('Authorization evidence signature verification failed.')

  const consumed = Object.freeze({
    ...evidence,
    status: 'consumed' as const,
    consumedAt: nowIso,
    consumptionCommitmentBase64: proposedRecordCommitmentBase64,
  })
  const replacementSerialized = JSON.stringify(consumed)
  let changed: boolean
  try {
    changed = await authority.compareAndSwap(
      evidence.evidenceId,
      serialized as string,
      replacementSerialized,
    )
  } catch {
    evidenceUnavailable('Authorization evidence could not be consumed durably.')
  }
  if (changed !== true) authorizationFailure('Authorization evidence was already consumed or changed.')
  let readBack: string | null
  try {
    readBack = await authority.read(evidence.evidenceId)
  } catch {
    evidenceUnavailable('Consumed authorization evidence could not be read back.')
  }
  if (readBack !== replacementSerialized) {
    throw new ParentCredentialVaultError(
      'persistence-verification-failed',
      'Authorization evidence failed exact durable consumption read-back.',
    )
  }
}
