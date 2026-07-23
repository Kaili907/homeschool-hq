import { SKILLS, type SkillId } from './skills'
import type { AnswerRecord, Difficulty, Profile, SkillStatus } from './types'
import { getStat } from './storage'

export const PLACEMENT_TOTAL = 20
export const PRACTICE_TOTAL = 15

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- placement ----------

/** Skill order for the placement test: every skill once, then a reshuffled second pass. */
export function placementOrder(): SkillId[] {
  const ids = SKILLS.map((s) => s.id)
  return [...shuffle(ids), ...shuffle(ids)].slice(0, PLACEMENT_TOTAL)
}

/** Staircase difficulty: start mid (2), +1 on correct, -1 on wrong, clamped to 1..3. */
export function placementDifficulty(history: AnswerRecord[]): Difficulty {
  let d = 2
  for (const rec of history) {
    d = rec.correct ? Math.min(3, d + 1) : Math.max(1, d - 1)
  }
  return d as Difficulty
}

export interface PlacementSkillResult {
  skillId: SkillId
  asked: number
  correct: number
  maxCorrectDifficulty: number
  status: SkillStatus
  seedMastery: number
}

export function summarizePlacement(history: AnswerRecord[]): PlacementSkillResult[] {
  return SKILLS.map((s) => {
    const recs = history.filter((r) => r.question.skillId === s.id)
    const asked = recs.length
    const correct = recs.filter((r) => r.correct).length
    const maxCorrectDifficulty = Math.max(
      0,
      ...recs.filter((r) => r.correct).map((r) => r.question.difficulty),
    )
    let status: SkillStatus
    let seedMastery: number
    if (asked === 0) {
      status = 'not-started'
      seedMastery = 0
    } else if (correct === asked && maxCorrectDifficulty >= 2) {
      status = 'mastered'
      seedMastery = 82
    } else if (correct > 0) {
      status = 'developing'
      seedMastery = correct === asked ? 65 : 45
    } else {
      status = 'developing'
      seedMastery = 20
    }
    return { skillId: s.id, asked, correct, maxCorrectDifficulty, status, seedMastery }
  })
}

export function applyPlacement(p: Profile, results: PlacementSkillResult[]): Profile {
  const skillStats = { ...p.skillStats }
  for (const r of results) {
    if (r.asked === 0) continue
    skillStats[r.skillId] = {
      attempts: r.asked,
      correct: r.correct,
      mastery: r.seedMastery,
    }
  }
  return { ...p, placementDone: true, skillStats }
}

// ---------- daily practice ----------

export interface PlanItem {
  skill: SkillId
  difficulty: Difficulty
}

export function difficultyFor(mastery: number): Difficulty {
  return mastery < 35 ? 1 : mastery < 70 ? 2 : 3
}

/** Weighted plan: weaker skills appear more often. */
export function buildPracticePlan(p: Profile, count = PRACTICE_TOTAL): PlanItem[] {
  const weighted = SKILLS.map((s) => {
    const mastery = getStat(p, s.id).mastery
    return { id: s.id, mastery, w: Math.max(10, 115 - mastery) }
  })
  const totalW = weighted.reduce((acc, x) => acc + x.w, 0)
  const plan: PlanItem[] = []
  for (let i = 0; i < count; i++) {
    let roll = Math.random() * totalW
    let chosen = weighted[weighted.length - 1]
    for (const x of weighted) {
      roll -= x.w
      if (roll <= 0) {
        chosen = x
        break
      }
    }
    plan.push({ skill: chosen.id, difficulty: difficultyFor(chosen.mastery) })
  }
  // Avoid the same skill 3+ times in a row — swap with a later item when possible.
  for (let i = 2; i < plan.length; i++) {
    if (plan[i].skill === plan[i - 1].skill && plan[i].skill === plan[i - 2].skill) {
      const j = plan.findIndex((x, k) => k > i && x.skill !== plan[i].skill)
      if (j > 0) [plan[i], plan[j]] = [plan[j], plan[i]]
    }
  }
  return plan
}
