import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { flushSync } from 'react-dom'
import type { AppState, Profile, SchoolYear } from '../../types'
import { isoToday } from '../../appState'
import { addDaysISO } from '../../curriculum/pacing'
import type { PlanDoc } from '../../curriculum/parser'
import { applyPlannerCommand } from '../actions'
import {
  ACTIVITY_CATEGORY_LABELS,
  addManualPlannerBlock,
  patchPlannerBlock,
  readPlannerState,
  removePlannerBlock,
  togglePlannerBlockActive,
  type ManualPlannerBlockInput,
} from '../defaults'
import { plannerWeekdayOf } from '../engine'
import { patchPlannerState } from '../progress'
import { selectDailyPlan } from '../selectors'
import type {
  DailyPlanBlock,
  PlannerAction,
  PlannerBlockChanges,
  PlannerCommandOutcome,
  PlannerDestination,
} from '../types'
import { DailyProgress } from './DailyProgress'
import { DailyTimeline } from './DailyTimeline'
import { PlannerBlockEditor } from './PlannerBlockEditor'

interface Props {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
  profiles: Profile[]
  docs: PlanDoc[]
  schoolYear: SchoolYear
  today: string
  onOpenDestination: (
    profileId: string,
    destination: PlannerDestination,
  ) => boolean
}

type EditorState =
  | { kind: 'new' }
  | { kind: 'edit'; blockId: string }
  | null

const friendlyDate = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function moveSchoolDay(date: string, direction: -1 | 1): string {
  let next = date
  for (let attempt = 0; attempt < 7; attempt++) {
    next = addDaysISO(next, direction)
    if (plannerWeekdayOf(next) <= 5) return next
  }
  return next
}

const newManualId = (): string => {
  const random = globalThis.crypto?.randomUUID?.()
  return `manual:${random ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export function DailyPlanView({
  state,
  onStateChange,
  profiles,
  docs,
  schoolYear,
  today,
  onOpenDestination,
}: Props) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all')
  const [date, setDate] = useState(today)
  const [editor, setEditor] = useState<EditorState>(null)
  const [pendingInstanceId, setPendingInstanceId] = useState<string>()
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const pendingInstanceRef = useRef<string | undefined>(undefined)
  const now = new Date().toISOString()
  const plannerRead = readPlannerState(state.planner)
  const planner =
    plannerRead.kind === 'supported' ? plannerRead.state : undefined

  const plans = useMemo(
    () =>
      profiles.map((profile) => ({
        profile,
        plan: selectDailyPlan({
          state,
          profileId: profile.id,
          date,
          currentLocalDate: today,
          docs,
          now,
          schoolYear,
        }),
      })),
    [state, profiles, date, today, docs, now, schoolYear],
  )
  const selected = plans.find(({ profile }) => profile.id === selectedProfileId)
  const editingBlock =
    editor?.kind === 'edit'
      ? planner?.blocks.find((block) => block.id === editor.blockId)
      : undefined

  useEffect(
    () => () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
    },
    [],
  )

  const act = (
    block: DailyPlanBlock,
    action: PlannerAction,
  ): PlannerCommandOutcome => {
    if (pendingInstanceRef.current === block.instanceId) {
      return { kind: 'idempotent', status: block.progress.status }
    }
    const actionNow = new Date().toISOString()
    const actionDate = isoToday()
    let result: ReturnType<typeof applyPlannerCommand> | undefined
    pendingInstanceRef.current = block.instanceId
    setPendingInstanceId(block.instanceId)
    flushSync(() => {
      onStateChange((previous) => {
        result = applyPlannerCommand(
          previous,
          {
            actor: { kind: 'parent' },
            action,
            target: {
              profileId: block.profileId,
              date: block.date,
              blockId: block.block.id,
              blockInstanceId: block.instanceId,
            },
          },
          {
            now: actionNow,
            currentLocalDate: actionDate,
            docs,
            schoolYear,
          },
        )
        return result.state
      })
    })
    const outcome: PlannerCommandOutcome = result?.outcome ?? {
      kind: 'rejected',
      reason: 'block-not-actionable',
    }
    if (
      (outcome.kind === 'applied' || outcome.kind === 'idempotent') &&
      (action === 'start' || action === 'resume') &&
      result?.navigation
    ) {
      onOpenDestination(block.profileId, result.navigation.destination)
    }
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    if (outcome.kind === 'rejected' || outcome.kind === 'idempotent') {
      pendingInstanceRef.current = undefined
      setPendingInstanceId(undefined)
    } else {
      pendingTimer.current = setTimeout(() => {
        pendingInstanceRef.current = undefined
        setPendingInstanceId(undefined)
      }, 450)
    }
    return outcome
  }

  const save = (
    input: ManualPlannerBlockInput,
    changes: PlannerBlockChanges,
  ) => {
    if (!editor || plannerRead.kind !== 'supported') return
    const saveNow = new Date().toISOString()
    const blockId =
      editor.kind === 'edit' ? editor.blockId : newManualId()
    onStateChange((previous) =>
      patchPlannerState(previous, (current) =>
        editor.kind === 'edit'
          ? patchPlannerBlock(current, blockId, changes, saveNow)
          : addManualPlannerBlock(current, input, saveNow, blockId),
      ),
    )
    setEditor(null)
  }

  const toggleActive = (blockId: string) => {
    const updatedAt = new Date().toISOString()
    onStateChange((previous) =>
      patchPlannerState(previous, (current) =>
        togglePlannerBlockActive(current, blockId, updatedAt),
      ),
    )
    setEditor(null)
  }

  const remove = (blockId: string) => {
    const removedAt = new Date().toISOString()
    onStateChange((previous) =>
      patchPlannerState(previous, (current) =>
        removePlannerBlock(current, blockId, removedAt),
      ),
    )
    setEditor(null)
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900">Daily Plan</h2>
            <p className="mt-1 break-words text-sm text-slate-500">
              Schedule completion organizes the day; it never proves academic mastery.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditor({ kind: 'new' })}
            disabled={!planner}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add activity
          </button>
        </div>

        {plannerRead.kind === 'unsupported-newer' && (
          <div
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
            role="alert"
          >
            <div className="font-bold">Planner update required</div>
            <p className="mt-1">
              This backup contains planner data version {plannerRead.version}. It has
              been preserved unchanged, but this app cannot safely view or edit it.
            </p>
          </div>
        )}

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="min-w-0 text-sm font-bold text-slate-700">
            Student
            <select
              className="mt-1 w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={selectedProfileId}
              onChange={(event) => setSelectedProfileId(event.target.value)}
            >
              <option value="all">All students · family overview</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · Grade {profile.grade}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm font-bold text-slate-700">
            Date
            <input
              type="date"
              className="mt-1 w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((current) => moveSchoolDay(current, -1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            ← Previous school day
          </button>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDate((current) => moveSchoolDay(current, 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            Next school day →
          </button>
          <span className="break-words text-sm font-semibold text-slate-500">
            {friendlyDate(date)}
          </span>
        </div>
      </section>

      {editor?.kind === 'new' && planner && (
        <PlannerBlockEditor
          key="new"
          profiles={profiles}
          onSave={save}
          onCancel={() => setEditor(null)}
        />
      )}
      {editor?.kind === 'edit' && editingBlock && (
        <PlannerBlockEditor
          key={`${editingBlock.id}:${editingBlock.updatedAt}`}
          profiles={profiles}
          block={editingBlock}
          onSave={save}
          onCancel={() => setEditor(null)}
          onDeactivate={() => toggleActive(editingBlock.id)}
          onRemove={() => remove(editingBlock.id)}
        />
      )}
      {editor?.kind === 'edit' && !editingBlock && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          That activity is no longer available.{' '}
          <button
            type="button"
            className="font-bold underline"
            onClick={() => setEditor(null)}
          >
            Close editor
          </button>
        </div>
      )}

      {selectedProfileId === 'all' ? (
        <section>
          <h3 className="mb-2 text-lg font-bold text-slate-800">Family overview</h3>
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {plans.map(({ profile, plan }) => (
              <article
                key={profile.id}
                className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                  <h4 className="min-w-0 break-words font-bold text-slate-900">
                    {profile.name}
                  </h4>
                  <span className="shrink-0 text-xs font-semibold text-slate-400">
                    Grade {profile.grade}
                  </span>
                </div>
                <DailyProgress summary={plan.summary} compact />
                <div className="mt-2 break-words text-sm font-semibold text-slate-600">
                  {plan.compatibility.kind === 'unsupported-newer'
                    ? 'Planner update required'
                    : plan.blocks.length === 0
                      ? plan.notices.length > 0
                        ? 'Some curriculum is unavailable'
                        : 'Nothing scheduled'
                      : `${plan.blocks.length} blocks · next: ${
                          plan.blocks.find((row) =>
                            ['not-started', 'in-progress', 'paused'].includes(
                              row.progress.status,
                            ),
                          )?.block.title ?? 'day complete'
                        }`}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProfileId(profile.id)}
                  className="mt-2 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                >
                  Open {profile.name}&apos;s timeline
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : selected ? (
        <section className="min-w-0 space-y-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h3 className="min-w-0 break-words text-lg font-bold text-slate-800">
              {selected.profile.name}&apos;s timeline
            </h3>
            <span className="break-words text-xs font-semibold text-slate-500">
              Fixed events stay fixed; flexible work uses available intervals.
            </span>
          </div>
          <DailyProgress summary={selected.plan.summary} />
          <DailyTimeline
            plan={selected.plan}
            parentControls
            pendingInstanceId={pendingInstanceId}
            onAction={act}
            onEdit={(row) =>
              setEditor({ kind: 'edit', blockId: row.block.id })
            }
          />
        </section>
      ) : null}

      {planner && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words font-bold text-slate-900">
                Recurring family activities
              </h3>
              <p className="break-words text-sm text-slate-500">
                Generated mission and curriculum rows are managed by their source systems.
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-500">
              {planner.blocks.length} saved
            </span>
          </div>
          {planner.blocks.length === 0 ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
              Add wrestling, jiu-jitsu, weight training, meals, breaks,
              appointments, or another recurring activity.
            </p>
          ) : (
            <ul className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
              {planner.blocks.map((block) => (
                <li
                  key={block.id}
                  className={`min-w-0 rounded-lg border p-3 ${
                    block.active
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-200 bg-slate-100 opacity-75'
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="break-words font-bold text-slate-800">
                        {block.title}
                      </div>
                      <div className="mt-0.5 break-words text-xs font-semibold text-slate-500">
                        {ACTIVITY_CATEGORY_LABELS[block.category]} · {block.startTime}{' '}
                        · {block.expectedMinutes} min ·{' '}
                        {block.assignToAll
                          ? 'All students'
                          : `${block.assignedProfileIds.length} assigned`}
                      </div>
                      <div className="mt-0.5 break-words text-xs text-slate-400">
                        {block.active ? 'Active' : 'Inactive'} ·{' '}
                        {block.scheduleBehavior === 'fixed'
                          ? 'Fixed time'
                          : 'Flexible'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({ kind: 'edit', blockId: block.id })
                      }
                      className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
