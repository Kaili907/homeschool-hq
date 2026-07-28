import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, Profile, SchoolYear } from '../../types'
import { addDaysISO } from '../../curriculum/pacing'
import type { PlanDoc } from '../../curriculum/parser'
import { applyPlannerAction } from '../actions'
import {
  ACTIVITY_CATEGORY_LABELS,
  createManualPlannerBlock,
  normalizePlannerState,
  patchPlannerBlock,
  removePlannerBlock,
  replacePlannerBlock,
  type ManualPlannerBlockInput,
} from '../defaults'
import { plannerWeekdayOf } from '../engine'
import { patchPlannerState } from '../progress'
import { pointerFromLinkedActivity } from '../resume'
import { selectDailyPlan } from '../selectors'
import type { DailyPlanBlock, PlannerAction, PlannerBlock } from '../types'
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
}

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
}: Props) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all')
  const [date, setDate] = useState(today)
  const [editor, setEditor] = useState<'new' | PlannerBlock | null>(null)
  const now = new Date().toISOString()
  const planner = normalizePlannerState(state.planner)

  const plans = useMemo(
    () =>
      profiles.map((profile) => ({
        profile,
        plan: selectDailyPlan({
          state,
          profileId: profile.id,
          date,
          docs,
          now,
          schoolYear,
        }),
      })),
    [state, profiles, date, docs, now, schoolYear],
  )
  const selected = plans.find(({ profile }) => profile.id === selectedProfileId)

  const act = (block: DailyPlanBlock, action: PlannerAction) => {
    const actionNow = new Date().toISOString()
    const resumePointer =
      action === 'pause' ? pointerFromLinkedActivity(block, actionNow) : undefined
    onStateChange((previous) =>
      applyPlannerAction(previous, block, action, actionNow, { resumePointer }),
    )
  }

  const save = (input: ManualPlannerBlockInput) => {
    const saveNow = new Date().toISOString()
    const existing = editor !== 'new' ? editor : undefined
    const created = createManualPlannerBlock(
      input,
      saveNow,
      existing?.id ?? newManualId(),
    )
    const next: PlannerBlock = existing
      ? {
          ...created,
          id: existing.id,
          createdAt: existing.createdAt,
          active: existing.active,
        }
      : created
    onStateChange((previous) =>
      patchPlannerState(previous, (current) => replacePlannerBlock(current, next)),
    )
    setEditor(null)
  }

  const toggleActive = (block: PlannerBlock) => {
    const updatedAt = new Date().toISOString()
    onStateChange((previous) =>
      patchPlannerState(previous, (current) =>
        patchPlannerBlock(current, block.id, { active: !block.active }, updatedAt),
      ),
    )
    setEditor(null)
  }

  const remove = (block: PlannerBlock) => {
    onStateChange((previous) =>
      patchPlannerState(previous, (current) => removePlannerBlock(current, block.id)),
    )
    setEditor(null)
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Daily Plan</h2>
            <p className="mt-1 text-sm text-slate-500">
              Schedule completion organizes the day; it never proves academic mastery.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditor('new')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
          >
            Add activity
          </button>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="min-w-0 text-sm font-bold text-slate-700">
            Student
            <select
              className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2"
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
              className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2"
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
          <span className="text-sm font-semibold text-slate-500">{friendlyDate(date)}</span>
        </div>
      </section>

      {editor && (
        <PlannerBlockEditor
          key={editor === 'new' ? 'new' : editor.id}
          profiles={profiles}
          block={editor === 'new' ? undefined : editor}
          onSave={save}
          onCancel={() => setEditor(null)}
          onDeactivate={
            editor === 'new' ? undefined : () => toggleActive(editor)
          }
          onRemove={editor === 'new' ? undefined : () => remove(editor)}
        />
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
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h4 className="min-w-0 truncate font-bold text-slate-900">{profile.name}</h4>
                  <span className="shrink-0 text-xs font-semibold text-slate-400">
                    Grade {profile.grade}
                  </span>
                </div>
                <DailyProgress summary={plan.summary} compact />
                <div className="mt-2 text-sm font-semibold text-slate-600">
                  {plan.blocks.length === 0
                    ? 'Nothing scheduled'
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
                  className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                >
                  Open {profile.name}&apos;s timeline
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : selected ? (
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-slate-800">
              {selected.profile.name}&apos;s timeline
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              Fixed events stay fixed; only unfinished flexible work shifts.
            </span>
          </div>
          <DailyProgress summary={selected.plan.summary} />
          <DailyTimeline
            plan={selected.plan}
            parentControls
            onAction={act}
            onEdit={(row) => setEditor(row.block)}
          />
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900">Recurring family activities</h3>
            <p className="text-sm text-slate-500">
              Generated mission and curriculum rows are managed by their source systems.
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-500">
            {planner.blocks.length} saved
          </span>
        </div>
        {planner.blocks.length === 0 ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
            Add wrestling, jiu-jitsu, weight training, meals, breaks, appointments, or
            another recurring activity.
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
                    <div className="break-words font-bold text-slate-800">{block.title}</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">
                      {ACTIVITY_CATEGORY_LABELS[block.category]} · {block.startTime} ·{' '}
                      {block.expectedMinutes} min ·{' '}
                      {block.assignToAll
                        ? 'All students'
                        : `${block.assignedProfileIds.length} assigned`}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {block.active ? 'Active' : 'Inactive'} ·{' '}
                      {block.scheduleBehavior === 'fixed' ? 'Fixed time' : 'Flexible'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditor(block)}
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
    </div>
  )
}
