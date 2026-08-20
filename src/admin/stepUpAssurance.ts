export const ADMIN_STEP_UP_ASSURANCE_VERSION = 1 as const

/**
 * A provider MFA event may authorize one critical Admin operation for at most
 * this long. Token refresh or an ordinary login does not restart this window.
 */
export const ADMIN_STEP_UP_MAX_AGE_SECONDS = 5 * 60

export type AdminStepUpAuthenticationMethod =
  | 'totp'
  | 'mfa/totp'
  | 'mfa/phone'
  | 'mfa/webauthn'

/**
 * Sanitized evidence that the server derived from a provider-verified bearer.
 *
 * This interface is deliberately not a wire credential. Server consumers must
 * pass the concrete object to the issuing verifier's one-shot `consume` method;
 * shape-compatible browser data has no authority.
 */
export interface StepUpAssurance {
  readonly version: typeof ADMIN_STEP_UP_ASSURANCE_VERSION
  readonly kind: 'admin-step-up'
  readonly actorUserId: string
  readonly sessionId: string
  readonly authenticationMethod: AdminStepUpAuthenticationMethod
  readonly authenticatedAt: string
  readonly expiresAt: string
}

export type StepUpAssuranceCheck =
  | { readonly status: 'assured'; readonly assurance: StepUpAssurance }
  | { readonly status: 'required'; readonly reason: 'aal2_required' | 'fresh_authentication_required' }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'unavailable' }

export type StepUpAssuranceConsumption =
  | { readonly ok: true; readonly assurance: StepUpAssurance }
  | {
      readonly ok: false
      readonly reason: 'invalid' | 'expired' | 'actor_mismatch' | 'session_mismatch' | 'replayed'
    }
