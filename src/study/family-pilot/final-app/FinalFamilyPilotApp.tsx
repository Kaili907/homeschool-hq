import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  loadFinalFamilyPilotCatalog,
  type FinalFamilyPilotCatalog,
  type FinalLearnerAssessmentMaterial,
} from '../../../curriculum/final-app-data'
import { FamilyPilotStudentLogin } from '../auth'
import {
  downloadFinalFamilyPilotBackup,
  exportFinalFamilyPilotBackup,
  parentBackupMessage,
  previewFinalFamilyPilotRestore,
  restoreFinalFamilyPilotBackup,
  type FinalFamilyPilotBackupOptions,
} from './backup'
import { deriveCanonicalCourseCompletion, ParentCourseCompletionReport } from '../course-completion'
import type { FamilyAutoPlannerSchoolPlanV1 } from '../auto-planner'
import {
  buildFamilyPilotStudentDashboardModel,
  type FamilyPilotStudentDashboardModel,
} from '../dashboard-adapter'
import { fromStudentSelector, toStudentSelector } from '../integration/identity'
import { createRichLessonRenderModel, FamilyPilotLessonPlayer } from '../lesson-player'
import { FamilyPilotRecoveryScreen } from '../recovery'
import { buildFamilyFactualProgress, LearnerFactualProgress, ParentProgressReport } from '../reports'
import { StudentDashboard } from '../student-dashboard'
import type { FamilySetupStudent } from '../setup'
import {
  recordActiveInterval,
  startFocusSession,
  suggestBreak,
  DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE,
  type FamilyPilotFocusSession,
} from '../focus'
import { FAMILY_PILOT_ACTIVE_HEARTBEAT_SECONDS, type FamilyPilotAssignmentRecordV1, type FamilyPilotSnapshot } from '../core'
import type { FamilyPilotStudySnapshot } from '../study'
import {
  FinalFamilyPilotController,
  type FinalFamilyPilotControllerResult,
} from './controller'
import {
  BrowserLearnerResponseStore,
  LearnerResponseRuntime,
  type LearnerResponseAssessor,
  type LearnerResponsePresentation,
} from './learner-response'
import { digestLocalPin } from './state'
import {
  BrowserAssessmentRuntime,
  type FinalAssessmentAttemptV1,
} from './assessment'
import { toStudentDashboardPresentation } from './dashboardPresentation'
import { FinalFamilyAutoPlannerHost } from './autoPlannerHost'
import { applyAutoPlannerPresentation } from './autoPlannerPresentation'
import { FamilySchoolPlanPanel } from './FamilySchoolPlanPanel'
import { FamilyOnboarding } from './FamilyOnboarding'
import { ParentReviewCenter } from './review-center'
import { FamilyOverview } from './FamilyOverview'
import { ParentSyncStatusR1, type ParentSyncStatusR1 as ParentSyncStatusValueR1 } from '../../hosted-sync/v2/familyPilot/status'
import {
  isParentDeviceSyncSetupSimulation,
  ParentDeviceSyncSetup,
  type ParentDeviceSyncSetupRuntime,
} from '../../hosted-sync/v2/familyPilot/deviceSetup'
import { resolveFamilyServicesR1, type FamilyServicesPilotConfigurationR1 } from '../family-services'
import { ParentAssignmentLibrary } from './ParentAssignmentLibrary'
import { createBrowserHouseholdScopedStorage } from '../cloud-auth/scopedStorage'
import { FamilyCloudAuthBoundary } from '../cloud-auth/FamilyCloudAuthBoundary'
import type { FamilyCloudAuthRuntime, FamilyCloudSessionState } from '../cloud-auth/types'

type Mode = 'parent' | 'student'
type ParentView = 'overview' | 'school-plan' | 'assign' | 'review' | 'reports' | 'preferences' | 'backup' | 'devices'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'That action could not be completed.'
}

function learnerAssessmentState(status: FinalAssessmentAttemptV1['status']): string {
  if (status === 'PENDING_ASSESSMENT') return 'Waiting for grading'
  if (status === 'ADULT_REVIEW_REQUIRED') return 'Waiting for review'
  if (status === 'PENDING_GUARDIAN_ATTESTATION') return 'Ask your parent'
  return 'Ready to continue'
}

export interface FinalFamilyPilotAppProps {
  readonly onExit: () => void
  /** One injected composition for independently flagged non-production family services. */
  readonly familyServicesPilot?: FamilyServicesPilotConfigurationR1
  /** Local/test/staging injection only. Production composition omits this seam. */
  readonly deviceSyncSetup?: ParentDeviceSyncSetupRuntime
  /** Canonical Parent household auth composition. Provider sessions stay inside this runtime. */
  readonly familyCloudAuth?: FamilyCloudAuthRuntime
}

export function FinalFamilyPilotApp({ onExit, familyServicesPilot, deviceSyncSetup, familyCloudAuth }: FinalFamilyPilotAppProps) {
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof loadFinalFamilyPilotCatalog>> | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void loadFinalFamilyPilotCatalog().then((loaded) => {
      if (live) setCatalog(loaded)
    }).catch((error: unknown) => {
      if (live) setCatalogError(messageOf(error))
    })
    return () => { live = false }
  }, [])

  const familyServices = resolveFamilyServicesR1({
    trustedScorerFeatureFlagValue: import.meta.env.VITE_FAMILY_PILOT_TRUSTED_SCORER_ENABLED,
    configuration: familyServicesPilot,
  })
  if (!catalog && !catalogError) {
    return <FinalShell onExit={onExit}><p className="rounded-xl bg-white p-6 font-semibold" role="status">Opening the admitted Family Pilot release…</p></FinalShell>
  }
  if (!catalog || catalogError) {
    return <FinalShell onExit={onExit}><p className="rounded-xl border border-red-300 bg-red-50 p-6 font-semibold" role="alert">{catalogError ?? 'The final curriculum could not be loaded.'}</p></FinalShell>
  }

  const app = (cloudState: Extract<FamilyCloudSessionState, { status: 'READY' | 'OFFLINE_LOCAL' }> | null) => (
    <ReadyFinalFamilyPilotApp
      catalog={catalog}
      onExit={onExit}
      trustedScorer={familyServices.trustedScorer}
      parentSyncStatus={familyServices.parentSyncStatus}
      deviceSyncSetup={deviceSyncSetup}
      cloudState={cloudState}
      onReconcile={familyCloudAuth ? (signal) => familyCloudAuth.reconcile(signal) : undefined}
      onHouseholdSignOut={familyCloudAuth ? async () => { await familyCloudAuth.signOut(); onExit() } : undefined}
    />
  )
  return familyCloudAuth
    ? <FamilyCloudAuthBoundary runtime={familyCloudAuth}>{(state) => app(state)}</FamilyCloudAuthBoundary>
    : app(null)
}

function ReadyFinalFamilyPilotApp({ catalog, onExit, trustedScorer, parentSyncStatus, deviceSyncSetup, cloudState, onReconcile, onHouseholdSignOut }: {
  readonly catalog: FinalFamilyPilotCatalog
  readonly onExit: () => void
  readonly trustedScorer?: LearnerResponseAssessor
  readonly parentSyncStatus: ParentSyncStatusValueR1
  readonly deviceSyncSetup?: ParentDeviceSyncSetupRuntime
  readonly cloudState: Extract<FamilyCloudSessionState, { status: 'READY' | 'OFFLINE_LOCAL' }> | null
  readonly onReconcile?: (signal?: AbortSignal) => ReturnType<FamilyCloudAuthRuntime['reconcile']>
  readonly onHouseholdSignOut?: () => void
}) {
  const [revision, setRevision] = useState(0)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<ParentSyncStatusValueR1>(() =>
    cloudState?.status === 'READY' ? 'UP_TO_DATE' : cloudState?.status === 'OFFLINE_LOCAL' ? 'OFFLINE_SAVED' : parentSyncStatus)
  const reconcileController = useRef<AbortController | null>(null)
  const reconcilePending = useRef(false)
  const runReconcile = useRef<() => void>(() => undefined)
  const storage = useMemo(
    () => cloudState ? createBrowserHouseholdScopedStorage(cloudState.householdRef) : undefined,
    [cloudState?.householdRef],
  )
  const controller = useMemo(() => new FinalFamilyPilotController({
    catalog,
    ...(cloudState ? {
      coreStore: { storage },
      appStore: { storage, householdRef: cloudState.householdRef },
    } : {}),
  }), [catalog, cloudState?.householdRef, storage])
  const backupOptions = useMemo<FinalFamilyPilotBackupOptions>(() => cloudState ? {
    coreStore: { storage },
    appStore: { storage, householdRef: cloudState.householdRef },
  } : {}, [cloudState?.householdRef, storage])
  useEffect(() => () => controller.close(), [controller])
  useEffect(() => {
    setCloudSyncStatus(cloudState?.status === 'READY'
      ? 'UP_TO_DATE' : cloudState?.status === 'OFFLINE_LOCAL' ? 'OFFLINE_SAVED' : parentSyncStatus)
  }, [cloudState?.status, parentSyncStatus])
  useEffect(() => () => {
    reconcilePending.current = false
    reconcileController.current?.abort()
  }, [])
  runReconcile.current = () => {
    if (!onReconcile || cloudState?.status !== 'READY') return
    if (reconcileController.current) {
      reconcilePending.current = true
      return
    }
    const abort = new AbortController()
    reconcileController.current = abort
    setCloudSyncStatus('SYNCING')
    void onReconcile(abort.signal).then((result) => {
      if (abort.signal.aborted) return
      if (result === 'UP_TO_DATE') {
        controller.refresh()
        setRevision((value) => value + 1)
        setCloudSyncStatus('UP_TO_DATE')
      } else if (result === 'OFFLINE') setCloudSyncStatus('OFFLINE_SAVED')
      else if (result === 'CONFLICT' || result === 'UNAVAILABLE') setCloudSyncStatus('NEEDS_ATTENTION')
    }).finally(() => {
      if (reconcileController.current !== abort) return
      reconcileController.current = null
      if (reconcilePending.current) {
        reconcilePending.current = false
        window.queueMicrotask(() => runReconcile.current())
      }
    })
  }
  const refresh = useCallback(() => {
    controller.refresh()
    setRevision((value) => value + 1)
    runReconcile.current()
  }, [controller])
  const householdSignOut = useCallback(() => {
    reconcileController.current?.abort()
    reconcileController.current = null
    onHouseholdSignOut?.()
  }, [onHouseholdSignOut])
  return <MountedFinalFamilyPilot
    controller={controller}
    onExit={onExit}
    refresh={refresh}
    revision={revision}
    trustedScorer={trustedScorer}
    parentSyncStatus={cloudState ? cloudSyncStatus : parentSyncStatus}
    deviceSyncSetup={deviceSyncSetup}
    cloudState={cloudState}
    onHouseholdSignOut={onHouseholdSignOut ? householdSignOut : undefined}
    backupOptions={backupOptions}
  />
}

function FinalShell({ onExit, children, cloudState = null }: { readonly onExit: () => void; readonly children: React.ReactNode; readonly cloudState?: Extract<FamilyCloudSessionState, { status: 'READY' | 'OFFLINE_LOCAL' }> | null }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-family-pilot-release="family-pilot-r1">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Manuel Academy</p>
            <h1 className="text-xl font-extrabold">Family Pilot</h1>
          </div>
          <button type="button" className="rounded-lg border border-slate-600 px-3 py-2 font-bold" onClick={onExit}>Exit Family Pilot</button>
        </div>
      </header>
      <aside className="border-b border-cyan-200 bg-cyan-50" data-testid="family-pilot-device-storage-notice">
        <p className="mx-auto max-w-6xl px-4 py-3 text-sm font-semibold text-slate-700">
          {cloudState?.status === 'READY'
            ? 'Family account connected. Work is saved on this device and synchronized through the authenticated household.'
            : cloudState?.status === 'OFFLINE_LOCAL'
              ? 'Offline / saved on this device. Cloud changes will wait until the family account reconnects; you are not signed out.'
              : 'This pilot currently saves progress in this browser on this device. Download backups regularly. Cross-device sync is coming next.'}
        </p>
      </aside>
      {children}
    </div>
  )
}

function MountedFinalFamilyPilot({
  controller,
  onExit,
  refresh,
  revision,
  trustedScorer,
  parentSyncStatus,
  deviceSyncSetup,
  cloudState,
  onHouseholdSignOut,
  backupOptions,
}: {
  readonly controller: FinalFamilyPilotController
  readonly onExit: () => void
  readonly refresh: () => void
  /** Forces a projection refresh without remounting an open Study session. */
  readonly revision: number
  readonly trustedScorer?: LearnerResponseAssessor
  readonly parentSyncStatus: ParentSyncStatusValueR1
  readonly deviceSyncSetup?: ParentDeviceSyncSetupRuntime
  readonly cloudState: Extract<FamilyCloudSessionState, { status: 'READY' | 'OFFLINE_LOCAL' }> | null
  readonly onHouseholdSignOut?: () => void
  readonly backupOptions: FinalFamilyPilotBackupOptions
}) {
  const [mode, setMode] = useState<Mode>('student')
  const [parentAuthorized, setParentAuthorized] = useState(false)
  const [parentView, setParentView] = useState<ParentView>('overview')
  const [openAssignmentRef, setOpenAssignmentRef] = useState<string | null>(null)
  const restoreInput = useRef<HTMLInputElement>(null)
  const autoPlannerHost = useMemo(() => new FinalFamilyAutoPlannerHost(controller), [controller])
  useEffect(() => () => autoPlannerHost.close(), [autoPlannerHost])
  const app = controller.appSnapshot
  const core = controller.coreSnapshot

  const doRestore = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const preview = await previewFinalFamilyPilotRestore(text, backupOptions)
    if (preview.status === 'rejected') {
      window.alert(`Backup was not restored. ${parentBackupMessage(preview.reasonCode)}`)
      return
    }
    const counts = preview.backup.recordCounts
    const learnerNames = preview.learners.map((learner) => learner.displayName).join(', ')
    const confirmed = window.confirm([
      'Review this backup before restoring',
      '',
      `Backup date: ${new Date(preview.backup.createdAt).toLocaleString()}`,
      `Format version: ${preview.backup.backupSchemaVersion}`,
      `Learners: ${learnerNames || 'None'}`,
      `Assignments: ${counts.assignments}`,
      `Study sessions: ${counts.studySessions}`,
      `Assessment states: ${counts.assessmentStates}`,
      `School Plans: ${counts.schoolPlans}`,
      '',
      `Change: ${preview.changes.mode.replaceAll('-', ' ')}`,
      'A local safety snapshot will be created first. Continue?',
    ].join('\n'))
    if (!confirmed) return
    const parentPin = !parentAuthorized && !preview.requiresNewParentPin
      ? window.prompt(
        'Enter the current Parent PIN to authorize restore.') ?? undefined
      : undefined
    const newParentPin = preview.requiresNewParentPin
      ? window.prompt('Set a new 4-digit Parent PIN for this device after restore.') ?? undefined
      : undefined
    if (preview.requiresNewParentPin) {
      const confirmation = window.prompt('Enter the new Parent PIN again to confirm.') ?? undefined
      if (!newParentPin || newParentPin !== confirmation) {
        window.alert('Backup was not restored. The new Parent PIN entries did not match.')
        return
      }
    }
    const restored = await restoreFinalFamilyPilotBackup(text, {
      ...backupOptions,
      preview,
      authority: preview.requiresNewParentPin
        ? { newParentPin }
        : parentAuthorized ? { parentAuthorized: true } : { parentPin },
    })
    if (restored.status === 'rejected') window.alert(`Backup was not restored. ${parentBackupMessage(restored.reasonCode)}`)
    else {
      window.alert('Backup restored. A pre-restore safety snapshot was saved on this device.')
      refresh()
    }
  }

  if (app.status !== 'ready') {
    const recovery: FamilyPilotSnapshot = {
      status: app.status,
      reasonCode: app.reasonCode as FamilyPilotSnapshot['reasonCode'],
      state: core.state,
    }
    return (
      <FinalShell onExit={onExit} cloudState={cloudState}>
        <FamilyPilotRecoveryScreen
          snapshot={recovery}
          actions={{
            retry: () => window.location.reload(),
            exportBackup: () => { void exportFinalFamilyPilotBackup(backupOptions)
              .then(downloadFinalFamilyPilotBackup)
              .catch((error: unknown) => window.alert(messageOf(error))) },
            restoreBackup: () => restoreInput.current?.click(),
            returnHome: onExit,
          }}
        />
        <input ref={restoreInput} className="hidden" type="file" accept="application/json" onChange={(event) => void doRestore(event.target.files?.[0])} />
      </FinalShell>
    )
  }

  if (!app.state.setup.completedAt) {
    return (
      <FinalShell onExit={onExit} cloudState={cloudState}>
        <FamilyOnboarding
          controller={controller}
          mode="first-run"
          onContinue={() => {
            setParentAuthorized(true)
            setParentView('school-plan')
            setMode('parent')
            refresh()
          }}
        />
        <section className="mx-auto mb-8 max-w-6xl rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <h3 className="text-lg font-extrabold">Moving an existing family to this browser?</h3>
          <p className="mt-2 text-slate-700">Restore a Parent Download Backup instead of creating the family again.</p>
          <button type="button" className="mt-4 min-h-11 rounded-lg border border-cyan-700 bg-white px-4 py-2 font-bold text-cyan-900" onClick={() => restoreInput.current?.click()}>Restore a Family Pilot backup</button>
          <input ref={restoreInput} className="hidden" type="file" accept="application/json" onChange={(event) => void doRestore(event.target.files?.[0])} />
        </section>
      </FinalShell>
    )
  }

  const learnersMissingDevicePins = cloudState
    ? app.state.setup.students.filter((student) => !app.state.studentAccessVerifiers[student.studentRef])
    : []
  const parentPinMissing = Boolean(cloudState && !app.state.parentAccessVerifier)
  if (learnersMissingDevicePins.length > 0 || parentPinMissing) {
    return (
      <FinalShell onExit={onExit} cloudState={cloudState}>
        <FreshDeviceLearnerPinSetup
          controller={controller}
          students={learnersMissingDevicePins}
          requireParentPin={parentPinMissing}
          onComplete={refresh}
          onSignOut={onHouseholdSignOut}
        />
      </FinalShell>
    )
  }

  const openStudentRef = app.state.activeStudentRef
  if (openAssignmentRef && openStudentRef) {
    return (
      <FinalShell onExit={onExit} cloudState={cloudState}>
        {openAssignmentRef.startsWith('assessment:') ? (
          <AssessmentSurface
            key={`${openStudentRef}:${openAssignmentRef}`}
            controller={controller}
            studentRef={openStudentRef}
            assignmentRef={openAssignmentRef}
            onExit={() => { setOpenAssignmentRef(null); refresh() }}
            refresh={refresh}
          />
        ) : (
          <LessonSurface
            key={`${openStudentRef}:${openAssignmentRef}`}
            controller={controller}
            studentRef={openStudentRef}
            assignmentRef={openAssignmentRef}
            onExit={() => { setOpenAssignmentRef(null); refresh() }}
            refresh={refresh}
            trustedScorer={trustedScorer}
          />
        )}
      </FinalShell>
    )
  }

  if (mode === 'student' && openStudentRef) {
    const closeLearner = () => {
      controller.selectStudent(null)
      controller.lockParentSession()
      setParentAuthorized(false)
      setMode('student')
      refresh()
    }
    return (
      <StudentSurface
        controller={controller}
        autoPlannerHost={autoPlannerHost}
        onOpen={setOpenAssignmentRef}
        onLock={closeLearner}
        onSwitchLearner={closeLearner}
        onSignOut={() => { closeLearner(); (onHouseholdSignOut ?? onExit)() }}
        onOpenParentView={(view) => {
          controller.selectStudent(null)
          controller.lockParentSession()
          setParentAuthorized(false)
          setParentView(view)
          setMode('parent')
          refresh()
        }}
        refresh={refresh}
        revision={revision}
      />
    )
  }

  return (
    <FinalShell onExit={onExit} cloudState={cloudState}>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-semibold text-slate-600">
            Admitted release · 90 courses · 8,292 production-bound lessons
          </p>
          <div className="flex gap-2" role="group" aria-label="Family Pilot role">
            <button type="button" className={`rounded-lg px-4 py-2 font-bold ${mode === 'parent' ? 'bg-slate-900 text-white' : 'border'}`} onClick={() => { controller.selectStudent(null); controller.lockParentSession(); setParentAuthorized(false); setMode('parent'); refresh() }}>Parent</button>
            <button type="button" className={`rounded-lg px-4 py-2 font-bold ${mode === 'student' ? 'bg-cyan-700 text-white' : 'border'}`} onClick={() => { controller.selectStudent(null); controller.lockParentSession(); setParentAuthorized(false); setMode('student'); refresh() }}>Student</button>
          </div>
        </div>
      </div>
      {mode === 'student' ? (
        <StudentSurface
          controller={controller}
          autoPlannerHost={autoPlannerHost}
          onOpen={setOpenAssignmentRef}
          onLock={() => { controller.selectStudent(null); refresh() }}
          onSwitchLearner={() => { controller.selectStudent(null); refresh() }}
          onSignOut={() => { controller.selectStudent(null); refresh(); (onHouseholdSignOut ?? onExit)() }}
          onOpenParentView={(view) => { controller.lockParentSession(); setParentAuthorized(false); setParentView(view); setMode('parent'); refresh() }}
          refresh={refresh}
          revision={revision}
        />
      ) : !parentAuthorized ? (
        <ParentPinGate controller={controller} onAuthorized={() => setParentAuthorized(true)} />
      ) : (
        <ParentSurface
          controller={controller}
          autoPlannerHost={autoPlannerHost}
          view={parentView}
          setView={setParentView}
          onOpen={(studentRef, assignmentRef) => { controller.selectStudent(studentRef); setOpenAssignmentRef(assignmentRef); refresh() }}
          refresh={refresh}
          restoreInput={restoreInput}
          onRestore={doRestore}
          revision={revision}
          syncStatus={parentSyncStatus}
          deviceSyncSetup={deviceSyncSetup}
          onSignOut={onHouseholdSignOut}
          backupOptions={backupOptions}
        />
      )}
    </FinalShell>
  )
}

function FreshDeviceLearnerPinSetup({ controller, students, requireParentPin, onComplete, onSignOut }: {
  readonly controller: FinalFamilyPilotController
  readonly students: readonly FamilySetupStudent[]
  readonly requireParentPin: boolean
  readonly onComplete: () => void
  readonly onSignOut?: () => void
}) {
  const [pins, setPins] = useState<Readonly<Record<string, string>>>({})
  const [confirmations, setConfirmations] = useState<Readonly<Record<string, string>>>({})
  const [parentPin, setParentPin] = useState('')
  const [parentConfirmation, setParentConfirmation] = useState('')
  const [error, setError] = useState('')
  const save = () => {
    for (const student of students) {
      const pin = pins[student.studentRef] ?? ''
      if (!/^\d{4}$/.test(pin) || confirmations[student.studentRef] !== pin) {
        setError(`Enter the same 4-digit PIN twice for ${student.displayName}.`)
        return
      }
    }
    if (requireParentPin && (!/^\d{4}$/.test(parentPin) || parentConfirmation !== parentPin)) {
      setError('Enter the same 4-digit Parent PIN twice.')
      return
    }
    for (const student of students) controller.setStudentPin(student.studentRef, pins[student.studentRef]!)
    if (requireParentPin) controller.setParentPin(parentPin)
    controller.saveSetup({
      ...controller.appSnapshot.state.setup,
      students: Object.freeze(controller.appSnapshot.state.setup.students.map((student) => Object.freeze({
        ...student,
        pinRequired: true,
      }))),
    })
    setError('')
    onComplete()
  }
  const pinField = (studentRef: string, confirmation: boolean) => {
    const values = confirmation ? confirmations : pins
    const setValues = confirmation ? setConfirmations : setPins
    return {
      value: values[studentRef] ?? '',
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues({
        ...values,
        [studentRef]: event.target.value.replace(/\D/g, '').slice(0, 4),
      }),
    }
  }
  return <main className="mx-auto max-w-xl px-4 py-10" data-testid="fresh-device-learner-pin-setup">
    <p className="font-bold text-cyan-700">New device security</p>
    <h2 className="mt-1 text-3xl font-extrabold">Set PINs for this device</h2>
    <p className="mt-3 text-slate-700">PINs stay only on this computer and are never uploaded. Your family data is connected, but this device needs new local PINs before independent learner or Parent Hub access.</p>
    {requireParentPin ? <fieldset className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <legend className="px-1 font-extrabold">Parent Hub</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="font-bold">New Parent PIN<input aria-label="New device Parent PIN" inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-lg border px-3 py-2" value={parentPin} onChange={(event) => setParentPin(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
        <label className="font-bold">Confirm Parent PIN<input aria-label="Confirm new device Parent PIN" inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-lg border px-3 py-2" value={parentConfirmation} onChange={(event) => setParentConfirmation(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
      </div>
    </fieldset> : null}
    <div className="mt-6 space-y-5">
      {students.map((student) => <fieldset key={student.studentRef} className="rounded-xl border border-slate-200 bg-white p-4">
        <legend className="px-1 font-extrabold">{student.displayName}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="font-bold">New 4-digit PIN<input {...pinField(student.studentRef, false)} aria-label={`${student.displayName} new learner PIN`} inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <label className="font-bold">Confirm PIN<input {...pinField(student.studentRef, true)} aria-label={`${student.displayName} confirm learner PIN`} inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        </div>
      </fieldset>)}
    </div>
    <button type="button" className="mt-6 min-h-11 rounded-lg bg-slate-900 px-5 py-3 font-extrabold text-white" onClick={save}>Save PINs on this device</button>
    {onSignOut ? <button type="button" className="ml-3 mt-3 min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold" onClick={onSignOut}>Sign out</button> : null}
    {error ? <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 font-semibold" role="alert">{error}</p> : null}
  </main>
}

function ParentPinGate({ controller, onAuthorized }: { readonly controller: FinalFamilyPilotController; readonly onAuthorized: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  return <main className="mx-auto max-w-md px-4 py-10">
    <p className="font-bold text-cyan-700">Authorized adult only</p>
    <h2 className="mt-1 text-3xl font-extrabold">Unlock the Parent Hub</h2>
    <label className="mt-6 block font-bold">Parent PIN<input aria-label="Unlock parent PIN" autoFocus inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-lg border px-3 py-2" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
    <button type="button" className="mt-4 rounded-lg bg-slate-900 px-5 py-3 font-extrabold text-white" onClick={() => { if (controller.verifyParentPin(pin)) { setError(''); setPin(''); onAuthorized() } else setError('Parent authorization failed.') }}>Unlock Parent Hub</button>
    {error ? <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 font-semibold" role="alert">{error}</p> : null}
  </main>
}

function StudentSurface({ controller, autoPlannerHost, onOpen, onLock, onSwitchLearner, onSignOut, onOpenParentView, refresh, revision }: {
  readonly controller: FinalFamilyPilotController
  readonly autoPlannerHost: FinalFamilyAutoPlannerHost
  readonly onOpen: (assignmentRef: string) => void
  readonly onLock: () => void
  readonly onSwitchLearner: () => void
  readonly onSignOut: () => void
  readonly onOpenParentView: (view: 'school-plan' | 'assign' | 'reports') => void
  readonly refresh: () => void
  readonly revision: number
}) {
  const app = controller.appSnapshot.state
  const active = app.activeStudentRef
  const students = app.setup.students
  if (!active) {
    return (
      <FamilyPilotStudentLogin
        students={students.map((student) => ({ studentRef: toStudentSelector(student.studentRef), displayName: student.displayName, avatarInitial: student.displayName.charAt(0), pinRequired: student.pinRequired }))}
        activeStudentRef={null}
        onSelectStudent={() => undefined}
        onAuthenticated={(selector) => { controller.selectStudent(fromStudentSelector(selector)); refresh() }}
        onVerifyPin={(selector, pin) => controller.appSnapshot.state.studentAccessVerifiers[fromStudentSelector(selector)] === digestLocalPin(pin)}
        onLogout={() => undefined}
        onSwitchStudent={() => undefined}
      />
    )
  }
  return (
    <ActiveStudentDashboard
      key={active}
      activeStudentRef={active}
      controller={controller}
      autoPlannerHost={autoPlannerHost}
      onOpen={onOpen}
      onLock={onLock}
      onSwitchLearner={onSwitchLearner}
      onSignOut={onSignOut}
      onOpenParentView={onOpenParentView}
      revision={revision}
    />
  )
}

function ActiveStudentDashboard({ controller, autoPlannerHost, activeStudentRef, onOpen, onLock, onSwitchLearner, onSignOut, onOpenParentView, revision }: {
  readonly controller: FinalFamilyPilotController
  readonly autoPlannerHost: FinalFamilyAutoPlannerHost
  readonly activeStudentRef: string
  readonly onOpen: (assignmentRef: string) => void
  readonly onLock: () => void
  readonly onSwitchLearner: () => void
  readonly onSignOut: () => void
  readonly onOpenParentView: (view: 'school-plan' | 'assign' | 'reports') => void
  readonly revision: number
}) {
  const [model, setModel] = useState<FamilyPilotStudentDashboardModel | null>(null)
  const [planning, setPlanning] = useState<Awaited<ReturnType<FinalFamilyAutoPlannerHost['dashboardFor']>>['plan'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setModel(null)
    setPlanning(null)
    void autoPlannerHost.dashboardFor(activeStudentRef).then(async ({ plan, schedule }) => {
      const app = controller.appSnapshot
      const next = await buildFamilyPilotStudentDashboardModel({
        today: plan.localDate,
        activeStudentRef,
        setup: app.state.setup,
        coreState: controller.coreSnapshot.state,
        schedule,
        assessments: app.state.assessmentAssignments,
        attestations: app.state.attestations,
        sourceAttachments: app.state.sourceAttachments,
        safetyHolds: app.state.safety.holds,
        safetyRecovery: app.safetyRecovery,
        appStoreStatus: app.status,
        catalog: controller.catalog,
      })
      if (!live) return
      setPlanning(plan)
      setModel(next)
      setError(next ? null : 'The authorized learner dashboard is unavailable.')
    }).catch((cause: unknown) => {
      if (live) setError(messageOf(cause))
    })
    return () => { live = false }
  }, [activeStudentRef, autoPlannerHost, controller, revision])

  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-white"><p role="alert">{error}</p><button type="button" className="mt-4 rounded-lg border px-4 py-2" onClick={onLock}>Lock</button></main>
  if (!model || !planning) return <main className="min-h-screen bg-slate-950 p-6 text-white"><p role="status">Preparing today’s schoolwork…</p></main>

  const presentation = applyAutoPlannerPresentation(toStudentDashboardPresentation(model), planning, model)
  const commandForWork = (assignmentRef: string) => model.today.items
    .map((item) => item.action)
    .find((action) => action && (action.type === 'START' || action.type === 'CONTINUE') && action.studentRef === activeStudentRef && action.assignmentRef === assignmentRef)
  const openWork = (assignmentRef: string) => {
    const command = commandForWork(assignmentRef)
    if (command && (command.type === 'START' || command.type === 'CONTINUE')) onOpen(command.assignmentRef)
  }
  const openCourse = (courseRef: string) => {
    const command = model.courses.find((course) => course.action?.type === 'OPEN_COURSE' && course.action.studentRef === activeStudentRef && course.action.courseRef === courseRef)?.action
    if (!command) return
    document.getElementById('family-dashboard-today-heading')?.scrollIntoView({ block: 'start' })
  }
  const openSchedule = () => document.getElementById('family-dashboard-today-heading')?.scrollIntoView({ block: 'start' })
  const openTool = (toolRef: string) => {
    const command = model.tools.find((tool) => tool.action.type === toolRef && tool.action.studentRef === activeStudentRef)?.action
    if (command?.type === 'OPEN_REPORTS') onOpenParentView('reports')
    else if (command?.type === 'OPEN_ASSIGNMENTS') onOpenParentView(planning.status === 'NEEDS_PLAN_SETUP' && model.today.items.length === 0 ? 'school-plan' : 'assign')
    else if (command?.type === 'OPEN_SCHEDULE') openSchedule()
  }
  const signOut = () => {
    if (model.actions.signOut.studentRef === activeStudentRef) onSignOut()
  }
  const student = controller.appSnapshot.state.setup.students.find((item) => item.studentRef === activeStudentRef)
  const learnerProgress = student ? buildFamilyFactualProgress({
    student,
    coreState: controller.coreSnapshot.state,
    assessments: controller.assessmentAssignments(activeStudentRef),
    catalog: controller.catalog.runtime,
    today: model.today.date,
  }) : null

  return (
    <>
      <StudentDashboard
        model={presentation}
        jarvis={{ mode: 'visual-only', status: 'Jarvis is visual only. Tutor V2 is not connected in this release.' }}
        onOpenWork={openWork}
        onOpenCourse={openCourse}
        onOpenSchedule={openSchedule}
        onOpenTool={openTool}
        onLock={onLock}
        onSwitchLearner={onSwitchLearner}
        onSignOut={signOut}
      />
      {learnerProgress ? <div className="mx-auto max-w-6xl bg-slate-50 px-4 py-6"><LearnerFactualProgress model={learnerProgress} /></div> : null}
    </>
  )
}

function ParentSurface({ controller, autoPlannerHost, view, setView, onOpen, refresh, restoreInput, onRestore, revision, syncStatus: initialSyncStatus, deviceSyncSetup, onSignOut, backupOptions }: {
  readonly controller: FinalFamilyPilotController
  readonly autoPlannerHost: FinalFamilyAutoPlannerHost
  readonly view: ParentView
  readonly setView: (view: ParentView) => void
  readonly onOpen: (studentRef: string, assignmentRef: string) => void
  readonly refresh: () => void
  readonly restoreInput: React.RefObject<HTMLInputElement | null>
  readonly onRestore: (file: File | undefined) => Promise<void>
  readonly revision: number
  readonly syncStatus: ParentSyncStatusValueR1
  readonly deviceSyncSetup?: ParentDeviceSyncSetupRuntime
  readonly onSignOut?: () => void
  readonly backupOptions: FinalFamilyPilotBackupOptions
}) {
  const students = controller.appSnapshot.state.setup.students
  const [selectedRef, setSelectedRef] = useState(students[0]?.studentRef ?? '')
  const deviceSyncAvailable = isParentDeviceSyncSetupSimulation(deviceSyncSetup)
  const [syncStatus, setSyncStatus] = useState<ParentSyncStatusValueR1>(deviceSyncAvailable ? 'SYNC_READY' : initialSyncStatus)
  useEffect(() => {
    setSyncStatus(deviceSyncAvailable ? 'SYNC_READY' : initialSyncStatus)
  }, [deviceSyncAvailable, initialSyncStatus])
  const selected = students.find((item) => item.studentRef === selectedRef) ?? students[0]
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-cyan-700">Parent Hub</p>
          <h2 className="text-2xl font-extrabold">Household learning</h2>
        </div>
        <div className="flex items-center gap-3">
          <ParentSyncStatusR1 status={syncStatus} />
          <select aria-label="Parent student" className="rounded-lg border px-3 py-2 font-bold" value={selected?.studentRef ?? ''} onChange={(event) => setSelectedRef(event.target.value)}>
            {students.map((student) => <option key={student.studentRef} value={student.studentRef}>{student.displayName}</option>)}
          </select>
          {onSignOut ? <button type="button" className="min-h-11 rounded-lg border border-slate-400 bg-white px-3 py-2 font-bold" onClick={onSignOut}>Sign out family</button> : null}
        </div>
      </div>
      <nav className="mt-5 flex flex-wrap gap-2 print:hidden" aria-label="Parent Hub sections">
        {(['overview', 'preferences', 'school-plan', 'assign', 'review', 'reports', 'backup', 'devices'] as ParentView[]).map((item) => {
          const label = item === 'overview' ? 'Overview'
            : item === 'preferences' ? 'Family setup'
              : item === 'school-plan' ? 'School Plan'
                : item === 'assign' ? 'Assignments'
                  : item === 'review' ? 'Review Center'
                  : item === 'reports' ? 'Progress'
                    : item === 'devices' ? 'Device Sync'
                      : 'Backup/Recovery'
          return <button key={item} type="button" className={`min-h-11 rounded-lg px-4 py-2 font-bold ${view === item ? 'bg-slate-900 text-white' : 'border bg-white'}`} aria-current={view === item ? 'page' : undefined} onClick={() => setView(item)}>{label}</button>
        })}
      </nav>
      {view === 'devices' ? (
        deviceSyncAvailable ? (
          <ParentDeviceSyncSetup runtime={deviceSyncSetup} onStatusChange={setSyncStatus} />
        ) : (
          <section className="mt-6 rounded-2xl border bg-white p-5" data-testid="parent-device-sync-local-only">
            <p className="font-bold text-cyan-700">Device Sync</p>
            <h3 className="mt-1 text-2xl font-extrabold">Local only</h3>
            <p className="mt-2 max-w-2xl text-slate-600">Hosted Sync is off for this Family Pilot. Learning and backups continue on this device; no family data is being sent to a hosted service.</p>
            <button type="button" disabled className="mt-4 min-h-11 rounded-lg border px-4 py-2 font-bold opacity-60">Device setup unavailable</button>
          </section>
        )
      ) : view === 'overview' ? (
        <FamilyOverview
          controller={controller}
          host={autoPlannerHost}
          revision={revision}
          onOpenDetails={(studentRef) => { setSelectedRef(studentRef); setView('reports') }}
          onOpenSchoolPlan={(studentRef) => { setSelectedRef(studentRef); setView('school-plan') }}
        />
      ) : view === 'preferences' ? (
        <FamilyOnboarding controller={controller} mode="manage" onContinue={() => { setView('school-plan'); refresh() }} />
      ) : !selected ? <p className="mt-6">No configured students.</p> : view === 'review' ? (
        <ParentReviewCenter controller={controller} student={selected} refresh={refresh} />
      ) : view === 'school-plan' ? (
        <div className="mt-6 space-y-4">
          <FamilySchoolPlanPanel controller={controller} host={autoPlannerHost} student={selected} onSaved={refresh} />
          <button type="button" className="min-h-11 rounded-lg border border-cyan-700 bg-white px-4 py-2 font-bold text-cyan-900" onClick={() => setView('assign')}>Assignments &amp; readiness</button>
        </div>
      ) : view === 'assign' ? (
        <div className="mt-6">
          <button type="button" className="min-h-11 rounded-lg border bg-white px-4 py-2 font-bold" onClick={() => setView('school-plan')}>Back to School Plan</button>
          <ParentAssignments key={selected.studentRef} controller={controller} student={selected} onOpen={onOpen} refresh={refresh} />
        </div>
      ) : view === 'reports' ? (
        <ParentReports controller={controller} autoPlannerHost={autoPlannerHost} student={selected} refresh={refresh} />
      ) : (
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h3 className="text-xl font-extrabold">Backup and recovery</h3>
          <p className="mt-2 text-slate-600">Exports learner profiles and working levels, course and assignment progress, exact Study segment references, assessment states, School Plans, source metadata, attestations, preferences, and safety state. It never includes PINs, network secrets, learner answers, answer authority, or Tutor conversations.</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">Restore always verifies the checksum, shows a preview, requires Parent authorization, and creates a local safety snapshot before replacing data.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white" onClick={() => { void exportFinalFamilyPilotBackup(backupOptions)
              .then(downloadFinalFamilyPilotBackup)
              .catch((error: unknown) => window.alert(messageOf(error))) }}>Download family backup</button>
            <button type="button" className="rounded-lg border border-cyan-700 px-4 py-2 font-bold text-cyan-900" onClick={() => { void exportFinalFamilyPilotBackup({ ...backupOptions, learnerRef: selected.studentRef })
              .then(downloadFinalFamilyPilotBackup)
              .catch((error: unknown) => window.alert(messageOf(error))) }}>Download {selected.displayName}&apos;s backup</button>
            <button type="button" className="rounded-lg border px-4 py-2 font-bold" onClick={() => restoreInput.current?.click()}>Preview backup to restore</button>
          </div>
          <input ref={restoreInput} className="hidden" type="file" accept="application/json" onChange={(event) => void onRestore(event.target.files?.[0])} />
        </section>
      )}
    </main>
  )
}

function ParentAssignments({ controller, student, onOpen, refresh }: {
  readonly controller: FinalFamilyPilotController
  readonly student: FamilySetupStudent
  readonly onOpen: (studentRef: string, assignmentRef: string) => void
  readonly refresh: () => void
}) {
  const [bindingByAssignment, setBindingByAssignment] = useState<Record<string, Awaited<ReturnType<typeof controller.catalog.getBinding>>>>({})
  const [error, setError] = useState('')
  const assignments = controller.coreSnapshot.state.students.find((item) => item.studentRef === student.studentRef)?.assignments ?? []

  useEffect(() => {
    let live = true
    void Promise.all(assignments.map(async (assignment) => [assignment.assignmentRef, await controller.catalog.getBinding(assignment.lessonRef)] as const)).then((entries) => {
      if (live) setBindingByAssignment(Object.fromEntries(entries))
    })
    return () => { live = false }
  }, [controller, assignments.map((item) => `${item.assignmentRef}:${item.updatedAt}`).join('|')])

  return (
    <div className="mt-6 space-y-5">
      <ParentAssignmentLibrary controller={controller} student={student} onOpen={onOpen} refresh={refresh} />
      {assignments.filter((assignment) => bindingByAssignment[assignment.assignmentRef]?.sourceReadinessKind === 'DYNAMIC_SOURCE_REQUIRED').map((assignment) => (
        <DynamicSourceCard key={assignment.assignmentRef} controller={controller} student={student} assignment={assignment} attached={controller.appSnapshot.state.sourceAttachments.some((item) => item.studentRef === student.studentRef && item.assignmentRef === assignment.assignmentRef)} refresh={refresh} />
      ))}
      {error ? <p className="rounded-lg border border-red-300 bg-red-50 p-3 font-semibold" role="alert">{error}</p> : null}
    </div>
  )
}

function DynamicSourceCard({ controller, student, assignment, attached, refresh }: {
  readonly controller: FinalFamilyPilotController
  readonly student: FamilySetupStudent
  readonly assignment: FamilyPilotAssignmentRecordV1
  readonly attached: boolean
  readonly refresh: () => void
}) {
  const [metadataJson, setMetadataJson] = useState('')
  const [adultAttested, setAdultAttested] = useState(false)
  const [error, setError] = useState('')
  return (
    <section className="rounded-2xl border border-blue-300 bg-blue-50 p-5">
      <h3 className="font-extrabold">Dynamic Social Studies source</h3>
      <p className="mt-1 font-semibold">{assignment.title}: {attached ? 'ATTACHED_SATISFIED — start is unlocked.' : 'PENDING_SOURCE_ATTACHMENT — only this assignment is blocked.'}</p>
      {!attached ? <div className="mt-3 grid gap-3">
        <label className="font-semibold">Complete source metadata JSON
          <textarea className="mt-1 min-h-44 w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm" value={metadataJson} onChange={(event) => setMetadataJson(event.target.value)} placeholder="Paste a JSON array containing at least two metadata-only source records." />
        </label>
        <label className="flex items-start gap-2 font-semibold"><input type="checkbox" checked={adultAttested} onChange={(event) => setAdultAttested(event.target.checked)} />I am an authorized adult and attest that I opened, read, and reviewed these sources for authority, rights, safety, reading level, privacy, and unit sufficiency.</label>
        <button type="button" className="rounded-lg bg-blue-800 px-4 py-2 font-bold text-white" onClick={() => {
          try {
            const parsed = JSON.parse(metadataJson) as unknown
            if (!Array.isArray(parsed)) throw new Error('Source metadata must be a JSON array.')
            controller.attachDynamicSource({ studentRef: student.studentRef, assignmentRef: assignment.assignmentRef, sources: parsed, adultAttested })
            setError('')
            refresh()
          } catch (cause) { setError(messageOf(cause)) }
        }}>Attach qualifying metadata</button>
      </div> : null}
      <p className="mt-2 text-sm text-slate-600">All 36 contract fields, two-source unit sufficiency, and adult attestation are required. Metadata only: Family Pilot does not fetch arbitrary websites or store source bodies or quotations.</p>
      {error ? <p className="mt-2 font-semibold text-red-700" role="alert">{error}</p> : null}
    </section>
  )
}

function ParentReports({ controller, autoPlannerHost, student, refresh }: {
  readonly controller: FinalFamilyPilotController
  readonly autoPlannerHost: FinalFamilyAutoPlannerHost
  readonly student: FamilySetupStudent
  readonly refresh: () => void
}) {
  const [schoolPlan, setSchoolPlan] = useState<FamilyAutoPlannerSchoolPlanV1 | null>(null)
  useEffect(() => {
    let live = true
    setSchoolPlan(null)
    void autoPlannerHost.loadDocument(student.studentRef).then((loaded) => {
      if (live) setSchoolPlan(loaded.status === 'ready' ? loaded.document.schoolPlan : null)
    }).catch(() => { if (live) setSchoolPlan(null) })
    return () => { live = false }
  }, [autoPlannerHost, student.studentRef])
  const coreStudent = controller.coreSnapshot.state.students.find((item) => item.studentRef === student.studentRef)
  if (!coreStudent) return <p className="mt-6">No report data.</p>
  const assessmentAssignments = controller.assessmentAssignments(student.studentRef)
  const pendingGuardianAssignmentRefs = new Set(controller.pendingAttestations(student.studentRef)
    .map((attestation) => attestation.assignmentRef))
  const courseRefBySubject = schoolPlan
    ? Object.fromEntries(schoolPlan.subjects.flatMap((subject) => subject.courseRef ? [[subject.subject, subject.courseRef]] : []))
    : undefined
  const courseCompletion = student.enabledSubjects.map((subject) => deriveCanonicalCourseCompletion({
    catalog: controller.catalog.runtime,
    studentRef: student.studentRef,
    subject,
    workingGrade: student.workingGradeBySubject[subject] ?? student.nominalGrade,
    assignments: coreStudent.assignments,
    assessments: assessmentAssignments,
    pendingGuardianAssignmentRefs,
  }))
  return (
    <div className="mt-6 space-y-5">
      <ParentProgressReport
        source={{
          student,
          coreState: controller.coreSnapshot.state,
          assessments: assessmentAssignments,
          catalog: controller.catalog.runtime,
          courseRefBySubject,
        }}
        today={new Date().toISOString().slice(0, 10)}
        schoolYear={schoolPlan ? { startDate: schoolPlan.schoolYearStart, endDate: schoolPlan.schoolYearEnd } : null}
      />
      <ParentCourseCompletionReport courses={courseCompletion} />
      <section className="rounded-2xl border bg-white p-5 print:hidden">
        <h3 className="text-xl font-extrabold">Pending records</h3>
        <p className="mt-3 font-semibold">Pending guardian attestations: {controller.pendingAttestations(student.studentRef).length}</p>
        <p className="font-semibold">Open safety holds: {controller.openSafetyHolds(student.studentRef).length}</p>
        <button type="button" className="mt-3 rounded-lg border px-3 py-2 font-bold" onClick={refresh}>Refresh report</button>
      </section>
    </div>
  )
}

function AssessmentSurface({ controller, studentRef, assignmentRef, onExit, refresh }: {
  readonly controller: FinalFamilyPilotController
  readonly studentRef: string
  readonly assignmentRef: string
  readonly onExit: () => void
  readonly refresh: () => void
}) {
  const runtime = useMemo(() => new BrowserAssessmentRuntime(), [assignmentRef, studentRef])
  const [material, setMaterial] = useState<FinalLearnerAssessmentMaterial | null>(null)
  const [attempt, setAttempt] = useState<FinalAssessmentAttemptV1 | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyTask, setBusyTask] = useState<string | null>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let live = true
    void controller.loadAssessment(studentRef, assignmentRef).then(async (loaded) => {
      const stored = await runtime.load({ studentRef, assignmentRef, assessmentRef: loaded.material.assessmentRef })
      if (!live) return
      setMaterial(loaded.material)
      setAttempt(stored)
      setDrafts(Object.fromEntries(Object.entries(stored.responses).map(([taskRef, response]) => [taskRef, String(response.value)])))
      setBusyTask(null)
      refresh()
    }).catch((error: unknown) => { if (live) { setMessage(messageOf(error)); setBusyTask(null) } })
    return () => { live = false }
  }, [assignmentRef, controller, refresh, runtime, studentRef])

  const saveTask = async (taskRef: string) => {
    if (!material || !attempt || !drafts[taskRef]?.trim()) { setMessage('Enter a response before saving.'); return }
    setBusyTask(taskRef)
    try {
      const saved = await runtime.saveResponse({ studentRef, assignmentRef, assessmentRef: material.assessmentRef, taskRef, value: drafts[taskRef] })
      setAttempt(saved)
      controller.updateAssessmentStatus(studentRef, assignmentRef, 'ACTIVE')
      setMessage('Response saved and verified in durable device storage.')
      refresh()
    } catch (error) { setMessage(messageOf(error)) }
    setBusyTask(null)
  }

  const submitAssessment = async () => {
    if (!material || !attempt) return
    const missing = material.learnerTasks.filter((task) => !attempt.responses[task.taskRef])
    if (missing.length) { setMessage(`Save all required responses first (${missing.length} remaining).`); return }
    const status = material.completionScoringAuthorityClass === 'AUTO_SCOREABLE'
      ? 'PENDING_ASSESSMENT' as const
      : material.completionScoringAuthorityClass === 'RUBRIC_REQUIRED'
        ? 'ADULT_REVIEW_REQUIRED' as const
        : material.completionScoringAuthorityClass === 'GUARDIAN_REQUIRED'
          ? 'PENDING_GUARDIAN_ATTESTATION' as const
          : 'CERTIFIED' as const
    setBusyTask('submit')
    try {
      const saved = await runtime.setStatus(attempt, status)
      setAttempt(saved)
      controller.updateAssessmentStatus(studentRef, assignmentRef, status)
      setMessage(status === 'PENDING_ASSESSMENT'
        ? 'Submitted. Your work is waiting for trusted grading.'
        : status === 'ADULT_REVIEW_REQUIRED'
          ? 'Submitted. Your work is waiting for review.'
          : status === 'PENDING_GUARDIAN_ATTESTATION'
            ? 'Submitted. Ask your parent to review this completion.'
            : 'Submitted. You are ready to continue.')
      refresh()
    } catch (error) { setMessage(messageOf(error)) }
    setBusyTask(null)
  }

  if (busyTask === 'loading') return <main className="mx-auto max-w-4xl p-6"><p role="status">Loading admitted assessment material and durable attempt…</p></main>
  if (!material || !attempt) return <main className="mx-auto max-w-4xl p-6"><p role="alert">{message || 'Assessment unavailable.'}</p><button type="button" className="mt-4 rounded-lg border px-4 py-2 font-bold" onClick={onExit}>Back</button></main>

  return <main className="mx-auto max-w-4xl px-4 py-6" data-assessment-ref={material.assessmentRef}>
    <button type="button" className="rounded-lg border px-3 py-2 font-bold" onClick={onExit}>Back to Home</button>
    <section className="mt-4 rounded-2xl border bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Admitted learner assessment · {material.completionScoringAuthorityClass.replaceAll('_', ' ')}</p>
      <h1 className="mt-1 text-3xl font-extrabold">{material.location.unitTitle} assessment</h1>
      <p className="mt-2 font-semibold">{material.location.courseTitle} · Grade {material.grade}</p>
      <ul className="mt-4 list-disc space-y-1 pl-5">{material.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ul>
      <div className="mt-6 space-y-5">{material.learnerTasks.map((task, index) => {
        const saved = Boolean(attempt.responses[task.taskRef])
        return <section key={task.taskRef} className="rounded-xl bg-slate-50 p-4" data-assessment-task-ref={task.taskRef}>
          <h2 className="font-extrabold">Task {index + 1}</h2>
          {task.directions ? <p className="mt-1 text-sm text-slate-600">{task.directions}</p> : null}
          <p className="mt-2 whitespace-pre-wrap">{task.prompt}</p>
          {task.choices?.length ? <fieldset className="mt-3 space-y-2"><legend className="sr-only">Choose one response</legend>{task.choices.map((choice) => <label key={choice} className="flex gap-2"><input type="radio" name={task.taskRef} value={choice} checked={drafts[task.taskRef] === choice} onChange={(event) => setDrafts((held) => ({ ...held, [task.taskRef]: event.target.value }))} />{choice}</label>)}</fieldset> : <textarea aria-label={`Response for task ${index + 1}`} className="mt-3 min-h-28 w-full rounded-lg border bg-white p-3" value={drafts[task.taskRef] ?? ''} onChange={(event) => setDrafts((held) => ({ ...held, [task.taskRef]: event.target.value }))} />}
          <button type="button" className="mt-3 rounded-lg bg-cyan-700 px-3 py-2 font-bold text-white disabled:opacity-50" disabled={busyTask !== null || attempt.status !== 'ACTIVE'} onClick={() => void saveTask(task.taskRef)}>{saved ? 'Save updated response' : 'Save response'}</button>
          {saved ? <span className="ml-3 text-sm font-bold text-emerald-700">Saved in IndexedDB</span> : null}
        </section>
      })}</div>
      <button type="button" className="mt-6 rounded-lg bg-emerald-700 px-5 py-3 font-extrabold text-white disabled:opacity-50" disabled={busyTask !== null || attempt.status !== 'ACTIVE'} onClick={() => void submitAssessment()}>{attempt.status === 'ACTIVE' ? 'Submit assessment' : learnerAssessmentState(attempt.status)}</button>
      <p className="mt-3 font-semibold" role="status">{learnerAssessmentState(attempt.status)}</p>
      {message ? <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold" role="alert">{message}</p> : null}
    </section>
  </main>
}

function LessonSurface({ controller, studentRef, assignmentRef, onExit, refresh, trustedScorer }: {
  readonly controller: FinalFamilyPilotController
  readonly studentRef: string
  readonly assignmentRef: string
  readonly onExit: () => void
  readonly refresh: () => void
  readonly trustedScorer?: LearnerResponseAssessor
}) {
  const [result, setResult] = useState<FinalFamilyPilotControllerResult | null>(null)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const [tutorText, setTutorText] = useState('')
  const [focus, setFocus] = useState<FamilyPilotFocusSession | null>(null)
  const [responseView, setResponseView] = useState<{ readonly key: string; readonly presentation: LearnerResponsePresentation } | null>(null)
  const [responseLoadError, setResponseLoadError] = useState<{ readonly key: string; readonly message: string } | null>(null)
  const responseStore = useMemo(() => new BrowserLearnerResponseStore(), [assignmentRef, studentRef])
  const assignment = controller.coreSnapshot.state.students.find((item) => item.studentRef === studentRef)?.assignments.find((item) => item.assignmentRef === assignmentRef)
  const richRenderModel = useMemo(
    () => result?.status === 'ok' ? createRichLessonRenderModel(result.material) : null,
    [result],
  )

  const run = useCallback(async (action: () => Promise<FinalFamilyPilotControllerResult>) => {
    setBusy(true)
    const next = await action()
    setResult(next)
    setMessage(next.status === 'rejected' ? next.message : '')
    setBusy(false)
    refresh()
  }, [refresh])

  useEffect(() => {
    void run(() => assignment?.state === 'planned' ? controller.start(studentRef, assignmentRef) : controller.reopen(studentRef, assignmentRef))
    // Start/reopen exactly once for this keyed assignment surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentRef, assignmentRef])

  useEffect(() => {
    if (result?.status !== 'ok' || focus) return
    setFocus(startFocusSession({ studentRef, sessionRef: result.study.session.sessionRef, startedAt: new Date().toISOString() }))
  }, [focus, result, studentRef])
  useEffect(() => {
    if (!focus || result?.status !== 'ok' || result.study.sessionStatus !== 'active') return
    const timer = window.setInterval(() => {
      try {
        controller.recordInstructionalHeartbeat(studentRef, assignmentRef)
      } catch (error) {
        setMessage(messageOf(error))
      }
      setFocus((held) => {
        if (!held?.activeSince) return held
        const now = new Date().toISOString()
        return suggestBreak(recordActiveInterval(held, { from: held.activeSince, to: now }), DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE)
      })
    }, FAMILY_PILOT_ACTIVE_HEARTBEAT_SECONDS * 1_000)
    return () => window.clearInterval(timer)
  }, [assignmentRef, controller, focus?.sessionRef, result?.status === 'ok' ? result.study.sessionStatus : null, studentRef])

  useEffect(() => {
    if (result?.status !== 'ok') return
    if (result.study.sessionStatus === 'completed') {
      try { controller.endInstructionalSession(studentRef, assignmentRef) } catch (error) { setMessage(messageOf(error)) }
      return
    }
    if (result.study.sessionStatus !== 'active') return
    try {
      if (document.visibilityState === 'hidden') controller.hideInstructionalSession(studentRef, assignmentRef)
      else controller.showInstructionalSession(studentRef, assignmentRef)
    } catch (error) { setMessage(messageOf(error)) }
    const onVisibilityChange = () => {
      try {
        if (document.visibilityState === 'hidden') controller.hideInstructionalSession(studentRef, assignmentRef)
        else controller.showInstructionalSession(studentRef, assignmentRef)
      } catch (error) {
        setMessage(messageOf(error))
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      try { controller.hideInstructionalSession(studentRef, assignmentRef) } catch { /* surfaced by the next storage health read */ }
    }
  }, [assignmentRef, controller, result?.status === 'ok' ? result.study.sessionStatus : null, studentRef])

  const responseKey = result?.status === 'ok'
    ? `${result.study.lessonRef}|${result.study.session.sessionRef}|${result.study.segmentOrdinal ?? ''}|${result.study.segmentRef ?? ''}`
    : null
  useEffect(() => {
    if (result?.status !== 'ok' || !responseKey) return
    let live = true
    const runtime = new LearnerResponseRuntime(result.material, {
      lessonRef: result.study.lessonRef,
      studentRef: result.study.session.learnerRef,
      assignmentRef,
      attemptRef: result.study.session.sessionRef,
    }, responseStore, trustedScorer)
    void runtime.open(result.study.segmentOrdinal, result.study.segmentRef).then((presentation) => {
      if (!live) return
      setResponseView({ key: responseKey, presentation })
      setResponseLoadError(null)
    }).catch((error: unknown) => {
      if (live) setResponseLoadError({ key: responseKey, message: messageOf(error) })
    })
    return () => { live = false }
  }, [assignmentRef, responseKey, responseStore, result, trustedScorer])

  if (!assignment) return <main className="mx-auto max-w-4xl p-6"><p role="alert">That assignment is unavailable for this student.</p><button onClick={onExit}>Back</button></main>
  if (!result || busy && !result) return <main className="mx-auto max-w-4xl p-6"><p role="status">Opening durable Study and production materials…</p></main>
  if (result.status === 'rejected') return <main className="mx-auto max-w-4xl p-6"><h2 className="text-2xl font-extrabold">Lesson not ready</h2><p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 font-semibold" role="alert">{result.message}</p><button type="button" className="mt-4 rounded-lg border px-4 py-2 font-bold" onClick={onExit}>Back to Home</button></main>
  if (responseLoadError?.key === responseKey) return <main className="mx-auto max-w-4xl p-6"><h2 className="text-2xl font-extrabold">Responses not available</h2><p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 font-semibold" role="alert">{responseLoadError.message}</p><button type="button" className="mt-4 rounded-lg border px-4 py-2 font-bold" onClick={onExit}>Back to Home</button></main>
  const responsePresentation = responseView?.key === responseKey ? responseView.presentation : null
  if (!responsePresentation) return <main className="mx-auto max-w-4xl p-6"><p role="status">Opening durable learner responses…</p></main>

  const pending = result.completionStatus === 'PENDING_GUARDIAN_ATTESTATION'
  const certified = result.completionStatus === 'CERTIFIED' && result.study.assignmentState === 'completed'
  const responseRuntime = new LearnerResponseRuntime(result.material, {
    lessonRef: result.study.lessonRef,
    studentRef: result.study.session.learnerRef,
    assignmentRef,
    // Study's stable session is the attempt identity in this completion-authority path.
    attemptRef: result.study.session.sessionRef,
  }, responseStore, trustedScorer)
  const responseItem = responsePresentation.item
  const segmentContent = responseItem ? {
    lessonRef: responseItem.lessonRef,
    sectionRef: responseItem.sectionRef,
    itemRef: responseItem.itemRef,
    title: responseItem.title,
    instruction: responseItem.instruction,
    prompt: responseItem.prompt,
    example: responseItem.example,
    responseKind: responseItem.responseType,
    choices: responseItem.choices.map((choice) => ({ id: choice.choiceRef, label: choice.label })),
    pendingAssessmentCount: responsePresentation.pendingAssessmentCount,
    answeredItemRefs: responsePresentation.answeredItemRefs,
    requiredItemRefs: responsePresentation.requiredItemRefs,
    canCompleteSegment: responsePresentation.canCompleteSegment,
  } as const : {
    title: 'Responses saved',
    prompt: 'All required responses for this Study step are saved on this device.',
    responseKind: 'READ' as const,
    pendingAssessmentCount: responsePresentation.pendingAssessmentCount,
    answeredItemRefs: responsePresentation.answeredItemRefs,
    requiredItemRefs: responsePresentation.requiredItemRefs,
    canCompleteSegment: responsePresentation.canCompleteSegment,
  }

  const submitLearnerResponse = async (value: string) => {
    if (!responseItem) {
      setMessage('There is no active response item for this Study step.')
      return
    }
    setBusy(true)
    const saved = await responseRuntime.submit({
      lessonRef: result.study.lessonRef,
      sectionRef: responseItem.sectionRef,
      itemRef: responseItem.itemRef,
      segmentRef: responsePresentation.segmentRef,
      value,
    })
    if (saved.status === 'rejected') setMessage(saved.message)
    else {
      setMessage(saved.assessmentStatus === 'PENDING_ASSESSMENT'
        ? 'Response saved and verified in IndexedDB. Assessment is pending.'
        : 'Response saved and verified in IndexedDB, then assessed by the trusted assessor.')
      try {
        const presentation = await responseRuntime.open(result.study.segmentOrdinal, result.study.segmentRef)
        setResponseView({ key: responseKey as string, presentation })
      } catch (error) {
        setMessage(`The response was saved, but could not be reopened: ${messageOf(error)}`)
      }
    }
    setBusy(false)
    refresh()
  }

  const completePresentedSegment = () => {
    if (!responsePresentation.canCompleteSegment) {
      setMessage('Save every required response before continuing.')
      return
    }
    void run(() => controller.completeSegment(studentRef, assignmentRef))
  }
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <section data-material-ref={result.material.materialRef}>
        {focus?.breakSuggested ? <p className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-3 font-semibold" role="status">Break guidance: this is a good time for a short break. This is advisory only.</p> : null}
        {pending ? (
          <div>
            <h2 className="text-2xl font-extrabold">Work finished — parent sign-off pending</h2>
            <p className="mt-2 font-semibold">This Ready for Life assignment is not completed or certified yet. A parent must attest the exact student, assignment, lesson, and session.</p>
            <button type="button" className="mt-4 rounded-lg border px-4 py-2 font-bold" onClick={onExit}>Return Home</button>
          </div>
        ) : (
          <FamilyPilotLessonPlayer
            status={certified ? 'completed' : result.study.sessionStatus === 'paused' ? 'paused' : 'active'}
            snapshot={result.study}
            segmentContent={segmentContent}
            renderModel={richRenderModel?.mode === 'rich' ? richRenderModel : undefined}
            tutorHelpAvailable
            busy={busy}
            errorMessage={message}
            onSubmitAction={(value) => void submitLearnerResponse(value)}
            onPause={(progressRef) => void run(() => controller.pause(studentRef, assignmentRef, progressRef ?? null))}
            onResume={() => void run(() => controller.resume(studentRef, assignmentRef))}
            onNext={completePresentedSegment}
            onCompleteSegment={completePresentedSegment}
            onOpenTutor={() => setTutorText('Tutor help is reserved for a future trusted callback. Your lesson and response progress are unchanged.')}
            onExit={(progressRef) => {
              try { controller.hideInstructionalSession(studentRef, assignmentRef) } catch (error) { setMessage(messageOf(error)); return }
              void controller.checkpoint(studentRef, assignmentRef, progressRef ?? null).then(() => onExit())
            }}
          />
        )}
        {!pending && !certified ? <button type="button" className="mt-4 rounded-lg border border-amber-500 px-4 py-2 font-bold" onClick={() => void controller.requestAdultHelp(studentRef, assignmentRef).then(() => { setMessage('A parent check-in is now required for this exact session.'); refresh() }).catch((error) => setMessage(messageOf(error)))}>I need an adult check-in</button> : null}
        {tutorText ? <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3"><p className="font-bold">Tutor help</p><p className="mt-1">{tutorText}</p><p className="mt-2 text-sm text-slate-600">No Tutor runtime is mounted here. This callback carries lesson references only, and no conversation is persisted.</p></div> : null}
        {message ? <p className="mt-3 font-semibold text-amber-800" role="alert">{message}</p> : null}
      </section>
    </main>
  )
}
