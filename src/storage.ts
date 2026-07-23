import type { Profile, SkillStat, SkillStatus } from './types'
import type { SkillId } from './skills'

const KEY = 'homeschool-hq:profile:v1'

export function newProfile(): Profile {
  return {
    version: 1,
    name: 'Math Champ',
    createdAt: new Date().toISOString(),
    placementDone: false,
    skillStats: {},
    totals: { questionsAnswered: 0, correct: 0, bestStreak: 0, sessions: 0 },
  }
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return newProfile()
    const p = JSON.parse(raw) as Profile
    if (p && p.version === 1 && p.skillStats && p.totals) return p
  } catch {
    // fall through to a fresh profile
  }
  return newProfile()
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function resetProfile(): Profile {
  const p = newProfile()
  saveProfile(p)
  return p
}

export function statusOf(stat: SkillStat | undefined): SkillStatus {
  if (!stat || stat.attempts === 0) return 'not-started'
  return stat.mastery >= 75 ? 'mastered' : 'developing'
}

export function getStat(p: Profile, id: SkillId): SkillStat {
  return p.skillStats[id] ?? { attempts: 0, correct: 0, mastery: 0 }
}

/** Update mastery after one answered question. Returns a new profile object. */
export function recordAnswer(
  p: Profile,
  skillId: SkillId,
  difficulty: number,
  correct: boolean,
): Profile {
  const prev = getStat(p, skillId)
  const stat: SkillStat = {
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    mastery: correct
      ? Math.min(100, prev.mastery + 4 + difficulty * 2)
      : Math.max(5, prev.mastery - 7),
  }
  return {
    ...p,
    skillStats: { ...p.skillStats, [skillId]: stat },
    totals: {
      ...p.totals,
      questionsAnswered: p.totals.questionsAnswered + 1,
      correct: p.totals.correct + (correct ? 1 : 0),
    },
  }
}

// ---------- backup ----------

export function exportBackup(p: Profile): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `homeschool-hq-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseBackup(text: string): Profile | null {
  try {
    const p = JSON.parse(text) as Profile
    if (p && p.version === 1 && p.skillStats && p.totals && typeof p.name === 'string') return p
  } catch {
    // invalid file
  }
  return null
}
