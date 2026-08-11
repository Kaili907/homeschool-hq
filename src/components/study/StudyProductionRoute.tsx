import { useEffect, useMemo, useState } from 'react'
import { isoToday } from '../../appState'
import {
  buildAcademyStudyContext,
  type AcademyStudyContext,
} from '../../academy/adapters/studyContextAdapter'
import { loadProgram } from '../../academy/program'
import type { AcademyProgramEntry } from '../../academy/workingLevel'
import type { AcademySchedule } from '../../academy/contentTypes'
import { derivedScopeWeek, isSchoolYearConfigured } from '../../curriculum/pacing'
import type { Profile, SchoolYear } from '../../types'
import { createStudyBoundContentClient } from '../../study/client/studyBoundContentClient'
import type { StudyProductionReadinessClient } from '../../study/client/studyProductionReadinessClient'
import { createStudyProductionSessionClient } from '../../study/client/studyProductionSessionClient'
import type { StudyCheckpointRecord } from '../../study/contracts/persistence/types'
import type {
  StudyBoundContentReady,
  StudyLearnerLesson,
} from '../../study/contracts/production/content'
import type { StudyProductionSessionProjection } from '../../study/contracts/production/session'
import {
  createStudyProductionController,
  type StudyProductionCheckpointDraft,
  type StudyProductionController,
  type StudyProductionControllerSnapshot,
} from '../../study/production/sessionController'
import type { VerifiedStudyRuntimeAdapter } from '../../study/production/verifiedRuntimeAdapter'
import {
  STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT,
  StudyProductionWorkspace,
  type StudyProductionContentSlot,
  type StudyProductionWorkspaceLaunch,
} from './StudyProductionWorkspace'

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/
const DASHBOARD_STATES = new Set<StudyProductionDashboardSession['state']>([
  'planned',
  'active',
  'paused',
  'approved_break',
  'student_requested_break',
  'technical_interruption',
  'completed',
  'abandoned',
])

export interface StudyProductionDashboardSession {
  readonly sessionId: string
  readonly state:
    | 'planned'
    | 'active'
    | 'paused'
    | 'approved_break'
    | 'student_requested_break'
    | 'technical_interruption'
    | 'completed'
    | 'abandoned'
  readonly lessonId: string
  readonly revision: number
  readonly updatedAt: string
}

export interface StudyProductionDashboard {
  readonly sessions: readonly StudyProductionDashboardSession[]
}

export interface StudyProductionRouteProps {
  readonly runtime: VerifiedStudyRuntimeAdapter
  readonly readiness: StudyProductionReadinessClient
  readonly profile: Profile
  readonly entries: readonly AcademyProgramEntry[]
  readonly schoolYear: SchoolYear | undefined
  readonly academyContext?: AcademyStudyContext
  readonly onExit: () => void
}

interface RouteAssembly {
  readonly controller: StudyProductionController
  readonly launch: StudyProductionWorkspaceLaunch
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const actual = Object.keys(candidate)
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(candidate, key))
    ? candidate
    : null
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = INSTANT.exec(value)
  return Boolean(match && validDate(match[1]!) && Number.isFinite(Date.parse(value)))
}

/** A second strict browser DTO boundary for the production dashboard selector. */
export function parseStudyProductionDashboard(value: unknown): StudyProductionDashboard | null {
  const candidate = exactObject(value, ['sessions'])
  if (!candidate || !Array.isArray(candidate.sessions) || candidate.sessions.length > 50) return null
  const sessions: StudyProductionDashboardSession[] = []
  for (const item of candidate.sessions) {
    const session = exactObject(item, ['sessionId', 'state', 'lessonId', 'revision', 'updatedAt'])
    if (!session || typeof session.sessionId !== 'string' || !SAFE_REF.test(session.sessionId) ||
        !DASHBOARD_STATES.has(session.state as StudyProductionDashboardSession['state']) ||
        typeof session.lessonId !== 'string' || !SAFE_REF.test(session.lessonId) ||
        !Number.isSafeInteger(session.revision) || Number(session.revision) < 1 ||
        !validInstant(session.updatedAt)) return null
    sessions.push(Object.freeze({
      sessionId: session.sessionId,
      state: session.state as StudyProductionDashboardSession['state'],
      lessonId: session.lessonId,
      revision: session.revision as number,
      updatedAt: session.updatedAt,
    }))
  }
  return Object.freeze({ sessions: Object.freeze(sessions) })
}

function immutableAcademyContext(value: AcademyStudyContext): AcademyStudyContext | null {
  if (value.adapterVersion !== 1 || !RELEASE_VERSION.test(value.releaseVersion) ||
      !SAFE_REF.test(value.lessonRef) || !Array.isArray(value.skillRefs) ||
      value.skillRefs.length < 1 || value.skillRefs.length > 64 ||
      value.skillRefs.some((ref) => !SAFE_REF.test(ref)) ||
      new Set(value.skillRefs).size !== value.skillRefs.length ||
      !Number.isSafeInteger(value.scopeWeek) || value.scopeWeek < 1 || value.scopeWeek > 53 ||
      !Number.isSafeInteger(value.scopeDay) || value.scopeDay < 1 || value.scopeDay > 7) return null
  return Object.freeze({
    adapterVersion: 1,
    releaseVersion: value.releaseVersion,
    lessonRef: value.lessonRef,
    skillRefs: Object.freeze([...value.skillRefs]) as unknown as string[],
    scopeWeek: value.scopeWeek,
    scopeDay: value.scopeDay,
  })
}

export function deriveStudyProductionAcademyContext(
  profile: Profile,
  schedule: AcademySchedule,
  schoolYear: SchoolYear | undefined,
  intendedLocalDate: string,
): AcademyStudyContext | null {
  if (!validDate(intendedLocalDate)) return null
  const scopeWeek = isSchoolYearConfigured(schoolYear)
    ? derivedScopeWeek(schoolYear, intendedLocalDate)
    : 1
  const jsDay = new Date(`${intendedLocalDate}T12:00:00`).getDay()
  if (jsDay < 1 || jsDay > 5) return null
  const context = buildAcademyStudyContext(profile, schedule, scopeWeek, jsDay)
  return context ? immutableAcademyContext(context) : null
}

/** Selects only the latest exact-lesson server session; Academy fields remain advisory. */
export function createStudyProductionWorkspaceLaunch(
  contextInput: AcademyStudyContext,
  dashboard: StudyProductionDashboard,
  intendedLocalDate: string,
): StudyProductionWorkspaceLaunch | null {
  const context = immutableAcademyContext(contextInput)
  if (!context || !validDate(intendedLocalDate)) return null
  const existing = dashboard.sessions
    .filter((session) => session.lessonId === context.lessonRef && session.state !== 'planned')
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
  if (existing) {
    return Object.freeze({
      kind: 'resume',
      input: Object.freeze({ sessionId: existing.sessionId, academyContext: context }),
    })
  }
  return Object.freeze({
    kind: 'begin',
    input: Object.freeze({
      academyContext: context,
      subjectId: 'academy',
      studyPlanId: null,
      intendedLocalDate,
      initialSegmentId: context.skillRefs[0]!,
    }),
  })
}

function routeOperationRef(): string {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}:${Math.random().toString(36).slice(2)}`
  return `production-dashboard-route:${value}`
}

export function StudyProductionRoute({
  runtime,
  readiness,
  profile,
  entries,
  schoolYear,
  academyContext,
  onExit,
}: StudyProductionRouteProps) {
  const [assembly, setAssembly] = useState<RouteAssembly | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const intendedLocalDate = isoToday()
  const entriesKey = entries.map((entry) => `${entry.subject}@${entry.level}`).join(',')
  const advisoryKey = academyContext
    ? `${academyContext.releaseVersion}|${academyContext.lessonRef}|${academyContext.skillRefs.join(',')}|${academyContext.scopeWeek}|${academyContext.scopeDay}`
    : ''

  useEffect(() => {
    const abort = new AbortController()
    let current = true
    setAssembly(null)
    setUnavailable(false)

    async function assemble() {
      try {
        if (!runtime.isReady()) throw new Error('production-runtime-not-ready')
        let context: AcademyStudyContext | null
        if (academyContext) {
          context = immutableAcademyContext(academyContext)
          if (!context) throw new Error('academy-study-advisory-invalid')
        } else {
          const program = await loadProgram(entries)
          if (abort.signal.aborted) return
          context = deriveStudyProductionAcademyContext(
            profile,
            program.schedule,
            schoolYear,
            intendedLocalDate,
          )
        }
        if (!context) throw new Error('academy-study-advisory-unavailable')

        const rawDashboard = await runtime.execute({
          operation: 'dashboard:read',
          request: Object.freeze({}),
          operationRef: routeOperationRef(),
          signal: abort.signal,
        })
        const dashboard = parseStudyProductionDashboard(rawDashboard)
        if (!dashboard) throw new Error('production-dashboard-contract-invalid')
        const launch = createStudyProductionWorkspaceLaunch(
          context,
          dashboard,
          intendedLocalDate,
        )
        if (!launch) throw new Error('production-launch-contract-invalid')

        const controller = createStudyProductionController({
          readiness,
          sessions: createStudyProductionSessionClient({ runtime }),
          content: createStudyBoundContentClient({ runtime }),
        })
        if (current && !abort.signal.aborted) {
          setAssembly(Object.freeze({ controller, launch }))
        }
      } catch {
        if (current && !abort.signal.aborted) setUnavailable(true)
      }
    }

    void assemble()
    return () => {
      current = false
      abort.abort('navigation-away')
    }
  }, [
    runtime,
    readiness,
    profile,
    schoolYear,
    entriesKey,
    advisoryKey,
    intendedLocalDate,
  ])

  if (unavailable) {
    return (
      <ProductionRouteState
        title="Study is unavailable right now"
        message="No production session was started or changed. Return to your Study plan and try again later."
        onExit={onExit}
        alert
      />
    )
  }
  if (!assembly) {
    return (
      <ProductionRouteState
        title="Preparing Study"
        message="Checking the exact Academy lesson and your server-saved Study state."
        onExit={onExit}
      />
    )
  }
  return <MountedProductionWorkspace assembly={assembly} onExit={onExit} />
}

function MountedProductionWorkspace({
  assembly,
  onExit,
}: {
  readonly assembly: RouteAssembly
  readonly onExit: () => void
}) {
  const { controller, launch } = assembly
  const [snapshot, setSnapshot] = useState(() => controller.snapshot())
  useEffect(() => controller.subscribe(setSnapshot), [controller])
  const content = useMemo(
    () => projectStudyProductionBoundContent(snapshot.content, snapshot.session),
    [snapshot.content, snapshot.session],
  )
  return (
    <StudyProductionWorkspace
      controller={controller}
      launch={launch}
      content={content}
      onExit={onExit}
    />
  )
}

function displayText(value: string): boolean {
  return value.trim().length > 0 && value.length <= 240
}

/** Converts only the exact bound session release into the production workspace seam. */
export function projectStudyProductionBoundContent(
  value: StudyBoundContentReady | null,
  session: StudyProductionSessionProjection | null,
): StudyProductionContentSlot {
  if (!value || !session) return { status: 'loading' }
  if (value.sessionRef !== session.sessionId || value.lessonRef !== session.lessonId ||
      value.curriculumBinding.releaseId !== session.curriculumBinding.releaseId ||
      value.curriculumBinding.packageId !== session.curriculumBinding.packageId ||
      value.curriculumBinding.releaseVersion !== session.curriculumBinding.releaseVersion ||
      value.curriculumBinding.curriculumManifestSha256 !==
        session.curriculumBinding.curriculumManifestSha256 ||
      value.lessons.length < 1 || value.lessons.length !== value.skillRefs.length) {
    return { status: 'unavailable' }
  }
  const subjects = [...new Set(value.lessons.map((lesson) => lesson.subject))]
  const subjectLabel = subjects.join(' · ')
  const lessonTitle = value.lessons.length === 1
    ? value.lessons[0]!.title
    : "Today's Study plan"
  const goal = value.lessons
    .flatMap((lesson) => [
      ...lesson.learningObjectives,
      lesson.essentialQuestion ?? '',
      lesson.formativeCheck,
    ])
    .find(displayText)
  if (!displayText(subjectLabel) || !displayText(lessonTitle) || !goal ||
      value.lessons.some((lesson) => !displayText(lesson.title))) {
    return { status: 'unavailable' }
  }
  const lessonById = new Map(value.lessons.map((lesson) => [lesson.lessonId, lesson]))
  return Object.freeze({
    status: 'bound',
    content: Object.freeze({
      contract: STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT,
      lessonId: value.lessonRef,
      releaseVersion: value.curriculumBinding.releaseVersion,
      subjectLabel,
      lessonTitle,
      goal,
      segments: Object.freeze(value.lessons.map((lesson) => Object.freeze({
        segmentId: lesson.lessonId,
        label: lesson.title,
      }))),
    }),
    renderSegment: (input) => {
      const lesson = lessonById.get(input.segment.segmentId)
      if (!lesson) return null
      if (input.mode === 'review') {
        return (
          <BoundLessonReview
            lesson={lesson}
            onReturn={input.actions.returnToCurrentSegment}
          />
        )
      }
      return (
        <BoundLessonCurrent
          lesson={lesson}
          checkpoint={input.checkpoint}
          segmentIndex={value.lessons.findIndex((item) => item.lessonId === lesson.lessonId)}
          busy={input.busy}
          saveCheckpoint={input.actions.saveCheckpoint}
          completeCurrentSegment={input.actions.completeCurrentSegment}
        />
      )
    },
  })
}

function newOpaqueRef(prefix: string): string {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}:${Math.random().toString(36).slice(2)}`
  return `${prefix}:${value}`
}

export function buildStudyProductionCompletionCheckpoint(input: {
  readonly checkpoint: StudyCheckpointRecord | null
  readonly segmentId: string
  readonly segmentIndex: number
  readonly now?: () => number
  readonly createRef?: (prefix: string) => string
}): StudyProductionCheckpointDraft {
  const now = input.now ?? Date.now
  const createRef = input.createRef ?? newOpaqueRef
  const previous = input.checkpoint
  const timestampMs = Math.max(
    now(),
    previous ? Date.parse(previous.updatedAt) : 0,
  )
  const updatedAt = new Date(timestampMs).toISOString()
  const completedSegmentIds = [...new Set([
    ...(previous?.completedSegmentIds ?? []),
    input.segmentId,
  ])]
  const perSegmentActiveTime = previous
    ? previous.perSegmentActiveTime.map((entry) => ({ ...entry }))
    : []
  if (!perSegmentActiveTime.some((entry) => entry.segmentId === input.segmentId)) {
    perSegmentActiveTime.push({ segmentId: input.segmentId, activeSeconds: 0 })
  }
  return Object.freeze({
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: previous?.checkpointId ?? createRef('checkpoint'),
    createdAt: previous?.createdAt ?? updatedAt,
    updatedAt,
    segmentId: input.segmentId,
    safeInstructionalCursor: previous?.safeInstructionalCursor ?? Object.freeze({
      tutorPhase: 'guided-practice',
      cycleNumber: 0,
      currentItemId: null,
      currentItemIndex: Math.max(0, input.segmentIndex),
      teachingTurnIndex: 0,
    }),
    completedSegmentIds,
    perSegmentActiveTime,
    pausedSeconds: previous?.pausedSeconds ?? 0,
    breakSeconds: previous?.breakSeconds ?? 0,
    protectedDraftRef: previous?.protectedDraftRef ?? null,
    protectedTutorStateRef: previous?.protectedTutorStateRef ?? createRef('tutor-state'),
    lastAcceptedEventId: previous?.lastAcceptedEventId ?? null,
    eventVersion: 1,
    tutorInteractionRef: previous?.tutorInteractionRef ?? createRef('interaction'),
    technicalInterruption: previous?.technicalInterruption ?? Object.freeze({
      status: 'none',
      interruptionId: null,
      category: 'none',
      startedAt: null,
    }),
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
}

function BoundLessonContent({ lesson }: { readonly lesson: StudyLearnerLesson }) {
  return (
    <>
      {lesson.essentialQuestion && (
        <p className="font-semibold text-slate-700">{lesson.essentialQuestion}</p>
      )}
      {lesson.learningObjectives.length > 0 && (
        <section className="mt-4" aria-labelledby="study-production-objectives">
          <h3 id="study-production-objectives" className="font-extrabold">Learning goal</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {lesson.learningObjectives.map((objective, index) => <li key={index}>{objective}</li>)}
          </ul>
        </section>
      )}
      <section className="mt-4" aria-labelledby="study-production-lesson-flow">
        <h3 id="study-production-lesson-flow" className="font-extrabold">Lesson steps</h3>
        <ol className="mt-2 space-y-2">
          {lesson.lessonFlow.map((step, index) => (
            <li key={index} className="rounded-lg border border-slate-200 p-3">
              <p className="font-bold">{step.segment}{step.minutes ? ` · ${step.minutes}` : ''}</p>
              <p className="mt-1 font-semibold text-slate-600">{step.teacherOrTutorAction}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-4 rounded-lg bg-slate-50 p-3" aria-labelledby="study-production-check">
        <h3 id="study-production-check" className="font-extrabold">Check your learning</h3>
        <p className="mt-1 font-semibold text-slate-700">{lesson.formativeCheck}</p>
      </section>
    </>
  )
}

function BoundLessonCurrent({
  lesson,
  checkpoint,
  segmentIndex,
  busy,
  saveCheckpoint,
  completeCurrentSegment,
}: {
  readonly lesson: StudyLearnerLesson
  readonly checkpoint: StudyCheckpointRecord | null
  readonly segmentIndex: number
  readonly busy: boolean
  readonly saveCheckpoint: (
    checkpoint: StudyProductionCheckpointDraft,
  ) => Promise<StudyProductionControllerSnapshot>
  readonly completeCurrentSegment: () => void
}) {
  const saveAndContinue = async () => {
    const result = await saveCheckpoint(buildStudyProductionCompletionCheckpoint({
      checkpoint,
      segmentId: lesson.lessonId,
      segmentIndex,
    }))
    if (result.status === 'ready') completeCurrentSegment()
  }
  return (
    <div>
      <BoundLessonContent lesson={lesson} />
      <button
        type="button"
        className="mt-5 min-h-11 rounded-lg border border-cyan-800 bg-cyan-700 px-5 py-3 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        onClick={() => { void saveAndContinue() }}
      >
        Save this step and continue
      </button>
    </div>
  )
}

function BoundLessonReview({
  lesson,
  onReturn,
}: {
  readonly lesson: StudyLearnerLesson
  readonly onReturn: () => void
}) {
  return (
    <div>
      <BoundLessonContent lesson={lesson} />
      <button
        type="button"
        className="mt-5 min-h-11 rounded-lg border border-slate-400 bg-white px-5 py-3 font-bold text-slate-800"
        onClick={onReturn}
      >
        Return to current step
      </button>
    </div>
  )
}

function ProductionRouteState({
  title,
  message,
  onExit,
  alert = false,
}: {
  readonly title: string
  readonly message: string
  readonly onExit: () => void
  readonly alert?: boolean
}) {
  return (
    <main className="study-runtime-host min-h-screen bg-slate-50 p-6 text-slate-900" aria-busy={!alert}>
      <section
        className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        role={alert ? 'alert' : undefined}
      >
        <h1 className="text-2xl font-extrabold" tabIndex={-1}>{title}</h1>
        <p className="mt-2 font-semibold text-slate-600">{message}</p>
        <button
          type="button"
          className="mt-5 min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
          onClick={onExit}
        >
          Back to Study plan
        </button>
      </section>
    </main>
  )
}
