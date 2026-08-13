import type * as LearnerSecurityModule from '../security/application/learnerSecurity'
import { createLocalSessionId, parseProfileId } from '../security/contracts'
import type { AppState } from '../types'

/** Route tests start after a test-owned, already-reviewed learner Session. */
export function createLearnerSecurityRouteMock(
  original: typeof LearnerSecurityModule,
): typeof LearnerSecurityModule {
  let persistedActiveProfileId: string | null = null

  const lockedLegacyMigrationInput = (state: AppState): AppState => {
    persistedActiveProfileId = state.activeProfileId
    return original.lockedLegacyMigrationInput(state)
  }

  const createBrowserLearnerSecurityApplication = (
    onLifecycleEvent: (event: {
      readonly type: string
      readonly occurredAt: string
    }) => void | Promise<unknown>,
  ) => {
    let access: Record<string, unknown> = { status: 'locked', reason: 'initial' }
    let liveSession: ReturnType<typeof recordFor> | null = null

    function recordFor(profileIdInput: string) {
      const profileId = parseProfileId(profileIdInput)
      if (!profileId) throw new Error('Test learner profile ID is invalid.')
      return Object.freeze({
        schemaVersion: 1 as const,
        sessionId: createLocalSessionId(
          () => '00000000-0000-4000-8000-000000000099',
        ),
        profileId,
        authenticatedAt: '2026-08-13T12:00:00.000Z',
        lastMeaningfulActivityAt: '2026-08-13T12:00:00.000Z',
        absoluteExpiresAt: '2026-08-13T13:00:00.000Z',
        globalRevocationEpoch: 0,
      })
    }

    const activeCheck = () =>
      liveSession
        ? ({ status: 'active' as const, session: liveSession })
        : ({ status: 'ended' as const, reason: 'none' as const })
    const session = {
      get session() { return liveSession },
      recheck: activeCheck,
      noteMeaningfulActivity: activeCheck,
      flushActivity: activeCheck,
    }

    const runtime = {
      ports: { session },
      get access() { return access },
      credentialStates: (profiles: Readonly<Record<string, unknown>>) =>
        Object.freeze(Object.fromEntries(
          Object.keys(profiles).map((profileId) => [profileId, 'enrolled']),
        )),
      async restore(profiles: Readonly<Record<string, unknown>>) {
        const profileId = persistedActiveProfileId
        const pathname = typeof window === 'undefined' ? '/' : window.location.pathname
        const profile = profileId
          ? profiles[profileId] as { readonly grade?: string } | undefined
          : undefined
        const routeAcceptsRestoredSession =
          pathname.startsWith('/academy') ||
          (pathname === '/study-engine' && import.meta.env.VITE_STUDY_ENGINE_ENABLED === 'true') ||
          (pathname === '/practice/grade-5-math' &&
            import.meta.env.VITE_GRADE5_MATH_PRACTICE_ENABLED === 'true' &&
            profile?.grade === '5')
        const forceLockedRestore =
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('test:learner-session-restore') === 'locked'
        if (
          profileId &&
          profile &&
          routeAcceptsRestoredSession &&
          !forceLockedRestore
        ) {
          liveSession = recordFor(profileId)
          access = {
            status: 'active',
            profileId: liveSession.profileId,
            sessionId: liveSession.sessionId,
          }
          return { status: 'active' as const, profileId: liveSession.profileId, session: liveSession }
        }
        liveSession = null
        access = { status: 'locked', reason: 'initial' }
        return { status: 'locked' as const, reason: 'none' }
      },
      async authenticate(profileIdInput: string) {
        liveSession = recordFor(profileIdInput)
        access = {
          status: 'active',
          profileId: liveSession.profileId,
          sessionId: liveSession.sessionId,
        }
        return { ok: true as const, profileId: liveSession.profileId, session: liveSession }
      },
      async end(
        event: Record<string, unknown>,
        requestLearnerPin: (profileId: string) => void | Promise<void> = () => undefined,
      ) {
        const occurredAt = String(event.occurredAt ?? '2026-08-13T12:00:00.000Z')
        const lifecycleType =
          event.type === 'logout'
            ? 'learner-sign-out'
            : event.type === 'lock'
              ? 'learner-lock'
              : event.type === 'learner-switch'
                ? 'learner-switch-start'
                : event.type === 'session-expired'
                  ? 'learner-session-expired'
                  : event.type === 'household-switch'
                    ? 'household-switch'
                    : String(event.source ?? 'provenance-loss')
        liveSession = null
        access = { status: 'locked', reason: String(event.type) }
        await onLifecycleEvent({ type: lifecycleType, occurredAt })
        if (event.type === 'learner-switch' && typeof event.targetProfileId === 'string') {
          await requestLearnerPin(event.targetProfileId)
        }
      },
      async resetCredential() {
        liveSession = null
        access = { status: 'locked', reason: 'authorization-loss' }
        await onLifecycleEvent({
          type: 'learner-credential-reset',
          occurredAt: '2026-08-13T12:00:00.000Z',
        })
      },
      observeAuthorityLoss(reason: string) {
        liveSession = null
        access = { status: 'locked', reason }
      },
      async close() {
        liveSession = null
      },
    }
    return runtime as unknown as LearnerSecurityModule.LearnerSecurityApplication
  }

  return {
    ...original,
    hasLegacyLearnerPinAuthority: () => false,
    lockedLegacyMigrationInput,
    createBrowserLearnerSecurityApplication:
      createBrowserLearnerSecurityApplication as typeof original.createBrowserLearnerSecurityApplication,
  }
}
