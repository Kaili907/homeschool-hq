import type {
  AppState,
  ISODate,
  LedgerEntry,
  PendingRedemption,
  Prize,
  Profile,
  StarEventSource,
  StarRates,
  StarState,
  StarsConfig,
} from '../types'
import { isDayComplete } from '../missions'
import { isoToday } from '../appState'

// ---------------------------------------------------------------------------
// Design principles (load-bearing — see Stars-Addendum-v2-2, do not "improve"):
//  1. Stars pay for effort/completion, not correctness (accuracy = small bonus).
//  2. Stars are NEVER deducted except by redemption. No penalties, no negatives.
//  3. Assessments are never starred (this module is never called from the
//     placement/assessment paths).
//  4. Dad is the bank — redemptions only move stars on approve.
//  5. Celebration ≠ paycheck.
// The ledger is append-only and balance must always equal the ledger sum.
// ---------------------------------------------------------------------------

// ---------- defaults ----------

export const DEFAULT_RATES: StarRates = {
  practiceSession: 8,
  accuracyBonus: 3,
  tutorRetry: 2,
  tutorRetryDailyMax: 6,
  missionComplete: 5,
  weeklyStreak: 10,
  weeklyStreakThreshold: 4,
  dailyCap: 25,
}

/** Starter prize menu from the addendum. Dad edits freely in the Grown-Ups panel. */
export const STARTER_PRIZES: Prize[] = [
  { id: 'pz-treat', name: 'Special treat pick', emoji: '🍦', cost: 30, active: true },
  { id: 'pz-dj', name: 'Dance party DJ for the evening', emoji: '🎵', cost: 25, active: true },
  { id: 'pz-latenight', name: 'Stay up 15 min late', emoji: '🛏️', cost: 35, active: true },
  { id: 'pz-fridaydinner', name: 'Pick Friday dinner', emoji: '🍕', cost: 40, active: true },
  { id: 'pz-movie', name: 'Family movie night — her pick', emoji: '🎬', cost: 100, active: true },
  { id: 'pz-dollarstore', name: 'Dollar-store trip ($5 budget)', emoji: '🏪', cost: 150, active: true },
  { id: 'pz-art', name: 'New art supplies', emoji: '🎨', cost: 175, active: true },
  { id: 'pz-bake', name: 'Bake-with-Dad session, her recipe', emoji: '👩‍🍳', cost: 125, active: true },
  { id: 'pz-toy', name: 'Toy or book up to $20', emoji: '🧸', cost: 800, active: true },
  { id: 'pz-outing', name: 'Special outing of her choice', emoji: '🎳', cost: 1000, active: true },
  { id: 'pz-daytrip', name: 'Day trip she plans with Dad', emoji: '🎟️', cost: 1500, active: true },
]

export function defaultStarsConfig(): StarsConfig {
  return { prizes: STARTER_PRIZES.map((p) => ({ ...p })), rates: { ...DEFAULT_RATES } }
}

/** App-level config with defaults filled in (old states have no `stars` block). */
export function getStarsConfig(state: AppState): StarsConfig {
  const c = state.stars
  if (!c) return defaultStarsConfig()
  return {
    prizes: c.prizes ?? STARTER_PRIZES.map((p) => ({ ...p })),
    rates: { ...DEFAULT_RATES, ...c.rates },
  }
}

// ---------- wallet basics ----------

export function emptyStarState(): StarState {
  return { balance: 0, lifetimeEarned: 0, ledger: [], pendingRedemptions: [] }
}

export function getStars(p: Profile): StarState {
  return p.stars ?? emptyStarState()
}

/** Playful profiles always have stars; grade-6 "cool" only when opted in; teens never. */
export function starsEnabled(p: Profile): boolean {
  if (p.theme === 'playful') return true
  if (p.theme === 'cool') return p.coolStars === true
  return false
}

export function ledgerSum(ledger: LedgerEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.amount, 0)
}

/** Invariant: a wallet's balance must equal the sum of its ledger. Never silently
 * repaired — a mismatch is surfaced in the Grown-Ups panel. */
export function invariantOk(s: StarState): boolean {
  return s.balance === ledgerSum(s.ledger)
}

/** stars on hold for pending (unapproved) redemptions. */
export function heldTotal(s: StarState): number {
  return s.pendingRedemptions.reduce((sum, r) => sum + r.cost, 0)
}

/** balance minus stars already on hold — what a new "Ask Dad!" can draw from. */
export function availableBalance(p: Profile): number {
  const s = getStars(p)
  return s.balance - heldTotal(s)
}

// ---------- ids & week math (Date.now/Math.random are fine in app code) ----------

let seq = 0
function newId(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function isoOf(dt: Date): ISODate {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Monday-of-week for a local ISO date. Weeks run Mon–Sun. */
export function weekStartISO(day: ISODate): ISODate {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const mondayOffset = (dt.getDay() + 6) % 7 // Mon=0 … Sun=6
  dt.setDate(dt.getDate() - mondayOffset)
  return isoOf(dt)
}

function sameWeek(a: ISODate, b: ISODate): boolean {
  return weekStartISO(a) === weekStartISO(b)
}

// ---------- daily-cap accounting ----------

const AUTO: StarEventSource[] = [
  'practice-session',
  'accuracy-bonus',
  'tutor-retry',
  'mission-complete',
  'weekly-streak',
]

function earnedTodayAuto(s: StarState, day: ISODate): number {
  return s.ledger
    .filter((e) => e.day === day && e.amount > 0 && AUTO.includes(e.source))
    .reduce((sum, e) => sum + e.amount, 0)
}

function retryEarnedToday(s: StarState, day: ISODate): number {
  return s.ledger
    .filter((e) => e.day === day && e.source === 'tutor-retry')
    .reduce((sum, e) => sum + e.amount, 0)
}

/**
 * Append one auto-earn entry, honoring the tutor-retry sub-cap and the global
 * daily cap. Returns the wallet unchanged when there's no room left. The entry
 * records the ACTUAL (possibly capped) amount so the balance == ledger invariant
 * always holds.
 */
function applyAutoEarn(
  s: StarState,
  source: StarEventSource,
  want: number,
  baseReason: string,
  day: ISODate,
  rates: StarRates,
): StarState {
  let capped = Math.max(0, Math.floor(want))
  if (source === 'tutor-retry') {
    capped = Math.min(capped, Math.max(0, rates.tutorRetryDailyMax - retryEarnedToday(s, day)))
  }
  capped = Math.min(capped, Math.max(0, rates.dailyCap - earnedTodayAuto(s, day)))
  if (capped <= 0) return s
  const reason = capped < Math.floor(want) ? `${baseReason} (daily max reached)` : baseReason
  const entry: LedgerEntry = {
    id: newId('le'),
    at: new Date().toISOString(),
    day,
    amount: capped,
    reason,
    source,
  }
  return {
    ...s,
    balance: s.balance + capped,
    lifetimeEarned: s.lifetimeEarned + capped,
    ledger: [...s.ledger, entry],
  }
}

function withStars(p: Profile, fn: (s: StarState) => StarState): Profile {
  return { ...p, stars: fn(getStars(p)) }
}

// ---------- earning hooks ----------

/** Daily practice session finished: base pay + accuracy bonus if ≥80%.
 * NEVER called for placement or assessments (principle 3). */
export function awardPracticeSession(
  p: Profile,
  correct: number,
  total: number,
  rates: StarRates,
  today: ISODate = isoToday(),
): Profile {
  return withStars(p, (s0) => {
    let s = applyAutoEarn(s0, 'practice-session', rates.practiceSession, 'Finished practice', today, rates)
    if (total > 0 && correct / total >= 0.8) {
      s = applyAutoEarn(s, 'accuracy-bonus', rates.accuracyBonus, 'Accuracy bonus', today, rates)
    }
    return s
  })
}

/** A walkthrough-assisted retry (MT-1) solved correctly. Sub-capped at +6/day. */
export function awardTutorRetry(
  p: Profile,
  rates: StarRates,
  today: ISODate = isoToday(),
): Profile {
  return withStars(p, (s) =>
    applyAutoEarn(s, 'tutor-retry', rates.tutorRetry, 'Tried one like it — nice!', today, rates),
  )
}

function completeDaysInWeek(p: Profile, today: ISODate): number {
  let n = 0
  for (const [day, md] of Object.entries(p.missions)) {
    if (sameWeek(day, today) && isDayComplete(md)) n += 1
  }
  return n
}

function weeklyBonusAwardedThisWeek(s: StarState, today: ISODate): boolean {
  return s.ledger.some((e) => e.source === 'weekly-streak' && sameWeek(e.day, today))
}

/**
 * Given a profile before and after a mission mutation, pay the mission-complete
 * bonus (and the weekly-streak bonus) IFF today's mission just transitioned to
 * fully-complete. Idempotent: re-checking/unchecking a done day pays nothing.
 */
export function awardMissionEvents(
  before: Profile,
  after: Profile,
  rates: StarRates,
  today: ISODate = isoToday(),
): Profile {
  const wasComplete = isDayComplete(before.missions[today])
  const nowComplete = isDayComplete(after.missions[today])
  if (wasComplete || !nowComplete) return after

  let p = withStars(after, (s) =>
    applyAutoEarn(s, 'mission-complete', rates.missionComplete, "Finished today's mission", today, rates),
  )
  if (
    completeDaysInWeek(p, today) >= rates.weeklyStreakThreshold &&
    !weeklyBonusAwardedThisWeek(getStars(p), today)
  ) {
    p = withStars(p, (s) =>
      applyAutoEarn(s, 'weekly-streak', rates.weeklyStreak, 'Weekly streak — great week!', today, rates),
    )
  }
  return p
}

// ---------- manual (Dad) grant / adjust ----------

export interface GrantResult {
  ok: boolean
  profile: Profile
  error?: string
}

/**
 * Dad's manual grant/adjust (uncapped, required reason). Positive is a real-world
 * bonus; a negative correction is the bank fixing its books and is floored so the
 * balance can never go negative (principle 2). The ACTUAL applied delta is written
 * to the ledger so the invariant holds.
 */
export function grantAdjust(
  p: Profile,
  delta: number,
  reason: string,
  today: ISODate = isoToday(),
): GrantResult {
  const trimmed = reason.trim()
  if (!trimmed) return { ok: false, profile: p, error: 'A reason is required.' }
  const d = Math.trunc(delta)
  if (d === 0) return { ok: false, profile: p, error: 'Enter a non-zero amount.' }
  const s = getStars(p)
  const applied = Math.max(d, -s.balance) // never below zero
  const entry: LedgerEntry = {
    id: newId('le'),
    at: new Date().toISOString(),
    day: today,
    amount: applied,
    reason: trimmed,
    source: 'manual-grant',
  }
  return {
    ok: true,
    profile: {
      ...p,
      stars: {
        ...s,
        balance: s.balance + applied,
        lifetimeEarned: s.lifetimeEarned + Math.max(0, applied),
        ledger: [...s.ledger, entry],
      },
    },
  }
}

// ---------- redemption (Dad is the bank) ----------

export interface RedeemResult {
  ok: boolean
  profile: Profile
  error?: string
}

/** Kid taps a prize → "Ask Dad!". Creates a pending hold; NO stars move yet.
 * Gated on available (balance − existing holds) so holds can't outrun the wallet. */
export function requestRedemption(p: Profile, prize: Prize, now: string = new Date().toISOString()): RedeemResult {
  if (!prize.active) return { ok: false, profile: p, error: 'That prize is not available right now.' }
  if (availableBalance(p) < prize.cost) {
    return { ok: false, profile: p, error: 'Not enough stars yet — keep saving!' }
  }
  const s = getStars(p)
  const pending: PendingRedemption = {
    id: newId('pr'),
    prizeId: prize.id,
    name: prize.name,
    emoji: prize.emoji,
    cost: prize.cost, // locked at request time — price can't change mid-save
    requestedAt: now,
  }
  return {
    ok: true,
    profile: { ...p, stars: { ...s, pendingRedemptions: [...s.pendingRedemptions, pending] } },
  }
}

/** Dad approves: balance drops by the locked cost + a redeem ledger entry; the
 * pending hold is cleared. This is the ONLY path that removes stars. */
export function approveRedemption(p: Profile, pendingId: string): RedeemResult {
  const s = getStars(p)
  const pending = s.pendingRedemptions.find((r) => r.id === pendingId)
  if (!pending) return { ok: false, profile: p, error: 'That request is no longer pending.' }
  if (s.balance < pending.cost) {
    return { ok: false, profile: p, error: 'Balance is below the locked price — check the ledger.' }
  }
  const entry: LedgerEntry = {
    id: newId('le'),
    at: new Date().toISOString(),
    day: isoToday(),
    amount: -pending.cost,
    reason: `Redeemed ${pending.emoji} ${pending.name}`,
    source: 'redeem',
  }
  return {
    ok: true,
    profile: {
      ...p,
      stars: {
        ...s,
        balance: s.balance - pending.cost,
        ledger: [...s.ledger, entry],
        pendingRedemptions: s.pendingRedemptions.filter((r) => r.id !== pendingId),
      },
    },
  }
}

/** Dad denies: the hold is removed and NOTHING moves (principle 4). */
export function denyRedemption(p: Profile, pendingId: string): Profile {
  const s = getStars(p)
  if (!s.pendingRedemptions.some((r) => r.id === pendingId)) return p
  return {
    ...p,
    stars: { ...s, pendingRedemptions: s.pendingRedemptions.filter((r) => r.id !== pendingId) },
  }
}
