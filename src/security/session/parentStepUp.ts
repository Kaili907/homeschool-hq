import { SECURITY_SESSION_POLICY } from '../contracts/sessionPolicy'
import {
  createLocalSessionId,
  isParentStepUpGrantPolicyCompliant,
  PARENT_STEP_UP_SCHEMA_VERSION,
  type ParentStepUpGrant,
} from '../contracts/sessions'
import type { ParentSessionController } from './parentSession'
import { requireSafeTimestamp, type SecurityClock, systemSecurityClock } from './runtime'

export interface ParentStepUpControllerOptions {
  readonly parentSession: ParentSessionController
  readonly clock?: SecurityClock
  readonly randomUUID?: () => string
}

/** A memory-only, purpose-bound grant that can authorize exactly one operation. */
export class ParentStepUpController {
  readonly #parentSession: ParentSessionController
  readonly #clock: SecurityClock
  readonly #randomUUID?: () => string
  readonly #unsubscribeParentEnd: () => void
  #grant: ParentStepUpGrant | null = null
  #lastObservedAt: number | null = null

  constructor(options: ParentStepUpControllerOptions) {
    this.#parentSession = options.parentSession
    this.#clock = options.clock ?? systemSecurityClock
    this.#randomUUID = options.randomUUID
    this.#unsubscribeParentEnd = this.#parentSession.subscribeEnded(() => this.revoke())
  }

  issue(operationId: string): ParentStepUpGrant {
    if (!operationId || operationId.trim() !== operationId) throw new Error('Step-up operation ID is required.')
    const parent = this.#parentSession.recheck()
    if (parent.status !== 'active') throw new Error('An active Parent session is required for step-up.')
    const now = requireSafeTimestamp(this.#clock)
    this.#grant = Object.freeze({
      schemaVersion: PARENT_STEP_UP_SCHEMA_VERSION,
      storage: SECURITY_SESSION_POLICY.parentStepUp.storage,
      grantId: createLocalSessionId(this.#randomUUID),
      parentSessionId: parent.session.sessionId,
      operationId,
      operationUseLimit: SECURITY_SESSION_POLICY.parentStepUp.operationUseLimit,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SECURITY_SESSION_POLICY.parentStepUp.maximumLifetimeMs).toISOString(),
    })
    this.#lastObservedAt = now
    return this.#grant
  }

  consume(operationId: string): boolean {
    if (!this.#grant || !operationId) return false
    const parent = this.#parentSession.recheck()
    if (parent.status !== 'active' || parent.session.sessionId !== this.#grant.parentSessionId) {
      this.revoke()
      return false
    }
    let now: number
    try {
      now = requireSafeTimestamp(this.#clock)
    } catch {
      this.revoke()
      return false
    }
    const issuedAt = Date.parse(this.#grant.issuedAt)
    const expiresAt = Date.parse(this.#grant.expiresAt)
    if (
      !isParentStepUpGrantPolicyCompliant(this.#grant) ||
      now < issuedAt ||
      (this.#lastObservedAt !== null && now < this.#lastObservedAt) ||
      now >= expiresAt
    ) {
      this.revoke()
      return false
    }
    this.#lastObservedAt = now
    if (this.#grant.operationId !== operationId) return false
    this.revoke()
    return true
  }

  revoke(): void {
    this.#grant = null
    this.#lastObservedAt = null
  }

  close(): void {
    this.revoke()
    this.#unsubscribeParentEnd()
  }

  get grant(): ParentStepUpGrant | null {
    return this.#grant
  }
}
