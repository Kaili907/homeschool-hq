import type { ParentCredentialBindingReference } from '../contracts'
import {
  createBoundPinVerifier,
  createUnusableBoundPinVerifier,
  isFourDigitPin,
  type PinVerifierCrypto,
  type PinVerifierMaterial,
  verifyBoundPinVerifier,
} from './pinVerifier'

export const PARENT_PIN_VERIFIER_DOMAIN = 'manuel-academy:parent-pin:v1' as const

function parentPinVerifierSpec(binding: ParentCredentialBindingReference) {
  return {
    domain: PARENT_PIN_VERIFIER_DOMAIN,
    bindingParts: [binding.installationId, binding.householdId],
  } as const
}

export async function createParentPinVerifier(
  binding: ParentCredentialBindingReference,
  pin: string,
  cryptoProvider?: PinVerifierCrypto,
): Promise<PinVerifierMaterial> {
  if (!isFourDigitPin(pin)) {
    throw new Error('A Parent PIN must contain exactly four decimal digits.')
  }
  return createBoundPinVerifier(parentPinVerifierSpec(binding), pin, cryptoProvider)
}

export function createUnusableParentPinVerifier(
  binding: ParentCredentialBindingReference,
  cryptoProvider?: PinVerifierCrypto,
): Promise<PinVerifierMaterial> {
  return createUnusableBoundPinVerifier(parentPinVerifierSpec(binding), cryptoProvider)
}

export function verifyParentPinVerifier(
  binding: ParentCredentialBindingReference,
  pin: unknown,
  material: PinVerifierMaterial,
  cryptoProvider?: PinVerifierCrypto,
): Promise<boolean> {
  if (!isFourDigitPin(pin)) return Promise.resolve(false)
  return verifyBoundPinVerifier(parentPinVerifierSpec(binding), pin, material, cryptoProvider)
}
