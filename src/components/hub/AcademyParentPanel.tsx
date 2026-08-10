import { useEffect, useMemo, useState } from 'react'
import type { AcademyAssessmentAttempt, ISODate, Profile, SchoolYear } from '../../types'
import { isoToday } from '../../appState'
import { isSchoolYearConfigured, nudgePointer, resolvePointer } from '../../curriculum/pacing'
import { enabledAcademyEntries, hasEnabledAcademyProgram } from '../../academy/workingLevel'
import { isAcademyContentVersionError } from '../../academy/contentClient'
import { loadProgram } from '../../academy/program'
import {
  ACADEMY_RELEASE_VERSION,
  ACADEMY_SUBJECT_LABELS,
  type AcademyCatalog,
} from '../../academy/contentTypes'
import { courseProgress, masteryOf, recordAssessmentAttempt } from '../../academy/academyState'

/**
 * CURR-1 — the parent-PIN-gated Academy panel. It reads only the public-safe
 * catalog plus persisted progress; protected guidance is never shipped by the
 * static host. Pacing controls ride the existing Pacing authority
 * (pointers/nudges keyed by course id) — nudges shift expectations, never
 * student data and never the source curriculum.
 */

interface Props {
  profiles: Profile[]
  sy: SchoolYear
  onPatchProfile: (id: string, update: (prev: Profile) => Profile) => void
}

export function AcademyParentPanel({ profiles, sy, onPatchProfile }: Props) {
  const learners = useMemo(() => profiles.filter(hasEnabledAcademyProgram), [profiles])
  const [learnerId, setLearnerId] = useState<string | null>(learners[0]?.id ?? null)
  const learner = learners.find((p) => p.id === learnerId) ?? learners[0] ?? null
  // ACADEMY-LEVEL-DECOUPLE: progress is reported over her PROGRAM (per-subject
  // working levels), which may draw courses from more than one level.
  const entries = useMemo(() => (learner ? enabledAcademyEntries(learner) : []), [learner])
  const releaseVersion = learner?.academy?.releaseVersion ?? ACADEMY_RELEASE_VERSION
  const [catalog, setCatalog] = useState<AcademyCatalog | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    setCatalog(null)
    setLoadError(null)
    if (entries.length === 0) return
    loadProgram(entries, releaseVersion)
      .then((program) => current && setCatalog(program.catalog))
      .catch((error: unknown) => {
        if (!current) return
        setCatalog(null)
        setLoadError(
          isAcademyContentVersionError(error)
            ? "This learner's curriculum version isn't available on this device."
            : "This learner's Academy catalog couldn't load right now.",
        )
      })
    return () => {
      current = false
    }
  }, [entries, releaseVersion])

  if (!learner) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
        No learner reaches an enabled Academy level yet. Enable a level flag
        (VITE_ACADEMY_GRADE_5/7/8_ENABLED) and set that level for a subject above.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {learners.map((p) => (
          <button
            key={p.id}
            onClick={() => setLearnerId(p.id)}
            aria-pressed={p.id === learner.id}
            className={`rounded-lg px-3 py-2 text-sm font-bold ${
              p.id === learner.id
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.name} — grade {p.grade}
          </button>
        ))}
      </div>
      {loadError ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-semibold">
          {loadError}
        </p>
      ) : !catalog ? (
        <p role="status" className="text-sm font-semibold text-slate-500">
          Loading her course catalog…
        </p>
      ) : (
        <LearnerAcademyDetail
          key={learner.id}
          learner={learner}
          catalog={catalog}
          sy={sy}
          onPatch={(update) => onPatchProfile(learner.id, update)}
        />
      )}
    </div>
  )
}

function LearnerAcademyDetail({
  learner,
  catalog,
  sy,
  onPatch,
}: {
  learner: Profile
  catalog: AcademyCatalog
  sy: SchoolYear
  onPatch: (update: (prev: Profile) => Profile) => void
}) {
  const today = isoToday()
  const progress = courseProgress(learner, catalog)
  const [openCourse, setOpenCourse] = useState<string | null>(null)

  if (!learner.academy) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">
        {learner.name} hasn&apos;t opened the Academy yet — enrollment happens on her first visit.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-500">
        Curriculum release {learner.academy.releaseVersion} · enrolled{' '}
        {learner.academy.enrolledAt.slice(0, 10)}
      </p>
      {catalog.courses.map((course) => {
        const stats = progress.find((c) => c.courseId === course.courseId)!
        const pointer = isSchoolYearConfigured(sy)
          ? resolvePointer(learner, course.courseId, sy, today)
          : 1
        const open = openCourse === course.courseId
        return (
          <div key={course.courseId} className="rounded-xl border border-slate-200 bg-white">
            <button
              onClick={() => setOpenCourse(open ? null : course.courseId)}
              aria-expanded={open}
              className="flex min-h-11 w-full items-center gap-3 p-3 text-left"
            >
              <span className="flex-1">
                <span className="block font-bold text-slate-900">
                  {ACADEMY_SUBJECT_LABELS[course.subject] ?? course.subject}
                </span>
                <span className="block text-sm font-semibold text-slate-500">
                  {stats.completed}/{stats.total} done · {stats.mastered} mastered
                  {stats.reteach > 0 ? ` · ${stats.reteach} in reteach` : ''} · week {pointer}
                </span>
              </span>
              <span aria-hidden="true">{open ? '▾' : '▸'}</span>
            </button>
            {open && (
              <div className="border-t border-slate-100 p-3">
                <PacingControls
                  learner={learner}
                  courseId={course.courseId}
                  sy={sy}
                  today={today}
                  onPatch={onPatch}
                />
                <UnitScoring learner={learner} course={course} onPatch={onPatch} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PacingControls({
  learner,
  courseId,
  sy,
  today,
  onPatch,
}: {
  learner: Profile
  courseId: string
  sy: SchoolYear
  today: ISODate
  onPatch: (update: (prev: Profile) => Profile) => void
}) {
  if (!isSchoolYearConfigured(sy)) {
    return (
      <p className="text-sm font-semibold text-slate-500">
        Set the school-year start date (Calendar tab) to activate pacing controls.
      </p>
    )
  }
  const pointer = resolvePointer(learner, courseId, sy, today)
  const nudge = (delta: number) =>
    onPatch((prev) =>
      nudgePointer(
        prev,
        courseId,
        pointer + delta,
        'Academy panel nudge',
        new Date().toISOString(),
        sy,
        today,
      ),
    )
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-bold text-slate-700">Pacing: week {pointer}</span>
      <button
        onClick={() => nudge(-1)}
        disabled={pointer <= 1}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 font-bold disabled:opacity-40"
      >
        −1 week
      </button>
      <button
        onClick={() => nudge(1)}
        disabled={pointer >= sy.totalWeeks}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 font-bold disabled:opacity-40"
      >
        +1 week
      </button>
      <span className="font-semibold text-slate-400">shifts expectations only</span>
    </div>
  )
}

function UnitScoring({
  learner,
  course,
  onPatch,
}: {
  learner: Profile
  course: AcademyCatalog['courses'][number]
  onPatch: (update: (prev: Profile) => Profile) => void
}) {
  const [unitNumber, setUnitNumber] = useState<number | null>(null)
  const [percent, setPercent] = useState('')
  const [outcome, setOutcome] = useState<AcademyAssessmentAttempt['outcome']>('secure')
  const [saved, setSaved] = useState(false)

  const unit = course.units.find((u) => u.unitNumber === unitNumber)
  const assessmentId = unit ? `${course.courseId}-u${String(unit.unitNumber).padStart(2, '0')}-assessment` : null
  const attempts = assessmentId ? (learner.academy?.assessments[assessmentId] ?? []) : []

  return (
    <div className="mt-3">
      <label className="text-sm font-bold text-slate-700">
        Unit detail{' '}
        <select
          value={unitNumber ?? ''}
          onChange={(e) => {
            setUnitNumber(e.target.value ? Number(e.target.value) : null)
            setSaved(false)
          }}
          className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold"
        >
          <option value="">choose a unit…</option>
          {course.units.map((u) => (
            <option key={u.unitId} value={u.unitNumber}>
              Unit {u.unitNumber}: {u.title}
            </option>
          ))}
        </select>
      </label>

      {unit && (
        <div className="mt-3 space-y-3">
          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-700">
              Mastery evidence ({unit.lessonIds.length} lessons)
            </summary>
            <ul className="mt-2 space-y-2">
              {unit.lessonIds.map((lessonId) => {
                const state = learner.academy?.lessons[lessonId]
                return (
                  <li key={lessonId} className="rounded-lg bg-slate-50 p-2 text-sm">
                    <span className="font-bold text-slate-800">{lessonId}</span>{' '}
                    <span className="font-semibold text-slate-500">
                      {state
                        ? `${state.status} · mastery ${masteryOf(state)} · ${state.occasions.length} occasion${state.occasions.length === 1 ? '' : 's'}`
                        : 'not started'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </details>

          {unit.hasAssessment && assessmentId && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <h4 className="text-sm font-bold text-indigo-900">Unit assessment scoring</h4>
              {attempts.length > 0 && (
                <p className="mt-2 text-sm font-semibold text-indigo-900">
                  Attempts:{' '}
                  {attempts.map((a) => `${a.date} — ${a.percent}% (${a.outcome})`).join(' · ')}
                </p>
              )}
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const value = Number(percent)
                  if (!Number.isFinite(value) || value < 0 || value > 100) return
                  onPatch((prev) =>
                    recordAssessmentAttempt(prev, assessmentId, {
                      date: isoToday(),
                      percent: value,
                      outcome,
                    }),
                  )
                  setPercent('')
                  setSaved(true)
                }}
              >
                <label className="text-sm font-bold text-indigo-900">
                  Percent
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                    className="ml-1 w-20 rounded-lg border border-indigo-300 px-2 py-1 font-semibold"
                    required
                  />
                </label>
                <label className="text-sm font-bold text-indigo-900">
                  Outcome
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as AcademyAssessmentAttempt['outcome'])}
                    className="ml-1 rounded-lg border border-indigo-300 bg-white px-2 py-1 font-semibold"
                  >
                    <option value="secure">secure</option>
                    <option value="developing">developing</option>
                    <option value="not-yet">not yet</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="min-h-11 rounded-lg bg-indigo-600 px-4 py-1 font-bold text-white"
                >
                  Record attempt
                </button>
                {saved && (
                  <span role="status" className="text-sm font-bold text-emerald-700">
                    Saved ✓
                  </span>
                )}
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
