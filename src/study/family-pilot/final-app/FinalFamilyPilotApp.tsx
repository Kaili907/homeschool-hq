import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  loadFinalFamilyPilotCatalog,
  type FinalLearnerAssessmentMaterial,
  type FinalLearnerProductionMaterial,
} from '../../../curriculum/final-app-data'
import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject, type Grade } from '../../../types'
import { FamilyPilotStudentLogin } from '../auth'
import { exportFinalFamilyPilotBackup, downloadFinalFamilyPilotBackup, restoreFinalFamilyPilotBackup } from './backup'
import {
  buildFamilyPilotStudentDashboardModel,
  type FamilyPilotStudentDashboardModel,
} from '../dashboard-adapter'
import { fromStudentSelector, toStudentSelector } from '../integration/identity'
import { FamilyPilotLessonPlayer } from '../lesson-player'
import { FamilyPilotParentAssignPanel } from '../parent-assign'
import { FamilyPreferences } from '../preferences'
import { FamilyPilotRecoveryScreen } from '../recovery'
import { buildStudentWeeklyReport, FamilyPilotProgressReport } from '../reports'
import { buildDailySchedule } from '../schedule'
import type { ScheduleItemV1 } from '../schedule'
import { StudentDashboard } from '../student-dashboard'
import {
  completeSetup,
  createStudent,
  setPinRequirement,
  setWorkingGrade,
  updateStudent,
  type FamilySetupState,
  type FamilySetupStudent,
} from '../setup'
import {
  recordActiveInterval,
  startFocusSession,
  suggestBreak,
  DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE,
  type FamilyPilotFocusSession,
} from '../focus'
import type { FamilyPilotAssignmentRecordV1, FamilyPilotSnapshot } from '../core'
import type { FamilyPilotStudentSnapshot } from '../parent'
import type { FamilyPilotStudySnapshot } from '../study'
import {
  academySubjectToStudySubject,
  FinalFamilyPilotController,
  type FinalFamilyPilotControllerResult,
} from './controller'
import {
  BrowserLearnerResponseStore,
  LearnerResponseRuntime,
  type LearnerResponsePresentation,
} from './learner-response'
import { digestLocalPin } from './state'
import {
  BrowserAssessmentRuntime,
  type FinalAssessmentAttemptV1,
} from './assessment'
import { toStudentDashboardPresentation } from './dashboardPresentation'

const SUBJECT_LABEL: Readonly<Record<AcademySubject, string>> = Object.freeze({
  mathematics: 'Mathematics',
  'english-language-arts': 'English Language Arts',
  science: 'Science',
  'social-studies': 'Social Studies',
  health: 'Health',
  'physical-education': 'Physical Education',
  'ready-for-life': 'Ready for Life',
  technology: 'Technology / Computer Science',
  'arts-and-music': 'Arts / Music',
  'financial-literacy': 'Financial Literacy',
})

type Mode = 'parent' | 'student'
type ParentView = 'assign' | 'reports' | 'preferences' | 'backup'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'That action could not be completed.'
}

export function FinalFamilyPilotApp({ onExit }: { readonly onExit: () => void }) {
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof loadFinalFamilyPilotCatalog>> | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let live = true
    void loadFinalFamilyPilotCatalog().then((loaded) => {
      if (live) setCatalog(loaded)
    }).catch((error: unknown) => {
      if (live) setCatalogError(messageOf(error))
    })
    return () => { live = false }
  }, [])

  const controller = useMemo(() => catalog ? new FinalFamilyPilotController({ catalog }) : null, [catalog])
  useEffect(() => () => controller?.close(), [controller])
  const refresh = useCallback(() => {
    controller?.refresh()
    setRevision((value) => value + 1)
  }, [controller])

  if (!catalog && !catalogError) {
    return <FinalShell onExit={onExit}><p className="rounded-xl bg-white p-6 font-semibold" role="status">Opening the admitted Family Pilot release…</p></FinalShell>
  }
  if (!catalog || !controller || catalogError) {
    return <FinalShell onExit={onExit}><p className="rounded-xl border border-red-300 bg-red-50 p-6 font-semibold" role="alert">{catalogError ?? 'The final curriculum could not be loaded.'}</p></FinalShell>
  }

  return <MountedFinalFamilyPilot controller={controller} onExit={onExit} refresh={refresh} revision={revision} />
}

function FinalShell({ onExit, children }: { readonly onExit: () => void; readonly children: React.ReactNode }) {
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
          This pilot currently saves progress in this browser on this device. Download backups regularly. Cross-device sync is coming next.
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
}: {
  readonly controller: FinalFamilyPilotController
  readonly onExit: () => void
  readonly refresh: () => void
  /** Forces a projection refresh without remounting an open Study session. */
  readonly revision: number
}) {
  const [mode, setMode] = useState<Mode>('student')
  const [parentAuthorized, setParentAuthorized] = useState(false)
  const [parentView, setParentView] = useState<ParentView>('assign')
  const [openAssignmentRef, setOpenAssignmentRef] = useState<string | null>(null)
  const restoreInput = useRef<HTMLInputElement>(null)
  const app = controller.appSnapshot
  const core = controller.coreSnapshot

  const doRestore = async (file: File | undefined) => {
    if (!file) return
    const restored = await restoreFinalFamilyPilotBackup(await file.text())
    if (restored.status === 'rejected') window.alert(`Backup was not restored: ${restored.reasonCode}`)
    else refresh()
  }

  if (app.status !== 'ready') {
    const recovery: FamilyPilotSnapshot = {
      status: app.status,
      reasonCode: app.reasonCode as FamilyPilotSnapshot['reasonCode'],
      state: core.state,
    }
    return (
      <FinalShell onExit={onExit}>
        <FamilyPilotRecoveryScreen
          snapshot={recovery}
          actions={{
            retry: () => window.location.reload(),
            exportBackup: () => { void exportFinalFamilyPilotBackup()
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
    return <FinalShell onExit={onExit}><SetupScreen controller={controller} refresh={refresh} restoreInput={restoreInput} onRestore={doRestore} onParentAuthorized={() => { setParentAuthorized(true); setMode('parent') }} /></FinalShell>
  }

  const openStudentRef = app.state.activeStudentRef
  if (openAssignmentRef && openStudentRef) {
    return (
      <FinalShell onExit={onExit}>
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
          />
        )}
      </FinalShell>
    )
  }

  if (mode === 'student' && openStudentRef) {
    const closeLearner = () => {
      controller.selectStudent(null)
      setParentAuthorized(false)
      setMode('student')
      refresh()
    }
    return (
      <StudentSurface
        controller={controller}
        onOpen={setOpenAssignmentRef}
        onLock={closeLearner}
        onSwitchLearner={closeLearner}
        onSignOut={() => { closeLearner(); onExit() }}
        onOpenParentView={(view) => {
          controller.selectStudent(null)
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
    <FinalShell onExit={onExit}>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-semibold text-slate-600">
            Admitted release · 90 courses · 8,292 production-bound lessons
          </p>
          <div className="flex gap-2" role="group" aria-label="Family Pilot role">
            <button type="button" className={`rounded-lg px-4 py-2 font-bold ${mode === 'parent' ? 'bg-slate-900 text-white' : 'border'}`} onClick={() => { controller.selectStudent(null); setMode('parent'); refresh() }}>Parent</button>
            <button type="button" className={`rounded-lg px-4 py-2 font-bold ${mode === 'student' ? 'bg-cyan-700 text-white' : 'border'}`} onClick={() => { controller.selectStudent(null); setMode('student'); refresh() }}>Student</button>
          </div>
        </div>
      </div>
      {mode === 'student' ? (
        <StudentSurface
          controller={controller}
          onOpen={setOpenAssignmentRef}
          onLock={() => { controller.selectStudent(null); refresh() }}
          onSwitchLearner={() => { controller.selectStudent(null); refresh() }}
          onSignOut={() => { controller.selectStudent(null); refresh(); onExit() }}
          onOpenParentView={(view) => { setParentAuthorized(false); setParentView(view); setMode('parent'); refresh() }}
          refresh={refresh}
          revision={revision}
        />
      ) : !parentAuthorized ? (
        <ParentPinGate controller={controller} onAuthorized={() => setParentAuthorized(true)} />
      ) : (
        <ParentSurface
          controller={controller}
          view={parentView}
          setView={setParentView}
          onOpen={(studentRef, assignmentRef) => { controller.selectStudent(studentRef); setOpenAssignmentRef(assignmentRef); refresh() }}
          refresh={refresh}
          restoreInput={restoreInput}
          onRestore={doRestore}
        />
      )}
    </FinalShell>
  )
}

function SetupScreen({ controller, refresh, restoreInput, onRestore, onParentAuthorized }: {
  readonly controller: FinalFamilyPilotController
  readonly refresh: () => void
  readonly restoreInput: React.RefObject<HTMLInputElement | null>
  readonly onRestore: (file: File | undefined) => Promise<void>
  readonly onParentAuthorized: () => void
}) {
  const [setup, setSetup] = useState<FamilySetupState>(controller.appSnapshot.state.setup)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState<Grade>('5')
  const [parentPin, setParentPin] = useState('')
  const [confirmParentPin, setConfirmParentPin] = useState('')
  const [error, setError] = useState('')

  const add = () => {
    const result = createStudent(setup, { displayName: name, nominalGrade: grade, enabledSubjects: ACADEMY_SUBJECTS }, new Date().toISOString())
    if (result.status !== 'ok') { setError(result.reason); return }
    setSetup(result.state)
    setName('')
    setError('')
  }
  const finish = () => {
    if (!/^\d{4}$/.test(parentPin) || parentPin !== confirmParentPin) { setError('Set and confirm a matching 4-digit parent PIN.'); return }
    const result = completeSetup(setup, new Date().toISOString())
    if (result.status !== 'ok') { setError(result.reason); return }
    try { controller.setParentPin(parentPin); controller.saveSetup(result.state); onParentAuthorized(); setParentPin(''); setConfirmParentPin(''); refresh() } catch (cause) { setError(messageOf(cause)) }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="font-bold text-cyan-700">First-run family setup</p>
      <h2 className="mt-1 text-3xl font-extrabold">Set up your learners</h2>
      <p className="mt-2 text-slate-600">Nominal grade is the reporting grade. Working grade is configured separately by subject after setup.</p>
      <section className="mt-6 rounded-2xl border bg-white p-5">
        <label className="block font-bold" htmlFor="family-setup-name">Student display name</label>
        <input id="family-setup-name" className="mt-1 w-full rounded-lg border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
        <label className="mt-4 block font-bold" htmlFor="family-setup-grade">Nominal grade</label>
        <select id="family-setup-grade" className="mt-1 rounded-lg border px-3 py-2" value={grade} onChange={(event) => setGrade(event.target.value as Grade)}>
          {(['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as Grade[]).map((value) => <option key={value} value={value}>Grade {value}{value === '6' ? ' (profile only; working-grade override required)' : ''}</option>)}
        </select>
        <button type="button" className="mt-4 rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white" onClick={add}>Add student</button>
      </section>
      <ul className="mt-4 space-y-2">
        {setup.students.map((student) => <li key={student.studentRef} className="rounded-xl border bg-white p-4 font-semibold">{student.displayName} · Nominal Grade {student.nominalGrade} · {student.enabledSubjects.length} subjects enabled</li>)}
      </ul>
      <section className="mt-6 rounded-2xl border bg-white p-5">
        <h3 className="font-extrabold">Protect the Parent Hub</h3>
        <p className="mt-1 text-sm text-slate-600">This local PIN authorizes guardian attestations, rubric review, source approval, preferences, and backups. Only a one-way verifier is stored.</p>
        <label className="mt-3 block font-bold">Parent PIN<input aria-label="Parent PIN" inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-lg border px-3 py-2" value={parentPin} onChange={(event) => setParentPin(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
        <label className="mt-3 block font-bold">Confirm parent PIN<input aria-label="Confirm parent PIN" inputMode="numeric" type="password" maxLength={4} className="mt-1 w-full rounded-lg border px-3 py-2" value={confirmParentPin} onChange={(event) => setConfirmParentPin(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
      </section>
      {error ? <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 font-semibold" role="alert">{error}</p> : null}
      <button type="button" className="mt-6 rounded-lg bg-emerald-700 px-5 py-3 font-extrabold text-white disabled:opacity-50" disabled={setup.students.length === 0} onClick={finish}>Finish family setup</button>
      <section className="mt-8 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
        <h3 className="text-lg font-extrabold">Moving an existing pilot to this browser?</h3>
        <p className="mt-2 text-slate-700">Restore a Parent Download Backup instead of creating the family again.</p>
        <button type="button" className="mt-4 rounded-lg border border-cyan-700 bg-white px-4 py-2 font-bold text-cyan-900" onClick={() => restoreInput.current?.click()}>Restore a Family Pilot backup</button>
        <input ref={restoreInput} className="hidden" type="file" accept="application/json" onChange={(event) => void onRestore(event.target.files?.[0])} />
      </section>
    </main>
  )
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

function StudentSurface({ controller, onOpen, onLock, onSwitchLearner, onSignOut, onOpenParentView, refresh, revision }: {
  readonly controller: FinalFamilyPilotController
  readonly onOpen: (assignmentRef: string) => void
  readonly onLock: () => void
  readonly onSwitchLearner: () => void
  readonly onSignOut: () => void
  readonly onOpenParentView: (view: 'assign' | 'reports') => void
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
      onOpen={onOpen}
      onLock={onLock}
      onSwitchLearner={onSwitchLearner}
      onSignOut={onSignOut}
      onOpenParentView={onOpenParentView}
      revision={revision}
    />
  )
}

function currentSchedule(
  studentRef: string,
  today: string,
  controller: FinalFamilyPilotController,
): readonly ScheduleItemV1[] {
  const assignments = controller.coreSnapshot.state.students
    .find((item) => item.studentRef === studentRef)?.assignments ?? []
  const lessonItems = buildDailySchedule({
    studentRef,
    date: today,
    items: assignments.map((item) => ({
      kind: 'assignment' as const,
      assignmentRef: item.assignmentRef,
      lessonRef: item.lessonRef,
      title: item.title,
      state: item.state,
    })),
  })
  const assessmentItems: readonly ScheduleItemV1[] = controller.assessmentAssignments(studentRef).map((item, index) => Object.freeze({
    scheduleItemRef: `schedule|${studentRef}|${today}|${item.assignmentRef}`,
    studentRef,
    date: today,
    title: item.title,
    kind: 'assignment' as const,
    order: lessonItems.length + index,
    status: item.status === 'CERTIFIED' ? 'completed' as const : item.status === 'PLANNED' ? 'pending' as const : 'in-progress' as const,
    assignmentRef: item.assignmentRef,
    lessonRef: null,
  }))
  return Object.freeze([...lessonItems, ...assessmentItems])
}

function ActiveStudentDashboard({ controller, activeStudentRef, onOpen, onLock, onSwitchLearner, onSignOut, onOpenParentView, revision }: {
  readonly controller: FinalFamilyPilotController
  readonly activeStudentRef: string
  readonly onOpen: (assignmentRef: string) => void
  readonly onLock: () => void
  readonly onSwitchLearner: () => void
  readonly onSignOut: () => void
  readonly onOpenParentView: (view: 'assign' | 'reports') => void
  readonly revision: number
}) {
  const [model, setModel] = useState<FamilyPilotStudentDashboardModel | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const app = controller.appSnapshot
    const today = new Date().toISOString().slice(0, 10)
    void buildFamilyPilotStudentDashboardModel({
      today,
      activeStudentRef,
      setup: app.state.setup,
      coreState: controller.coreSnapshot.state,
      schedule: currentSchedule(activeStudentRef, today, controller),
      assessments: app.state.assessmentAssignments,
      attestations: app.state.attestations,
      sourceAttachments: app.state.sourceAttachments,
      safetyHolds: app.state.safety.holds,
      safetyRecovery: app.safetyRecovery,
      appStoreStatus: app.status,
      catalog: controller.catalog,
    }).then((next) => {
      if (!live) return
      setModel(next)
      setError(next ? null : 'The authorized learner dashboard is unavailable.')
    }).catch((cause: unknown) => {
      if (live) setError(messageOf(cause))
    })
    return () => { live = false }
  }, [activeStudentRef, controller, revision])

  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-white"><p role="alert">{error}</p><button type="button" className="mt-4 rounded-lg border px-4 py-2" onClick={onLock}>Lock</button></main>
  if (!model) return <main className="min-h-screen bg-slate-950 p-6 text-white"><p role="status">Opening your dashboard…</p></main>

  const presentation = toStudentDashboardPresentation(model)
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
    else if (command?.type === 'OPEN_ASSIGNMENTS') onOpenParentView('assign')
    else if (command?.type === 'OPEN_SCHEDULE') openSchedule()
  }
  const signOut = () => {
    if (model.actions.signOut.studentRef === activeStudentRef) onSignOut()
  }

  return (
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
  )
}

function ParentSurface({ controller, view, setView, onOpen, refresh, restoreInput, onRestore }: {
  readonly controller: FinalFamilyPilotController
  readonly view: ParentView
  readonly setView: (view: ParentView) => void
  readonly onOpen: (studentRef: string, assignmentRef: string) => void
  readonly refresh: () => void
  readonly restoreInput: React.RefObject<HTMLInputElement | null>
  readonly onRestore: (file: File | undefined) => Promise<void>
}) {
  const students = controller.appSnapshot.state.setup.students
  const [selectedRef, setSelectedRef] = useState(students[0]?.studentRef ?? '')
  const selected = students.find((item) => item.studentRef === selectedRef) ?? students[0]
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-cyan-700">Parent Hub</p>
          <h2 className="text-2xl font-extrabold">Household learning</h2>
        </div>
        <select aria-label="Parent student" className="rounded-lg border px-3 py-2 font-bold" value={selected?.studentRef ?? ''} onChange={(event) => setSelectedRef(event.target.value)}>
          {students.map((student) => <option key={student.studentRef} value={student.studentRef}>{student.displayName}</option>)}
        </select>
      </div>
      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Parent Hub sections">
        {(['assign', 'reports', 'preferences', 'backup'] as ParentView[]).map((item) => <button key={item} type="button" className={`rounded-lg px-4 py-2 font-bold ${view === item ? 'bg-slate-900 text-white' : 'border bg-white'}`} onClick={() => setView(item)}>{item === 'assign' ? 'Assignments & readiness' : item.charAt(0).toUpperCase() + item.slice(1)}</button>)}
      </nav>
      {!selected ? <p className="mt-6">No configured students.</p> : view === 'assign' ? (
        <ParentAssignments controller={controller} student={selected} onOpen={onOpen} refresh={refresh} />
      ) : view === 'reports' ? (
        <ParentReports controller={controller} student={selected} refresh={refresh} />
      ) : view === 'preferences' ? (
        <PreferencesSurface controller={controller} student={selected} refresh={refresh} onClose={() => setView('assign')} />
      ) : (
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h3 className="text-xl font-extrabold">Backup and recovery</h3>
          <p className="mt-2 text-slate-600">Exports minimized roster, assignment progress, exact segment references, source metadata, attestations, preferences, and safety state. It never includes learner answers or Tutor conversations.</p>
          <div className="mt-4 flex gap-3">
            <button type="button" className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white" onClick={() => { void exportFinalFamilyPilotBackup()
              .then(downloadFinalFamilyPilotBackup)
              .catch((error: unknown) => window.alert(messageOf(error))) }}>Download backup</button>
            <button type="button" className="rounded-lg border px-4 py-2 font-bold" onClick={() => restoreInput.current?.click()}>Restore validated backup</button>
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
  const courses = controller.coursesFor(student)
  const [courseRef, setCourseRef] = useState(courses[0]?.courseRef ?? '')
  const [lessons, setLessons] = useState<Awaited<ReturnType<typeof controller.catalog.runtime.listLessons>>>([])
  const [bindingByAssignment, setBindingByAssignment] = useState<Record<string, Awaited<ReturnType<typeof controller.catalog.getBinding>>>>({})
  const [error, setError] = useState('')
  const assignments = controller.coreSnapshot.state.students.find((item) => item.studentRef === student.studentRef)?.assignments ?? []
  const selectedCourse = courses.find((item) => item.courseRef === courseRef) ?? courses[0]
  const availableAssessments = selectedCourse ? controller.assessmentsFor(student, selectedCourse.courseRef) : []
  const assessmentAssignments = controller.assessmentAssignments(student.studentRef)

  useEffect(() => {
    let live = true
    if (!selectedCourse) { setLessons([]); return () => { live = false } }
    void controller.catalog.runtime.listLessons(selectedCourse.courseRef).then((items) => { if (live) setLessons(items) })
    return () => { live = false }
  }, [controller, selectedCourse?.courseRef])
  useEffect(() => {
    let live = true
    void Promise.all(assignments.map(async (assignment) => [assignment.assignmentRef, await controller.catalog.getBinding(assignment.lessonRef)] as const)).then((entries) => {
      if (live) setBindingByAssignment(Object.fromEntries(entries))
    })
    return () => { live = false }
  }, [controller, assignments.map((item) => `${item.assignmentRef}:${item.updatedAt}`).join('|')])

  const studySubject = selectedCourse ? academySubjectToStudySubject(selectedCourse.subject) : 'other'
  const workingGrade = selectedCourse?.grade ?? Number(student.nominalGrade)
  const pending = controller.pendingAttestations(student.studentRef)
  const holds = controller.openSafetyHolds(student.studentRef)

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-2xl border bg-white p-5">
        <label className="font-bold" htmlFor="family-final-course">Admitted course</label>
        <select id="family-final-course" className="mt-2 w-full rounded-lg border px-3 py-2" value={selectedCourse?.courseRef ?? ''} onChange={(event) => setCourseRef(event.target.value)}>
          {courses.map((course) => <option key={course.courseRef} value={course.courseRef}>{course.title} · Grade {course.grade} · {course.lessonCount} lessons</option>)}
        </select>
        {courses.length === 0 ? <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold">No curriculum resolves for this configuration. A nominal Grade 6 student needs a supported per-subject working grade.</p> : null}
        <p className="mt-2 text-sm text-slate-600">Every admitted lesson in this course is available; the course payload is lazy-loaded only after this course is selected.</p>
      </section>
      {selectedCourse ? (
        <FamilyPilotParentAssignPanel
          student={{ studentRef: student.studentRef, displayName: student.displayName, nominalGrade: Number(student.nominalGrade) }}
          availableLessons={lessons.map((lesson) => ({ lessonRef: lesson.lessonRef, title: lesson.title, subject: studySubject, grade: lesson.grade }))}
          currentAssignments={assignments.map((assignment) => ({
            assignmentRef: assignment.assignmentRef,
            studentRef: student.studentRef,
            lessonRef: assignment.lessonRef,
            lessonTitle: assignment.title,
            subject: academySubjectToStudySubject(assignment.subject as AcademySubject),
            status: assignment.state === 'planned' ? 'not-started' : assignment.state === 'active' ? 'in-progress' : assignment.state === 'abandoned' ? 'skipped' : assignment.state,
            optional: false,
          }))}
          workingGrade={[{ subject: studySubject, grade: workingGrade }]}
          enabledSubjects={[studySubject]}
          onAssignLesson={async (studentRef, lessonRef) => {
            try { await controller.assignLesson(studentRef, lessonRef); refresh() } catch (cause) { setError(messageOf(cause)) }
          }}
          onResumeAssignment={onOpen}
        />
      ) : null}
      {selectedCourse ? <section className="rounded-2xl border bg-white p-5" data-testid="family-pilot-assessment-assignment">
        <h3 className="text-xl font-extrabold">Assessments</h3>
        <p className="mt-1 text-sm text-slate-600">All assessment prompts are learner material. Responses are saved in IndexedDB before submission; answer authority never enters the browser.</p>
        <ul className="mt-3 space-y-2">{availableAssessments.map((assessment) => {
          const assigned = assessmentAssignments.find((item) => item.assessmentRef === assessment.assessmentRef)
          return <li key={assessment.assessmentRef} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 p-3">
            <span><strong>{assessment.assessmentRef}</strong><br /><span className="text-sm">{assessment.authorityClass.replaceAll('_', ' ')}{assigned ? ` · ${assigned.status.replaceAll('_', ' ')}` : ''}</span></span>
            {assigned ? <button type="button" className="rounded-lg border bg-white px-3 py-2 font-bold" onClick={() => onOpen(student.studentRef, assigned.assignmentRef)}>Open</button> : <button type="button" className="rounded-lg bg-cyan-700 px-3 py-2 font-bold text-white" onClick={async () => { try { await controller.assignAssessment(student.studentRef, assessment.assessmentRef); refresh() } catch (cause) { setError(messageOf(cause)) } }}>Assign assessment</button>}
          </li>
        })}</ul>
      </section> : null}
      {assessmentAssignments.filter((item) => ['ADULT_REVIEW_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION'].includes(item.status)).map((assessment) => <section key={assessment.assignmentRef} className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h3 className="font-extrabold">Assessment authority pending</h3>
        <p className="mt-1">{assessment.title} · {assessment.status.replaceAll('_', ' ')}</p>
        <button type="button" className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" onClick={() => { controller.updateAssessmentStatus(student.studentRef, assessment.assignmentRef, 'CERTIFIED'); refresh() }}>{assessment.status === 'ADULT_REVIEW_REQUIRED' ? 'Record rubric review complete' : 'Guardian attest and certify'}</button>
      </section>)}
      {assignments.filter((assignment) => bindingByAssignment[assignment.assignmentRef]?.sourceReadinessKind === 'DYNAMIC_SOURCE_REQUIRED').map((assignment) => (
        <DynamicSourceCard key={assignment.assignmentRef} controller={controller} student={student} assignment={assignment} attached={controller.appSnapshot.state.sourceAttachments.some((item) => item.studentRef === student.studentRef && item.assignmentRef === assignment.assignmentRef)} refresh={refresh} />
      ))}
      {pending.map((item) => (
        <section key={`${item.studentRef}:${item.assignmentRef}:${item.sessionRef}`} className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h3 className="font-extrabold">Guardian attestation pending</h3>
          <p className="mt-1">{assignments.find((assignment) => assignment.assignmentRef === item.assignmentRef)?.title ?? item.lessonRef} is not certified or completed yet.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" onClick={async () => { const result = await controller.attest(student.studentRef, item.assignmentRef, 'adult-observed'); if (result.status === 'ok') refresh(); else setError(result.message) }}>Attest: adult observed</button>
            <button type="button" className="rounded-lg border border-emerald-700 bg-white px-4 py-2 font-bold" onClick={async () => { const result = await controller.attest(student.studentRef, item.assignmentRef, 'simulated-alternative'); if (result.status === 'ok') refresh(); else setError(result.message) }}>Equal-credit simulated alternative</button>
          </div>
        </section>
      ))}
      {holds.map((hold) => {
        const assignment = assignments.find((item) => controller.appSnapshot.state.sessions.some((session) => session.studentRef === student.studentRef && session.assignmentRef === item.assignmentRef && session.session.sessionRef === hold.sessionRef))
        return (
          <section key={hold.holdRef} className="rounded-2xl border border-red-300 bg-red-50 p-5">
            <h3 className="font-extrabold">Safety check-in</h3>
            <p className="mt-1">Held only for {student.displayName}’s exact Study session. Siblings remain available.</p>
            {assignment ? <button type="button" className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white" onClick={async () => { try { await controller.clearHold(student.studentRef, assignment.assignmentRef, hold.holdRef); refresh() } catch (cause) { setError(messageOf(cause)) } }}>Parent checked in — clear hold</button> : null}
          </section>
        )
      })}
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

function PreferencesSurface({ controller, student, refresh, onClose }: {
  readonly controller: FinalFamilyPilotController
  readonly student: FamilySetupStudent
  readonly refresh: () => void
  readonly onClose: () => void
}) {
  const change = (mutation: ReturnType<typeof updateStudent>) => {
    if (mutation.status !== 'ok') { window.alert(mutation.reason); return }
    controller.saveSetup(mutation.state)
    refresh()
  }
  return (
    <FamilyPreferences
      student={student}
      onUpdateDisplayName={(studentRef, displayName) => change(updateStudent(controller.appSnapshot.state.setup, studentRef, { displayName }, new Date().toISOString()))}
      onSetWorkingGrade={(studentRef, subject, grade) => change(setWorkingGrade(controller.appSnapshot.state.setup, studentRef, subject, grade, new Date().toISOString()))}
      onSetSubjectEnabled={(studentRef, subject, enabled) => {
        const held = controller.appSnapshot.state.setup.students.find((item) => item.studentRef === studentRef)
        if (!held) return
        const enabledSubjects = enabled ? [...held.enabledSubjects, subject] : held.enabledSubjects.filter((item) => item !== subject)
        change(updateStudent(controller.appSnapshot.state.setup, studentRef, { enabledSubjects }, new Date().toISOString()))
      }}
      onSetPinRequired={(studentRef, required) => {
        const result = setPinRequirement(controller.appSnapshot.state.setup, studentRef, required, new Date().toISOString())
        if (result.status !== 'ok') return
        const pin = required ? window.prompt('Choose a 4-digit local access PIN for this student.') : null
        if (required && !/^\d{4}$/.test(pin ?? '')) { window.alert('PIN was not changed. Enter exactly four digits.'); return }
        const next = result.state
        controller.saveSetup(next)
        controller.setStudentPin(studentRef, required && pin ? pin : null)
        refresh()
      }}
      onClose={onClose}
    />
  )
}

function ParentReports({ controller, student, refresh }: {
  readonly controller: FinalFamilyPilotController
  readonly student: FamilySetupStudent
  readonly refresh: () => void
}) {
  const coreStudent = controller.coreSnapshot.state.students.find((item) => item.studentRef === student.studentRef)
  if (!coreStudent) return <p className="mt-6">No report data.</p>
  const workItems = coreStudent.assignments.filter((item) => item.state !== 'abandoned').map((item) => ({
    blockRef: item.sessionRef ?? item.assignmentRef,
    title: item.title,
    status: item.state === 'planned' ? 'not-started' as const : item.state === 'active' ? 'in-progress' as const : item.state === 'paused' ? 'paused' as const : 'completed' as const,
    scheduledLocalDate: item.createdAt.slice(0, 10),
    requiredWorkCompletionPercent: item.progress.totalSegments > 0 ? Math.round(item.progress.completedSegmentRefs.length / item.progress.totalSegments * 100) : 0,
    currentSegmentTitle: item.pause.resumeSegmentRef,
    currentSegmentOrdinal: null,
    totalSegments: item.progress.totalSegments,
    completedSegmentCount: item.progress.completedSegmentRefs.length,
    timeOnTaskSeconds: item.progress.activeSeconds,
    pauseState: item.state === 'paused' ? { blockRef: item.sessionRef ?? item.assignmentRef, category: 'unspecified' as const } : null,
  }))
  const snapshot: FamilyPilotStudentSnapshot = {
    learner: { hostProfileRef: student.studentRef, learnerRef: student.studentRef, displayName: student.displayName },
    workItems,
    reviewItems: [],
    safety: { hasActiveStop: controller.openSafetyHolds(student.studentRef).length > 0, mostRecentStopAt: controller.openSafetyHolds(student.studentRef)[0]?.createdAt ?? null, historyState: controller.appSnapshot.safetyRecovery },
    counts: {
      notStarted: workItems.filter((item) => item.status === 'not-started').length,
      inProgress: workItems.filter((item) => item.status === 'in-progress').length,
      paused: workItems.filter((item) => item.status === 'paused').length,
      completed: workItems.filter((item) => item.status === 'completed').length,
    },
  }
  const report = buildStudentWeeklyReport(snapshot, { startDate: '2000-01-01', endDate: '2100-12-31' })
  const assessmentAssignments = controller.assessmentAssignments(student.studentRef)
  const subjectRows = Object.entries(coreStudent.assignments
    .filter((item) => item.state !== 'abandoned')
    .reduce<Record<string, FamilyPilotAssignmentRecordV1[]>>((groups, item) => {
      ;(groups[item.subject] ??= []).push(item)
      return groups
    }, {}))
  return (
    <div className="mt-6 space-y-5">
      <FamilyPilotProgressReport report={report} />
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-xl font-extrabold">Subject and grade progress</h3>
        <ul className="mt-3 space-y-2">{subjectRows.map(([subject, assignments]) => <li key={subject} className="rounded-lg bg-slate-100 p-3 font-semibold">{SUBJECT_LABEL[subject as AcademySubject] ?? subject} · Working Grade {student.workingGradeBySubject[subject as AcademySubject] ?? student.nominalGrade} · {assignments?.filter((item) => item.state === 'completed').length ?? 0}/{assignments?.length ?? 0} completed</li>)}</ul>
        <p className="mt-3 font-semibold">Pending guardian attestations: {controller.pendingAttestations(student.studentRef).length}</p>
        <p className="font-semibold">Assessments: {assessmentAssignments.filter((item) => item.status === 'CERTIFIED').length}/{assessmentAssignments.length} certified · {assessmentAssignments.filter((item) => item.status === 'PENDING_ASSESSMENT').length} trusted-scoring pending · {assessmentAssignments.filter((item) => item.status === 'ADULT_REVIEW_REQUIRED').length} rubric review pending</p>
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
        ? 'Submitted. Trusted scoring is unavailable offline, so this remains PENDING_ASSESSMENT; no correctness was fabricated.'
        : status === 'ADULT_REVIEW_REQUIRED'
          ? 'Submitted for adult rubric review.'
          : status === 'PENDING_GUARDIAN_ATTESTATION'
            ? 'Submitted. Guardian attestation is required before certification.'
            : 'Completion evidence submitted and certified.')
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
          <button type="button" className="mt-3 rounded-lg bg-cyan-700 px-3 py-2 font-bold text-white disabled:opacity-50" disabled={busyTask !== null} onClick={() => void saveTask(task.taskRef)}>{saved ? 'Save updated response' : 'Save response'}</button>
          {saved ? <span className="ml-3 text-sm font-bold text-emerald-700">Saved in IndexedDB</span> : null}
        </section>
      })}</div>
      <button type="button" className="mt-6 rounded-lg bg-emerald-700 px-5 py-3 font-extrabold text-white disabled:opacity-50" disabled={busyTask !== null || attempt.status === 'CERTIFIED'} onClick={() => void submitAssessment()}>{attempt.status === 'CERTIFIED' ? 'Certified' : 'Submit assessment'}</button>
      <p className="mt-3 font-semibold" role="status">Status: {attempt.status.replaceAll('_', ' ')}</p>
      {message ? <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold" role="alert">{message}</p> : null}
    </section>
  </main>
}

function materialLabel(value: string): string {
  return value.replaceAll('_', ' ').replaceAll(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function MaterialValue({ value }: { readonly value: unknown }) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' || typeof value === 'number') return <p className="mt-2 whitespace-pre-wrap">{String(value)}</p>
  if (typeof value === 'boolean') return <p className="mt-2">{value ? 'Yes' : 'No'}</p>
  if (Array.isArray(value)) return <ul className="mt-2 list-disc space-y-1 pl-5">{value.map((item, index) => <li key={index}><MaterialValue value={item} /></li>)}</ul>
  if (typeof value === 'object') return <dl className="mt-2 space-y-2">{Object.entries(value).map(([key, item]) => item === null || item === undefined || item === '' || Array.isArray(item) && item.length === 0 ? null : <div key={key}><dt className="font-bold">{materialLabel(key)}</dt><dd className="ml-3"><MaterialValue value={item} /></dd></div>)}</dl>
  return null
}

function MaterialView({ material }: { readonly material: FinalLearnerProductionMaterial }) {
  const supplemental = [
    ['Essential question', material.essentialQuestion],
    ['Key points', material.keyPoints],
    ['Materials', material.materials],
    ['Movement cues', material.movementCues],
    ['Technique', material.technique],
    ['Space setup', material.spaceSetup],
    ['Equipment and no-equipment route', material.equipmentRequirements],
    ['Accessible adaptation', material.accessibleAdaptation],
    ['No-equipment alternative', material.noEquipmentAlternative],
    ['Safety rules', material.safetyRules],
    ['Stopping rules', material.stoppingRules],
    ['Activity steps', material.activitySteps],
    ['Completion and success criteria', material.successCriteria],
    ['Rubric-facing criteria', material.rubricCriteria],
    ['Simulation or model-data alternative', material.simulationAlternative],
    ['Technology activity setup', material.activitySetup],
    ['Attached learner resource', material.learnerResource],
    ['Source metadata and context', material.sourceMetadata],
    ['Common error to watch for', material.commonErrorToWatchFor],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0))
  return (
    <section className="rounded-2xl border border-cyan-200 bg-white p-5" data-material-ref={material.materialRef}>
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Admitted learner material · {material.subject}</p>
      <h2 className="mt-1 text-2xl font-extrabold">{material.title}</h2>
      {supplemental.length ? <div className="mt-4 space-y-4" data-testid="learner-material-contract">{supplemental.map(([title, value]) => <section key={String(title)} className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-extrabold">{String(title)}</h3><MaterialValue value={value} /></section>)}</div> : null}
      {material.format === 'markdown' ? <div className="mt-4 whitespace-pre-wrap font-serif leading-7">{material.markdown}</div> : (
        <div className="mt-4 space-y-4">{material.sections.map((section, index) => <section key={`${section.title}:${index}`} className="rounded-xl bg-slate-50 p-4"><h3 className="font-extrabold">{section.title}</h3>{section.body ? <p className="mt-2 whitespace-pre-wrap">{section.body}</p> : null}{section.prompts.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{section.prompts.map((prompt, promptIndex) => <li key={`${promptIndex}:${prompt}`}>{prompt}</li>)}</ul> : null}</section>)}</div>
      )}
    </section>
  )
}

function LessonSurface({ controller, studentRef, assignmentRef, onExit, refresh }: {
  readonly controller: FinalFamilyPilotController
  readonly studentRef: string
  readonly assignmentRef: string
  readonly onExit: () => void
  readonly refresh: () => void
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
    const timer = window.setInterval(() => setFocus((held) => {
      if (!held?.activeSince) return held
      const now = new Date().toISOString()
      return suggestBreak(recordActiveInterval(held, { from: held.activeSince, to: now }), DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE)
    }), 60_000)
    return () => window.clearInterval(timer)
  }, [focus?.sessionRef, result?.status === 'ok' ? result.study.sessionStatus : null])

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
    }, responseStore)
    void runtime.open(result.study.segmentOrdinal, result.study.segmentRef).then((presentation) => {
      if (!live) return
      setResponseView({ key: responseKey, presentation })
      setResponseLoadError(null)
    }).catch((error: unknown) => {
      if (live) setResponseLoadError({ key: responseKey, message: messageOf(error) })
    })
    return () => { live = false }
  }, [assignmentRef, responseKey, responseStore, result])

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
  }, responseStore)
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
  } as const : {
    title: 'Responses saved',
    prompt: 'All required responses for this Study step are saved on this device.',
    responseKind: 'READ' as const,
    pendingAssessmentCount: responsePresentation.pendingAssessmentCount,
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
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
      <MaterialView material={result.material} />
      <section className="rounded-2xl border bg-white p-5">
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
            tutorHelpAvailable
            busy={busy}
            errorMessage={message}
            onSubmitAction={(value) => void submitLearnerResponse(value)}
            onPause={() => void run(() => controller.pause(studentRef, assignmentRef))}
            onResume={() => void run(() => controller.resume(studentRef, assignmentRef))}
            onNext={completePresentedSegment}
            onCompleteSegment={completePresentedSegment}
            onOpenTutor={() => void controller.tutor(studentRef, assignmentRef).then((tutor) => setTutorText(tutor.status === 'ok' ? tutor.step.presentation.visibleText : tutor.message)).catch((error) => setTutorText(messageOf(error)))}
            onExit={() => void controller.checkpoint(studentRef, assignmentRef).then(() => onExit())}
          />
        )}
        {!pending && !certified ? <button type="button" className="mt-4 rounded-lg border border-amber-500 px-4 py-2 font-bold" onClick={() => void controller.requestAdultHelp(studentRef, assignmentRef).then(() => { setMessage('A parent check-in is now required for this exact session.'); refresh() }).catch((error) => setMessage(messageOf(error)))}>I need an adult check-in</button> : null}
        {tutorText ? <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3"><p className="font-bold">Tutor help</p><p className="mt-1">{tutorText}</p><p className="mt-2 text-sm text-slate-600">If Tutor Core is unavailable, this is the accepted static curriculum fallback. No conversation is persisted.</p></div> : null}
        {message ? <p className="mt-3 font-semibold text-amber-800" role="alert">{message}</p> : null}
      </section>
    </main>
  )
}
