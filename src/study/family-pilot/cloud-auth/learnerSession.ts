import type {
  FamilyCloudAuthRuntime,
  FamilyLearnerSessionState,
  FamilyLocalLearnerAccessPort,
} from './types'

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

/** Household auth chooses the tenant; the local PIN chooses one learner inside it. */
export class FamilyLearnerSession {
  readonly #household: FamilyCloudAuthRuntime
  readonly #access: FamilyLocalLearnerAccessPort
  #learnerRef: string | null = null

  constructor(household: FamilyCloudAuthRuntime, access: FamilyLocalLearnerAccessPort) {
    this.#household = household
    this.#access = access
  }

  snapshot(): FamilyLearnerSessionState {
    const household = this.#household.snapshot()
    const householdRef = household.status === 'READY' || household.status === 'OFFLINE_LOCAL'
      ? household.householdRef : null
    return this.#learnerRef && householdRef
      ? Object.freeze({ status: 'ACTIVE', householdRef, learnerRef: this.#learnerRef })
      : Object.freeze({ status: 'LOCKED', householdRef, learnerRef: null })
  }

  learners() {
    const household = this.#household.snapshot()
    if (household.status !== 'READY' && household.status !== 'OFFLINE_LOCAL') return Object.freeze([])
    return this.#access.list(household.householdRef)
  }

  authenticate(learnerRef: string, pin: string): boolean {
    const household = this.#household.snapshot()
    if (
      (household.status !== 'READY' && household.status !== 'OFFLINE_LOCAL') ||
      !REF.test(learnerRef)
    ) return false
    const profile = this.#access.list(household.householdRef)
      .find((item) => item.learnerRef === learnerRef)
    if (!profile) return false
    if (profile.pinRequired && !/^\d{4}$/.test(pin)) return false
    if (profile.pinRequired && !this.#access.verifyPin(household.householdRef, learnerRef, pin)) return false
    this.#learnerRef = learnerRef
    return true
  }

  dashboard(): Readonly<Record<string, unknown>> | null {
    const current = this.snapshot()
    if (current.status !== 'ACTIVE') return null
    return this.#access.dashboard(current.householdRef, current.learnerRef)
  }

  lock(): void { this.#learnerRef = null }
  switchLearner(): void { this.#learnerRef = null }

  async signOut(): Promise<void> {
    this.#learnerRef = null
    await this.#household.signOut()
  }
}

