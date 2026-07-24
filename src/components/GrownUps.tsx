import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, MissionTemplate, MissionTemplateItem, Profile } from '../types'
import {
  downloadJson,
  exportAllBackup,
  importBackup,
  listV1BackupKeys,
  readLocalStorageKey,
} from '../appState'
import { emptyProfile, SCHEMA_VERSION } from '../migration'
import { defaultTemplateFor, isDayComplete, templateFor } from '../missions'
import { AssessmentAdmin } from './assessment/AssessmentAdmin'
import { HsGrownUps } from './HsGrownUps'
import { NeedsDadFlags, TutorControls } from './TutorPanel'
import { TutorAiControls } from './tutor/TutorAiControls'
import { SyncControls } from './sync/SyncControls'
import type { SyncApi } from '../sync/useSync'
import { StarsGlobalAdmin, StarsProfileAdmin } from './StarsAdmin'
import { getStars } from '../stars/stars'
import { ReadingGrownUps } from './reading/ReadingGrownUps'
import { MindsetProfilePanel, MindsetStartDate } from './mindset/MindsetGrownUps'

interface GrownUpsProps {
  state: AppState
  /** App's React setState — accepts a value or a functional update (prev => next). */
  onStateChange: Dispatch<SetStateAction<AppState>>
  /** M6 cloud-sync API (identity, status, sync now, migration). */
  sync: SyncApi
  onClose: () => void
  onChangeParentPin: () => void
}

export function GrownUps({ state, onStateChange, sync, onClose, onChangeParentPin }: GrownUpsProps) {
  const [msg, setMsg] = useState('')
  const [expanded, setExpanded] = useState<{
    id: string
    tab: 'template' | 'history' | 'assessments' | 'hs' | 'stars' | 'reading' | 'mindset'
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const backupKeys = listV1BackupKeys()

  // Functional per-profile writer: every edit derives its base from the latest
  // committed profile, so admin edits never clobber a concurrent write. Child
  // panels receive `(update) => patchProfile(p.id, update)`.
  const patchProfile = (id: string, update: (prev: Profile) => Profile) =>
    onStateChange((s) =>
      s.profiles[id] ? { ...s, profiles: { ...s.profiles, [id]: update(s.profiles[id]) } } : s,
    )

  function resetProgress(p: Profile) {
    if (!window.confirm(`Erase ALL progress for ${p.name}? This cannot be undone.`)) return
    if (!window.confirm(`Really sure? ${p.name}'s mastery, streaks and missions will be wiped.`)) return
    patchProfile(p.id, (prev) => {
      const fresh = emptyProfile(prev.id, prev.name, prev.grade)
      return { ...fresh, pin: prev.pin, theme: prev.theme, createdAt: prev.createdAt }
    })
    setMsg(`${p.name}'s progress was reset.`)
  }

  function handleImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    file.text().then((text) => {
      const result = importBackup(state, text)
      if (!result.ok) {
        setMsg(`❌ ${result.error}`)
      } else if (
        window.confirm(`${result.note}\n\nThis will overwrite current data. Continue?`)
      ) {
        onStateChange(result.state)
        setMsg(`✅ ${result.note}`)
      }
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  const masteredCount = (p: Profile) =>
    Object.values(p.skills).filter((s) => s && s.attempts > 0 && s.mastery >= 75).length

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">🔒 Grown-Ups panel</h1>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Schema v{SCHEMA_VERSION} · all data lives on this device · export a backup regularly
        </p>
        {msg && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
            {msg}
          </div>
        )}

        {/* profiles */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Profiles</h2>
        <div className="space-y-3">
          {Object.values(state.profiles).map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={p.name}
                  onChange={(e) => patchProfile(p.id, (prev) => ({ ...prev, name: e.target.value }))}
                  className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-800"
                  aria-label={`name for ${p.id}`}
                />
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  Grade {p.grade} · {p.theme}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {p.pin ? 'PIN set' : 'no PIN yet'} · {masteredCount(p)} skills mastered ·{' '}
                  {p.totals.questionsAnswered} questions all-time
                </span>
                <span className="ml-auto flex gap-2">
                  <button
                    onClick={() =>
                      setExpanded(
                        expanded?.id === p.id && expanded.tab === 'template'
                          ? null
                          : { id: p.id, tab: 'template' },
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Mission template
                  </button>
                  <button
                    onClick={() =>
                      setExpanded(
                        expanded?.id === p.id && expanded.tab === 'history'
                          ? null
                          : { id: p.id, tab: 'history' },
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    History
                  </button>
                  <button
                    onClick={() =>
                      setExpanded(
                        expanded?.id === p.id && expanded.tab === 'mindset'
                          ? null
                          : { id: p.id, tab: 'mindset' },
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Mindset 🧠
                  </button>
                  {/* playful always; grade-6 cool always (so Dad can reach the opt-in toggle); never teens */}
                  {(p.theme === 'playful' || p.theme === 'cool') && (
                    <button
                      onClick={() =>
                        setExpanded(
                          expanded?.id === p.id && expanded.tab === 'stars'
                            ? null
                            : { id: p.id, tab: 'stars' },
                        )
                      }
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                    >
                      Stars ⭐
                      {getStars(p).pendingRedemptions.length > 0 && (
                        <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {getStars(p).pendingRedemptions.length}
                        </span>
                      )}
                    </button>
                  )}
                  {(p.grade === '3' || p.grade === '4' || p.grade === '6') && (
                    <button
                      onClick={() =>
                        setExpanded(
                          expanded?.id === p.id && expanded.tab === 'reading'
                            ? null
                            : { id: p.id, tab: 'reading' },
                        )
                      }
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Reading 📖
                    </button>
                  )}
                  {(p.grade === '10' || p.grade === '12') && (
                    <button
                      onClick={() =>
                        setExpanded(
                          expanded?.id === p.id && expanded.tab === 'assessments'
                            ? null
                            : { id: p.id, tab: 'assessments' },
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Assessments
                    </button>
                  )}
                  {(p.grade === '10' || p.grade === '12') && (
                    <button
                      onClick={() =>
                        setExpanded(
                          expanded?.id === p.id && expanded.tab === 'hs'
                            ? null
                            : { id: p.id, tab: 'hs' },
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      HS setup
                    </button>
                  )}
                  {p.pin && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Clear ${p.name}'s PIN? She'll choose a new one at next sign-in.`))
                          patchProfile(p.id, (prev) => ({ ...prev, pin: '' }))
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Clear PIN
                    </button>
                  )}
                  <button
                    onClick={() => resetProgress(p)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Reset progress
                  </button>
                </span>
              </div>
              {expanded?.id === p.id && expanded.tab === 'template' && (
                <TemplateEditor profile={p} onChange={(update) => patchProfile(p.id, update)} />
              )}
              {expanded?.id === p.id && expanded.tab === 'history' && (
                <MissionHistory profile={p} />
              )}
              {expanded?.id === p.id && expanded.tab === 'assessments' && (
                <AssessmentAdmin
                  profile={p}
                  nowISO={new Date().toISOString()}
                  onPatch={(update) => patchProfile(p.id, update)}
                />
              )}
              {expanded?.id === p.id && expanded.tab === 'hs' && (
                <HsGrownUps profile={p} onChange={(update) => patchProfile(p.id, update)} />
              )}
              {expanded?.id === p.id && expanded.tab === 'stars' && (
                <StarsProfileAdmin profile={p} onChange={(update) => patchProfile(p.id, update)} />
              )}
              {expanded?.id === p.id && expanded.tab === 'reading' && (
                <ReadingGrownUps profile={p} onChange={(update) => patchProfile(p.id, update)} />
              )}
              {expanded?.id === p.id && expanded.tab === 'mindset' && (
                <MindsetProfilePanel profile={p} />
              )}
            </div>
          ))}
        </div>

        {/* needs-dad flags (MT-1 escalation) */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Needs Dad</h2>
        <NeedsDadFlags state={state} onStateChange={onStateChange} />

        {/* tutor voice (MT-1) */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Tutor &amp; Voice</h2>
        <TutorControls state={state} onStateChange={onStateChange} />

        {/* AI tutor — key, per-profile cap, chat transcripts (MT-2/3) */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">AI Tutor 💬</h2>
        <TutorAiControls state={state} onStateChange={onStateChange} />

        {/* star economy (MS) */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Star economy ⭐</h2>
        <StarsGlobalAdmin state={state} onStateChange={onStateChange} />

        {/* mindset (MM) — start date drives the weekly unlock; per-profile completion is above */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Mindset 🧠</h2>
        <MindsetStartDate state={state} onStateChange={onStateChange} />

        {/* cloud sync (M6) — sign in, status, migration. The JSON backup below stays
            the forever escape hatch, and everything works with no sync configured. */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Cloud sync ☁️</h2>
        <SyncControls sync={sync} />

        {/* backup */}
        <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Backup</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              exportAllBackup(state)
              setMsg('✅ Exported all five profiles to one JSON file.')
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            ⬇️ Export ALL profiles (JSON)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ⬆️ Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => handleImport(e.target.files)}
          />
          <button
            onClick={onChangeParentPin}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Change parent PIN
          </button>
        </div>

        {/* migration snapshots */}
        {backupKeys.length > 0 && (
          <>
            <h2 className="mt-6 mb-2 text-lg font-bold text-slate-800">Migration snapshots</h2>
            <div className="space-y-2">
              {backupKeys.map((k) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs"
                >
                  <code className="text-slate-500">{k}</code>
                  <button
                    onClick={() => {
                      const raw = readLocalStorageKey(k)
                      if (raw) downloadJson(`${k.replaceAll(':', '_')}.json`, raw)
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------- mission template editor ----------

const newItemId = () => `m${Math.random().toString(36).slice(2, 9)}`

function TemplateEditor({
  profile,
  onChange,
}: {
  profile: Profile
  onChange: (update: (prev: Profile) => Profile) => void
}) {
  const template = templateFor(profile) // render/read view only
  // Whole-template replace (reset button) — prev-independent by design.
  const set = (t: MissionTemplate) => onChange((prev) => ({ ...prev, template: t }))

  // Per-list edit derives the base template from prev, not the render snapshot,
  // so two list edits in one tick compose instead of the second replaying a
  // stale template over the first.
  const editList = (
    key: 'weekday' | 'friday',
    fn: (items: MissionTemplateItem[]) => MissionTemplateItem[],
  ) =>
    onChange((prev) => {
      const cur = templateFor(prev)
      return { ...prev, template: { ...cur, [key]: fn(cur[key]) } }
    })

  const renderList = (key: 'weekday' | 'friday', title: string) => (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="space-y-1.5">
        {template[key].map((item, idx) => (
          <div key={item.id} className="flex items-center gap-1.5">
            <button
              onClick={() =>
                idx > 0 &&
                editList(key, (items) => {
                  const a = [...items]
                  ;[a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]
                  return a
                })
              }
              disabled={idx === 0}
              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-500 disabled:opacity-30"
              aria-label="move up"
            >
              ▲
            </button>
            <input
              value={item.label}
              onChange={(e) =>
                editList(key, (items) =>
                  items.map((x) => (x.id === item.id ? { ...x, label: e.target.value } : x)),
                )
              }
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800"
            />
            <label
              className="flex items-center gap-1 text-xs font-semibold text-slate-500"
              title="Auto items check themselves when the in-app math session finishes"
            >
              <input
                type="checkbox"
                checked={!!item.auto}
                onChange={(e) =>
                  editList(key, (items) =>
                    items.map((x) =>
                      x.id === item.id ? { ...x, auto: e.target.checked || undefined } : x,
                    ),
                  )
                }
              />
              auto
            </label>
            <button
              onClick={() => editList(key, (items) => items.filter((x) => x.id !== item.id))}
              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-rose-500"
              aria-label="remove item"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() =>
          editList(key, (items) => [...items, { id: newItemId(), label: 'New item' }])
        }
        className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        + Add item
      </button>
    </div>
  )

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">
          Mission template — changes apply from the next new day
        </span>
        <button
          onClick={() => {
            if (window.confirm('Replace this template with the grade default?'))
              set(defaultTemplateFor(profile.grade))
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Reset to default
        </button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        {renderList('weekday', 'Monday–Thursday')}
        {renderList('friday', 'Friday (light day)')}
      </div>
    </div>
  )
}

// ---------- mission history ----------

function MissionHistory({ profile }: { profile: Profile }) {
  const dates = Object.keys(profile.missions).sort().reverse().slice(0, 30)
  if (dates.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        No mission days recorded yet.
      </div>
    )
  }
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {dates.map((date) => {
        const day = profile.missions[date]
        const done = day.items.filter((i) => i.done).length
        return (
          <div key={date} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-700">{date}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isDayComplete(day) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {done}/{day.items.length} {isDayComplete(day) ? '· complete' : ''}
              </span>
            </div>
            <ul className="mt-1.5 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
              {day.items.map((i) => (
                <li key={i.id} className="text-xs text-slate-500">
                  <span className={i.done ? 'text-emerald-600' : 'text-slate-300'}>
                    {i.done ? '✓' : '○'}
                  </span>{' '}
                  {i.label}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
