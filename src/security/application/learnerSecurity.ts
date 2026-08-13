import type { AppState, Profile } from '../../types'
import { validateAppStateForSync } from '../../sync/provenance'
import {
  parseProfileId,
  type ProfileId,
  type SecurityLifecycleEvent,
  type LearnerSessionRecord,
} from '../contracts'
import {
  createBrowserFailedAttemptLedger,
  type FailedAttemptLedger,
  type FailedAttemptStatus,
} from '../attempts'
import {
  deleteLearnerCredential,
  enrollLearnerPin,
  readLearnerCredential,
  verifyLearnerPin,
  type StoredLearnerCredentialRecord,
} from '../credentials'
import {
  createBrowserGlobalRevocationCoordinator,
  createBrowserLearnerSessionController,
  executeLearnerAccessActions,
  INITIAL_LEARNER_ACCESS_STATE,
  transitionLearnerAccess,
  type GlobalRevocationPort,
  type LearnerAccessEvent,
  type LearnerAccessState,
  type LearnerSessionController,
} from '../session'

export type LearnerCredentialState =
  | 'unenrolled'
  | 'enrolled'
  | 'reset-required'

export type LearnerCredentialStateByProfileId = Readonly<
  Record<string, LearnerCredentialState>
>

export type LearnerAuthenticationResult =
  | Readonly<{
      ok: true
      profileId: ProfileId
      session: LearnerSessionRecord
    }>
  | Readonly<{ ok: false; error: string }>

export type LearnerRestoreResult =
  | Readonly<{
      status: 'active'
      profileId: ProfileId
      session: LearnerSessionRecord
    }>
  | Readonly<{ status: 'locked'; reason: string }>

export interface LearnerCredentialApplicationPort {
  read(profileId: ProfileId): StoredLearnerCredentialRecord | null
  verify(profileId: ProfileId, pin: string): Promise<boolean>
  enroll(
    profileId: ProfileId,
    pin: string,
  ): Promise<StoredLearnerCredentialRecord>
  delete(profileId: ProfileId): void
}

export interface LearnerSecurityApplicationPorts {
  readonly credentials: LearnerCredentialApplicationPort
  readonly attempts: Pick<
    FailedAttemptLedger,
    'status' | 'recordFailure' | 'recordSuccess'
  >
  readonly session: LearnerSessionController
  readonly revocation: GlobalRevocationPort
}

function requireProfileId(value: unknown): ProfileId {
  const profileId = parseProfileId(value)
  if (!profileId) throw new Error('Learner profile ID is invalid.')
  return profileId
}

function sameCredential(
  left: StoredLearnerCredentialRecord | null,
  right: StoredLearnerCredentialRecord | null,
): boolean {
  return left !== null && right !== null && JSON.stringify(left) === JSON.stringify(right)
}

function attemptError(status: FailedAttemptStatus): string | null {
  switch (status.status) {
    case 'ready':
      return null
    case 'cooldown':
      return `Please wait ${Math.max(1, Math.ceil(status.remainingMs / 1_000))} seconds before trying again.`
    case 'temporarily-locked':
      return `Too many tries. Ask a grown-up or wait ${Math.max(1, Math.ceil(status.remainingMs / 60_000))} minutes.`
    case 'ledger-invalid':
      return 'PIN attempts are unavailable. Ask a grown-up for help.'
  }
}

function wrongPinError(status: FailedAttemptStatus): string {
  return attemptError(status) ?? 'Oops — that is not it. Try again!'
}

function accessFromSession(
  session: LearnerSessionRecord,
): Extract<LearnerAccessState, { status: 'active' }> {
  return Object.freeze({
    status: 'active',
    profileId: session.profileId,
    sessionId: session.sessionId,
  })
}

/**
 * Application-only composition of the reviewed credential, attempt, Session,
 * ownership, revocation, and lifecycle APIs. React authority is intentionally
 * outside this class and may be published only after authenticate/restore
 * returns an active result.
 */
export class LearnerSecurityApplication {
  #access: LearnerAccessState = INITIAL_LEARNER_ACCESS_STATE
  #closed = false

  constructor(readonly ports: LearnerSecurityApplicationPorts) {}

  get access(): LearnerAccessState {
    return this.#access
  }

  credentialState(profileIdInput: unknown): LearnerCredentialState {
    const profileId = requireProfileId(profileIdInput)
    const credential = this.ports.credentials.read(profileId)
    return credential?.state ?? 'unenrolled'
  }

  credentialStates(
    profiles: Readonly<Record<string, Profile>>,
  ): LearnerCredentialStateByProfileId {
    const states: Record<string, LearnerCredentialState> = Object.create(null)
    for (const profile of Object.values(profiles)) {
      states[profile.id] = this.credentialState(profile.id)
    }
    return Object.freeze(states)
  }

  async restore(
    profiles: Readonly<Record<string, Profile>>,
  ): Promise<LearnerRestoreResult> {
    this.#requireOpen()
    const restored = await this.ports.session.restore()
    if (restored.status !== 'active') {
      this.#access = Object.freeze({ status: 'locked', reason: 'initial' })
      return Object.freeze({ status: 'locked', reason: restored.reason })
    }

    this.#access = accessFromSession(restored.session)
    const profile = profiles[restored.session.profileId]
    const credential = this.ports.credentials.read(restored.session.profileId)
    if (!profile || !credential || credential.state !== 'enrolled') {
      await this.end({
        type: 'authorization-loss',
        source: 'learner-credential-reset',
        occurredAt: new Date().toISOString(),
      })
      return Object.freeze({
        status: 'locked',
        reason: 'credential-unavailable',
      })
    }

    return Object.freeze({
      status: 'active',
      profileId: restored.session.profileId,
      session: restored.session,
    })
  }

  async authenticate(
    profileIdInput: unknown,
    pin: string,
    mode: 'verify' | 'enroll',
  ): Promise<LearnerAuthenticationResult> {
    this.#requireOpen()
    const profileId = requireProfileId(profileIdInput)
    const subject = Object.freeze({ kind: 'learner' as const, profileId })
    const status = await this.ports.attempts.status(subject)
    const blocked = attemptError(status)
    if (blocked) return Object.freeze({ ok: false, error: blocked })

    const before = this.ports.credentials.read(profileId)
    let authenticatedCredential: StoredLearnerCredentialRecord
    if (mode === 'enroll') {
      if (before !== null) {
        return Object.freeze({
          ok: false,
          error: 'A learner PIN already exists. Return to the learner chooser.',
        })
      }
      authenticatedCredential = await this.ports.credentials.enroll(profileId, pin)
    } else {
      if (!before || before.state !== 'enrolled') {
        return Object.freeze({
          ok: false,
          error: 'This learner needs a grown-up to reset or create a PIN.',
        })
      }
      if (!(await this.ports.credentials.verify(profileId, pin))) {
        const failure = await this.ports.attempts.recordFailure(subject)
        return Object.freeze({ ok: false, error: wrongPinError(failure) })
      }
      authenticatedCredential = before
    }

    await this.ports.attempts.recordSuccess(subject)
    const revalidated = this.ports.credentials.read(profileId)
    if (
      !sameCredential(authenticatedCredential, revalidated) ||
      revalidated?.state !== 'enrolled'
    ) {
      return Object.freeze({
        ok: false,
        error: 'Learner credential changed during sign-in. Please start again.',
      })
    }

    let session: LearnerSessionRecord
    try {
      session = await this.ports.session.create(profileId)
    } catch {
      return Object.freeze({
        ok: false,
        error: 'A secure learner session could not be started. Please try again.',
      })
    }

    const afterSession = this.ports.credentials.read(profileId)
    if (!sameCredential(revalidated, afterSession) || afterSession?.state !== 'enrolled') {
      this.#access = accessFromSession(session)
      await this.end({
        type: 'authorization-loss',
        source: 'learner-credential-reset',
        occurredAt: new Date().toISOString(),
      })
      return Object.freeze({
        ok: false,
        error: 'Learner credential changed during sign-in. Please start again.',
      })
    }

    this.#access = accessFromSession(session)
    return Object.freeze({ ok: true, profileId, session })
  }

  async end(
    event: Exclude<LearnerAccessEvent, { type: 'authenticated' }>,
    requestLearnerPin: (profileId: ProfileId) => void | Promise<void> = () => undefined,
  ): Promise<void> {
    this.#requireOpen()
    const live = this.ports.session.session
    if (this.#access.status !== 'active' && live) {
      this.#access = accessFromSession(live)
    }
    const transition = transitionLearnerAccess(this.#access, event)
    this.#access = transition.state
    await executeLearnerAccessActions(transition.actions, {
      learnerSession: {
        clearLocal: this.ports.session.clearLocal.bind(this.ports.session),
        deliverLifecycle: this.ports.session.deliverLifecycle.bind(this.ports.session),
      },
      revocation: this.ports.revocation,
      requestLearnerPin,
    })
  }

  observeAuthorityLoss(reason: Extract<LearnerAccessState, { status: 'locked' }>['reason']): void {
    this.#access = Object.freeze({ status: 'locked', reason })
  }

  async resetCredential(profileIdInput: unknown): Promise<void> {
    const profileId = requireProfileId(profileIdInput)
    await this.end({
      type: 'authorization-loss',
      source: 'learner-credential-reset',
      occurredAt: new Date().toISOString(),
    })
    this.ports.credentials.delete(profileId)
    if (this.ports.credentials.read(profileId) !== null) {
      throw new Error('Learner credential reset could not be verified.')
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return
    this.#closed = true
    await this.ports.session.close()
    this.ports.revocation.close()
  }

  #requireOpen(): void {
    if (this.#closed) throw new Error('Learner security application is closed.')
  }
}

export function createBrowserLearnerSecurityApplication(
  onLifecycleEvent: (event: SecurityLifecycleEvent) => void | Promise<unknown>,
): LearnerSecurityApplication {
  const revocation = createBrowserGlobalRevocationCoordinator()
  const session = createBrowserLearnerSessionController({
    revocation,
    onLifecycleEvent,
  })
  const attempts = createBrowserFailedAttemptLedger()
  return new LearnerSecurityApplication({
    credentials: {
      read: (profileId) => readLearnerCredential(profileId),
      verify: (profileId, pin) => verifyLearnerPin(profileId, pin),
      enroll: (profileId, pin) => enrollLearnerPin(profileId, pin),
      delete: (profileId) => deleteLearnerCredential(profileId),
    },
    attempts,
    session,
    revocation,
  })
}

export function hasLegacyLearnerPinAuthority(state: AppState): boolean {
  return Object.values(state.profiles).some((profile) => profile.pin !== '')
}

/** Keeps legacy PINs private for migration while removing persisted UI authority. */
export function lockedLegacyMigrationInput(state: AppState): AppState {
  return { ...state, activeProfileId: null }
}

/**
 * Restores the compatibility-only blank field required by the current local
 * schema. A real PIN is never accepted by this adapter.
 */
export function appStateWithLearnerPinSentinels(
  value: unknown,
  parkedParentPin?: string,
): AppState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Credential-free educational state is malformed.')
  }
  const candidate = value as Record<string, unknown>
  if (!candidate.profiles || typeof candidate.profiles !== 'object' || Array.isArray(candidate.profiles)) {
    throw new Error('Credential-free educational profiles are malformed.')
  }
  const profiles: Record<string, unknown> = Object.create(null)
  for (const [profileId, profile] of Object.entries(candidate.profiles as Record<string, unknown>)) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new Error(`Credential-free learner ${profileId} is malformed.`)
    }
    profiles[profileId] = { ...(profile as Record<string, unknown>), pin: '' }
  }
  const validation = validateAppStateForSync({
    ...candidate,
    ...(parkedParentPin === undefined ? {} : { parentPin: parkedParentPin }),
    profiles,
    activeProfileId: null,
  })
  if (!validation.ok) throw new Error(validation.error)
  return validation.state
}
