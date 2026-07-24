import { describe, expect, it } from 'vitest'
import type { AppState, MissionDay, Profile } from '../types'
import { emptyProfile, defaultAppState } from '../migration'
import { importBackup } from '../appState'
import {
  DEFAULT_RATES,
  approveRedemption,
  availableBalance,
  awardMissionEvents,
  awardPracticeSession,
  awardTutorRetry,
  defaultStarsConfig,
  denyRedemption,
  getStars,
  grantAdjust,
  invariantOk,
  ledgerSum,
  requestRedemption,
  starsEnabled,
} from './stars'

const RATES = DEFAULT_RATES
const DAY = '2026-07-23' // a Thursday
const WEEK = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23'] // Mon–Thu same week

function kid(): Profile {
  return emptyProfile('p1', 'Tester', '3') // playful theme
}

const completeDay = (): MissionDay => ({ items: [{ id: 'a', label: 'A', done: true }] })
const openDay = (): MissionDay => ({ items: [{ id: 'a', label: 'A', done: false }] })

describe('gating', () => {
  it('enables stars for playful, cool-opt-in, never teens', () => {
    expect(starsEnabled(emptyProfile('p', 'x', '3'))).toBe(true)
    expect(starsEnabled(emptyProfile('p', 'x', '4'))).toBe(true)
    const cool = emptyProfile('p', 'x', '6')
    expect(starsEnabled(cool)).toBe(false)
    expect(starsEnabled({ ...cool, coolStars: true })).toBe(true)
    expect(starsEnabled(emptyProfile('p', 'x', '10'))).toBe(false)
    expect(starsEnabled(emptyProfile('p', 'x', '12'))).toBe(false)
  })
})

describe('earning table', () => {
  it('practice session pays the base rate', () => {
    const p = awardPracticeSession(kid(), 10, 15, RATES, DAY)
    expect(getStars(p).balance).toBe(RATES.practiceSession)
  })

  it('accuracy bonus only at ≥80%', () => {
    const low = awardPracticeSession(kid(), 11, 15, RATES, DAY) // 73%
    expect(getStars(low).balance).toBe(RATES.practiceSession)
    const high = awardPracticeSession(kid(), 12, 15, RATES, DAY) // 80%
    expect(getStars(high).balance).toBe(RATES.practiceSession + RATES.accuracyBonus)
  })

  it('mission completion pays only on the false→true transition', () => {
    const before: Profile = { ...kid(), missions: { [DAY]: openDay() } }
    const after: Profile = { ...before, missions: { [DAY]: completeDay() } }
    const paid = awardMissionEvents(before, after, RATES, DAY)
    expect(getStars(paid).balance).toBe(RATES.missionComplete)
    // re-running with an already-complete "before" pays nothing (idempotent)
    const again = awardMissionEvents(paid, paid, RATES, DAY)
    expect(getStars(again).balance).toBe(RATES.missionComplete)
  })

  it('weekly-streak pays once when the 4th mission day completes', () => {
    const missionsMost: Record<string, MissionDay> = {
      [WEEK[0]]: completeDay(),
      [WEEK[1]]: completeDay(),
      [WEEK[2]]: completeDay(),
      [WEEK[3]]: openDay(),
    }
    const before: Profile = { ...kid(), missions: missionsMost }
    const after: Profile = { ...before, missions: { ...missionsMost, [WEEK[3]]: completeDay() } }
    const paid = awardMissionEvents(before, after, RATES, DAY)
    expect(getStars(paid).balance).toBe(RATES.missionComplete + RATES.weeklyStreak)
    // a 5th completion later the same week must NOT pay the weekly bonus again
    const before2: Profile = { ...paid, missions: { ...after.missions, '2026-07-24': openDay() } }
    const after2: Profile = { ...before2, missions: { ...before2.missions, '2026-07-24': completeDay() } }
    const paid2 = awardMissionEvents(before2, after2, RATES, '2026-07-24')
    expect(getStars(paid2).balance).toBe(RATES.missionComplete + RATES.weeklyStreak + RATES.missionComplete)
  })
})

describe('daily caps', () => {
  it('caps auto-earning at 25/day', () => {
    let p = kid()
    for (let i = 0; i < 5; i++) p = awardPracticeSession(p, 15, 15, RATES, DAY) // 8+3 each
    expect(getStars(p).balance).toBe(RATES.dailyCap)
    // a new day resets the cap
    p = awardPracticeSession(p, 15, 15, RATES, '2026-07-24')
    expect(getStars(p).balance).toBe(RATES.dailyCap + RATES.practiceSession + RATES.accuracyBonus)
  })

  it('tutor-retry has its own +6/day sub-cap', () => {
    let p = kid()
    for (let i = 0; i < 6; i++) p = awardTutorRetry(p, RATES, DAY) // 2 each, max 6/day
    expect(getStars(p).balance).toBe(RATES.tutorRetryDailyMax)
  })
})

describe('never-deduct except redemption', () => {
  it('grant floors a negative correction at zero balance and records the applied delta', () => {
    let p = awardPracticeSession(kid(), 15, 15, RATES, DAY) // 11
    const res = grantAdjust(p, -100, 'correction', DAY)
    expect(res.ok).toBe(true)
    p = res.profile
    expect(getStars(p).balance).toBe(0)
    expect(invariantOk(getStars(p))).toBe(true)
  })

  it('grant requires a reason and a non-zero amount', () => {
    expect(grantAdjust(kid(), 5, '   ', DAY).ok).toBe(false)
    expect(grantAdjust(kid(), 0, 'nope', DAY).ok).toBe(false)
    expect(grantAdjust(kid(), 5, 'helped sister', DAY).ok).toBe(true)
  })
})

describe('redemption flow', () => {
  const prize = { id: 'pz', name: 'Treat', emoji: '🍦', cost: 30, active: true }

  function saver(): Profile {
    // three capped days → 75 stars
    let p = kid()
    for (const d of ['2026-07-20', '2026-07-21', '2026-07-22']) {
      for (let i = 0; i < 4; i++) p = awardPracticeSession(p, 15, 15, RATES, d)
    }
    return p
  }

  it('request holds without moving stars; available drops', () => {
    const p0 = saver()
    const startBal = getStars(p0).balance
    const res = requestRedemption(p0, prize)
    expect(res.ok).toBe(true)
    const p = res.profile
    expect(getStars(p).balance).toBe(startBal) // nothing moved yet
    expect(getStars(p).pendingRedemptions).toHaveLength(1)
    expect(availableBalance(p)).toBe(startBal - prize.cost)
  })

  it('approve drops balance + writes a redeem entry', () => {
    const p0 = saver()
    const startBal = getStars(p0).balance
    const pending = requestRedemption(p0, prize).profile
    const res = approveRedemption(pending, getStars(pending).pendingRedemptions[0].id)
    expect(res.ok).toBe(true)
    const p = res.profile
    expect(getStars(p).balance).toBe(startBal - prize.cost)
    expect(getStars(p).pendingRedemptions).toHaveLength(0)
    expect(getStars(p).ledger.at(-1)).toMatchObject({ amount: -prize.cost, source: 'redeem' })
    expect(invariantOk(getStars(p))).toBe(true)
  })

  it('deny leaves the balance untouched and moves nothing', () => {
    const p0 = saver()
    const startBal = getStars(p0).balance
    const startLedger = getStars(p0).ledger.length
    const pending = requestRedemption(p0, prize).profile
    const p = denyRedemption(pending, getStars(pending).pendingRedemptions[0].id)
    expect(getStars(p).balance).toBe(startBal)
    expect(getStars(p).ledger.length).toBe(startLedger) // no new ledger rows
    expect(getStars(p).pendingRedemptions).toHaveLength(0)
  })

  it('cannot hold more than the available balance', () => {
    const p0 = saver() // 75
    const big = { ...prize, cost: 60 }
    const first = requestRedemption(p0, big)
    expect(first.ok).toBe(true)
    const second = requestRedemption(first.profile, big) // would need 120 available
    expect(second.ok).toBe(false)
  })
})

describe('invariant holds across 50 mixed events', () => {
  it('balance always equals ledger sum', () => {
    // deterministic LCG so the sequence is reproducible
    let seed = 123456789
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const prize = { id: 'pz', name: 'Treat', emoji: '🍦', cost: 12, active: true }
    let p = kid()
    let day = 20
    for (let i = 0; i < 50; i++) {
      const iso = `2026-07-${String(day).padStart(2, '0')}`
      const roll = rnd()
      if (roll < 0.4) {
        p = awardPracticeSession(p, Math.floor(rnd() * 16), 15, RATES, iso)
      } else if (roll < 0.55) {
        p = awardTutorRetry(p, RATES, iso)
      } else if (roll < 0.7) {
        const before: Profile = { ...p, missions: { ...p.missions, [iso]: openDay() } }
        const after: Profile = { ...before, missions: { ...before.missions, [iso]: completeDay() } }
        p = awardMissionEvents(before, after, RATES, iso)
      } else if (roll < 0.82) {
        const g = grantAdjust(p, Math.floor(rnd() * 20) - 5, 'mixed-event', iso)
        if (g.ok) p = g.profile
      } else if (roll < 0.92) {
        const r = requestRedemption(p, prize)
        if (r.ok) p = r.profile
      } else {
        const pend = getStars(p).pendingRedemptions[0]
        if (pend) {
          if (rnd() < 0.5) p = approveRedemption(p, pend.id).profile
          else p = denyRedemption(p, pend.id)
        }
      }
      expect(invariantOk(getStars(p))).toBe(true)
      if (rnd() < 0.25) day = Math.min(28, day + 1)
    }
    const s = getStars(p)
    expect(s.balance).toBe(ledgerSum(s.ledger))
    expect(s.balance).toBeGreaterThanOrEqual(0)
  })
})

describe('export / import round-trips StarState', () => {
  it('a full backup preserves per-profile stars and app config', () => {
    const base: AppState = defaultAppState()
    const withStars: AppState = {
      ...base,
      stars: defaultStarsConfig(),
      profiles: {
        ...base.profiles,
        p1: awardPracticeSession(base.profiles.p1, 15, 15, RATES, DAY),
      },
    }
    const text = JSON.stringify(withStars)
    const result = importBackup(base, text)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.profiles.p1.stars).toEqual(withStars.profiles.p1.stars)
      expect(result.state.stars).toEqual(withStars.stars)
      expect(invariantOk(getStars(result.state.profiles.p1))).toBe(true)
    }
  })
})
