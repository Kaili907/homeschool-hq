import type { CourseTrack, Profile } from '../types'
import {
  addCollegeTask,
  ensureHsDefaults,
  removeCollegeTask,
  setCourses,
  updateCollegeTask,
} from '../hs/hsState'

// Dad's high-school controls, mounted inside the Grown-Ups panel for the two
// teen profiles: the senior's college-application deadlines and every teen's
// manual course-progress tracks.

const nid = () => `x${Math.random().toString(36).slice(2, 8)}`

const btn = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50'
const dangerBtn = 'rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-600'
const input = 'rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800'

export function HsGrownUps({
  profile,
  onChange,
}: {
  profile: Profile
  onChange: (update: (prev: Profile) => Profile) => void
}) {
  const p = ensureHsDefaults(profile)
  const courses = p.courses ?? []
  const isSenior = p.grade === '12'

  // Every write threads through the functional update and re-seeds the HS
  // defaults on the latest committed profile, so admin edits compose. The
  // course-list transform is applied to prev's OWN courses (not the render
  // snapshot), so setCourses never replays a stale array over a concurrent edit.
  const edit = (fn: (prev: Profile) => Profile) =>
    onChange((prev) => fn(ensureHsDefaults(prev)))
  const setCourseList = (fn: (cur: CourseTrack[]) => CourseTrack[]) =>
    edit((prev) => setCourses(prev, fn(prev.courses ?? [])))
  const patchCourse = (id: string, fn: (c: CourseTrack) => CourseTrack) =>
    setCourseList((cur) => cur.map((c) => (c.id === id ? fn(c) : c)))

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {/* college-application deadlines (senior only) */}
      {isSenior && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">College-app deadlines</span>
            <button className={btn} onClick={() => edit((prev) => addCollegeTask(prev))}>
              + Add task
            </button>
          </div>
          <div className="space-y-1.5">
            {(p.collegeTasks ?? []).map((task) => (
              <div key={task.id} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
                <input
                  value={task.label}
                  onChange={(e) => edit((prev) => updateCollegeTask(prev, task.id, { label: e.target.value }))}
                  className={`${input} min-w-0 flex-1`}
                  aria-label="task label"
                />
                <input
                  type="date"
                  value={task.due}
                  onChange={(e) => edit((prev) => updateCollegeTask(prev, task.id, { due: e.target.value }))}
                  className={input}
                  aria-label="due date"
                />
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={(e) => edit((prev) => updateCollegeTask(prev, task.id, { done: e.target.checked }))}
                  />
                  done
                </label>
                <button className={dangerBtn} onClick={() => edit((prev) => removeCollegeTask(prev, task.id))} aria-label="remove task">
                  ✕
                </button>
              </div>
            ))}
            {(p.collegeTasks ?? []).length === 0 && (
              <p className="text-xs text-slate-400">No tasks yet — add the essay, FAFSA, and each application.</p>
            )}
          </div>
        </section>
      )}

      {/* course progress tracks */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">Course progress</span>
          <button
            className={btn}
            onClick={() => setCourseList((cur) => [...cur, { id: nid(), name: 'New course', units: [{ id: nid(), label: 'Unit 1', done: false }] }])}
          >
            + Add course
          </button>
        </div>
        <div className="space-y-2">
          {courses.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={c.name}
                  onChange={(e) => patchCourse(c.id, (x) => ({ ...x, name: e.target.value }))}
                  className={`${input} min-w-0 flex-1 font-semibold`}
                  aria-label="course name"
                />
                <button
                  className={btn}
                  onClick={() => patchCourse(c.id, (x) => ({ ...x, units: [...x.units, { id: nid(), label: `Unit ${x.units.length + 1}`, done: false }] }))}
                >
                  + Unit
                </button>
                <button className={dangerBtn} onClick={() => setCourseList((cur) => cur.filter((x) => x.id !== c.id))} aria-label="remove course">
                  ✕
                </button>
              </div>
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {c.units.map((u) => (
                  <div key={u.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={u.done}
                      onChange={(e) => patchCourse(c.id, (x) => ({ ...x, units: x.units.map((y) => (y.id === u.id ? { ...y, done: e.target.checked } : y)) }))}
                    />
                    <input
                      value={u.label}
                      onChange={(e) => patchCourse(c.id, (x) => ({ ...x, units: x.units.map((y) => (y.id === u.id ? { ...y, label: e.target.value } : y)) }))}
                      className={`${input} min-w-0 flex-1`}
                      aria-label="unit label"
                    />
                    <button
                      className={dangerBtn}
                      onClick={() => patchCourse(c.id, (x) => ({ ...x, units: x.units.filter((y) => y.id !== u.id) }))}
                      aria-label="remove unit"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
