import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  isFamilyPilotDiagnosticsEnabledFromHost,
  isFamilyPilotEnabledFromHost,
} from '../familyPilotFlag'
import {
  createFamilyPilotStudent,
  loadFamilyPilotState,
  projectFamilyPilotDiagnostics,
  projectFamilyPilotParentProgress,
  resetFamilyPilotState,
  setActiveFamilyPilotStudent,
  updateFamilyPilotState,
  type FamilyPilotSnapshot,
  type FamilyPilotStoreOptions,
} from './core'

// FAMILY-PILOT-CORE: the gated shell.
//
// The shell owns state custody only. The student, study, parent and tutor
// surfaces are built by parallel sessions and mount through `children`, so this
// file never has to know what a lesson looks like to keep a household's data
// correct.

/**
 * What the shell hands to a render-function child. The integrated pilot needs
 * the shell's OWN snapshot rather than a second read of storage: two surfaces
 * holding independent copies of "who is active" is precisely how one learner's
 * work ends up rendered under another's name.
 */
export interface FamilyPilotShellContext {
  readonly snapshot: FamilyPilotSnapshot
  readonly activeStudentRef: string | null
  /** Re-reads pilot state after a child has written to it. */
  readonly reload: () => void
}

export interface FamilyPilotShellProps {
  readonly onExit: () => void
  /** Defence in depth: the route gates entry, and the shell gates render. */
  readonly enabled?: boolean
  readonly diagnostics?: boolean
  readonly store?: FamilyPilotStoreOptions
  /** A plain node, or a function given custody of the shell's live snapshot. */
  readonly children?: ReactNode | ((context: FamilyPilotShellContext) => ReactNode)
}

function newStudentRef(): string {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}:${Math.random().toString(36).slice(2)}`
  return `student:${value}`
}

export function FamilyPilotShell({
  onExit,
  enabled,
  diagnostics,
  store,
  children,
}: FamilyPilotShellProps) {
  // Both hooks run unconditionally; the props only override the result. Writing
  // this as `enabled ?? useMemo(...)` would skip the hook whenever the prop was
  // supplied, changing the hook order between renders.
  const hostEnabled = useMemo(isFamilyPilotEnabledFromHost, [])
  const hostDiagnostics = useMemo(isFamilyPilotDiagnosticsEnabledFromHost, [])
  const pilotEnabled = enabled ?? hostEnabled
  const showDiagnostics = diagnostics ?? hostDiagnostics
  const storeOptions = useMemo(() => store ?? {}, [store])
  const now = useMemo(() => storeOptions.now ?? nowIso, [storeOptions])
  const [snapshot, setSnapshot] = useState<FamilyPilotSnapshot>(
    () => loadFamilyPilotState(storeOptions),
  )
  const [name, setName] = useState('')

  const writable = snapshot.status === 'ready' || snapshot.status === 'recovered'

  const apply = useCallback(
    (mutate: Parameters<typeof updateFamilyPilotState>[0]) => {
      setSnapshot(updateFamilyPilotState(mutate, storeOptions))
    },
    [storeOptions],
  )

  const addStudent = useCallback(() => {
    const displayName = name.trim()
    if (!displayName || !writable) return
    const studentRef = newStudentRef()
    apply((state) => createFamilyPilotStudent(state, { studentRef, displayName }, now()))
    setName('')
  }, [apply, name, now, writable])

  const progress = useMemo(
    () => projectFamilyPilotParentProgress(snapshot.state, snapshot.state.activeStudentRef),
    [snapshot.state],
  )

  const reload = useCallback(() => {
    setSnapshot(loadFamilyPilotState(storeOptions))
  }, [storeOptions])

  const body = typeof children === 'function'
    ? children({ snapshot, activeStudentRef: snapshot.state.activeStudentRef, reload })
    : children

  if (!pilotEnabled) return null

  return (
    <main className="study-runtime-host min-h-screen bg-slate-50 p-6 text-slate-900">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold" tabIndex={-1}>Family Pilot</h1>
            <p className="mt-1 font-semibold text-slate-600">
              Saved on this device only. Each learner keeps their own work.
            </p>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
            onClick={onExit}
          >
            Back home
          </button>
        </header>

        {snapshot.status === 'recovered' && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold" role="alert">
            Saved pilot data could not be read, so this device started a fresh copy.
            The unreadable copy was kept for troubleshooting and nothing was sent anywhere.
          </p>
        )}
        {snapshot.status === 'read-only' && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold" role="alert">
            This device has pilot data from a newer version of the app. It has been
            left untouched and cannot be changed here — update the app to use it.
          </p>
        )}
        {snapshot.status === 'unavailable' && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold" role="alert">
            This browser is not allowing local saving, so pilot work will not be
            kept after you close this page.
          </p>
        )}

        <section className="mt-6" aria-labelledby="family-pilot-learners">
          <h2 id="family-pilot-learners" className="font-extrabold">Learners</h2>
          {snapshot.state.students.length === 0 && (
            <p className="mt-2 font-semibold text-slate-600">No learners yet.</p>
          )}
          <ul className="mt-2 space-y-2">
            {snapshot.state.students.map((student) => {
              const active = student.studentRef === snapshot.state.activeStudentRef
              return (
                <li key={student.studentRef}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    data-student-ref={student.studentRef}
                    className={`min-h-11 w-full rounded-lg border px-4 py-2 text-left font-bold ${
                      active ? 'border-cyan-800 bg-cyan-50' : 'border-slate-300 bg-white'
                    }`}
                    disabled={!writable}
                    onClick={() => apply((state) =>
                      setActiveFamilyPilotStudent(state, student.studentRef))}
                  >
                    {student.displayName}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-3 flex gap-2">
            <label className="sr-only" htmlFor="family-pilot-new-learner">New learner name</label>
            <input
              id="family-pilot-new-learner"
              className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-semibold"
              value={name}
              maxLength={160}
              disabled={!writable}
              onChange={(event) => setName(event.target.value)}
            />
            <button
              type="button"
              className="min-h-11 rounded-lg border border-cyan-800 bg-cyan-700 px-4 py-2 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!writable || name.trim().length === 0}
              onClick={addStudent}
            >
              Add learner
            </button>
          </div>
        </section>

        {progress && (
          <section className="mt-6" aria-labelledby="family-pilot-progress">
            <h2 id="family-pilot-progress" className="font-extrabold">
              {progress.displayName}: progress
            </h2>
            <p className="mt-1 font-semibold text-slate-600">
              {progress.completedCount} finished · {progress.inProgressCount} in progress
            </p>
            <ul className="mt-2 space-y-2">
              {progress.assignments.map((assignment) => (
                <li
                  key={assignment.assignmentRef}
                  className="rounded-lg border border-slate-200 p-3"
                  data-assignment-ref={assignment.assignmentRef}
                >
                  <p className="font-bold">{assignment.title}</p>
                  <p className="mt-1 font-semibold text-slate-600">
                    {assignment.subject} · {assignment.state} · {assignment.percentComplete}%
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {body}

        <section className="mt-6" aria-labelledby="family-pilot-data">
          <h2 id="family-pilot-data" className="font-extrabold">Pilot data</h2>
          <button
            type="button"
            className="mt-2 min-h-11 rounded-lg border border-rose-400 bg-white px-4 py-2 font-bold text-rose-800"
            disabled={snapshot.status === 'read-only'}
            onClick={() => setSnapshot(resetFamilyPilotState(storeOptions))}
          >
            Reset pilot data on this device
          </button>
        </section>

        {showDiagnostics && <FamilyPilotDiagnosticsPanel snapshot={snapshot} />}
      </section>
    </main>
  )
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Development-only. Shows refs and states; never learner work. */
function FamilyPilotDiagnosticsPanel({ snapshot }: { readonly snapshot: FamilyPilotSnapshot }) {
  const view = projectFamilyPilotDiagnostics(snapshot)
  return (
    <section
      className="mt-6 rounded-lg border border-slate-300 bg-slate-50 p-3"
      aria-labelledby="family-pilot-diagnostics"
      data-testid="family-pilot-diagnostics"
    >
      <h2 id="family-pilot-diagnostics" className="font-extrabold">PILOT diagnostics</h2>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm">
        {Object.entries(view).map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="font-semibold text-slate-600">{key}</dt>
            <dd data-diagnostic={key}>{value === null ? '—' : String(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
