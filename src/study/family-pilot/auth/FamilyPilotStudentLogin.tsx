import { useState } from 'react'
import {
  checkPin,
  findStudentByRef,
  pickStudent,
  studentRefKey,
  studentRequiresPin,
} from './loginFlow'
import type { FamilyPilotStudentLoginProps, FamilyPilotStudentProfile, FamilyPilotStudentRef } from './types'

const PIN_LENGTH = 4

function initialFor(student: FamilyPilotStudentProfile): string {
  return (student.avatarInitial ?? student.displayName.charAt(0) ?? '?').toUpperCase()
}

/**
 * Self-contained Family Pilot student-entry screen: "Who's studying?"
 *
 * Fully controlled by `activeStudentRef` — this component holds no session
 * or assignment state of its own, so it cannot retain a prior student's
 * context across a switch. The host owns the actual Study session and is
 * notified of every intent through the callbacks.
 */
export function FamilyPilotStudentLogin(props: FamilyPilotStudentLoginProps) {
  const { activeStudentRef, students, loading = false, error = null } = props

  const activeStudent = findStudentByRef(students, activeStudentRef)

  return (
    <div className="family-pilot-auth min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#family-pilot-auth-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow"
      >
        Skip to student sign-in
      </a>
      <main id="family-pilot-auth-main" className="mx-auto max-w-3xl px-4 py-8" aria-busy={loading}>
        {activeStudentRef ? (
          <ActiveStudentPanel
            student={activeStudent}
            onLogout={props.onLogout}
            onSwitchStudent={props.onSwitchStudent}
          />
        ) : (
          <StudentPicker
            students={students}
            loading={loading}
            error={error}
            onSelectStudent={props.onSelectStudent}
            onVerifyPin={props.onVerifyPin}
            onAuthenticated={props.onAuthenticated}
            onParentRecover={props.onParentRecover}
          />
        )}
      </main>
    </div>
  )
}

function StudentPicker({
  students,
  loading,
  error,
  onSelectStudent,
  onVerifyPin,
  onAuthenticated,
  onParentRecover,
}: {
  students: readonly FamilyPilotStudentProfile[]
  loading: boolean
  error: string | null
  onSelectStudent: (studentRef: FamilyPilotStudentRef) => void
  onVerifyPin?: (studentRef: FamilyPilotStudentRef, pin: string) => boolean
  onAuthenticated: (studentRef: FamilyPilotStudentRef) => void
  onParentRecover?: (studentRef: FamilyPilotStudentRef) => void
}) {
  const [selectedRef, setSelectedRef] = useState<FamilyPilotStudentRef | null>(null)

  const selectedStudent = findStudentByRef(students, selectedRef)

  function handlePick(student: FamilyPilotStudentProfile) {
    setSelectedRef(pickStudent(onSelectStudent, student))
  }

  if (!loading && !error && selectedStudent && selectedRef) {
    return (
      <StudentConfirm
        student={selectedStudent}
        studentRef={selectedRef}
        onBack={() => setSelectedRef(null)}
        onVerifyPin={onVerifyPin}
        onAuthenticated={onAuthenticated}
        onParentRecover={onParentRecover}
      />
    )
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-bold">Who&rsquo;s studying?</h1>
        <p className="mt-1 text-slate-600">Pick your profile to start.</p>
      </header>

      {loading && (
        <p className="mt-6 rounded-xl bg-white p-5" role="status">
          Loading student profiles…
        </p>
      )}

      {error && !loading && (
        <section className="mt-6 rounded-xl border border-red-300 bg-red-50 p-5" role="alert">
          <h2 className="font-bold">Student profiles couldn&rsquo;t load</h2>
          <p>{error}</p>
        </section>
      )}

      {!loading && !error && (
        <div role="list" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <button
              key={studentRefKey(student.studentRef)}
              type="button"
              role="listitem"
              onClick={() => handlePick(student)}
              aria-label={`Continue as ${student.displayName}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow transition hover:border-cyan-500 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
            >
              <span
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-700 text-xl font-bold text-white"
              >
                {initialFor(student)}
              </span>
              <span className="text-lg font-bold">{student.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function StudentConfirm({
  student,
  studentRef,
  onBack,
  onVerifyPin,
  onAuthenticated,
  onParentRecover,
}: {
  student: FamilyPilotStudentProfile
  studentRef: FamilyPilotStudentRef
  onBack: () => void
  onVerifyPin?: (studentRef: FamilyPilotStudentRef, pin: string) => boolean
  onAuthenticated: (studentRef: FamilyPilotStudentRef) => void
  onParentRecover?: (studentRef: FamilyPilotStudentRef) => void
}) {
  const requiresPin = studentRequiresPin(student, onVerifyPin)

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <button
        type="button"
        className="text-sm font-semibold text-cyan-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
        onClick={onBack}
      >
        ← Back
      </button>

      <div className="mt-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-700 text-lg font-bold text-white"
        >
          {initialFor(student)}
        </span>
        <h2 className="text-2xl font-bold">Continue as {student.displayName}?</h2>
      </div>

      {requiresPin ? (
        <PinEntry
          studentRef={studentRef}
          onVerifyPin={onVerifyPin as (studentRef: FamilyPilotStudentRef, pin: string) => boolean}
          onAuthenticated={onAuthenticated}
          onParentRecover={onParentRecover}
        />
      ) : (
        <button
          type="button"
          className="mt-5 w-full rounded-lg bg-cyan-700 px-4 py-3 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900 sm:w-auto"
          onClick={() => onAuthenticated(studentRef)}
        >
          Continue
        </button>
      )}
    </section>
  )
}

function PinEntry({
  studentRef,
  onVerifyPin,
  onAuthenticated,
  onParentRecover,
}: {
  studentRef: FamilyPilotStudentRef
  onVerifyPin: (studentRef: FamilyPilotStudentRef, pin: string) => boolean
  onAuthenticated: (studentRef: FamilyPilotStudentRef) => void
  onParentRecover?: (studentRef: FamilyPilotStudentRef) => void
}) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)

  function press(digit: string) {
    if (digits.length >= PIN_LENGTH) return
    const next = digits + digit
    setDigits(next)
    setError(null)
    if (next.length === PIN_LENGTH) {
      const result = checkPin(onVerifyPin, studentRef, next)
      if (result.accepted) {
        onAuthenticated(studentRef)
      } else {
        setError(result.message)
        setDigits('')
      }
    }
  }

  return (
    <div className="mt-5">
      <p id="family-pilot-pin-label" className="text-sm font-semibold text-slate-600">
        Enter your PIN
      </p>
      <div className="mt-2 flex gap-3" role="group" aria-labelledby="family-pilot-pin-label">
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`h-4 w-4 rounded-full border-2 ${
              index < digits.length ? 'border-cyan-700 bg-cyan-700' : 'border-slate-300'
            }`}
          />
        ))}
      </div>
      <div className="mt-2 min-h-6 text-sm font-semibold text-red-600" role="alert">
        {error}
      </div>

      <div className="mt-2 grid w-56 grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            aria-label={`digit ${digit}`}
            onClick={() => press(digit)}
            className="rounded-lg border border-slate-300 bg-white py-3 text-xl font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          aria-label="clear PIN"
          onClick={() => setDigits('')}
          className="rounded-lg border border-slate-300 bg-white py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
        >
          Clear
        </button>
        <button
          type="button"
          aria-label="digit 0"
          onClick={() => press('0')}
          className="rounded-lg border border-slate-300 bg-white py-3 text-xl font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
        >
          0
        </button>
        <button
          type="button"
          aria-label="delete digit"
          onClick={() => setDigits(digits.slice(0, -1))}
          className="rounded-lg border border-slate-300 bg-white py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
        >
          ⌫
        </button>
      </div>

      {onParentRecover && (
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-slate-500 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
          onClick={() => onParentRecover(studentRef)}
        >
          Forgot your PIN? Ask a parent
        </button>
      )}
    </div>
  )
}

function ActiveStudentPanel({
  student,
  onLogout,
  onSwitchStudent,
}: {
  student: FamilyPilotStudentProfile | null
  onLogout: () => void
  onSwitchStudent: () => void
}) {
  const displayName = student?.displayName ?? 'your profile'

  return (
    <section
      aria-label="Active student"
      className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center"
    >
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-700 text-2xl font-bold text-white"
      >
        {student ? initialFor(student) : '?'}
      </span>
      <div>
        <p className="text-sm font-semibold text-cyan-700">Family Pilot</p>
        <h1 className="text-2xl font-bold">Studying as {displayName}</h1>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
          onClick={onSwitchStudent}
        >
          Switch student
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-900"
          onClick={onLogout}
        >
          Log out
        </button>
      </div>
    </section>
  )
}
