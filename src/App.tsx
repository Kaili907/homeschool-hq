import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { SKILL_BY_ID, type SkillId } from './skills'
import type { AnswerRecord, AppState, Profile } from './types'
import { generateFresh } from './generators'
import {
  downloadJson,
  finishSession,
  isoToday,
  loadAppState,
  patchProfile,
  readLocalStorageKey,
  recordAnswer,
  saveAppState,
  type AppStatePersistenceFailure,
} from './appState'
import {
  PLACEMENT_TOTAL,
  PRACTICE_TOTAL,
  applyPlacement,
  buildPracticePlan,
  placementDifficulty,
  placementOrder,
  summarizePlacement,
  type PlacementSkillResult,
  type PlanItem,
} from './engine'
import { autoCompletePractice, autoCompleteTyping, ensureToday, isDayComplete, setItemDone } from './missions'
import { recordAttendance } from './attendance/attendance'
import { getVoicePrefs, isMuted, logWalkthrough, setMuted } from './tutor/tutorState'
import { purgeVoiceCache } from './tutor/voice'
import {
  awardMissionEvents,
  awardPracticeSession,
  awardTutorRetry,
  getStars,
  getStarsConfig,
  requestRedemption,
  starsEnabled,
} from './stars/stars'
import { StarWallet } from './components/StarWallet'
import { PrizeShop } from './components/PrizeShop'
import { THEMES, ThemeContext, useTheme } from './theme'
import { MissionCard } from './components/MissionCard'
import { QuizSession } from './components/QuizSession'
import { HighSchoolHome } from './components/HighSchoolHome'
import { SkillTree } from './components/SkillTree'
import { Picker } from './components/Picker'
import { PinPad } from './components/PinPad'
import { GrownUps } from './components/GrownUps'
import { ParentHub } from './components/hub/ParentHub'
import { useSync } from './sync/useSync'
import { Confetti } from './components/Confetti'
import { AssessmentRunner } from './components/assessment/AssessmentRunner'
import { assignedOpenTests } from './components/assessment/homeCards'
import { TypingTrainer } from './components/typing/TypingTrainer'
import { recordDrill } from './typing/typingState'
import type { DrillResult } from './typing/engine'
import ReadingView from './components/reading/ReadingView'
import { MindsetLesson } from './components/mindset/MindsetLesson'
import { MindsetCard } from './components/mindset/MindsetCard'
import { isStudyEngineEnabledFromHost, isStudyEnginePreviewEnabledFromHost } from './study/featureFlag'
import { isStudyEnginePath, leaveStudyEnginePath } from './studyEngineRoute'
import { enabledAcademyGradeFromHost } from './academy/featureFlag'
import {
  leaveAcademyPath,
  parseAcademyPath,
  syncAcademyPath,
  type AcademyRoute,
} from './academy/academyRoute'
import {
  buildHostStudyContext,
  deriveStudyHouseholdRef,
  deriveStudyLearnerRef,
  localDevelopmentHouseholdTimeZone,
} from './study/hostContext'
import type { StudyAdultAuthorization } from './study/types'
import type { StudyPortBundle } from './study/ports'
import { getGatewayAccessToken } from './tutor/gatewayAuth'
import { createStudyIdentityClient } from './study/client/studyIdentityClient'
import { createStudyProductionReadinessClient } from './study/client/studyProductionReadinessClient'
import {
  createVerifiedStudyRuntimeAdapter,
  type VerifiedStudyRuntimeAdapter,
} from './study/production/verifiedRuntimeAdapter'
import { StudyLifecycleBoundary } from './study/lifecycle'

const loadPreviewPorts = import.meta.env.DEV
  ? () => import('./study/localDevelopmentPorts').then(({ createLocalDevelopmentStudyPorts }) => createLocalDevelopmentStudyPorts())
  : null
const StudyDashboard = import.meta.env.DEV
  ? lazy(() => import('./components/study/StudyDashboard').then((module) => ({ default: module.StudyDashboard })))
  : null
const StudySessionRoute = import.meta.env.DEV
  ? lazy(() => import('./components/study/StudySessionRoute').then((module) => ({ default: module.StudySessionRoute })))
  : null
const StudySettings = import.meta.env.DEV
  ? lazy(() => import('./components/study/StudySettings').then((module) => ({ default: module.StudySettings })))
  : null

// CURR-1: the Grade 5/7/8 curriculum surface. Lazy — the chunk (and the
// curriculum content it fetches) loads only when an enabled academy grade opens
// it, never on initial application load.
const AcademyRouter = lazy(() =>
  import('./components/academy/AcademyRouter').then((module) => ({ default: module.AcademyRouter })),
)

type Screen =
  | { kind: 'picker' }
  | { kind: 'kidPin'; profileId: string }
  | { kind: 'kidPinCreate'; profileId: string; firstEntry?: string }
  | { kind: 'home' }
  | { kind: 'placement'; order: SkillId[] }
  | { kind: 'placementResults'; results: PlacementSkillResult[] }
  | { kind: 'practice'; plan: PlanItem[] }
  | { kind: 'practiceResults'; history: AnswerRecord[] }
  | { kind: 'parentPin' }
  | { kind: 'parentPinCreate'; firstEntry?: string }
  | { kind: 'grownups' }
  | { kind: 'parentHub' }
  | { kind: 'assessment'; testId: string }
  | { kind: 'prizeShop' }
  | { kind: 'typing' }
  | { kind: 'reading' }
  | { kind: 'mindset' }
  | { kind: 'studyDashboard' }
  | { kind: 'studySettings' }
  | { kind: 'studySession'; blockRef: string; learnerRef: string }
  | { kind: 'academy'; route: AcademyRoute }

export default function App() {
  const loaded = useMemo(loadAppState, [])
  const studyEnabled = useMemo(isStudyEngineEnabledFromHost, [])
  const studyPreviewEnabled = useMemo(isStudyEnginePreviewEnabledFromHost, [])
  const [studyRuntime, setStudyRuntime] = useState<{ readonly ports: StudyPortBundle } | null>(null)
  const [studyProductionStatus, setStudyProductionStatus] = useState<
    'disabled' | 'unauthenticated' | 'checking' | 'not-ready' | 'degraded' | 'ready'
  >(studyEnabled && !studyPreviewEnabled ? 'unauthenticated' : 'disabled')
  const studyProductionLifecycleRef = useRef<StudyLifecycleBoundary | null>(null)
  const studyReadinessClientRef = useRef<ReturnType<typeof createStudyProductionReadinessClient> | null>(null)
  const studyIdentityClientRef = useRef<ReturnType<typeof createStudyIdentityClient> | null>(null)
  const studyVerifiedRuntimeRef = useRef<VerifiedStudyRuntimeAdapter | null>(null)
  const studySelectedProfileRef = useRef<string | null>(null)
  if (!studyProductionLifecycleRef.current) {
    studyProductionLifecycleRef.current = new StudyLifecycleBoundary()
  }
  if (!studyIdentityClientRef.current) {
    studyIdentityClientRef.current = createStudyIdentityClient()
  }
  if (!studyVerifiedRuntimeRef.current) {
    studyVerifiedRuntimeRef.current = createVerifiedStudyRuntimeAdapter({
      identityClient: studyIdentityClientRef.current,
      lifecycle: studyProductionLifecycleRef.current,
    })
  }
  const [state, setState] = useState<AppState>(loaded.state)
  const [persistenceFailure, setPersistenceFailure] =
    useState<AppStatePersistenceFailure | null>(null)
  // MOUNT-2: the study route is evaluated before the picker default, so a fresh
  // navigation or refresh at /study-engine with a valid persisted profile lands
  // on the study surface. No active profile or flag-off falls through to the
  // picker/normal app (the loader guarantees a non-null activeProfileId exists).
  const [screen, setScreen] = useState<Screen>(() => {
    if (studyEnabled && loaded.state.activeProfileId && isStudyEnginePath(window.location.pathname)) {
      return { kind: 'studyDashboard' }
    }
    // CURR-1 (MOUNT-2 pattern): an /academy deep link with a valid persisted
    // profile whose grade flag is enabled lands on the academy surface; any
    // other case falls through to the picker/normal app.
    const bootProfile = loaded.state.activeProfileId
      ? loaded.state.profiles[loaded.state.activeProfileId]
      : null
    if (bootProfile && enabledAcademyGradeFromHost(bootProfile.grade)) {
      const academyRoute = parseAcademyPath(window.location.pathname)
      if (academyRoute) return { kind: 'academy', route: academyRoute }
    }
    return { kind: 'picker' }
  })
  const [showMigration, setShowMigration] = useState(loaded.migrated)
  const [parentStudyAuthorization, setParentStudyAuthorization] = useState<StudyAdultAuthorization | null>(null)
  const seenRef = useRef(new Set<string>())
  // MT-1: start of the current practice session, for the "3+ this session" escalation count.
  const sessionStartRef = useRef(Date.now())

  useEffect(() => {
    let current = true
    if (!studyPreviewEnabled || !loadPreviewPorts) {
      setStudyRuntime(null)
      return () => { current = false }
    }
    void loadPreviewPorts().then((runtime) => {
      if (current) setStudyRuntime(runtime)
    }).catch(() => {
      if (current) setStudyRuntime(null)
    })
    return () => { current = false }
  }, [studyPreviewEnabled])

  useEffect(() => {
    let current = true
    void saveAppState(state).then((result) => {
      if (current) setPersistenceFailure(result.ok ? null : result)
    })
    return () => { current = false }
  }, [state])

  // M6: local-first cloud sync. Inert with no Supabase config; never blocks the UI.
  // Local writes above already persisted; this pushes async + pulls on open/reconnect.
  const sync = useSync(state, setState)
  const active = state.activeProfileId ? state.profiles[state.activeProfileId] : null

  useEffect(() => {
    const productionSelected = studyEnabled && !studyPreviewEnabled
    const lifecycle = studyProductionLifecycleRef.current!
    const runtime = studyVerifiedRuntimeRef.current!
    if (!productionSelected) {
      lifecycle.cancel('feature-disabled')
      void runtime.cancel('feature-disabled')
      studyReadinessClientRef.current?.invalidate()
      studySelectedProfileRef.current = null
      setStudyProductionStatus('disabled')
      return
    }
    if (!sync.status.user || sync.status.binding !== 'bound' || sync.status.provenance !== 'verified') {
      lifecycle.cancel('authorization-loss')
      void runtime.cancel('authorization-loss')
      studyReadinessClientRef.current?.invalidate()
      studySelectedProfileRef.current = null
      setStudyProductionStatus('unauthenticated')
      return
    }
    if (!active) {
      lifecycle.cancel('learner-switch')
      void runtime.cancel('learner-switch')
      studySelectedProfileRef.current = null
      setStudyProductionStatus('unauthenticated')
      return
    }
    const verifiedHostUserId = sync.status.user.id
    const verifiedActiveProfileId = active.id

    const controller = new AbortController()
    const readiness = studyReadinessClientRef.current ?? createStudyProductionReadinessClient()
    studyReadinessClientRef.current = readiness
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleReadinessCheck = (expiresAt: string) => {
      if (refreshTimer) clearTimeout(refreshTimer)
      const refreshIn = Math.max(250, Date.parse(expiresAt) - Date.now() - 500)
      refreshTimer = setTimeout(() => { void reconcile() }, refreshIn)
    }

    async function reconcile() {
      if (controller.signal.aborted) return
      setStudyProductionStatus('checking')
      try {
        const previousProfile = studySelectedProfileRef.current
        if (previousProfile && previousProfile !== verifiedActiveProfileId) {
          await runtime.cancel('learner-switch')
        }
        studySelectedProfileRef.current = verifiedActiveProfileId
        const result = await readiness.revalidate(controller.signal)
        if (controller.signal.aborted) return
        if (result.status !== 'ready') {
          await runtime.applyReadiness(result)
          if (!controller.signal.aborted) setStudyProductionStatus(result.status)
          if (!controller.signal.aborted) scheduleReadinessCheck(result.expiresAt)
          return
        }
        const accessToken = await getGatewayAccessToken()
        if (!accessToken || controller.signal.aborted) {
          await runtime.cancel('authorization-loss')
          if (!controller.signal.aborted) setStudyProductionStatus('unauthenticated')
          return
        }
        const launched = await runtime.launch({
          featureEnabled: true,
          authenticatedHostSession: true,
          hostSessionKey: verifiedHostUserId,
          accessToken,
          selectedStudentRef: { kind: 'legacy-profile-id', value: verifiedActiveProfileId },
          readiness: result,
          signal: controller.signal,
        })
        if (controller.signal.aborted || launched.status !== 'ready') return
        setStudyProductionStatus('ready')
        // Refresh before the sanitized readiness lease expires. A failed or
        // degraded refresh revokes the opaque session and cancels this epoch.
        scheduleReadinessCheck(result.expiresAt)
      } catch {
        if (!controller.signal.aborted) {
          await runtime.cancel('authorization-loss')
          setStudyProductionStatus('not-ready')
        }
      }
    }
    void reconcile()
    return () => {
      controller.abort('navigation-away')
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [
    active?.id,
    studyEnabled,
    studyPreviewEnabled,
    sync.status.binding,
    sync.status.provenance,
    sync.status.user?.id,
  ])

  useEffect(() => () => {
    void studyVerifiedRuntimeRef.current?.cancel('navigation-away')
  }, [])

  // SE-B attendance: when the signed-in girl's mission day is complete, append one
  // attendance day (invisible to her, append-only). recordAttendance is idempotent
  // — the date guard makes a re-fire a no-op — so this safely covers every path a
  // day can complete (manual check, math practice, typing drill).
  const attendanceId = state.activeProfileId
  const attendanceTodayComplete = attendanceId
    ? isDayComplete(state.profiles[attendanceId]?.missions[isoToday()])
    : false
  useEffect(() => {
    if (!attendanceId || !attendanceTodayComplete) return
    setState((s) => patchProfile(s, attendanceId, (p) => recordAttendance(p, true, isoToday())))
  }, [attendanceId, attendanceTodayComplete])

  const studyContextResult = buildHostStudyContext({
    enabled: studyPreviewEnabled,
    syncStatus: sync.status,
    profile: active,
    subject: 'math',
    lessonRef: active ? `grade-${active.grade}:daily-study` : 'unselected:daily-study',
    skillRefs: active ? [`grade-${active.grade}:current-study-skill`] : [],
    householdTimeZone: studyPreviewEnabled ? localDevelopmentHouseholdTimeZone() : null,
    timerHidden: false,
  })
  const studyPreviewReady = Boolean(
    studyEnabled &&
    studyPreviewEnabled &&
    studyRuntime &&
    studyContextResult.status === 'ready',
  )
  const studyProductionSelected = studyEnabled && !studyPreviewEnabled
  const studyProductionUnavailableReason = studyProductionStatus === 'checking'
    ? 'Study is being checked. Please try again in a moment.'
    : studyProductionStatus === 'unauthenticated'
      ? 'Sign in and select an available learner before opening Study.'
      : studyProductionStatus === 'degraded'
        ? 'Study is taking a safe pause right now. Please try again later.'
        : 'Study is not available yet. Please try again later.'
  const tokens = THEMES[active?.theme ?? 'playful']

  const establishParentStudyAuthorization = () => {
    const user = sync.status.user
    if (!studyPreviewEnabled || !user || sync.status.binding !== 'bound' || sync.status.provenance !== 'verified') {
      setParentStudyAuthorization(null)
      return
    }
    const householdRef = deriveStudyHouseholdRef(user.id)
    setParentStudyAuthorization({
      householdRef,
      actorRef: `adult:${householdRef.slice('household:'.length)}`,
      role: 'parent',
      adultAuthorized: true,
    })
  }

  // Every profile write is a functional update so the reducer's base is the
  // latest committed profile (see appState.patchProfile): two writes in one tick
  // — or a session-finish racing the last answer — compose instead of clobbering.
  // patchActive targets the signed-in profile; patchById targets a specific one
  // (e.g. during PIN setup, before that profile becomes active).
  const patchById = (id: string, update: (prev: Profile) => Profile) =>
    setState((s) => patchProfile(s, id, update))
  const patchActive = (update: (prev: Profile) => Profile) =>
    setState((s) => (s.activeProfileId ? patchProfile(s, s.activeProfileId, update) : s))
  const signOut = () => {
    leaveStudyEnginePath()
    leaveAcademyPath()
    void purgeVoiceCache()
    studyProductionLifecycleRef.current?.cancel('logout')
    void studyVerifiedRuntimeRef.current?.cancel('logout')
    studyReadinessClientRef.current?.invalidate()
    studySelectedProfileRef.current = null
    setParentStudyAuthorization(null)
    setState((s) => ({ ...s, activeProfileId: null }))
    setScreen({ kind: 'picker' })
  }
  // Begin a practice run and stamp the session start (MT-1 escalation window).
  const startPractice = (p: Profile) => {
    sessionStartRef.current = Date.now()
    setScreen({ kind: 'practice', plan: buildPracticePlan(p) })
  }

  // ---------- profile-free screens ----------

  if (screen.kind === 'picker') {
    return (
      <Picker
        state={state}
        migrationBanner={
          showMigration && loaded.backupKey
            ? {
                onDownload: () => {
                  const raw = readLocalStorageKey(loaded.backupKey!)
                  if (raw) downloadJson(`${loaded.backupKey!.replaceAll(':', '_')}.json`, raw)
                },
                onDismiss: () => setShowMigration(false),
              }
            : undefined
        }
        onPick={(profileId) => {
          const p = state.profiles[profileId]
          setScreen(p.pin === '' ? { kind: 'kidPinCreate', profileId } : { kind: 'kidPin', profileId })
        }}
        onGrownUps={() =>
          setScreen(state.parentPin === '' ? { kind: 'parentPinCreate' } : { kind: 'parentPin' })
        }
      />
    )
  }

  if (screen.kind === 'kidPin' || screen.kind === 'kidPinCreate') {
    const profile = state.profiles[screen.profileId]
    const t = THEMES[profile.theme]
    return (
      <ThemeContext.Provider value={t}>
        <div style={{ fontFamily: t.font, background: t.appBg }} className="min-h-screen">
          {screen.kind === 'kidPin' ? (
            <PinPad
              title={`Hi, ${profile.name}!`}
              subtitle="Enter your secret PIN"
              onComplete={(pin) => {
                if (pin === profile.pin) {
                  setState((s) => ({ ...s, activeProfileId: profile.id }))
                  setScreen({ kind: 'home' })
                  return null
                }
                return 'Oops — that is not it. Try again!'
              }}
              onCancel={() => setScreen({ kind: 'picker' })}
            />
          ) : (
            <PinPad
              title={screen.firstEntry ? 'One more time!' : `Welcome, ${profile.name}!`}
              subtitle={
                screen.firstEntry ? 'Type your new PIN again to lock it in' : 'Choose a secret 4-digit PIN'
              }
              onComplete={(pin) => {
                if (!screen.firstEntry) {
                  setScreen({ kind: 'kidPinCreate', profileId: profile.id, firstEntry: pin })
                  return null
                }
                if (pin === screen.firstEntry) {
                  patchById(profile.id, (prev) => ({ ...prev, pin }))
                  setState((s) => ({ ...s, activeProfileId: profile.id }))
                  setScreen({ kind: 'home' })
                  return null
                }
                setScreen({ kind: 'kidPinCreate', profileId: profile.id })
                return 'The PINs did not match — start over.'
              }}
              onCancel={() => setScreen({ kind: 'picker' })}
            />
          )}
        </div>
      </ThemeContext.Provider>
    )
  }

  if (screen.kind === 'parentPin' || screen.kind === 'parentPinCreate') {
    const t = THEMES.clean
    return (
      <ThemeContext.Provider value={t}>
        <div style={{ fontFamily: t.font, background: t.appBg }} className="min-h-screen">
          {screen.kind === 'parentPin' ? (
            <PinPad
              title="Grown-Ups only"
              subtitle="Enter the parent PIN"
              onComplete={(pin) => {
                if (pin === state.parentPin) {
                  establishParentStudyAuthorization()
                  setScreen({ kind: 'parentHub' })
                  return null
                }
                return 'Wrong PIN.'
              }}
              onCancel={() => setScreen({ kind: 'picker' })}
            />
          ) : (
            <PinPad
              title={screen.firstEntry ? 'Confirm parent PIN' : 'Set a parent PIN'}
              subtitle={
                screen.firstEntry
                  ? 'Type it again to confirm'
                  : 'This PIN gates the Grown-Ups panel'
              }
              onComplete={(pin) => {
                if (!screen.firstEntry) {
                  setScreen({ kind: 'parentPinCreate', firstEntry: pin })
                  return null
                }
                if (pin === screen.firstEntry) {
                  setState((s) => ({ ...s, parentPin: pin }))
                  establishParentStudyAuthorization()
                  setScreen({ kind: 'parentHub' })
                  return null
                }
                setScreen({ kind: 'parentPinCreate' })
                return 'PINs did not match — start over.'
              }}
              onCancel={() => setScreen({ kind: 'picker' })}
            />
          )}
        </div>
      </ThemeContext.Provider>
    )
  }

  if (screen.kind === 'parentHub') {
    const parentStudyReady =
      studyPreviewReady &&
      studyRuntime &&
      parentStudyAuthorization &&
      sync.status.user &&
      parentStudyAuthorization.householdRef === deriveStudyHouseholdRef(sync.status.user.id)
    return (
      <ParentHub
        state={state}
        onStateChange={setState}
        onClose={() => {
          setParentStudyAuthorization(null)
          setScreen({ kind: 'picker' })
        }}
        onOpenClassic={() => setScreen({ kind: 'grownups' })}
        studyEnabled={studyPreviewReady || studyProductionSelected}
        study={
          parentStudyReady
            ? {
                householdRef: parentStudyAuthorization.householdRef,
                learners: Object.values(state.profiles).map((profile) => ({
                  hostProfileRef: profile.id,
                  learnerRef: deriveStudyLearnerRef(sync.status.user!.id, profile.id),
                  displayName: profile.name,
                })),
                ports: studyRuntime.ports,
                authorization: parentStudyAuthorization,
              }
            : undefined
        }
        studyUnavailableReason={studyProductionSelected
          ? studyProductionUnavailableReason
          : 'Sign in, verify the household binding, and re-enter the parent PIN to use the explicit local Study preview.'}
        persistenceFailure={persistenceFailure}
        onDismissPersistenceFailure={() => setPersistenceFailure(null)}
      />
    )
  }

  if (screen.kind === 'grownups') {
    return (
      <GrownUps
        state={state}
        onStateChange={setState}
        sync={sync}
        onClose={() => setScreen({ kind: 'parentHub' })}
        onChangeParentPin={() => setScreen({ kind: 'parentPinCreate' })}
      />
    )
  }

  // ---------- signed-in screens ----------

  if (!active) {
    // defensive: no active profile → back to picker
    return (
      <Picker
        state={state}
        onPick={(profileId) => {
          const p = state.profiles[profileId]
          setScreen(p.pin === '' ? { kind: 'kidPinCreate', profileId } : { kind: 'kidPin', profileId })
        }}
        onGrownUps={() =>
          setScreen(state.parentPin === '' ? { kind: 'parentPinCreate' } : { kind: 'parentPin' })
        }
      />
    )
  }

  // MA mount point — self-styled (clean), rendered full-bleed outside the theme wrapper
  if (
    screen.kind === 'studyDashboard' ||
    screen.kind === 'studySettings' ||
    screen.kind === 'studySession'
  ) {
    if (studyProductionSelected) {
      const verifiedRuntime = studyVerifiedRuntimeRef.current
      if (studyProductionStatus !== 'ready' || !verifiedRuntime?.isReady()) {
        return (
          <StudyUnavailable
            reason={studyProductionUnavailableReason}
            onBack={() => {
              leaveStudyEnginePath()
              setScreen({ kind: 'home' })
            }}
          />
        )
      }
      return (
        <VerifiedProductionStudyHost
          runtime={verifiedRuntime}
          onBack={() => {
            void verifiedRuntime.cancel('navigation-away')
            leaveStudyEnginePath()
            setScreen({ kind: 'home' })
          }}
        />
      )
    }
    if (
      !studyPreviewReady ||
      !studyRuntime ||
      studyContextResult.status !== 'ready' ||
      !StudyDashboard ||
      !StudySessionRoute ||
      !StudySettings
    ) {
      return (
        <StudyUnavailable
          reason={
            studyProductionSelected
              ? studyProductionUnavailableReason
              : studyContextResult.status === 'unavailable'
              ? studyContextResult.reason
              : 'The Study integration is unavailable.'
          }
          onBack={() => {
            leaveStudyEnginePath()
            setScreen({ kind: 'home' })
          }}
        />
      )
    }
    if (screen.kind === 'studySettings') {
      return (
        <Suspense fallback={<StudyLoading />}>
          <StudySettings
            context={studyContextResult.context}
            ports={studyRuntime.ports}
            onBack={() => setScreen({ kind: 'studyDashboard' })}
          />
        </Suspense>
      )
    }
    if (screen.kind === 'studySession') {
      return (
        <Suspense fallback={<StudyLoading />}>
          <StudySessionRoute
            context={studyContextResult.context}
            ports={studyRuntime.ports}
            blockRef={screen.blockRef}
            learnerRef={screen.learnerRef}
            onBack={() => setScreen({ kind: 'studyDashboard' })}
          />
        </Suspense>
      )
    }
    return (
      <Suspense fallback={<StudyLoading />}>
        <StudyDashboard
          context={studyContextResult.context}
          ports={studyRuntime.ports}
          onLaunch={(entry) =>
            setScreen({
              kind: 'studySession',
              blockRef: entry.blockRef,
              learnerRef: studyContextResult.context.learnerRef,
            })
          }
          onSettings={() => setScreen({ kind: 'studySettings' })}
          onBack={() => {
            leaveStudyEnginePath()
            setScreen({ kind: 'home' })
          }}
        />
      </Suspense>
    )
  }

  // CURR-1 academy mount point — self-styled, rendered full-bleed like Study.
  if (screen.kind === 'academy') {
    const academyGrade = enabledAcademyGradeFromHost(active.grade)
    if (!academyGrade) {
      // Flag off or a non-academy grade signed in behind a stale /academy URL.
      return (
        <StudyUnavailable
          reason="The Academy curriculum is not enabled for this learner."
          onBack={() => {
            leaveAcademyPath()
            setScreen({ kind: 'home' })
          }}
        />
      )
    }
    return (
      <Suspense fallback={<StudyLoading />}>
        <AcademyRouter
          profile={active}
          grade={academyGrade}
          schoolYear={state.schoolYear}
          route={screen.route}
          onNavigate={(route) => {
            syncAcademyPath(route)
            setScreen({ kind: 'academy', route })
          }}
          onPatch={patchActive}
          onExit={() => {
            leaveAcademyPath()
            setScreen({ kind: 'home' })
          }}
        />
      </Suspense>
    )
  }

  if (screen.kind === 'assessment') {
    return (
      <AssessmentRunner
        profile={active}
        testId={screen.testId}
        nowISO={() => new Date().toISOString()}
        onPatch={patchActive}
        onHome={() => setScreen({ kind: 'home' })}
      />
    )
  }

  return (
    <ThemeContext.Provider value={tokens}>
      <div style={{ fontFamily: tokens.font, background: tokens.appBg }} className="min-h-screen">
        {screen.kind === 'placement' && (
          <QuizSession
            title="Placement Quest"
            emoji="🗺️"
            total={PLACEMENT_TOTAL}
            getQuestion={(index, history) =>
              generateFresh(screen.order[index], placementDifficulty(history), seenRef.current)
            }
            onFinish={(history) => {
              const results = summarizePlacement(history, active.grade)
              // a finished placement counts as the day's math session too
              patchActive((p) => autoCompletePractice(finishSession(applyPlacement(p, results), 0)))
              setScreen({ kind: 'placementResults', results })
            }}
            onQuit={() => setScreen({ kind: 'home' })}
          />
        )}

        {screen.kind === 'practice' && (
          <QuizSession
            title="Daily Practice"
            emoji="✏️"
            total={PRACTICE_TOTAL}
            getQuestion={(index) =>
              generateFresh(screen.plan[index].skill, screen.plan[index].difficulty, seenRef.current)
            }
            onAnswer={(q, correct) =>
              patchActive((p) => recordAnswer(p, q.skillId, q.difficulty, correct))
            }
            tutorEnabled
            voice={getVoicePrefs(active)}
            muted={isMuted(state)}
            onToggleMute={() => setState((s) => setMuted(s, !isMuted(s)))}
            makeRetry={(skillId, difficulty) =>
              generateFresh(skillId, difficulty, seenRef.current)
            }
            onRetryAnswer={(q, correct) =>
              patchActive((p) => {
                const rec = recordAnswer(p, q.skillId, q.difficulty, correct, 'retry')
                // MS: a walkthrough-assisted retry solved correctly earns (sub-capped +6/day)
                return correct && starsEnabled(p)
                  ? awardTutorRetry(rec, getStarsConfig(state).rates)
                  : rec
              })
            }
            onWalkthrough={(skillId) =>
              patchActive((p) =>
                logWalkthrough(p, skillId, Date.now(), sessionStartRef.current, isoToday()),
              )
            }
            profile={active}
            onTutorProfileChange={patchActive}
            onFinish={(history) => {
              const correct = history.filter((r) => r.correct).length
              patchActive((p) => {
                // mission auto-completes as part of finishing a real practice session
                const withMission = autoCompletePractice(finishSession(p, longestStreak(history)))
                if (!starsEnabled(p)) return withMission
                const rates = getStarsConfig(state).rates
                // effort/completion pay (+accuracy bonus), then any mission/weekly bonus
                const earned = awardPracticeSession(withMission, correct, history.length, rates)
                return awardMissionEvents(p, earned, rates)
              })
              setScreen({ kind: 'practiceResults', history })
            }}
            onQuit={() => setScreen({ kind: 'home' })}
          />
        )}

        {screen.kind === 'placementResults' && (
          <PlacementResults
            results={screen.results}
            onHome={() => setScreen({ kind: 'home' })}
            onPractice={() => startPractice(active)}
          />
        )}

        {screen.kind === 'practiceResults' && (
          <PracticeResults
            history={screen.history}
            onHome={() => setScreen({ kind: 'home' })}
            onAgain={() => startPractice(active)}
          />
        )}

        {screen.kind === 'prizeShop' && (
          <PrizeShop
            profile={active}
            config={getStarsConfig(state)}
            playful={active.theme === 'playful'}
            onRequest={(prize) => {
              const res = requestRedemption(active, prize)
              if (res.ok) patchActive((p) => requestRedemption(p, prize).profile)
              return { ok: res.ok, error: res.error }
            }}
            onHome={() => setScreen({ kind: 'home' })}
          />
        )}

        {screen.kind === 'home' && (
          <Home
            profile={active}
            muted={isMuted(state)}
            onEnsureToday={() => patchActive((p) => ensureToday(p))}
            onToggleItem={(itemId, done) =>
              patchActive((p) => {
                const after = setItemDone(p, itemId, done)
                // MS: a manual check that completes the day pays the mission (+weekly) bonus
                return starsEnabled(p)
                  ? awardMissionEvents(p, after, getStarsConfig(state).rates)
                  : after
              })
            }
            onProfileChange={patchActive}
            onSignOut={signOut}
            onPlacement={() => setScreen({ kind: 'placement', order: placementOrder(active.grade) })}
            onPractice={() => startPractice(active)}
            onOpenShop={() => setScreen({ kind: 'prizeShop' })}
            onOpenAssessment={(testId) => setScreen({ kind: 'assessment', testId })}
            onOpenTyping={() => setScreen({ kind: 'typing' })}
            onOpenReading={() => setScreen({ kind: 'reading' })}
            onOpenMindset={() => setScreen({ kind: 'mindset' })}
            onOpenStudy={studyPreviewReady || studyProductionSelected ? () => setScreen({ kind: 'studyDashboard' }) : undefined}
            studyMode={studyPreviewReady ? 'preview' : studyProductionSelected ? 'unavailable' : undefined}
            onOpenAcademy={
              enabledAcademyGradeFromHost(active.grade)
                ? () => {
                    syncAcademyPath({ kind: 'home' })
                    setScreen({ kind: 'academy', route: { kind: 'home' } })
                  }
                : undefined
            }
            mindsetStartDate={state.mindsetStartDate}
          />
        )}

        {/* MR reading fluency — grades 3/4/6 only (teens never reach here) */}
        {screen.kind === 'reading' && (
          <ReadingView
            profile={active}
            muted={isMuted(state)}
            onProfileChange={patchActive}
            onExit={() => setScreen({ kind: 'home' })}
          />
        )}

        {/* MM mindset — the quiet corner; all grades, calm and minimal */}
        {screen.kind === 'mindset' && (
          <MindsetLesson
            profile={active}
            startDate={state.mindsetStartDate}
            muted={isMuted(state)}
            onPatch={patchActive}
            onExit={() => setScreen({ kind: 'home' })}
          />
        )}

        {/* SE-A typing trainer "MK" — grades 3/4/6 only (teens never reach here) */}
        {screen.kind === 'typing' && (
          <TypingTrainer
            profile={active}
            muted={isMuted(state)}
            onDrillComplete={(result: DrillResult) =>
              patchActive((prev) => {
                // record the drill, then flip the typing auto-item for today...
                const withDrill = recordDrill(prev, result)
                const after = autoCompleteTyping(withDrill)
                // ...and pay the mission/weekly bonus if that completes the day (stars profiles only)
                return starsEnabled(prev)
                  ? awardMissionEvents(prev, after, getStarsConfig(state).rates)
                  : after
              })
            }
            onExit={() => setScreen({ kind: 'home' })}
          />
        )}
      </div>
    </ThemeContext.Provider>
  )
}

function StudyUnavailable({ reason, onBack }: { reason: string; onBack: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  return (
    <main className="study-runtime-host min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 ref={headingRef} className="text-2xl font-bold" tabIndex={-1}>Study is not available yet</h1>
        <p className="mt-2">{reason}</p>
        <p className="mt-2 text-sm">No Study persistence or safety request was made.</p>
        <button className="mt-4 min-h-11 rounded-lg border border-amber-500 bg-white px-4 py-2 font-bold" onClick={onBack}>Back home</button>
      </div>
    </main>
  )
}

function VerifiedProductionStudyHost({
  runtime,
  onBack,
}: {
  runtime: VerifiedStudyRuntimeAdapter
  onBack: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const operationRef = useRef(`production-dashboard:${Date.now()}:${Math.random().toString(36).slice(2)}`)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    void runtime.execute({
      operation: 'dashboard:read',
      request: Object.freeze({}),
      operationRef: operationRef.current,
      signal: controller.signal,
    }).then(() => {
      if (!controller.signal.aborted) setStatus('ready')
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('unavailable')
    })
    return () => controller.abort('navigation-away')
  }, [runtime])

  useEffect(() => { headingRef.current?.focus() }, [status])

  return (
    <main className="study-runtime-host min-h-screen bg-slate-50 p-6 text-slate-900" aria-busy={status === 'loading'}>
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 ref={headingRef} className="text-2xl font-bold" tabIndex={-1}>Verified Study workspace</h1>
        {status === 'loading' && <p className="mt-2" role="status">Checking your current Study planÃ¢â‚¬Â¦</p>}
        {status === 'ready' && (
          <p className="mt-2" role="status">Your Study workspace is ready for this learner.</p>
        )}
        {status === 'unavailable' && (
          <p className="mt-2" role="alert">Study took a safe pause. No late result was applied.</p>
        )}
        <button className="mt-4 min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold" onClick={onBack}>Back home</button>
      </div>
    </main>
  )
}

function StudyLoading() {
  return (
    <main className="study-runtime-host min-h-screen bg-slate-50 p-6 text-slate-900" aria-busy="true">
      <p role="status">Loading the explicit local Study previewâ€¦</p>
    </main>
  )
}

// ---------- home ----------

function Home({
  profile,
  muted,
  onEnsureToday,
  onToggleItem,
  onProfileChange,
  onSignOut,
  onPlacement,
  onPractice,
  onOpenShop,
  onOpenAssessment,
  onOpenTyping,
  onOpenReading,
  onOpenMindset,
  onOpenStudy,
  studyMode,
  onOpenAcademy,
  mindsetStartDate,
}: {
  profile: Profile
  muted: boolean
  onEnsureToday: () => void
  onToggleItem: (itemId: string, done: boolean) => void
  onProfileChange: (update: (prev: Profile) => Profile) => void
  onSignOut: () => void
  onPlacement: () => void
  onPractice: () => void
  onOpenShop: () => void
  onOpenAssessment: (testId: string) => void
  onOpenTyping: () => void
  onOpenReading: () => void
  onOpenMindset: () => void
  onOpenStudy?: () => void
  studyMode?: 'preview' | 'unavailable'
  /** CURR-1: present only when this profile's academy grade flag is enabled. */
  onOpenAcademy?: () => void
  mindsetStartDate: string | undefined
}) {
  const t = useTheme()
  const assessmentCards = assignedOpenTests(profile)
  const isTrainerReady = profile.grade === '3' || profile.grade === '4' || profile.grade === '6'
  const hasToday = !!profile.missions[isoToday()]
  useEffect(() => {
    if (!hasToday) onEnsureToday()
  }, [hasToday, onEnsureToday])
  // M4 mount point: the two teens get high-school mode (real code in HighSchoolHome)
  if (profile.grade === '10' || profile.grade === '12') {
    return (
      <HighSchoolHome
        profile={profile}
        onProfileChange={onProfileChange}
        onSignOut={onSignOut}
        onToggleItem={onToggleItem}
        muted={muted}
        assessmentCards={assessmentCards}
        onOpenAssessment={onOpenAssessment}
        onOpenMindset={onOpenMindset}
        onOpenStudy={onOpenStudy}
        studyMode={studyMode}
        mindsetStartDate={mindsetStartDate}
      />
    )
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${t.heading}`}>
            {t.bigEmoji ? '🏠 ' : ''}Hi, {profile.name}!
          </h1>
          <p className={`mt-1 font-bold ${t.sub}`}>
            {profile.streaks.current > 0
              ? `🔥 ${profile.streaks.current}-day streak — keep it going!`
              : 'Ready to learn today?'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {starsEnabled(profile) && (
            <StarWallet stars={getStars(profile)} playful={t.id === 'playful'} muted={muted} />
          )}
          <button onClick={onSignOut} className={`${t.secondaryBtn} px-4 py-2 text-sm`}>
            Sign out
          </button>
        </div>
      </header>

      {starsEnabled(profile) && (
        <button
          onClick={onOpenShop}
          className={
            t.id === 'playful'
              ? 'mt-4 flex w-full items-center justify-center gap-2 rounded-3xl border-b-8 border-amber-500 bg-gradient-to-r from-amber-300 to-yellow-300 px-6 py-3 text-lg font-extrabold text-amber-900 shadow-lg transition-all hover:scale-[1.01] active:translate-y-1 active:border-b-4'
              : 'mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-6 py-3 font-bold text-amber-700 shadow hover:bg-amber-100'
          }
        >
          🎁 Prize Shop
        </button>
      )}

      {profile.totals.questionsAnswered > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-extrabold">
          <span className={`${t.statPill} px-4 py-1 text-amber-600`}>
            ⭐ {profile.totals.correct} correct
          </span>
          <span className={`${t.statPill} px-4 py-1 text-orange-600`}>
            🔥 Best: {profile.totals.bestStreak}
          </span>
          <span className={`${t.statPill} px-4 py-1 text-sky-600`}>
            📚 {profile.totals.sessions} sessions
          </span>
        </div>
      )}

      {assessmentCards.length > 0 && (
        <div className="mt-6 space-y-3">
          {assessmentCards.map(({ test, status }) => (
            <button
              key={test.id}
              onClick={() => onOpenAssessment(test.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-500"
            >
              <span className="text-3xl">📋</span>
              <span className="flex-1">
                <span className="block font-bold text-slate-900">{test.title}</span>
                <span className="block text-sm font-semibold text-slate-500">
                  {status === 'in-progress'
                    ? 'In progress — see Dad to continue'
                    : 'Placement — see Dad before starting'}
                </span>
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                {status === 'in-progress' ? 'resume' : 'start'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <MissionCard profile={profile} onToggle={onToggleItem} />
      </div>

      {/* CURR-1 Manuel Academy entry — today's lessons, courses, year schedule */}
      {onOpenAcademy && (
        <button
          onClick={onOpenAcademy}
          className={
            t.id === 'playful'
              ? 'mt-6 flex min-h-11 w-full items-center gap-4 rounded-3xl border-b-8 border-indigo-800 bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-left text-white shadow-xl'
              : `${t.card} mt-6 flex min-h-11 w-full items-center gap-4 p-5 text-left hover:border-cyan-400`
          }
        >
          <span className="text-4xl" aria-hidden="true">
            🏫
          </span>
          <span>
            <span className="block text-2xl font-extrabold">Manuel Academy</span>
            <span className="block font-bold opacity-90">
              Today&apos;s lessons, your courses, and the year schedule
            </span>
          </span>
        </button>
      )}

      {onOpenStudy && (
        <button
          onClick={onOpenStudy}
          className={
            t.id === 'playful'
              ? 'mt-6 flex min-h-11 w-full items-center gap-4 rounded-3xl border-b-8 border-cyan-800 bg-gradient-to-br from-cyan-500 to-blue-600 p-5 text-left text-white shadow-xl'
              : `${t.card} mt-6 flex min-h-11 w-full items-center gap-4 p-5 text-left hover:border-cyan-400`
          }
        >
          <span className="text-4xl" aria-hidden="true">🧭</span>
          <span><span className="block text-2xl font-extrabold">Today’s Study plan</span><span className="block font-bold opacity-90">{studyMode === 'preview' ? 'Launch the explicit local Study preview' : 'Check whether Study is available'}</span></span>
        </button>
      )}

      {/* MR reading fluency entry — opens today's read-aloud passage */}
      <button
        onClick={onOpenReading}
        className={
          t.id === 'playful'
            ? 'mt-6 flex w-full items-center gap-4 rounded-3xl border-b-8 border-rose-700 bg-gradient-to-br from-rose-500 to-orange-500 p-5 text-left shadow-xl transition-all hover:scale-[1.01] active:translate-y-1 active:border-b-4'
            : `${t.card} mt-6 flex w-full items-center gap-4 p-5 text-left transition-all hover:border-cyan-400`
        }
      >
        <span className="text-4xl">📖</span>
        <span className="flex-1">
          <span
            className={`block text-2xl font-extrabold ${t.id === 'playful' ? 'text-white' : t.heading}`}
          >
            Reading
          </span>
          <span className={`block font-bold ${t.id === 'playful' ? 'text-rose-100' : t.sub}`}>
            Read today&apos;s passage aloud — tap any word to hear it
          </span>
        </span>
      </button>

      {/* MM mindset — weekly lesson + habit card (quiet corner; renders only once unlocked) */}
      <MindsetCard profile={profile} startDate={mindsetStartDate} onOpen={onOpenMindset} />

      {/* SE-A typing trainer entry — one card, opens the 5-minute drill ladder */}
      <button
        onClick={onOpenTyping}
        className={
          t.id === 'playful'
            ? 'mt-6 flex w-full items-center gap-4 rounded-3xl border-b-8 border-sky-700 bg-gradient-to-br from-sky-500 to-indigo-600 p-5 text-left shadow-xl transition-all hover:scale-[1.01] active:translate-y-1 active:border-b-4'
            : `${t.card} mt-6 flex w-full items-center gap-4 p-5 text-left transition-all hover:border-cyan-400`
        }
      >
        <span className="text-4xl">⌨️</span>
        <span className="flex-1">
          <span
            className={`block text-2xl font-extrabold ${t.id === 'playful' ? 'text-white' : t.heading}`}
          >
            Typing — 5 min
          </span>
          <span className={`block font-bold ${t.id === 'playful' ? 'text-sky-100' : t.sub}`}>
            Home-row drills that grow into words and sentences
          </span>
        </span>
      </button>

      {isTrainerReady ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              onClick={onPlacement}
              className={
                t.id === 'playful'
                  ? 'rounded-3xl border-b-8 border-fuchsia-700 bg-gradient-to-br from-fuchsia-500 to-violet-600 p-6 text-left shadow-xl transition-all hover:scale-[1.02] active:translate-y-1 active:border-b-4'
                  : `${t.card} p-6 text-left transition-all hover:border-cyan-400`
              }
            >
              <div className="text-4xl">🗺️</div>
              <div className={`mt-1 text-2xl font-extrabold ${t.id === 'playful' ? 'text-white' : t.heading}`}>
                {profile.placementDone ? 'Retake Placement Quest' : 'Placement Quest'}
              </div>
              <div className={`font-bold ${t.id === 'playful' ? 'text-fuchsia-100' : t.sub}`}>
                20 questions to map out your skills
              </div>
            </button>
            <button
              onClick={onPractice}
              className={
                t.id === 'playful'
                  ? 'rounded-3xl border-b-8 border-emerald-700 bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-left shadow-xl transition-all hover:scale-[1.02] active:translate-y-1 active:border-b-4'
                  : `${t.card} p-6 text-left transition-all hover:border-cyan-400`
              }
            >
              <div className="text-4xl">✏️</div>
              <div className={`mt-1 text-2xl font-extrabold ${t.id === 'playful' ? 'text-white' : t.heading}`}>
                Daily Practice
              </div>
              <div className={`font-bold ${t.id === 'playful' ? 'text-emerald-100' : t.sub}`}>
                15 questions picked just for you
              </div>
            </button>
          </div>

          {!profile.placementDone && (
            <div className="mt-4 rounded-2xl bg-amber-100 p-3 text-center text-sm font-bold text-amber-800 shadow">
              💡 Tip: take the Placement Quest first so Daily Practice knows what to work on!
            </div>
          )}

          <h2 className={`mt-8 mb-3 text-2xl font-extrabold ${t.heading}`}>
            {t.bigEmoji ? '🌳 ' : ''}Your Skills Tree
          </h2>
          <SkillTree profile={profile} />
        </>
      ) : (
        <p className={`mt-6 text-center text-sm font-semibold ${t.sub}`}>
          In-app math practice for grade {profile.grade} arrives in a later update — for now,
          check things off as you finish them.
        </p>
      )}
    </div>
  )
}

// ---------- results ----------

function longestStreak(history: AnswerRecord[]): number {
  let best = 0
  let cur = 0
  for (const r of history) {
    cur = r.correct ? cur + 1 : 0
    best = Math.max(best, cur)
  }
  return best
}

function PlacementResults({
  results,
  onHome,
  onPractice,
}: {
  results: PlacementSkillResult[]
  onHome: () => void
  onPractice: () => void
}) {
  const t = useTheme()
  const chip = {
    mastered: { cls: t.chipMastered, label: t.cheers === 'full' ? 'Mastered ⭐' : 'Mastered' },
    developing: { cls: t.chipDeveloping, label: t.cheers === 'full' ? 'Growing 🌱' : 'In progress' },
    'not-started': { cls: t.chipNotStarted, label: 'Not started' },
  } as const
  const mastered = results.filter((r) => r.status === 'mastered').length
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {t.confetti && <Confetti burst={1} />}
      <div className={`${t.card} animate-pop p-6 text-center`}>
        {t.bigEmoji && <div className="text-5xl">🗺️✨</div>}
        <h1 className={`mt-2 text-3xl font-extrabold ${t.heading}`}>Quest complete!</h1>
        <p className={`mt-1 font-bold ${t.sub}`}>
          Here is your skill map — {mastered} skill{mastered === 1 ? '' : 's'} mastered already!
        </p>
      </div>
      <div className="mt-4 space-y-2">
        {results.map((r) => {
          const meta = SKILL_BY_ID[r.skillId]
          const ui = chip[r.status]
          return (
            <div key={r.skillId} className={`${t.card} flex items-center gap-3 p-3`}>
              {t.bigEmoji && <div className="text-3xl">{meta.emoji}</div>}
              <div className="flex-1">
                <div className={`font-extrabold ${t.heading}`}>{meta.name}</div>
                {r.asked > 0 && (
                  <div className="text-xs font-bold text-slate-400">
                    {r.correct}/{r.asked} correct
                  </div>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${ui.cls}`}>
                {ui.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={onPractice} className={`${t.primaryBtn} px-6 py-4 text-xl`}>
          Start practicing! ✏️
        </button>
        <button onClick={onHome} className={`${t.secondaryBtn} px-6 py-4 text-xl`}>
          Back home 🏠
        </button>
      </div>
    </div>
  )
}

function PracticeResults({
  history,
  onHome,
  onAgain,
}: {
  history: AnswerRecord[]
  onHome: () => void
  onAgain: () => void
}) {
  const t = useTheme()
  const score = history.filter((r) => r.correct).length
  const best = longestStreak(history)
  const great = score >= Math.ceil(history.length * 0.8)
  const message = great
    ? 'AMAZING work! You are on fire! 🔥'
    : score >= history.length / 2
      ? 'Nice job — you are getting stronger! 💪'
      : 'Good practice! Every try makes your brain grow! 🧠'
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 text-center">
      {great && t.confetti && <Confetti burst={1} />}
      <div className={`${t.card} animate-pop p-8`}>
        {t.bigEmoji && <div className="text-6xl">{great ? '🏆' : '🎈'}</div>}
        <h1 className={`mt-2 text-3xl font-extrabold ${t.heading}`}>Practice done!</h1>
        <div className="mt-4 text-5xl font-extrabold text-emerald-600">
          {score}/{history.length}
        </div>
        <div className={`mt-1 font-bold ${t.sub}`}>questions correct</div>
        {best >= 3 && (
          <div className="mt-2 text-lg font-extrabold text-orange-500">🔥 Best streak: {best}!</div>
        )}
        {t.cheers === 'full' && <p className={`mt-4 text-lg font-bold ${t.heading}`}>{message}</p>}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button onClick={onAgain} className={`${t.primaryBtn} px-6 py-4 text-xl`}>
          Practice again! 🔁
        </button>
        <button onClick={onHome} className={`${t.secondaryBtn} px-6 py-4 text-xl`}>
          Back home 🏠
        </button>
      </div>
    </div>
  )
}
