import { useState, type FormEvent } from 'react'
import type { Profile } from '../../types'
import {
  ACTIVITY_CATEGORY_LABELS,
  SCHOOL_WEEKDAYS,
  type ManualPlannerBlockInput,
} from '../defaults'
import type { PlannerActivityCategory, PlannerBlock, PlannerWeekday } from '../types'

interface Props {
  profiles: Profile[]
  block?: PlannerBlock
  onSave: (input: ManualPlannerBlockInput) => void
  onCancel: () => void
  onDeactivate?: () => void
  onRemove?: () => void
}

const WEEKDAY_OPTIONS: { value: PlannerWeekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

const FIELD =
  'mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800'

export function PlannerBlockEditor({
  profiles,
  block,
  onSave,
  onCancel,
  onDeactivate,
  onRemove,
}: Props) {
  const [title, setTitle] = useState(block?.title ?? '')
  const [description, setDescription] = useState(block?.description ?? '')
  const [category, setCategory] = useState<PlannerActivityCategory>(block?.category ?? 'custom')
  const [assignToAll, setAssignToAll] = useState(block?.assignToAll ?? true)
  const [assigned, setAssigned] = useState<string[]>(
    block?.assignedProfileIds ?? profiles.map((profile) => profile.id),
  )
  const [days, setDays] = useState<PlannerWeekday[]>(block?.weekdays ?? SCHOOL_WEEKDAYS)
  const [startTime, setStartTime] = useState(block?.startTime ?? '09:00')
  const [expectedMinutes, setExpectedMinutes] = useState(block?.expectedMinutes ?? 30)
  const [scheduleBehavior, setScheduleBehavior] = useState<'flexible' | 'fixed'>(
    block?.scheduleBehavior ?? 'flexible',
  )
  const [requiresParentHelp, setRequiresParentHelp] = useState(
    block?.requiresParentHelp ?? false,
  )
  const [location, setLocation] = useState(block?.location ?? '')
  const [notes, setNotes] = useState(block?.notes ?? '')
  const [error, setError] = useState('')

  const toggleAssignment = (profileId: string) =>
    setAssigned((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    )

  const toggleDay = (day: PlannerWeekday) =>
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('Enter an activity title.')
      return
    }
    if (!assignToAll && assigned.length === 0) {
      setError('Choose at least one student.')
      return
    }
    if (days.length === 0) {
      setError('Choose at least one recurring day.')
      return
    }
    if (!Number.isFinite(expectedMinutes) || expectedMinutes < 1) {
      setError('Expected duration must be at least one minute.')
      return
    }
    onSave({
      title,
      description,
      category,
      assignedProfileIds: assignToAll ? profiles.map((profile) => profile.id) : assigned,
      assignToAll,
      weekdays: [...days].sort((a, b) => a - b),
      startTime,
      expectedMinutes,
      scheduleBehavior,
      requiresParentHelp,
      location,
      notes,
    })
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
      aria-label={block ? `Edit ${block.title}` : 'Add manual activity'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">
          {block ? 'Edit recurring activity' : 'Add recurring activity'}
        </h3>
        {block && (
          <span className="text-xs font-semibold text-slate-400">ID: {block.id}</span>
        )}
      </div>

      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-bold text-slate-700">
          Activity title
          <input
            className={FIELD}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label className="min-w-0 text-sm font-bold text-slate-700">
          Category
          <select
            className={FIELD}
            value={category}
            onChange={(event) => setCategory(event.target.value as PlannerActivityCategory)}
          >
            {Object.entries(ACTIVITY_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm font-bold text-slate-700 sm:col-span-2">
          Description or instructions
          <textarea
            className={FIELD}
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="min-w-0 text-sm font-bold text-slate-700">
          Start time
          <input
            className={FIELD}
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            required
          />
        </label>
        <label className="min-w-0 text-sm font-bold text-slate-700">
          Expected duration (minutes)
          <input
            className={FIELD}
            type="number"
            min={1}
            max={720}
            value={expectedMinutes}
            onChange={(event) => setExpectedMinutes(Number(event.target.value))}
            required
          />
        </label>
        <label className="min-w-0 text-sm font-bold text-slate-700">
          Schedule behavior
          <select
            className={FIELD}
            value={scheduleBehavior}
            onChange={(event) =>
              setScheduleBehavior(event.target.value as 'flexible' | 'fixed')
            }
          >
            <option value="flexible">Flexible — shifts later when needed</option>
            <option value="fixed">Fixed — keeps this start time</option>
          </select>
        </label>
        <label className="min-w-0 text-sm font-bold text-slate-700">
          Location
          <input
            className={FIELD}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-slate-700">Students</legend>
        <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={assignToAll}
            onChange={(event) => setAssignToAll(event.target.checked)}
          />
          All students, including profiles added later
        </label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <label
              key={profile.id}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                assignToAll ? 'border-slate-100 bg-slate-50 text-slate-400' : 'border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                checked={assignToAll || assigned.includes(profile.id)}
                disabled={assignToAll}
                onChange={() => toggleAssignment(profile.id)}
              />
              <span className="min-w-0 truncate">{profile.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-slate-700">Repeats on</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-700"
            >
              <input
                type="checkbox"
                checked={days.includes(day.value)}
                onChange={() => toggleDay(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={requiresParentHelp}
          onChange={(event) => setRequiresParentHelp(event.target.checked)}
        />
        Requires parent help
      </label>
      <label className="mt-3 block min-w-0 text-sm font-bold text-slate-700">
        Parent notes
        <textarea
          className={FIELD}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
        >
          {block ? 'Save changes' : 'Add activity'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
        >
          Cancel
        </button>
        {block && onDeactivate && (
          <button
            type="button"
            onClick={onDeactivate}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800"
          >
            {block.active ? 'Deactivate' : 'Reactivate'}
          </button>
        )}
        {block && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700"
          >
            Remove activity
          </button>
        )}
      </div>
    </form>
  )
}
