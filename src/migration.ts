import type { AppState, Grade, Profile, SkillState, ThemeId, V1Profile } from './types'
import type { SkillId } from './skills'

export const SCHEMA_VERSION = 2 as const

export function themeForGrade(grade: Grade): ThemeId {
  if (grade === '3' || grade === '4') return 'playful'
  // CURR-1: the middle grades (5–8) get the same age-appropriate theme as 6.
  if (grade === '5' || grade === '6' || grade === '7' || grade === '8') return 'cool'
  return 'clean'
}

export function emptyProfile(id: string, name: string, grade: Grade): Profile {
  return {
    id,
    name,
    grade,
    pin: '',
    theme: themeForGrade(grade),
    skills: {},
    missions: {},
    streaks: { current: 0, best: 0, lastActiveDate: '' },
    createdAt: new Date().toISOString(),
    placementDone: false,
    totals: { questionsAnswered: 0, correct: 0, bestStreak: 0, sessions: 0 },
  }
}

/** The five students. p1 is the existing 3rd grader; names are placeholders Dad renames. */
export const PROFILE_SEEDS: { id: string; name: string; grade: Grade }[] = [
  { id: 'p1', name: '3rd Grader', grade: '3' },
  { id: 'p2', name: '4th Grader', grade: '4' },
  { id: 'p3', name: '6th Grader', grade: '6' },
  { id: 'p4', name: 'Sophomore', grade: '10' },
  { id: 'p5', name: 'Senior', grade: '12' },
]

export function defaultAppState(): AppState {
  const profiles: Record<string, Profile> = {}
  for (const seed of PROFILE_SEEDS) {
    profiles[seed.id] = emptyProfile(seed.id, seed.name, seed.grade)
  }
  return { schemaVersion: SCHEMA_VERSION, profiles, activeProfileId: null, parentPin: '' }
}

function isV1Profile(v: unknown): v is V1Profile {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    p.version === 1 &&
    typeof p.name === 'string' &&
    typeof p.createdAt === 'string' &&
    typeof p.placementDone === 'boolean' &&
    typeof p.skillStats === 'object' &&
    p.skillStats !== null &&
    typeof p.totals === 'object' &&
    p.totals !== null
  )
}

/**
 * v1 (single profile) → v2 (five profiles).
 * The 3rd grader's data lands in profiles.p1 UNTOUCHED: every skill's
 * attempts/correct/mastery are copied verbatim, plus name, createdAt,
 * placementDone, totals and lastPracticeDate.
 * Returns null if the input is not a valid v1 profile (caller falls back safely).
 */
export function migrateV1ToV2(v1: unknown): AppState | null {
  if (!isV1Profile(v1)) return null
  const state = defaultAppState()

  const skills: Partial<Record<SkillId, SkillState>> = {}
  for (const [skillId, stat] of Object.entries(v1.skillStats)) {
    if (!stat) continue
    skills[skillId as SkillId] = {
      attempts: stat.attempts,
      correct: stat.correct,
      mastery: stat.mastery,
      ...(v1.lastPracticeDate ? { lastSeen: v1.lastPracticeDate } : {}),
    }
  }

  state.profiles.p1 = {
    ...state.profiles.p1,
    name: v1.name,
    createdAt: v1.createdAt,
    skills,
    placementDone: v1.placementDone,
    totals: { ...v1.totals },
    ...(v1.lastPracticeDate ? { lastPracticeDate: v1.lastPracticeDate } : {}),
    streaks: {
      current: 0,
      best: v1.totals.bestStreak,
      lastActiveDate: v1.lastPracticeDate ?? '',
    },
  }
  return state
}

export function isAppState(v: unknown): v is AppState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    s.schemaVersion === SCHEMA_VERSION &&
    typeof s.profiles === 'object' &&
    s.profiles !== null &&
    typeof s.parentPin === 'string' &&
    Object.values(s.profiles as Record<string, unknown>).every(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Profile).name === 'string' &&
        typeof (p as Profile).skills === 'object',
    )
  )
}
