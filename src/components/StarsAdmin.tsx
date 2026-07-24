import { useState, type Dispatch, type SetStateAction } from 'react'
import type { AppState, Prize, Profile, StarRates, StarsConfig } from '../types'
import {
  approveRedemption,
  defaultStarsConfig,
  denyRedemption,
  getStars,
  getStarsConfig,
  grantAdjust,
  invariantOk,
  ledgerSum,
  starsEnabled,
} from '../stars/stars'

const newPrizeId = () => `pz-${Math.random().toString(36).slice(2, 9)}`

// ===========================================================================
// Per-kid admin (rendered as the "Stars" tab for a star-enabled profile)
// ===========================================================================

export function StarsProfileAdmin({
  profile,
  onChange,
}: {
  profile: Profile
  // functional writer (H1 contract): derives from the latest committed profile
  onChange: (update: (prev: Profile) => Profile) => void
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const stars = getStars(profile)
  const healthy = invariantOk(stars)

  const applyGrant = () => {
    // validate against the rendered profile for the message; apply off the latest prev
    const res = grantAdjust(profile, Number(amount), reason)
    if (!res.ok) {
      setErr(res.error ?? 'Could not apply that.')
      return
    }
    onChange((prev) => grantAdjust(prev, Number(amount), reason).profile)
    setAmount('')
    setReason('')
    setErr('')
  }

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {!healthy && (
        <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          ⚠️ Ledger mismatch: balance {stars.balance} ≠ ledger sum {ledgerSum(stars.ledger)}. This was
          NOT auto-repaired — review the ledger below and correct with a manual adjust.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl font-extrabold text-amber-600">⭐ {stars.balance}</span>
        <span className="text-xs font-semibold text-slate-500">
          {stars.lifetimeEarned} earned all-time · {stars.ledger.length} ledger entries
        </span>
        {profile.grade === '6' && (
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={profile.coolStars === true}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, coolStars: e.target.checked || undefined }))
              }
            />
            Show stars for this (cool-theme) kid
          </label>
        )}
      </div>

      {/* pending redemptions */}
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Pending redemptions
        </div>
        {stars.pendingRedemptions.length === 0 ? (
          <p className="text-sm text-slate-400">None waiting.</p>
        ) : (
          <div className="space-y-2">
            {stars.pendingRedemptions.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5"
              >
                <span className="text-sm font-bold text-slate-700">
                  {r.emoji} {r.name} · ⭐ {r.cost}
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => {
                      const res = approveRedemption(profile, r.id)
                      if (!res.ok) {
                        setErr(res.error ?? '')
                        return
                      }
                      onChange((prev) => approveRedemption(prev, r.id).profile)
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Approve (−{r.cost})
                  </button>
                  <button
                    onClick={() => onChange((prev) => denyRedemption(prev, r.id))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Deny
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* manual grant / adjust */}
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Manual grant / adjust (reason required)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="±stars"
            className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
            aria-label="grant amount"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. helped sister with hiragana ⭐5"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
            aria-label="grant reason"
          />
          <button
            onClick={applyGrant}
            className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Apply
          </button>
        </div>
        {err && <p className="mt-1 text-xs font-semibold text-rose-600">{err}</p>}
        <p className="mt-1 text-xs text-slate-400">
          Grants are uncapped. A negative correction is floored so the balance never goes below zero.
        </p>
      </div>

      {/* ledger */}
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Ledger (newest first)
        </div>
        {stars.ledger.length === 0 ? (
          <p className="text-sm text-slate-400">No entries yet.</p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {[...stars.ledger].reverse().map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">{e.day}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">{e.reason}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                  {e.source}
                </span>
                <span className={`shrink-0 font-extrabold ${e.amount >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {e.amount >= 0 ? '+' : ''}
                  {e.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ===========================================================================
// Global admin: prize CRUD + earning-table editor (rendered once)
// ===========================================================================

const RATE_FIELDS: { key: keyof StarRates; label: string }[] = [
  { key: 'practiceSession', label: 'Practice session done' },
  { key: 'accuracyBonus', label: 'Accuracy bonus (≥80%)' },
  { key: 'tutorRetry', label: 'Tutor retry solved' },
  { key: 'tutorRetryDailyMax', label: 'Tutor retry — max/day' },
  { key: 'missionComplete', label: 'Morning Mission complete' },
  { key: 'weeklyStreak', label: 'Weekly streak bonus' },
  { key: 'weeklyStreakThreshold', label: 'Weekly streak — days needed' },
  { key: 'dailyCap', label: 'Daily cap (auto-earn)' },
]

export function StarsGlobalAdmin({
  state,
  onStateChange,
}: {
  state: AppState
  onStateChange: Dispatch<SetStateAction<AppState>>
}) {
  const config = getStarsConfig(state) // render/read view only
  // Functional writer (H1 contract): every edit derives its base config from the
  // latest committed state, so two rapid edits compose instead of clobbering.
  const save = (mut: (cfg: StarsConfig) => StarsConfig) =>
    onStateChange((s) => ({ ...s, stars: mut(getStarsConfig(s)) }))

  const setPrize = (id: string, patch: Partial<Prize>) =>
    save((cfg) => ({ ...cfg, prizes: cfg.prizes.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const addPrize = () =>
    save((cfg) => ({
      ...cfg,
      prizes: [...cfg.prizes, { id: newPrizeId(), name: 'New prize', emoji: '🎁', cost: 50, active: true }],
    }))
  const removePrize = (id: string) => save((cfg) => ({ ...cfg, prizes: cfg.prizes.filter((p) => p.id !== id) }))
  const setRate = (key: keyof StarRates, value: number) =>
    save((cfg) => ({ ...cfg, rates: { ...cfg.rates, [key]: Math.max(0, Math.trunc(value)) } }))

  return (
    <div className="space-y-5">
      {/* earning table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-bold text-slate-700">Earning table (defaults; edit freely)</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RATE_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-2 text-sm text-slate-600">
              <span>{f.label}</span>
              <input
                type="number"
                value={config.rates[f.key]}
                onChange={(e) => setRate(f.key, Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-semibold"
                aria-label={f.label}
              />
            </label>
          ))}
        </div>
      </div>

      {/* prizes */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">Prizes</span>
          <span className="flex gap-2">
            <button
              onClick={addPrize}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              + Add prize
            </button>
            <button
              onClick={() => {
                if (window.confirm('Replace the whole prize list with the starter menu?'))
                  save((cfg) => ({ ...cfg, prizes: defaultStarsConfig().prizes }))
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset to starter menu
            </button>
          </span>
        </div>
        <div className="space-y-2">
          {config.prizes.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2">
              <input
                value={p.emoji}
                onChange={(e) => setPrize(p.id, { emoji: e.target.value })}
                className="w-12 rounded-lg border border-slate-300 px-2 py-1 text-center text-lg"
                aria-label={`emoji for ${p.name}`}
              />
              <input
                value={p.name}
                onChange={(e) => setPrize(p.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                aria-label={`name for ${p.id}`}
              />
              <input
                type="number"
                value={p.cost}
                onChange={(e) => setPrize(p.id, { cost: Math.max(1, Math.trunc(Number(e.target.value))) })}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm font-semibold"
                aria-label={`cost for ${p.name}`}
              />
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) => setPrize(p.id, { active: e.target.checked })}
                />
                active
              </label>
              <button
                onClick={() => removePrize(p.id)}
                className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-rose-500"
                aria-label={`remove ${p.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* invariant summary across star-enabled kids */}
      <StarHealthSummary state={state} />
    </div>
  )
}

function StarHealthSummary({ state }: { state: AppState }) {
  const flagged = Object.values(state.profiles).filter(
    (p) => starsEnabled(p) && p.stars && !invariantOk(p.stars),
  )
  if (flagged.length === 0) return null
  return (
    <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-700">
      ⚠️ {flagged.length} wallet{flagged.length === 1 ? '' : 's'} failed the balance = ledger-sum check:{' '}
      {flagged.map((p) => p.name).join(', ')}. Open each kid's Stars tab to review.
    </div>
  )
}
