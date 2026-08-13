import type { LearnerPinCostParameters, ProfileId } from '../contracts'

export const LEARNER_PIN_COST_PARAMETERS_VERSION = 1 as const
export const LEARNER_PIN_SALT_BYTES = 16 as const
export const LEARNER_PIN_DERIVED_KEY_BYTES = 32 as const
export const LEARNER_PIN_VERIFIER_DOMAIN = 'manuel-academy:learner-pin:v2' as const

/**
 * Version 1 is intentionally immutable. A future work-factor change must add a
 * new cost-parameter version so existing records remain reproducible.
 */
export const LEARNER_PIN_COST_PARAMETERS_V1: Readonly<LearnerPinCostParameters> = Object.freeze({
  iterations: 600_000,
  derivedKeyBytes: LEARNER_PIN_DERIVED_KEY_BYTES,
})

export interface PinVerifierMaterial {
  readonly costParametersVersion: typeof LEARNER_PIN_COST_PARAMETERS_VERSION
  readonly costParameters: LearnerPinCostParameters
  readonly saltBase64: string
  readonly verifierBase64: string
}

export interface PinVerifierCrypto {
  readonly subtle: SubtleCrypto
  getRandomValues<T extends ArrayBufferView | null>(array: T): T
}

const FOUR_DIGIT_PIN = /^\d{4}$/
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export function isFourDigitPin(value: unknown): value is string {
  return typeof value === 'string' && FOUR_DIGIT_PIN.test(value)
}

function requireCrypto(cryptoProvider?: PinVerifierCrypto): PinVerifierCrypto {
  const candidate = cryptoProvider ?? globalThis.crypto
  if (!candidate || typeof candidate.getRandomValues !== 'function' || !candidate.subtle) {
    throw new Error('Web Crypto is required for learner credential operations.')
  }
  return candidate
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64ToBytes(value: string, expectedBytes: number): Uint8Array {
  if (!BASE64.test(value)) throw new Error('Credential material is not valid base64.')
  let binary: string
  try {
    binary = atob(value)
  } catch {
    throw new Error('Credential material is not valid base64.')
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytes.byteLength !== expectedBytes || bytesToBase64(bytes) !== value) {
    throw new Error('Credential material has an invalid encoded length.')
  }
  return bytes
}

export function isSupportedPinCostParameters(version: unknown, value: unknown): value is LearnerPinCostParameters {
  if (
    version !== LEARNER_PIN_COST_PARAMETERS_VERSION ||
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    Object.keys(candidate).length === 2 &&
    candidate.iterations === LEARNER_PIN_COST_PARAMETERS_V1.iterations &&
    candidate.derivedKeyBytes === LEARNER_PIN_COST_PARAMETERS_V1.derivedKeyBytes
  )
}

function framedProfileBoundSecret(profileId: ProfileId, secret: string): Uint8Array {
  const encoder = new TextEncoder()
  const parts = [encoder.encode(LEARNER_PIN_VERIFIER_DOMAIN), encoder.encode(profileId), encoder.encode(secret)]
  const framed = new Uint8Array(parts.reduce((total, part) => total + 4 + part.byteLength, 0))
  const view = new DataView(framed.buffer)
  let offset = 0
  for (const part of parts) {
    view.setUint32(offset, part.byteLength, false)
    offset += 4
    framed.set(part, offset)
    offset += part.byteLength
  }
  return framed
}

async function deriveVerifier(
  profileId: ProfileId,
  secret: string,
  salt: Uint8Array,
  cryptoProvider: PinVerifierCrypto,
): Promise<Uint8Array> {
  const key = await cryptoProvider.subtle.importKey(
    'raw',
    framedProfileBoundSecret(profileId, secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await cryptoProvider.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: LEARNER_PIN_COST_PARAMETERS_V1.iterations,
    },
    key,
    LEARNER_PIN_COST_PARAMETERS_V1.derivedKeyBytes * 8,
  )
  return new Uint8Array(bits)
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  let difference = 0
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

async function createVerifierForSecret(
  profileId: ProfileId,
  secret: string,
  cryptoProvider?: PinVerifierCrypto,
): Promise<PinVerifierMaterial> {
  const crypto = requireCrypto(cryptoProvider)
  const salt = crypto.getRandomValues(new Uint8Array(LEARNER_PIN_SALT_BYTES))
  const verifier = await deriveVerifier(profileId, secret, salt, crypto)
  return {
    costParametersVersion: LEARNER_PIN_COST_PARAMETERS_VERSION,
    costParameters: { ...LEARNER_PIN_COST_PARAMETERS_V1 },
    saltBase64: bytesToBase64(salt),
    verifierBase64: bytesToBase64(verifier),
  }
}

export async function createPinVerifier(
  profileId: ProfileId,
  pin: string,
  cryptoProvider?: PinVerifierCrypto,
): Promise<PinVerifierMaterial> {
  if (!isFourDigitPin(pin)) {
    throw new Error('A learner PIN must contain exactly four decimal digits.')
  }
  return createVerifierForSecret(profileId, pin, cryptoProvider)
}

/**
 * Creates verifier-shaped material whose random secret is discarded. It is
 * used only for reset-required tombstones; reset state always rejects PINs.
 */
export async function createUnusablePinVerifier(
  profileId: ProfileId,
  cryptoProvider?: PinVerifierCrypto,
): Promise<PinVerifierMaterial> {
  const crypto = requireCrypto(cryptoProvider)
  const discardedSecret = bytesToBase64(crypto.getRandomValues(new Uint8Array(LEARNER_PIN_DERIVED_KEY_BYTES)))
  return createVerifierForSecret(profileId, discardedSecret, crypto)
}

export async function verifyPinVerifier(
  profileId: ProfileId,
  pin: unknown,
  material: PinVerifierMaterial,
  cryptoProvider?: PinVerifierCrypto,
): Promise<boolean> {
  if (!isFourDigitPin(pin)) return false
  if (!isSupportedPinCostParameters(material.costParametersVersion, material.costParameters)) {
    return false
  }
  try {
    const crypto = requireCrypto(cryptoProvider)
    const salt = base64ToBytes(material.saltBase64, LEARNER_PIN_SALT_BYTES)
    const expected = base64ToBytes(material.verifierBase64, LEARNER_PIN_DERIVED_KEY_BYTES)
    const actual = await deriveVerifier(profileId, pin, salt, crypto)
    return constantTimeEqual(actual, expected)
  } catch {
    return false
  }
}
